import { Router } from "express";
import db from "../db.js";
import { requireFarmer } from "../auth.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| ENSURE TIME SLOTS EXIST FOR A CENTRE + DATE
|--------------------------------------------------------------------------
| Slots are generated automatically the first time a farmer selects a
| procurement date. This keeps the farmer flow working even when the
| database has no pre-created slots for that date.
|--------------------------------------------------------------------------
*/
function ensureSlotsForDate(centre, date) {
  const existing = db.prepare(`
    SELECT COUNT(*) AS count
    FROM centre_slots
    WHERE centre_id = ?
      AND slot_date = ?
  `).get(centre.id, date);

  if (Number(existing?.count || 0) > 0) return;

  const toMinutes = (value, fallback) => {
    const raw = String(value || fallback).slice(0, 5);
    const [hours, minutes] = raw.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return fallback === "18:00" ? 1080 : 480;
    }
    return hours * 60 + minutes;
  };

  const toTime = minutes =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  const opening = toMinutes(centre.opening_time, "08:00");
  const closing = toMinutes(centre.closing_time, "18:00");

  if (closing <= opening) return;

  // One-hour appointment slots. Each slot can accept up to 10 farmers.
  const slotCapacity = 10;

  const createSlots = db.transaction(() => {
    for (
      let cursor = opening;
      cursor + 60 <= closing;
      cursor += 60
    ) {
      db.prepare(`
        INSERT OR IGNORE INTO centre_slots (
          centre_id,
          slot_date,
          start_time,
          end_time,
          capacity,
          booked_count,
          status
        )
        VALUES (?, ?, ?, ?, ?, 0, 'AVAILABLE')
      `).run(
        centre.id,
        date,
        toTime(cursor),
        toTime(cursor + 60),
        slotCapacity
      );
    }
  });

  createSlots();
}

/*
|--------------------------------------------------------------------------
| GET AVAILABLE SLOTS FOR A CENTRE
|--------------------------------------------------------------------------
|
| Optional query parameter:
|
| ?date=2026-09-05
|
| When date is supplied, only slots for that exact date are returned.
| When date is not supplied, the existing behavior is preserved and
| all available slots for the centre are returned.
|--------------------------------------------------------------------------
*/

