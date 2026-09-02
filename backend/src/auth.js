import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env.JWT_SECRET || "development-secret-change-me";

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(hash, password) {
  return bcrypt.compare(password, hash);
}

export function issueToken(user) {
  return jwt.sign(
    {
      sub: String(user.user_id),
      role: user.role,
      email: user.email
    },
    SECRET,
    { expiresIn: "2h" }
  );
}

export function issueFarmerToken(farmerId) {
  return jwt.sign(
    {
      role: "FARMER",
      farmerId: Number(farmerId),
      sub: String(farmerId)
    },
    SECRET,
    { expiresIn: "8h" }
  );
}

export function issueAdminToken(adminId) {
  return jwt.sign(
    {
      role: "ADMIN",
      adminId: Number(adminId),
      sub: String(adminId)
    },
    SECRET,
    { expiresIn: "8h" }
  );
}

function read(req) {
  const token =
    req.cookies?.sp_token ||
    req.cookies?.sp_phase4_token ||
    req.cookies?.sp_phase3_token;

  if (!token) return null;

  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const payload = read(req);

  if (!payload) {
    return res.status(401).json({
      message: "Authentication required."
    });
  }

  req.auth = payload;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({
        message: "You do not have permission to access this resource."
      });
    }

    next();
  };
}

export function requireFarmer(req, res, next) {
  const payload = read(req);

  if (!payload || payload.role !== "FARMER") {
    return res.status(401).json({
      message: "Farmer authentication required."
    });
  }

  /*
   * Normal login token stores the user ID in `sub`.
   * Farmer-specific tokens may store it in `farmerId`.
   */
  req.farmerId = Number(
    payload.farmerId ?? payload.sub
  );

  req.auth = payload;

  if (!Number.isInteger(req.farmerId) || req.farmerId <= 0) {
    return res.status(401).json({
      message: "Invalid farmer authentication."
    });
  }

  next();
}

export function requireAdmin(req, res, next) {
  const payload = read(req);

  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({
      message: "Administrator access required."
    });
  }

  req.adminId = Number(
    payload.adminId ?? payload.sub
  );

  req.auth = payload;

  if (!Number.isInteger(req.adminId) || req.adminId <= 0) {
    return res.status(403).json({
      message: "Invalid administrator authentication."
    });
  }

  next();
}