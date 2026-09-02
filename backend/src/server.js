import farmerAiRoutes from "./routes/farmer.ai.routes.js";
import adminAiRoutes from "./routes/admin.ai.routes.js";
import farmerActivityRoutes from "./routes/farmer.activity.routes.js";
import adminQueueRoutes from "./routes/admin.queue.routes.js";
import queueRoutes from "./routes/queue.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

import db from "./db.js";

import {
  issueFarmerToken,
  issueAdminToken,
  issueToken,
  requireAuth,
  requireFarmer,
  requireAdmin,
  hashPassword,
  verifyPassword
} from "./auth.js";

import {
  profileSchema,
  cropSchema
} from "./validation.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN ||
      "http://localhost:5173",
    credentials: true
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use("/api/farmer/bookings", bookingRoutes);
app.use("/api/farmer/queue", queueRoutes);
app.use("/api/admin/queue", adminQueueRoutes);
app.use("/api/farmer/activity", farmerActivityRoutes);
app.use("/api/admin/ai", adminAiRoutes);
app.use("/api/farmer/ai", farmerAiRoutes);
// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    phase: 4
  });
});

// ============================================================
// HELPERS
// ============================================================

function publicUser(user) {
  return {
    user_id: user.user_id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    is_active: Boolean(user.is_active)
  };
}

function setAuthCookie(res, token) {
  res.cookie("sp_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production",
    maxAge: 2 * 60 * 60 * 1000,
    path: "/"
  });
}

function getFarmer(id) {
  return db
    .prepare(
      "SELECT * FROM farmers WHERE farmer_id=?"
    )
    .get(id);
}

function getFarmerByUserId(userId) {
  return db
    .prepare(
      "SELECT * FROM farmers WHERE user_id=?"
    )
    .get(userId);
}

function serializeFarmer(farmer) {
  if (!farmer) return null;

  return {
    farmerId: farmer.farmer_id,
    userId: farmer.user_id ?? null,
    name: farmer.name,
    mobile: farmer.mobile,
    email: farmer.email || "",
    location: farmer.location || "",
    district: farmer.district || "",
    village: farmer.village || "",
    preferredLanguage:
      farmer.preferred_language || "en"
  };
}

function serializeCrop(crop) {
  return {
    cropId: crop.crop_id,
    farmerId: crop.farmer_id,
    cropName: crop.crop_name,
    cropVariety: crop.crop_variety,
    quantityKg: crop.quantity_kg,
    harvestDate: crop.harvest_date,
    expectedProcurementDate:
      crop.expected_procurement_date,
    location: crop.location,
    createdAt: crop.created_at
  };
}

// ============================================================
// AUTH SCHEMAS
// ============================================================

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
});

const loginSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
});

// ============================================================
// AUTH - SIGNUP
// ============================================================

