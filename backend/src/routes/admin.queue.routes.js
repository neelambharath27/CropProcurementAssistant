import { Router } from "express";
import db from "../db.js";
import { requireAdmin } from "../auth.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| ADMIN — VIEW LIVE QUEUE
|--------------------------------------------------------------------------
*/

router.get("/live", requireAdmin, (req, res) => {
  const queue = db.prepare(`
    SELECT
      q.*,
      c.name AS centre_name,
      c.code AS centre_code,
      f.name AS farmer_name,
      f.mobile AS farmer_mobile,
      cr.crop_name,
      cr.crop_variety
    FROM queues q
    JOIN procurement_centres c
      ON c.id = q.centre_id
    JOIN farmers f
      ON f.farmer_id = q.farmer_id
    JOIN crops cr
      ON cr.crop_id = q.crop_id
    WHERE q.status IN (
      'WAITING',
      'CALLED',
      'CHECKED_IN',
      'VERIFIED',
      'PROCESSING'
    )
    ORDER BY
      q.queue_date ASC,
      q.position ASC
  `).all();

  res.json({
    queue
  });
});

/*
|--------------------------------------------------------------------------
| ADMIN — CALL TOKEN
|--------------------------------------------------------------------------
*/

router.post("/:id/call", requireAdmin, (req, res) => {
  const queueId =
    Number(req.params.id);

  const queue =
    db.prepare(`
      SELECT *
      FROM queues
      WHERE id = ?
    `).get(queueId);

  if (!queue) {
    return res.status(404).json({
      message:
        "Queue entry not found."
    });
  }

  if (queue.status !== "WAITING") {
    return res.status(409).json({
      message:
        "Only a WAITING token can be called."
    });
  }

  db.prepare(`
    UPDATE queues
    SET
      status = 'CALLED'
    WHERE id = ?
  `).run(queueId);

  res.json({
    message:
      "Token called successfully."
  });
});