router.get("/slots/:centreId", requireFarmer, (req, res) => {
  const centreId = Number(req.params.centreId);
  const requestedDate = String(
    req.query?.date || ""
  ).trim();

  if (
    !Number.isInteger(centreId) ||
    centreId <= 0
  ) {
    return res.status(400).json({
      message: "Invalid centre ID."
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Validate optional date format
  |--------------------------------------------------------------------------
  */

  if (
    requestedDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(
      requestedDate
    )
  ) {
    return res.status(400).json({
      message:
        "Invalid date. Use YYYY-MM-DD format."
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Verify active centre
  |--------------------------------------------------------------------------
  */

  const centre = db.prepare(`
    SELECT *
    FROM procurement_centres
    WHERE id = ?
      AND status = 'ACTIVE'
  `).get(centreId);

  if (!centre) {
    return res.status(404).json({
      message:
        "Active procurement centre not found."
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Generate the selected day's slots on demand
  |--------------------------------------------------------------------------
  */

  if (requestedDate) {
    ensureSlotsForDate(centre, requestedDate);
  }

  /*
  |--------------------------------------------------------------------------
  | Get available slots
  |--------------------------------------------------------------------------
  */

  const slots = requestedDate
    ? db.prepare(`
        SELECT
          slot_id,
          centre_id,
          slot_date,
          start_time,
          end_time,
          capacity,
          booked_count,
          status
        FROM centre_slots
        WHERE centre_id = ?
          AND slot_date = ?
          AND status = 'AVAILABLE'
          AND booked_count < capacity
        ORDER BY
          slot_date ASC,
          start_time ASC
      `).all(
        centreId,
        requestedDate
      )
    : db.prepare(`
        SELECT
          slot_id,
          centre_id,
          slot_date,
          start_time,
          end_time,
          capacity,
          booked_count,
          status
        FROM centre_slots
        WHERE centre_id = ?
          AND status = 'AVAILABLE'
          AND booked_count < capacity
        ORDER BY
          slot_date ASC,
          start_time ASC
      `).all(centreId);

  res.json({
    slots
  });
});

/*
|--------------------------------------------------------------------------
| GET FARMER BOOKINGS
|--------------------------------------------------------------------------
*/

router.get("/", requireFarmer, (req, res) => {
  const bookings = db.prepare(`
    SELECT
      b.booking_id,
      b.farmer_id,
      b.crop_id,
      b.centre_id,
      b.slot_id,
      b.booking_date,
      b.token_number,
      b.status,
      b.booking_source,
      b.recommendation_score,
      b.created_at,
      b.updated_at,

      c.name AS centre_name,
      c.code AS centre_code,

      cr.crop_name,
      cr.crop_variety,
      cr.quantity_kg,

      s.start_time,
      s.end_time

    FROM bookings b

    JOIN procurement_centres c
      ON c.id = b.centre_id

    JOIN crops cr
      ON cr.crop_id = b.crop_id

    JOIN centre_slots s
      ON s.slot_id = b.slot_id

    WHERE b.farmer_id = ?

    ORDER BY
      b.created_at DESC
  `).all(req.farmerId);

  res.json({
    bookings
  });
});

/*
|--------------------------------------------------------------------------
| GET SINGLE BOOKING
|--------------------------------------------------------------------------
*/

router.get("/:id", requireFarmer, (req, res) => {
  const bookingId = Number(req.params.id);

  if (
    !Number.isInteger(bookingId) ||
    bookingId <= 0
  ) {
    return res.status(400).json({
      message:
        "Invalid booking ID."
    });
  }

  const booking = db.prepare(`
    SELECT
      b.*,

      c.name AS centre_name,
      c.code AS centre_code,
      c.location AS centre_location,

      cr.crop_name,
      cr.crop_variety,
      cr.quantity_kg,

      s.slot_date,
      s.start_time,
      s.end_time,
      s.capacity,
      s.booked_count

    FROM bookings b

    JOIN procurement_centres c
      ON c.id = b.centre_id

    JOIN crops cr
      ON cr.crop_id = b.crop_id

    JOIN centre_slots s
      ON s.slot_id = b.slot_id

    WHERE b.booking_id = ?
      AND b.farmer_id = ?
  `).get(
    bookingId,
    req.farmerId
  );

  if (!booking) {
    return res.status(404).json({
      message:
        "Booking not found."
    });
  }

  res.json({
    booking
  });
});

/*
|--------------------------------------------------------------------------
| CREATE BOOKING + GENERATE TOKEN
|--------------------------------------------------------------------------
|
| POST /api/farmer/bookings
|
| Normal booking:
|
| {
|   "cropId": 1,
|   "centreId": 1,
|   "slotId": 1
| }
|
| AI recommended booking:
|
| {
|   "cropId": 1,
|   "centreId": 1,
|   "slotId": 1,
|   "bookingSource": "AI_RECOMMENDED",
|   "recommendationScore": 0.55
| }
|
|--------------------------------------------------------------------------
*/

router.post("/", requireFarmer, (req, res, next) => {
  try {
    const cropId =
      Number(req.body?.cropId);

    const centreId =
      Number(req.body?.centreId);

    const slotId =
      Number(req.body?.slotId);

    /*
    |--------------------------------------------------------------------------
    | Recommendation information
    |--------------------------------------------------------------------------
    */

    const recommendationScore =
      req.body?.recommendationScore !== undefined &&
      req.body?.recommendationScore !== null &&
      req.body?.recommendationScore !== ""
        ? Number(
            req.body.recommendationScore
          )
        : null;

    const bookingSource =
      String(
        req.body?.bookingSource ||
          "FARMER"
      )
        .trim()
        .toUpperCase();

    /*
    |--------------------------------------------------------------------------
    | Validate required IDs
    |--------------------------------------------------------------------------
    */

    if (
      !Number.isInteger(cropId) ||
      !Number.isInteger(centreId) ||
      !Number.isInteger(slotId) ||
      cropId <= 0 ||
      centreId <= 0 ||
      slotId <= 0
    ) {
      return res.status(400).json({
        message:
          "cropId, centreId and slotId are required."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate recommendation score
    |--------------------------------------------------------------------------
    */

    if (
      recommendationScore !== null &&
      (
        !Number.isFinite(
          recommendationScore
        ) ||
        recommendationScore < 0 ||
        recommendationScore > 1
      )
    ) {
      return res.status(400).json({
        message:
          "recommendationScore must be between 0 and 1."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate booking source
    |--------------------------------------------------------------------------
    */

    const allowedBookingSources = [
      "FARMER",
      "AI_RECOMMENDED"
    ];

    // The database stores AI bookings as `AI`; the farmer-facing API uses
    // the clearer `AI_RECOMMENDED` value.
    const storedBookingSource =
      bookingSource === "AI_RECOMMENDED"
        ? "AI"
        : "FARMER";

    if (
      !allowedBookingSources.includes(
        bookingSource
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid bookingSource. Use FARMER or AI_RECOMMENDED."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Keep score/source logically consistent
    |--------------------------------------------------------------------------
    */

    if (
      bookingSource === "AI_RECOMMENDED" &&
      recommendationScore === null
    ) {
      return res.status(400).json({
        message:
          "recommendationScore is required for AI_RECOMMENDED bookings."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Verify crop belongs to logged-in farmer
    |--------------------------------------------------------------------------
    */

    const crop = db.prepare(`
      SELECT *
      FROM crops
      WHERE crop_id = ?
        AND farmer_id = ?
    `).get(
      cropId,
      req.farmerId
    );

    if (!crop) {
      return res.status(404).json({
        message:
          "Crop not found for this farmer."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Verify active centre
    |--------------------------------------------------------------------------
    */

    const centre = db.prepare(`
      SELECT *
      FROM procurement_centres
      WHERE id = ?
        AND status = 'ACTIVE'
    `).get(centreId);

    if (!centre) {
      return res.status(404).json({
        message:
          "Active procurement centre not found."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Verify available slot
    |--------------------------------------------------------------------------
    */

    const slot = db.prepare(`
      SELECT *
      FROM centre_slots
      WHERE slot_id = ?
        AND centre_id = ?
        AND status = 'AVAILABLE'
    `).get(
      slotId,
      centreId
    );

    if (!slot) {
      return res.status(404).json({
        message:
          "Selected slot not found."
      });
    }

    if (slot.slot_date !== crop.expected_procurement_date) {
      return res.status(409).json({
        message: "The selected time slot must be on the farmer's registered procurement date."
      });
    }

    if (
      slot.booked_count >=
      slot.capacity
    ) {
      return res.status(409).json({
        message:
          "Selected slot is already full."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Prevent duplicate active booking
    |--------------------------------------------------------------------------
    */

    const duplicate = db.prepare(`
      SELECT booking_id
      FROM bookings
      WHERE farmer_id = ?
        AND slot_id = ?
        AND status = 'BOOKED'
    `).get(
      req.farmerId,
      slotId
    );

    if (duplicate) {
      return res.status(409).json({
        message:
          "You already have a booking for this slot.",
        bookingId:
          duplicate.booking_id
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Transaction
    |--------------------------------------------------------------------------
    */

    const bookingId =
      db.transaction(() => {

        /*
        Re-read slot inside transaction.
        */

        const currentSlot =
          db.prepare(`
            SELECT *
            FROM centre_slots
            WHERE slot_id = ?
          `).get(slotId);

        if (!currentSlot) {
          throw new Error(
            "Selected slot no longer exists."
          );
        }

        if (
          currentSlot.status !==
            "AVAILABLE" ||
          currentSlot.booked_count >=
            currentSlot.capacity
        ) {
          throw new Error(
            "Selected slot is no longer available."
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Token numbers are generated per
        | centre per booking date.
        |--------------------------------------------------------------------------
        */

        const tokenRow =
          db.prepare(`
            SELECT
              COALESCE(
                MAX(token_number),
                0
              ) + 1 AS next_token

            FROM bookings

            WHERE centre_id = ?
              AND booking_date = ?
          `).get(
            centreId,
            currentSlot.slot_date
          );

        const tokenNumber =
          tokenRow.next_token;

        /*
        |--------------------------------------------------------------------------
        | Create booking
        |--------------------------------------------------------------------------
        */

        const result =
          db.prepare(`
            INSERT INTO bookings (
              farmer_id,
              crop_id,
              centre_id,
              slot_id,
              booking_date,
              token_number,
              status,
              booking_source,
              recommendation_score
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              'BOOKED',
              ?,
              ?
            )
          `).run(
            req.farmerId,
            cropId,
            centreId,
            slotId,
            currentSlot.slot_date,
            tokenNumber,
            storedBookingSource,
            recommendationScore
          );

        /*
        |--------------------------------------------------------------------------
        | Update slot booking count
        |--------------------------------------------------------------------------
        */

        db.prepare(`
          UPDATE centre_slots

          SET
            booked_count =
              booked_count + 1,

            status = CASE
              WHEN booked_count + 1 >= capacity
                THEN 'FULL'
              ELSE 'AVAILABLE'
            END,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE slot_id = ?
        `).run(slotId);

        /*
        |--------------------------------------------------------------------------
        | Create initial queue record
        |--------------------------------------------------------------------------
        */

        const queuePosition =
          db.prepare(`
            SELECT
              COUNT(*) + 1 AS next_position

            FROM queues

            WHERE centre_id = ?
              AND queue_date = ?

              AND status IN (
                'WAITING',
                'CALLED',
                'CHECKED_IN',
                'VERIFIED',
                'PROCESSING'
              )
          `).get(
            centreId,
            currentSlot.slot_date
          ).next_position;

        /*
        |--------------------------------------------------------------------------
        | Initial queue estimate
        |--------------------------------------------------------------------------
        */

        const avgServiceRow = db.prepare(`
          SELECT AVG((julianday(service_end_time) - julianday(service_start_time)) * 1440.0) AS avg_minutes
          FROM queues
          WHERE centre_id=? AND status='COMPLETED'
            AND service_start_time IS NOT NULL AND service_end_time IS NOT NULL
            AND (julianday(service_end_time) - julianday(service_start_time)) > 0
        `).get(centreId);
        const serviceMinutes = Math.max(5, Math.min(60, Number(avgServiceRow?.avg_minutes || 10)));
        const estimatedWait = Math.max(0, Math.round((queuePosition - 1) * serviceMinutes));

        /*
        |--------------------------------------------------------------------------
        | Create queue
        |--------------------------------------------------------------------------
        */

        db.prepare(`
          INSERT INTO queues (
            booking_id,
            centre_id,
            farmer_id,
            crop_id,
            token_number,
            queue_date,
            position,
            estimated_wait_minutes,
            status
          )

          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'WAITING'
          )
        `).run(
          result.lastInsertRowid,
          centreId,
          req.farmerId,
          cropId,
          tokenNumber,
          currentSlot.slot_date,
          queuePosition,
          estimatedWait
        );

        return result.lastInsertRowid;
      })();

    /*
    |--------------------------------------------------------------------------
    | Return complete booking
    |--------------------------------------------------------------------------
    */

    const booking =
      db.prepare(`
        SELECT
          b.*,

          c.name AS centre_name,
          c.code AS centre_code,
          c.location AS centre_location,

          cr.crop_name,
          cr.crop_variety,
          cr.quantity_kg,

          s.start_time,
          s.end_time,
          s.slot_date

        FROM bookings b

        JOIN procurement_centres c
          ON c.id = b.centre_id

        JOIN crops cr
          ON cr.crop_id = b.crop_id

        JOIN centre_slots s
          ON s.slot_id = b.slot_id

        WHERE b.booking_id = ?
      `).get(bookingId);

    res.status(201).json({
      message:
        "Booking created successfully.",
      booking
    });

  } catch (error) {

    if (
      String(error.message).includes(
        "no longer available"
      )
    ) {
      return res.status(409).json({
        message:
          error.message
      });
    }

    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| CANCEL BOOKING
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/cancel",
  requireFarmer,
  (req, res, next) => {
    try {
      const bookingId =
        Number(req.params.id);

      if (
        !Number.isInteger(bookingId) ||
        bookingId <= 0
      ) {
        return res.status(400).json({
          message:
            "Invalid booking ID."
        });
      }

      const booking =
        db.prepare(`
          SELECT *
          FROM bookings
          WHERE booking_id = ?
            AND farmer_id = ?
        `).get(
          bookingId,
          req.farmerId
        );

      if (!booking) {
        return res.status(404).json({
          message:
            "Booking not found."
        });
      }

      if (
        booking.status !== "BOOKED"
      ) {
        return res.status(409).json({
          message:
            "Only BOOKED reservations can be cancelled."
        });
      }

      db.transaction(() => {

        /*
        Cancel booking
        */

        db.prepare(`
          UPDATE bookings

          SET
            status = 'CANCELLED',
            updated_at =
              CURRENT_TIMESTAMP

          WHERE booking_id = ?
        `).run(bookingId);

        /*
        Release slot capacity
        */

        db.prepare(`
          UPDATE centre_slots

          SET
            booked_count =
              CASE
                WHEN booked_count > 0
                  THEN booked_count - 1
                ELSE 0
              END,

            status = CASE
              WHEN booked_count - 1 < capacity
                THEN 'AVAILABLE'
              ELSE status
            END,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE slot_id = ?
        `).run(booking.slot_id);

        /*
        Cancel queue entry
        */

        db.prepare(`
          UPDATE queues

          SET
            status = 'CANCELLED',
            updated_at =
              CURRENT_TIMESTAMP

          WHERE booking_id = ?
        `).run(bookingId);

      })();

      res.json({
        message:
          "Booking cancelled successfully."
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;