app.post(
  "/api/auth/signup",
  async (req, res, next) => {
    try {
      const parsed =
        signupSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message:
            "Please check the form fields.",
          issues:
            parsed.error.flatten()
              .fieldErrors
        });
      }

      const {
        name,
        mobile
      } = parsed.data;

      // Farmers do not need an email address or password.
      // Keep an internal unique email/password value because the
      // existing database columns require them; they are never used
      // as farmer login credentials.
      const normalizedEmail =
        `farmer.${mobile}@smartprocure.local`;

      const existing = db
        .prepare(
          `SELECT user_id
           FROM users
           WHERE email=? OR mobile=?`
        )
        .get(
          normalizedEmail,
          mobile
        );

      if (existing) {
        return res.status(409).json({
          message:
            "A farmer account with this mobile number already exists."
        });
      }

      const hash =
        await hashPassword(`farmer-${mobile}-${name.trim().toLowerCase()}`);

      const transaction =
        db.transaction(() => {
          const result =
            db.prepare(
              `INSERT INTO users
               (name,mobile,email,password_hash,role)
               VALUES(?,?,?,?, 'FARMER')`
            ).run(
              name,
              mobile,
              normalizedEmail,
              hash
            );

          db.prepare(
            `INSERT INTO farmers
             (user_id,name,mobile,email,
              location,district,village,
              preferred_language)
             VALUES(?,?,?,?,?,?,?,?)`
          ).run(
            result.lastInsertRowid,
            name,
            mobile,
            normalizedEmail,
            "",
            "",
            "",
            "en"
          );

          return result.lastInsertRowid;
        });

      const user = db
        .prepare(
          "SELECT * FROM users WHERE user_id=?"
        )
        .get(transaction());

      const farmer =
        getFarmerByUserId(user.user_id);

      setAuthCookie(
        res,
        issueFarmerToken(
          getFarmerByUserId(user.user_id).farmer_id
        )
      );

      res.status(201).json({
        user: publicUser(user),
        farmer:
          serializeFarmer(farmer)
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// AUTH - LOGIN
// ============================================================

app.post(
  "/api/auth/login",
  async (req, res, next) => {
    try {
      const parsed =
        loginSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message:
            "Enter your registered farmer name and 10-digit mobile number."
        });
      }

      const {
        name,
        mobile
      } = parsed.data;

      // Farmer login is intentionally simple: registered mobile number
      // + farmer name. Admin authentication remains separate.
      const user = db
        .prepare(
          `SELECT *
           FROM users
           WHERE mobile=?
             AND role='FARMER'`
        )
        .get(mobile);

      if (!user || !user.is_active || user.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
        return res.status(401).json({
          message:
            "Name and mobile number do not match a registered farmer account."
        });
      }

      setAuthCookie(
        res,
        issueFarmerToken(
          getFarmerByUserId(user.user_id).farmer_id
        )
      );

      const payload = {
        user: publicUser(user)
      };

      if (user.role === "FARMER") {
        payload.farmer =
          serializeFarmer(
            getFarmerByUserId(
              user.user_id
            )
          );
      }

      if (user.role === "ADMIN") {
        payload.admin = db
          .prepare(
            `SELECT *
             FROM admins
             WHERE user_id=? OR email=?`
          )
          .get(
            user.user_id,
            user.email
          );
      }

      res.json(payload);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// AUTH - LOGOUT
// ============================================================

app.post(
  "/api/auth/logout",
  (_, res) => {
    res.clearCookie(
      "sp_token",
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/"
      }
    );

    res.clearCookie(
      "sp_phase4_token"
    );

    res.clearCookie(
      "sp_phase3_token"
    );

    res.json({
      message:
        "Logged out successfully."
    });
  }
);

// ============================================================
// AUTH - CURRENT USER
// ============================================================

app.get(
  "/api/auth/me",
  requireAuth,
  (req, res) => {
    const user = db
      .prepare(
        "SELECT * FROM users WHERE user_id=?"
      )
      .get(req.auth.sub);

    if (!user || !user.is_active) {
      return res.status(401).json({
        message:
          "Account unavailable."
      });
    }

    const result = {
      user: publicUser(user)
    };

    if (user.role === "FARMER") {
      result.farmer =
        serializeFarmer(
          getFarmerByUserId(
            user.user_id
          )
        );
    }

    if (user.role === "ADMIN") {
      result.admin = db
        .prepare(
          `SELECT *
           FROM admins
           WHERE user_id=? OR email=?`
        )
        .get(
          user.user_id,
          user.email
        );
    }

    res.json(result);
  }
);

// ============================================================
// PASSWORD RESET PLACEHOLDER
// ============================================================

app.post(
  "/api/auth/forgot-password",
  (req, res) => {
    res.json({
      message:
        "If an account exists, password-reset instructions will be sent through the configured recovery channel."
    });
  }
);

// ============================================================
// DEMO FARMER LOGIN
// ============================================================

app.post(
  "/api/demo/farmer-login",
  (req, res, next) => {
    try {
      const parsed =
        profileSchema.safeParse(
          req.body?.farmer
        );

      if (!parsed.success) {
        return res.status(400).json({
          message:
            "Invalid farmer details."
        });
      }

      const farmerData =
        parsed.data;

      let farmer = db
        .prepare(
          "SELECT * FROM farmers WHERE mobile=?"
        )
        .get(
          farmerData.mobile
        );

      if (!farmer) {
        const result =
          db.prepare(
            `INSERT INTO farmers
             (name,mobile,email,location,
              district,village,preferred_language)
             VALUES(?,?,?,?,?,?,?)`
          ).run(
            farmerData.name,
            farmerData.mobile,
            farmerData.email || "",
            farmerData.location,
            farmerData.district,
            farmerData.village,
            farmerData.preferredLanguage
          );

        farmer =
          getFarmer(
            result.lastInsertRowid
          );
      }

      let token =
        issueFarmerToken(
          farmer.farmer_id
        );

      const linkedUser =
        db.prepare(
          "SELECT * FROM users WHERE mobile=?"
        ).get(
          farmer.mobile
        );

      if (linkedUser) {
        token =
          issueToken(
            linkedUser
          );
      }

      res.cookie(
        "sp_phase4_token",
        token,
        {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          maxAge:
            8 * 60 * 60 * 1000,
          path: "/"
        }
      );

      res.json({
        farmer:
          serializeFarmer(
            farmer
          )
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// DEMO ADMIN LOGIN
// ============================================================

app.post(
  "/api/demo/admin-login",
  (req, res) => {
    const email = String(
      req.body?.email ||
        "admin@smartprocure.local"
    );

    const admin =
      db.prepare(
        "SELECT * FROM admins WHERE email=?"
      ).get(email);

    if (!admin) {
      return res.status(401).json({
        message:
          "Admin account not found."
      });
    }

    const token =
      issueAdminToken(
        admin.admin_id
      );

    res.cookie(
      "sp_phase4_token",
      token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge:
          8 * 60 * 60 * 1000,
        path: "/"
      }
    );

    res.json({
      admin: {
        adminId:
          admin.admin_id,
        name: admin.name,
        email: admin.email
      }
    });
  }
);

// ============================================================
// FARMER PROFILE
// ============================================================

app.get(
  "/api/farmer/me",
  requireFarmer,
  (req, res) => {
    const farmer =
      getFarmer(
        req.farmerId
      );

    if (!farmer) {
      return res.status(404).json({
        message:
          "Farmer not found."
      });
    }

    res.json({
      farmer:
        serializeFarmer(
          farmer
        )
    });
  }
);

app.get(
  "/api/farmer/profile",
  requireFarmer,
  (req, res) => {
    const farmer =
      getFarmer(
        req.farmerId
      );

    if (!farmer) {
      return res.status(404).json({
        message:
          "Farmer not found."
      });
    }

    res.json({
      farmer:
        serializeFarmer(
          farmer
        )
    });
  }
);

app.put(
  "/api/farmer/profile",
  requireFarmer,
  (req, res, next) => {
    try {
      const parsed =
        profileSchema.safeParse(
          req.body
        );

      if (!parsed.success) {
        return res.status(400).json({
          message:
            "Please check the profile fields."
        });
      }

      const profile =
        parsed.data;

      db.prepare(
        `UPDATE farmers
         SET name=?,
             mobile=?,
             email=?,
             location=?,
             district=?,
             village=?,
             preferred_language=?,
             updated_at=CURRENT_TIMESTAMP
         WHERE farmer_id=?`
      ).run(
        profile.name,
        profile.mobile,
        profile.email || "",
        profile.location,
        profile.district,
        profile.village,
        profile.preferredLanguage,
        req.farmerId
      );

      res.json({
        farmer:
          serializeFarmer(
            getFarmer(
              req.farmerId
            )
          )
      });
    } catch (error) {
      if (
        String(error.message)
          .includes("UNIQUE")
      ) {
        return res.status(409).json({
          message:
            "That mobile number is already in use."
        });
      }

      next(error);
    }
  }
);

// ============================================================
// FARMER CROP TYPES
// ============================================================

app.get(
  "/api/farmer/crop-types",
  requireFarmer,
  (req, res) => {
    const cropTypes = db.prepare(`
      SELECT id, name
      FROM crop_types
      WHERE active=1
      ORDER BY name ASC
    `).all();

    res.json({ cropTypes });
  }
);

// ============================================================
// FARMER CROPS
// ============================================================

app.get(
  "/api/farmer/crops",
  requireFarmer,
  (req, res) => {
    const crops =
      db.prepare(
        `SELECT *
         FROM crops
         WHERE farmer_id=?
         ORDER BY created_at DESC`
      )
        .all(req.farmerId)
        .map(
          serializeCrop
        );

    res.json({ crops });
  }
);

app.get(
  "/api/farmer/crops/:id",
  requireFarmer,
  (req, res) => {
    const crop =
      db.prepare(
        `SELECT *
         FROM crops
         WHERE crop_id=?
           AND farmer_id=?`
      ).get(
        Number(
          req.params.id
        ),
        req.farmerId
      );

    if (!crop) {
      return res.status(404).json({
        message:
          "Crop not found."
      });
    }

    res.json({
      crop:
        serializeCrop(crop)
    });
  }
);

app.post(
  "/api/farmer/crops",
  requireFarmer,
  (req, res, next) => {
    try {
      const parsed =
        cropSchema.safeParse({
          ...req.body,

          quantityKg:
            typeof
              req.body?.quantityKg ===
            "string"
              ? Number(
                  req.body.quantityKg
                )
              : req.body?.quantityKg
        });

      if (!parsed.success) {
        return res.status(400).json({
          message:
            "Please complete the crop details."
        });
      }

      const crop =
        parsed.data;

      const result =
        db.prepare(
          `INSERT INTO crops
           (farmer_id,crop_name,crop_variety,
            quantity_kg,harvest_date,
            expected_procurement_date,location)
           VALUES(?,?,?,?,?,?,?)`
        ).run(
          req.farmerId,
          crop.cropName,
          crop.cropVariety,
          crop.quantityKg,
          crop.harvestDate,
          crop.expectedProcurementDate,
          crop.location
        );

      const saved =
        db.prepare(
          "SELECT * FROM crops WHERE crop_id=?"
        ).get(
          result.lastInsertRowid
        );

      res.status(201).json({
        crop:
          serializeCrop(
            saved
          )
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// FARMER CENTRES
// ============================================================

app.get(
  "/api/farmer/centres",
  requireFarmer,
  (req, res, next) => {
    try {
      const village = String(req.query?.village || "").trim().toLowerCase();
      const district = String(req.query?.district || "").trim().toLowerCase();
      const requestedDate = String(req.query?.date || new Date().toISOString().slice(0, 10)).trim();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD format." });
      }

      const centres = db.prepare(`
        SELECT id, name, code, location, district, village, address,
               contact_number, capacity_per_day, current_load, status,
               opening_time, closing_time
        FROM procurement_centres
        WHERE status='ACTIVE'
        ORDER BY name ASC
      `).all();

      // Give every active centre usable slots for a requested date. Admin-created
      // slots are never overwritten; demo/default slots are only generated when
      // that centre has no slots for the selected date.
      const ensureSlots = db.transaction(() => {
        for (const centre of centres) {
          const existing = db.prepare(`SELECT COUNT(*) AS c FROM centre_slots WHERE centre_id=? AND slot_date=?`).get(centre.id, requestedDate).c;
          if (Number(existing) > 0) continue;

          const start = String(centre.opening_time || "08:00").slice(0,5);
          const end = String(centre.closing_time || "18:00").slice(0,5);
          const toMinutes = value => {
            const [h,m] = value.split(":").map(Number);
            return h * 60 + m;
          };
          const toTime = minutes => `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
          let cursor = toMinutes(start);
          const finish = toMinutes(end);
          while (cursor + 60 <= finish) {
            const slotStart = toTime(cursor);
            const slotEnd = toTime(cursor + 60);
            db.prepare(`INSERT OR IGNORE INTO centre_slots (centre_id,slot_date,start_time,end_time,capacity,booked_count,status) VALUES (?,?,?,?,10,0,'AVAILABLE')`).run(centre.id, requestedDate, slotStart, slotEnd);
            cursor += 60;
          }
        }
      });
      ensureSlots();

      const result = centres.map(centre => {
        const text = `${centre.name} ${centre.location} ${centre.village} ${centre.district}`.toLowerCase();
        let proximityScore = 0;
        let proximityLabel = "Available nearby";
        if (village && (centre.village.toLowerCase() === village || text.includes(village))) {
          proximityScore = 100;
          proximityLabel = "Village match";
        } else if (district && (centre.district.toLowerCase() === district || text.includes(district))) {
          proximityScore = 70;
          proximityLabel = "District match";
        } else if (village && centre.location.toLowerCase().includes(village.split(/\s+/)[0])) {
          proximityScore = 60;
          proximityLabel = "Location match";
        } else {
          proximityScore = 30;
        }

        const queue = db.prepare(`
          SELECT COUNT(*) AS count
          FROM queues
          WHERE centre_id=? AND queue_date=?
            AND status IN ('WAITING','CALLED','CHECKED_IN','VERIFIED','PROCESSING')
        `).get(centre.id, requestedDate);

        const slot = db.prepare(`
          SELECT COALESCE(SUM(capacity - booked_count),0) AS available
          FROM centre_slots
          WHERE centre_id=? AND slot_date=? AND status='AVAILABLE' AND booked_count < capacity
        `).get(centre.id, requestedDate);

        return {
          ...centre,
          queue_count: Number(queue.count || 0),
          available_slots: Number(slot.available || 0),
          proximity_score: proximityScore,
          proximity_label: proximityLabel
        };
      });

      result.sort((a,b) => b.proximity_score - a.proximity_score || a.queue_count - b.queue_count || a.name.localeCompare(b.name));
      res.json({ centres: result, date: requestedDate });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// ADMIN DASHBOARD
// ============================================================

app.get(
  "/api/admin/dashboard",
  requireAdmin,
  (req, res) => {
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    res.json({
      metrics: {
        farmers:
          db.prepare(
            "SELECT COUNT(*) c FROM farmers"
          ).get().c,

        crops:
          db.prepare(
            "SELECT COUNT(*) c FROM crops"
          ).get().c,

        todayProcurement:
          db.prepare(
            `SELECT COUNT(*) c
             FROM procurements
             WHERE procurement_date=?`
          ).get(today).c,

        activeCentres:
          db.prepare(
            `SELECT COUNT(*) c
             FROM procurement_centres
             WHERE status='ACTIVE'`
          ).get().c,

        queue:
          db.prepare(
            `SELECT COUNT(*) c
             FROM queues
             WHERE queue_date=?
             AND status IN
             ('WAITING','CALLED','PROCESSING')`
          ).get(today).c,

        pendingPayments:
          db.prepare(
            `SELECT COUNT(*) c
             FROM payments
             WHERE status='PENDING'`
          ).get().c,

        completed:
          db.prepare(
            `SELECT COUNT(*) c
             FROM procurements
             WHERE status='COMPLETED'`
          ).get().c
      },

      recent:
        db.prepare(
          `SELECT
             p.procurement_number,
             f.name farmer,
             c.crop_name crop,
             p.net_weight,
             p.total_amount,
             p.status,
             pc.name centre
           FROM procurements p
           JOIN farmers f
             ON f.farmer_id=p.farmer_id
           JOIN crops c
             ON c.crop_id=p.crop_id
           JOIN procurement_centres pc
             ON pc.id=p.centre_id
           ORDER BY p.created_at DESC
           LIMIT 8`
        ).all()
    });
  }
);

// ============================================================
// ADMIN CENTRES
// ============================================================

app.get(
  "/api/admin/centres",
  requireAdmin,
  (req, res) => {
    res.json({
      centres:
        db.prepare(
          `SELECT *
           FROM procurement_centres
           ORDER BY name`
        ).all()
    });
  }
);

app.post(
  "/api/admin/centres",
  requireAdmin,
  (req, res, next) => {
    try {
      const x =
        req.body || {};

      if (
        !x.name ||
        !x.code ||
        !x.location ||
        !Number(
          x.capacityPerDay
        ) ||
        Number(
          x.capacityPerDay
        ) <= 0
      ) {
        return res.status(400).json({
          message:
            "Name, code, location and positive capacity are required."
        });
      }

      const result =
        db.prepare(
          `INSERT INTO procurement_centres
           (name,code,location,district,village,
            address,contact_number,capacity_per_day,
            status,opening_time,closing_time)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
          x.name,
          x.code,
          x.location,
          x.district || "",
          x.village || "",
          x.address || "",
          x.contactNumber || "",
          Number(
            x.capacityPerDay
          ),
          x.status ||
            "ACTIVE",
          x.openingTime ||
            "08:00",
          x.closingTime ||
            "18:00"
        );

      res.status(201).json({
        centre:
          db.prepare(
            `SELECT *
             FROM procurement_centres
             WHERE id=?`
          ).get(
            result.lastInsertRowid
          )
      });
    } catch (error) {
      if (
        String(error.message)
          .includes("UNIQUE")
      ) {
        return res.status(409).json({
          message:
            "Centre code already exists."
        });
      }

      next(error);
    }
  }
);

app.put(
  "/api/admin/centres/:id",
  requireAdmin,
  (req, res, next) => {
    try {
      const x =
        req.body || {};

      db.prepare(
        `UPDATE procurement_centres
         SET name=?,
             location=?,
             district=?,
             village=?,
             address=?,
             contact_number=?,
             capacity_per_day=?,
             status=?,
             opening_time=?,
             closing_time=?,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=?`
      ).run(
        x.name,
        x.location,
        x.district || "",
        x.village || "",
        x.address || "",
        x.contactNumber || "",
        Number(
          x.capacityPerDay
        ),
        x.status ||
          "ACTIVE",
        x.openingTime ||
          "08:00",
        x.closingTime ||
          "18:00",
        Number(
          req.params.id
        )
      );

      res.json({
        centre:
          db.prepare(
            `SELECT *
             FROM procurement_centres
             WHERE id=?`
          ).get(
            Number(
              req.params.id
            )
          )
      });
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  "/api/admin/centres/:id/status",
  requireAdmin,
  (req, res) => {
    const status =
      String(
        req.body?.status || ""
      );

    if (
      ![
        "ACTIVE",
        "INACTIVE",
        "MAINTENANCE",
        "FULL"
      ].includes(status)
    ) {
      return res.status(400).json({
        message:
          "Invalid centre status."
      });
    }

    db.prepare(
      `UPDATE procurement_centres
       SET status=?,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).run(
      status,
      Number(
        req.params.id
      )
    );

    res.json({
      ok: true
    });
  }
);

app.patch(
  "/api/admin/centres/:id/capacity",
  requireAdmin,
  (req, res) => {
    const capacity =
      Number(
        req.body?.capacityPerDay
      );

    if (!(capacity > 0)) {
      return res.status(400).json({
        message:
          "Capacity must be positive."
      });
    }

    db.prepare(
      `UPDATE procurement_centres
       SET capacity_per_day=?,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).run(
      capacity,
      Number(
        req.params.id
      )
    );

    res.json({
      ok: true
    });
  }
);

// ============================================================
// ADMIN CROP TYPES
// ============================================================

app.get(
  "/api/admin/crop-types",
  requireAdmin,
  (req, res) => {
    res.json({
      cropTypes:
        db.prepare(
          `SELECT *
           FROM crop_types
           ORDER BY name`
        ).all()
    });
  }
);

app.post(
  "/api/admin/crop-types",
  requireAdmin,
  (req, res, next) => {
    try {
      const name =
        String(
          req.body?.name || ""
        ).trim();

      if (!name) {
        return res.status(400).json({
          message:
            "Crop type name is required."
        });
      }

      const result =
        db.prepare(
          "INSERT INTO crop_types(name) VALUES(?)"
        ).run(name);

      res.status(201).json({
        cropType:
          db.prepare(
            `SELECT *
             FROM crop_types
             WHERE id=?`
          ).get(
            result.lastInsertRowid
          )
      });
    } catch (error) {
      if (
        String(error.message)
          .includes("UNIQUE")
      ) {
        return res.status(409).json({
          message:
            "Crop type already exists."
        });
      }

      next(error);
    }
  }
);

app.patch(
  "/api/admin/crop-types/:id/status",
  requireAdmin,
  (req, res) => {
    db.prepare(
      `UPDATE crop_types
       SET active=?,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).run(
      req.body?.active ? 1 : 0,
      Number(
        req.params.id
      )
    );

    res.json({
      ok: true
    });
  }
);

// ============================================================
// ADMIN FARMERS
// ============================================================

app.get(
  "/api/admin/farmers",
  requireAdmin,
  (req, res) => {
    res.json({
      farmers:
        db.prepare(
          `SELECT
             f.*,
             COUNT(DISTINCT c.crop_id) crops,
             COUNT(DISTINCT p.id) procurements
           FROM farmers f
           LEFT JOIN crops c
             ON c.farmer_id=f.farmer_id
           LEFT JOIN procurements p
             ON p.farmer_id=f.farmer_id
           GROUP BY f.farmer_id
           ORDER BY f.created_at DESC`
        ).all()
    });
  }
);

app.get(
  "/api/admin/farmers/:id/crops",
  requireAdmin,
  (req, res) => {
    res.json({
      crops:
        db.prepare(
          `SELECT *
           FROM crops
           WHERE farmer_id=?
           ORDER BY created_at DESC`
        ).all(
          Number(
            req.params.id
          )
        )
    });
  }
);

// ============================================================
// ADMIN PROCUREMENTS
// ============================================================

app.get(
  "/api/admin/procurements",
  requireAdmin,
  (req, res) => {
    res.json({
      procurements:
        db.prepare(
          `SELECT
             p.*,
             f.name farmer,
             c.crop_name crop,
             c.crop_variety variety,
             c.expected_procurement_date farmer_expected_procurement_date,
             pc.name centre,
             pa.status payment_status,
             q.position queue_position,
             qa.grade quality_grade
           FROM procurements p
           JOIN farmers f
             ON f.farmer_id=p.farmer_id
           JOIN crops c
             ON c.crop_id=p.crop_id
           JOIN procurement_centres pc
             ON pc.id=p.centre_id
           LEFT JOIN payments pa
             ON pa.procurement_id=p.id
           LEFT JOIN queues q
             ON q.procurement_id=p.id
           LEFT JOIN quality_assessments qa
             ON qa.procurement_id=p.id
           ORDER BY p.created_at DESC`
        ).all()
    });
  }
);

// ============================================================
// ADMIN QUEUE
// ============================================================

app.get(
  "/api/admin/queue",
  requireAdmin,
  (req, res) => {
    res.json({
      queue:
        db.prepare(
          `SELECT
             q.*,
             pc.name centre,
             f.name farmer,
             c.crop_name crop,
             p.status procurement_status,
             qa.decision quality_decision,
             qa.grade quality_grade
           FROM queues q
           JOIN procurement_centres pc
             ON pc.id=q.centre_id
           JOIN farmers f
             ON f.farmer_id=q.farmer_id
           JOIN crops c
             ON c.crop_id=q.crop_id
           LEFT JOIN procurements p
             ON p.id=q.procurement_id
           LEFT JOIN quality_assessments qa
             ON qa.procurement_id=p.id
           ORDER BY q.queue_date DESC,
                    q.position ASC`
        ).all()
    });
  }
);

// ============================================================
// ADMIN PRICES
// ============================================================

app.get(
  "/api/admin/prices",
  requireAdmin,
  (req, res) => {
    res.json({
      prices:
        db.prepare(
          `SELECT
             cp.*,
             ct.name crop
           FROM crop_prices cp
           JOIN crop_types ct
             ON ct.id=cp.crop_type_id
           ORDER BY cp.active DESC,
                    cp.effective_from DESC`
        ).all()
    });
  }
);

app.post(
  "/api/admin/prices",
  requireAdmin,
  (req, res, next) => {
    try {
      const x =
        req.body || {};

      const price =
        Number(
          x.pricePerKg
        );

      if (
        !Number(
          x.cropTypeId
        ) ||
        price < 0 ||
        !x.effectiveFrom
      ) {
        return res.status(400).json({
          message:
            "Crop, price and effective date are required."
        });
      }

      const result =
        db.prepare(
          `INSERT INTO crop_prices
           (crop_type_id,variety,price_per_kg,
            effective_from,effective_to,active,created_by)
           VALUES(?,?,?,?,?,?,?)`
        ).run(
          Number(
            x.cropTypeId
          ),
          x.variety || "",
          price,
          x.effectiveFrom,
          x.effectiveTo ||
            null,
          x.active === false
            ? 0
            : 1,
          req.adminId
        );

      res.status(201).json({
        price:
          db.prepare(
            `SELECT *
             FROM crop_prices
             WHERE id=?`
          ).get(
            result.lastInsertRowid
          )
      });
    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  "/api/admin/prices/:id/status",
  requireAdmin,
  (req, res) => {
    db.prepare(
      `UPDATE crop_prices
       SET active=?,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).run(
      req.body?.active ? 1 : 0,
      Number(
        req.params.id
      )
    );

    res.json({
      ok: true
    });
  }
);

// ============================================================
// ADMIN PAYMENTS
// ============================================================

app.get(
  "/api/admin/payments",
  requireAdmin,
  (req, res) => {
    res.json({
      payments:
        db.prepare(
          `SELECT
             pa.*,
             p.procurement_number,
             f.name farmer
           FROM payments pa
           JOIN procurements p
             ON p.id=pa.procurement_id
           JOIN farmers f
             ON f.farmer_id=pa.farmer_id
           ORDER BY pa.created_at DESC`
        ).all()
    });
  }
);

// ============================================================
// ADMIN CREATE PROCUREMENT
// ============================================================

app.post(
  "/api/admin/procurements",
  requireAdmin,
  (req, res, next) => {
    try {
      const x =
        req.body || {};

      const farmer =
        db.prepare(
          `SELECT *
           FROM farmers
           WHERE farmer_id=?`
        ).get(
          Number(
            x.farmerId
          )
        );

      const crop =
        db.prepare(
          `SELECT *
           FROM crops
           WHERE crop_id=?
             AND farmer_id=?`
        ).get(
          Number(
            x.cropId
          ),
          Number(
            x.farmerId
          )
        );

      const centre =
        db.prepare(
          `SELECT *
           FROM procurement_centres
           WHERE id=?`
        ).get(
          Number(
            x.centreId
          )
        );

      if (
        !farmer ||
        !crop ||
        !centre
      ) {
        return res.status(400).json({
          message:
            "Valid farmer, crop and centre are required."
        });
      }

      const gross =
        Number(
          x.grossWeight
        );

      const tare =
        Number(
          x.tareWeight || 0
        );

      const net =
        gross - tare;

      const price =
        Number(
          x.pricePerKg
        );

      if (
        !(gross > 0) ||
        tare < 0 ||
        !(net > 0) ||
        price < 0
      ) {
        return res.status(400).json({
          message:
            "Enter valid weights and price."
        });
      }

      const amount =
        Number(
          (
            net * price
          ).toFixed(2)
        );

      // The farmer's registered expected procurement date is the source of truth.
      const procurementDate = crop.expected_procurement_date;

      const transaction =
        db.transaction(
          () => {
            const count =
              db.prepare(
                "SELECT COUNT(*) c FROM procurements"
              ).get().c + 1;

            const procurementNumber =
              `PROC-${new Date().getFullYear()}-${String(
                count
              ).padStart(
                6,
                "0"
              )}`;

            const result =
              db.prepare(
                `INSERT INTO procurements
                 (procurement_number,farmer_id,crop_id,
                  centre_id,procurement_date,status,
                  gross_weight,tare_weight,net_weight,
                  price_per_kg,total_amount,created_by)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
              ).run(
                procurementNumber,
                farmer.farmer_id,
                crop.crop_id,
                centre.id,
                procurementDate,
                "COMPLETED",
                gross,
                tare,
                net,
                price,
                amount,
                req.adminId
              );

            const procurementId =
              result.lastInsertRowid;

            const token =
              db.prepare(
                `SELECT
                   COALESCE(
                     MAX(token_number),
                     0
                   ) + 1 n
                 FROM queues
                 WHERE centre_id=?
                   AND queue_date=?`
              ).get(
                centre.id,
                procurementDate
              ).n;

            db.prepare(
              `INSERT INTO queues
               (centre_id,farmer_id,crop_id,
                procurement_id,token_number,
                queue_date,position,
                estimated_wait_minutes,status)
               VALUES(?,?,?,?,?,?,?,?,?)`
            ).run(
              centre.id,
              farmer.farmer_id,
              crop.crop_id,
              procurementId,
              token,
              procurementDate,
              1,
              0,
              "COMPLETED"
            );

            if (x.grade) {
              db.prepare(
                `INSERT INTO quality_assessments
                 (procurement_id,grade,
                  moisture_percent,
                  foreign_matter_percent,
                  damaged_percent,
                  remarks,assessed_by)
                 VALUES(?,?,?,?,?,?,?)`
              ).run(
                procurementId,
                x.grade,
                x.moisturePercent ||
                  null,
                x.foreignMatterPercent ||
                  null,
                x.damagedPercent ||
                  null,
                x.remarks || "",
                req.adminId
              );
            }

            db.prepare(
              `INSERT INTO payments
               (procurement_id,farmer_id,amount,
                payment_method,status)
               VALUES(?,?,?,?,?)`
            ).run(
              procurementId,
              farmer.farmer_id,
              amount,
              x.paymentMethod ||
                "BANK_TRANSFER",
              x.paymentStatus ||
                "PENDING"
            );

            const receiptCount =
              db.prepare(
                "SELECT COUNT(*) c FROM receipts"
              ).get().c + 1;

            const receiptNumber =
              `REC-${new Date().getFullYear()}-${String(
                receiptCount
              ).padStart(
                6,
                "0"
              )}`;

            db.prepare(
              `INSERT INTO receipts
               (procurement_id,
                receipt_number,
                generated_by)
               VALUES(?,?,?)`
            ).run(
              procurementId,
              receiptNumber,
              req.adminId
            );

            return procurementId;
          }
        );

      const procurementId =
        transaction();

      res.status(201).json({
        procurement:
          db.prepare(
            `SELECT *
             FROM procurements
             WHERE id=?`
          ).get(
            procurementId
          )
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// ADMIN RECEIPT GENERATION
// ============================================================

app.post(
  "/api/admin/receipts/:id/generate",
  requireAdmin,
  (req, res, next) => {
    try {
      const procurementId =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          procurementId
        ) ||
        procurementId <= 0
      ) {
        return res.status(400).json({
          message:
            "Invalid procurement ID."
        });
      }

      const procurement =
        db.prepare(
          `SELECT *
           FROM procurements
           WHERE id=?`
        ).get(
          procurementId
        );

      if (!procurement) {
        return res.status(404).json({
          message:
            "Procurement not found."
        });
      }

      if (
        procurement.status !==
        "COMPLETED"
      ) {
        return res.status(409).json({
          message:
            "Procurement must be COMPLETED before generating a receipt."
        });
      }

      const existingReceipt =
        db.prepare(
          `SELECT *
           FROM receipts
           WHERE procurement_id=?`
        ).get(
          procurementId
        );

      if (existingReceipt) {
        return res.status(200).json({
          message:
            "Receipt already exists.",
          receipt:
            existingReceipt
        });
      }

      const receipt =
        db.transaction(
          () => {
            const receiptCount =
              db.prepare(
                "SELECT COUNT(*) c FROM receipts"
              ).get().c + 1;

            const receiptNumber =
              `REC-${new Date().getFullYear()}-${String(
                receiptCount
              ).padStart(
                6,
                "0"
              )}`;

            const result =
              db.prepare(
                `INSERT INTO receipts
                 (procurement_id,
                  receipt_number,
                  generated_by)
                 VALUES(?,?,?)`
              ).run(
                procurementId,
                receiptNumber,
                req.adminId
              );

            return db
              .prepare(
                `SELECT *
                 FROM receipts
                 WHERE id=?`
              )
              .get(
                result.lastInsertRowid
              );
          }
        )();

      res.status(201).json({
        message:
          "Receipt generated successfully.",
        receipt
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// FARMER RECEIPT
// ============================================================

app.get(
  "/api/procurements/:id/receipt",
  requireFarmer,
  (req, res, next) => {
    try {
      const receipt =
        db.prepare(
          `SELECT
             r.receipt_number,
             r.issued_at,
             p.procurement_number,
             p.procurement_date,
             p.net_weight,
             p.price_per_kg,
             p.total_amount,
             p.status,
             f.name farmer,
             f.farmer_id,
             c.crop_name,
             c.crop_variety,
             pc.name centre,
             pa.status payment_status
           FROM receipts r
           JOIN procurements p
             ON p.id=r.procurement_id
           JOIN farmers f
             ON f.farmer_id=p.farmer_id
           JOIN crops c
             ON c.crop_id=p.crop_id
           JOIN procurement_centres pc
             ON pc.id=p.centre_id
           LEFT JOIN payments pa
             ON pa.procurement_id=p.id
           WHERE r.procurement_id=?
             AND p.farmer_id=?`
        ).get(
          Number(
            req.params.id
          ),
          req.farmerId
        );

      if (!receipt) {
        return res.status(404).json({
          message:
            "Receipt not found."
        });
      }

      res.json({
        receipt
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// ADMIN RECEIPT
// ============================================================

app.get(
  "/api/admin/receipts/:id",
  requireAdmin,
  (req, res, next) => {
    try {
      const receipt =
        db.prepare(
          `SELECT
             r.*,
             p.procurement_number,
             p.procurement_date,
             p.net_weight,
             p.price_per_kg,
             p.total_amount,
             p.status procurement_status,
             f.name farmer,
             f.farmer_id,
             c.crop_name,
             c.crop_variety,
             pc.name centre,
             pa.status payment_status
           FROM receipts r
           JOIN procurements p
             ON p.id=r.procurement_id
           JOIN farmers f
             ON f.farmer_id=p.farmer_id
           JOIN crops c
             ON c.crop_id=p.crop_id
           JOIN procurement_centres pc
             ON pc.id=p.centre_id
           LEFT JOIN payments pa
             ON pa.procurement_id=p.id
           WHERE r.procurement_id=?`
        ).get(
          Number(
            req.params.id
          )
        );

      if (!receipt) {
        return res.status(404).json({
          message:
            "Receipt not found."
        });
      }

      res.json({
        receipt
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// 404 HANDLER
// ============================================================

app.use(
  (req, res) => {
    res.status(404).json({
      message:
        `Route not found: ${req.method} ${req.originalUrl}`
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (err, req, res, next) => {
    console.error(err);

    res.status(500).json({
      message:
        "Something went wrong on the server."
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Phase 4 API running at http://localhost:${PORT}`
    );
  }
);

export { app };