/*
|--------------------------------------------------------------------------
| ADMIN — CHECK IN
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/check-in",
  requireAdmin,
  (req, res) => {
    const queueId =
      Number(req.params.id);

    const queue =
      db.prepare(`
        SELECT *
        FROM queues
        WHERE id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (
      queue.status !== "CALLED" &&
      queue.status !== "WAITING"
    ) {
      return res.status(409).json({
        message:
          "Queue entry is not ready for check-in."
      });
    }

    db.transaction(() => {

      db.prepare(`
        UPDATE queues
        SET
          status = 'CHECKED_IN',
          check_in_time =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(queueId);

      if (queue.booking_id) {
        db.prepare(`
          INSERT INTO checkins (
            booking_id,
            farmer_id,
            verification_status,
            check_in_time
          )
          VALUES (
            ?,
            ?,
            'PENDING',
            CURRENT_TIMESTAMP
          )
        `).run(
          queue.booking_id,
          queue.farmer_id
        );
      }
    })();

    res.json({
      message:
        "Farmer checked in successfully."
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — VERIFY FARMER
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/verify",
  requireAdmin,
  (req, res) => {
    const queueId =
      Number(req.params.id);

    const queue =
      db.prepare(`
        SELECT *
        FROM queues
        WHERE id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (
      queue.status !== "CHECKED_IN"
    ) {
      return res.status(409).json({
        message:
          "Farmer must be checked in first."
      });
    }

    db.transaction(() => {

      db.prepare(`
        UPDATE queues
        SET
          status = 'VERIFIED'
        WHERE id = ?
      `).run(queueId);

      if (queue.booking_id) {
        db.prepare(`
          UPDATE checkins
          SET
            verification_status = 'VERIFIED',
            verified_by = ?,
            verification_time =
              CURRENT_TIMESTAMP
          WHERE booking_id = ?
            AND farmer_id = ?
            AND verification_status =
              'PENDING'
        `).run(
          req.adminId,
          queue.booking_id,
          queue.farmer_id
        );
      }
    })();

    res.json({
      message:
        "Farmer verified successfully."
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — START PROCESSING
|--------------------------------------------------------------------------
|
| This now creates the PENDING procurement record.
|
| Workflow:
|
| VERIFIED
|    ↓
| PROCESSING
|    ↓
| PENDING PROCUREMENT
|    ↓
| QUALITY CHECK
|
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/start",
  requireAdmin,
  (req, res) => {
    const queueId =
      Number(req.params.id);

    const queue =
      db.prepare(`
        SELECT
          q.*,
          cr.crop_name,
          cr.crop_variety,
          cr.expected_procurement_date
        FROM queues q
        JOIN crops cr
          ON cr.crop_id = q.crop_id
        WHERE q.id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (
      queue.status !== "VERIFIED"
    ) {
      return res.status(409).json({
        message:
          "Farmer must be verified first."
      });
    }

    if (queue.procurement_id) {
      return res.status(409).json({
        message:
          "Processing has already been started for this queue entry."
      });
    }

    const procurementNumber =
      `PROC-${new Date().getFullYear()}-${String(
        Date.now()
      ).slice(-6)}`;

    let procurementId;

    db.transaction(() => {

      const result =
        db.prepare(`
          INSERT INTO procurements (
            procurement_number,
            farmer_id,
            crop_id,
            centre_id,
            procurement_date,
            status,
            gross_weight,
            tare_weight,
            net_weight,
            price_per_kg,
            total_amount,
            created_by,
            booking_id
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            'PENDING',
            NULL,
            NULL,
            NULL,
            0,
            0,
            ?,
            ?
          )
        `).run(
          procurementNumber,
          queue.farmer_id,
          queue.crop_id,
          queue.centre_id,
          queue.expected_procurement_date,
          req.adminId,
          queue.booking_id || null
        );

      procurementId =
        Number(
          result.lastInsertRowid
        );

      db.prepare(`
        UPDATE queues
        SET
          status = 'PROCESSING',
          service_start_time =
            CURRENT_TIMESTAMP,
          procurement_id = ?
        WHERE id = ?
      `).run(
        procurementId,
        queueId
      );
    })();

    res.status(201).json({
      message:
        "Processing started and procurement record created.",
      procurement: {
        id:
          procurementId,
        procurement_number:
          procurementNumber,
        status:
          "PENDING"
      }
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — QUALITY CHECK
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Quality is now checked BEFORE weight.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/quality-check",
  requireAdmin,
  (req, res) => {

    const queueId =
      Number(req.params.id);

    const {
      grade = "",
      moisturePercent = null,
      foreignMatterPercent = null,
      damagedPercent = null,
      remarks = "",
      decision
    } = req.body || {};

    const queue =
      db.prepare(`
        SELECT
          q.*,
          cr.crop_name,
          cr.crop_variety
        FROM queues q
        JOIN crops cr
          ON cr.crop_id = q.crop_id
        WHERE q.id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (
      queue.status !== "PROCESSING"
    ) {
      return res.status(409).json({
        message:
          "Queue entry must be PROCESSING for quality checking."
      });
    }

    if (!queue.procurement_id) {
      return res.status(409).json({
        message:
          "Processing must be started before quality checking."
      });
    }

    const procurement =
      db.prepare(`
        SELECT *
        FROM procurements
        WHERE id = ?
      `).get(
        queue.procurement_id
      );

    if (!procurement) {
      return res.status(404).json({
        message:
          "Linked procurement record not found."
      });
    }

    if (
      procurement.status !==
      "PENDING"
    ) {
      return res.status(409).json({
        message:
          "Procurement is not in a quality-checkable state."
      });
    }

    const allowedDecisions = [
      "ACCEPTED",
      "REJECTED",
      "RETURNED"
    ];

    if (
      !allowedDecisions.includes(
        decision
      )
    ) {
      return res.status(400).json({
        message:
          "Decision must be ACCEPTED, REJECTED, or RETURNED."
      });
    }

    const existingAssessment =
      db.prepare(`
        SELECT *
        FROM quality_assessments
        WHERE procurement_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(
        queue.procurement_id
      );

    if (existingAssessment) {
      return res.status(409).json({
        message:
          "Quality assessment already exists for this procurement."
      });
    }

    const moisture =
      moisturePercent === null ||
      moisturePercent === ""
        ? null
        : Number(
            moisturePercent
          );

    const foreignMatter =
      foreignMatterPercent === null ||
      foreignMatterPercent === ""
        ? null
        : Number(
            foreignMatterPercent
          );

    const damaged =
      damagedPercent === null ||
      damagedPercent === ""
        ? null
        : Number(
            damagedPercent
          );

    if (
      moisture !== null &&
      (
        !Number.isFinite(moisture) ||
        moisture < 0
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid moisture percentage."
      });
    }

    if (
      foreignMatter !== null &&
      (
        !Number.isFinite(
          foreignMatter
        ) ||
        foreignMatter < 0
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid foreign matter percentage."
      });
    }

    if (
      damaged !== null &&
      (
        !Number.isFinite(
          damaged
        ) ||
        damaged < 0
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid damaged percentage."
      });
    }

    db.transaction(() => {

      db.prepare(`
        INSERT INTO quality_assessments (
          procurement_id,
          grade,
          moisture_percent,
          foreign_matter_percent,
          damaged_percent,
          remarks,
          assessed_by,
          decision
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `).run(
        queue.procurement_id,
        grade || "N/A",
        moisture,
        foreignMatter,
        damaged,
        remarks,
        req.adminId,
        decision
      );

      /*
      ACCEPTED:
      Keep procurement PENDING.
      Weight check comes next.
      */

      if (
        decision === "ACCEPTED"
      ) {

        db.prepare(`
          UPDATE procurements
          SET
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          queue.procurement_id
        );

        db.prepare(`
          UPDATE queues
          SET
            status = 'PROCESSING'
          WHERE id = ?
        `).run(
          queueId
        );
      }

      /*
      REJECTED / RETURNED:
      Stop the procurement workflow.
      */

      if (
        decision === "REJECTED" ||
        decision === "RETURNED"
      ) {

        db.prepare(`
          UPDATE procurements
          SET
            status = ?,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          decision,
          queue.procurement_id
        );

        db.prepare(`
          UPDATE queues
          SET
            status = ?,
            service_end_time =
              CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          decision,
          queueId
        );
      }
    })();

    res.status(201).json({
      message:
        "Quality assessment saved successfully.",
      procurement_id:
        queue.procurement_id,
      decision,
      grade:
        grade || "N/A",
      moisture_percent:
        moisture,
      foreign_matter_percent:
        foreignMatter,
      damaged_percent:
        damaged,
      remarks
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — WEIGHT CHECK
|--------------------------------------------------------------------------
|
| Weight is now allowed ONLY after ACCEPTED quality.
|
| POST /api/admin/queue/:id/weight
|
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/weight",
  requireAdmin,
  (req, res) => {

    const queueId =
      Number(req.params.id);

    const grossWeight =
      Number(
        req.body?.grossWeight
      );

    const tareWeight =
      Number(
        req.body?.tareWeight
      );

    const pricePerKg =
      Number(
        req.body?.pricePerKg
      );

    if (
      !Number.isFinite(grossWeight) ||
      grossWeight <= 0
    ) {
      return res.status(400).json({
        message:
          "Gross weight must be greater than 0."
      });
    }

    if (
      !Number.isFinite(tareWeight) ||
      tareWeight < 0
    ) {
      return res.status(400).json({
        message:
          "Tare weight must be 0 or greater."
      });
    }

    if (
      tareWeight >= grossWeight
    ) {
      return res.status(400).json({
        message:
          "Tare weight must be less than gross weight."
      });
    }

    if (
      !Number.isFinite(pricePerKg) ||
      pricePerKg <= 0
    ) {
      return res.status(400).json({
        message:
          "Price per kg must be greater than 0."
      });
    }

    const queue =
      db.prepare(`
        SELECT
          q.*,
          cr.crop_name,
          cr.crop_variety
        FROM queues q
        JOIN crops cr
          ON cr.crop_id = q.crop_id
        WHERE q.id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (
      queue.status !== "PROCESSING"
    ) {
      return res.status(409).json({
        message:
          "Queue entry must be PROCESSING before weight check."
      });
    }

    if (!queue.procurement_id) {
      return res.status(409).json({
        message:
          "Procurement record is required before weight check."
      });
    }

    const procurement =
      db.prepare(`
        SELECT *
        FROM procurements
        WHERE id = ?
      `).get(
        queue.procurement_id
      );

    if (!procurement) {
      return res.status(404).json({
        message:
          "Procurement record not found."
      });
    }

    if (
      procurement.status !==
      "PENDING"
    ) {
      return res.status(409).json({
        message:
          "Procurement is not ready for weight check."
      });
    }

    const quality =
      db.prepare(`
        SELECT *
        FROM quality_assessments
        WHERE procurement_id = ?
          AND decision = 'ACCEPTED'
        ORDER BY id DESC
        LIMIT 1
      `).get(
        queue.procurement_id
      );

    if (!quality) {
      return res.status(409).json({
        message:
          "Quality must be ACCEPTED before weight check."
      });
    }

    if (
      procurement.gross_weight !== null
    ) {
      return res.status(409).json({
        message:
          "Weight check has already been completed."
      });
    }

    const netWeight =
      Number(
        (
          grossWeight -
          tareWeight
        ).toFixed(3)
      );

    const totalAmount =
      Number(
        (
          netWeight *
          pricePerKg
        ).toFixed(2)
      );

    db.transaction(() => {

      /*
      Update the PENDING procurement
      created at processing start.
      */

      db.prepare(`
        UPDATE procurements
        SET
          gross_weight = ?,
          tare_weight = ?,
          net_weight = ?,
          price_per_kg = ?,
          total_amount = ?,
          status = 'COMPLETED',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        grossWeight,
        tareWeight,
        netWeight,
        pricePerKg,
        totalAmount,
        queue.procurement_id
      );

      /*
      Complete queue.
      */

      db.prepare(`
        UPDATE queues
        SET
          status = 'COMPLETED',
          service_end_time =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(queueId);

      /*
      Complete associated booking.
      */

      if (queue.booking_id) {
        db.prepare(`
          UPDATE bookings
          SET
            status = 'COMPLETED',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE booking_id = ?
        `).run(
          queue.booking_id
        );
      }
    })();

    res.status(201).json({
      message:
        "Quality accepted. Weight checked and procurement completed.",

      procurement: {
        id:
          queue.procurement_id,

        procurement_number:
          procurement.procurement_number,

        gross_weight:
          grossWeight,

        tare_weight:
          tareWeight,

        net_weight:
          netWeight,

        price_per_kg:
          pricePerKg,

        total_amount:
          totalAmount,

        status:
          "COMPLETED"
      }
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — COMPLETE SERVICE
|--------------------------------------------------------------------------
|
| Safety/finalization endpoint.
|
| Normal path should already complete through weight.
|
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/complete",
  requireAdmin,
  (req, res) => {

    const queueId =
      Number(req.params.id);

    const queue =
      db.prepare(`
        SELECT *
        FROM queues
        WHERE id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (
      queue.status === "COMPLETED"
    ) {
      return res.json({
        message:
          "Queue service is already completed."
      });
    }

    if (
      queue.status !==
      "PROCESSING"
    ) {
      return res.status(409).json({
        message:
          "Queue entry must be PROCESSING."
      });
    }

    if (!queue.procurement_id) {
      return res.status(409).json({
        message:
          "Procurement record is required."
      });
    }

    const procurement =
      db.prepare(`
        SELECT *
        FROM procurements
        WHERE id = ?
      `).get(
        queue.procurement_id
      );

    if (!procurement) {
      return res.status(404).json({
        message:
          "Procurement record not found."
      });
    }

    if (
      procurement.status !==
      "COMPLETED"
    ) {
      return res.status(409).json({
        message:
          "Weight check must complete procurement before finalization."
      });
    }

    db.transaction(() => {

      db.prepare(`
        UPDATE queues
        SET
          status = 'COMPLETED',
          service_end_time =
            COALESCE(
              service_end_time,
              CURRENT_TIMESTAMP
            )
        WHERE id = ?
      `).run(queueId);

      if (queue.booking_id) {
        db.prepare(`
          UPDATE bookings
          SET
            status = 'COMPLETED',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE booking_id = ?
        `).run(
          queue.booking_id
        );
      }
    })();

    res.json({
      message:
        "Queue service completed."
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — CREATE PAYMENT
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/payment",
  requireAdmin,
  (req, res) => {

    const queueId =
      Number(req.params.id);

    const queue =
      db.prepare(`
        SELECT
          q.*,
          p.id AS procurement_record_id,
          p.procurement_number,
          p.total_amount,
          p.status AS procurement_status
        FROM queues q
        LEFT JOIN procurements p
          ON p.id = q.procurement_id
        WHERE q.id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (!queue.procurement_id) {
      return res.status(409).json({
        message:
          "Procurement record is required before payment."
      });
    }

    if (
      queue.procurement_status !==
      "COMPLETED"
    ) {
      return res.status(409).json({
        message:
          "Procurement must be COMPLETED before payment."
      });
    }

    const existingPayment =
      db.prepare(`
        SELECT *
        FROM payments
        WHERE procurement_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(
        queue.procurement_id
      );

    if (existingPayment) {
      return res.status(200).json({
        message:
          "Payment record already exists.",
        payment:
          existingPayment
      });
    }

    const paymentMethod =
      String(
        req.body?.paymentMethod ||
          "BANK_TRANSFER"
      ).trim();

    const allowedMethods = [
      "BANK_TRANSFER",
      "UPI",
      "NEFT",
      "RTGS",
      "CASH"
    ];

    if (
      !allowedMethods.includes(
        paymentMethod
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid payment method."
      });
    }

    const payment =
      db.transaction(() => {

        const result =
          db.prepare(`
            INSERT INTO payments (
              procurement_id,
              farmer_id,
              amount,
              payment_method,
              status
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              'PENDING'
            )
          `).run(
            queue.procurement_id,
            queue.farmer_id,
            queue.total_amount,
            paymentMethod
          );

        return db.prepare(`
          SELECT *
          FROM payments
          WHERE id = ?
        `).get(
          result.lastInsertRowid
        );
      })();

    res.status(201).json({
      message:
        "Payment record created.",
      payment
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — START PAYMENT PROCESSING
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/payment/process",
  requireAdmin,
  (req, res) => {

    const queueId =
      Number(req.params.id);

    const queue =
      db.prepare(`
        SELECT *
        FROM queues
        WHERE id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (!queue.procurement_id) {
      return res.status(409).json({
        message:
          "Procurement record is required before payment processing."
      });
    }

    const payment =
      db.prepare(`
        SELECT *
        FROM payments
        WHERE procurement_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(
        queue.procurement_id
      );

    if (!payment) {
      return res.status(404).json({
        message:
          "Payment record not found. Create the payment first."
      });
    }

    if (
      payment.status !==
      "PENDING"
    ) {
      return res.status(409).json({
        message:
          "Only a PENDING payment can be processed."
      });
    }

    db.prepare(`
      UPDATE payments
      SET
        status = 'PROCESSING',
        processed_at =
          CURRENT_TIMESTAMP,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      payment.id
    );

    res.json({
      message:
        "Payment processing started."
    });
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — CONFIRM PAYMENT + CREATE NOTIFICATION
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/payment/confirm",
  requireAdmin,
  (req, res) => {

    const queueId =
      Number(req.params.id);

    const queue =
      db.prepare(`
        SELECT
          q.*,
          f.name AS farmer_name,
          f.user_id AS farmer_user_id,
          p.procurement_number,
          p.total_amount
        FROM queues q
        JOIN farmers f
          ON f.farmer_id = q.farmer_id
        JOIN procurements p
          ON p.id = q.procurement_id
        WHERE q.id = ?
      `).get(queueId);

    if (!queue) {
      return res.status(404).json({
        message:
          "Queue entry not found."
      });
    }

    if (!queue.procurement_id) {
      return res.status(409).json({
        message:
          "Procurement record is required before payment confirmation."
      });
    }

    const payment =
      db.prepare(`
        SELECT *
        FROM payments
        WHERE procurement_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(
        queue.procurement_id
      );

    if (!payment) {
      return res.status(404).json({
        message:
          "Payment record not found."
      });
    }

    if (
      payment.status !==
        "PROCESSING" &&
      payment.status !==
        "PENDING"
    ) {
      return res.status(409).json({
        message:
          "Payment is not ready for confirmation."
      });
    }

    const transactionReference =
      String(
        req.body?.transactionReference ||
          `TXN-${Date.now()}`
      ).trim();

    if (!transactionReference) {
      return res.status(400).json({
        message:
          "Transaction reference is required."
      });
    }

    let updatedPayment;
    let notification = null;

    db.transaction(() => {

      /*
      Mark payment SUCCESS.
      */

      db.prepare(`
        UPDATE payments
        SET
          status = 'SUCCESS',
          transaction_reference = ?,
          paid_at =
            CURRENT_TIMESTAMP,
          processed_at =
            COALESCE(
              processed_at,
              CURRENT_TIMESTAMP
            ),
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        transactionReference,
        payment.id
      );

      /*
      Create farmer notification once.
      */

      if (queue.farmer_user_id) {

        const existingNotification =
          db.prepare(`
            SELECT *
            FROM notifications
            WHERE user_id = ?
              AND type = 'PAYMENT_SUCCESS'
              AND related_type = 'PAYMENT'
              AND related_id = ?
            LIMIT 1
          `).get(
            queue.farmer_user_id,
            payment.id
          );

        if (!existingNotification) {

          const title =
            "Payment Confirmed";

          const message =
            `Payment of ₹${Number(
              payment.amount
            ).toLocaleString(
              "en-IN"
            )} has been confirmed for ${queue.procurement_number}.`;

          const notificationResult =
            db.prepare(`
              INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                related_type,
                related_id,
                is_read
              )
              VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                0
              )
            `).run(
              queue.farmer_user_id,
              "PAYMENT_SUCCESS",
              title,
              message,
              "PAYMENT",
              payment.id
            );

          notification =
            db.prepare(`
              SELECT *
              FROM notifications
              WHERE notification_id = ?
            `).get(
              notificationResult.lastInsertRowid
            );

        } else {

          notification =
            existingNotification;
        }
      }

      /*
      Read updated payment.
      */

      updatedPayment =
        db.prepare(`
          SELECT *
          FROM payments
          WHERE id = ?
        `).get(
          payment.id
        );

    })();

    res.json({
      message:
        "Payment confirmed successfully.",
      payment:
        updatedPayment,
      notification:
        notification
    });
  }
);

export default router;