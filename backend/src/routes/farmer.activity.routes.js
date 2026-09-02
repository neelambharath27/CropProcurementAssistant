import { Router } from "express";
import db from "../db.js";
import { requireFarmer } from "../auth.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| FARMER — NOTIFICATIONS
|--------------------------------------------------------------------------
|
| GET /api/farmer/activity/notifications
|
|--------------------------------------------------------------------------
*/

router.get(
  "/notifications",
  requireFarmer,
  (req, res, next) => {
    try {
      const notifications = db.prepare(`
        SELECT
          notification_id,
          type,
          title,
          message,
          related_type,
          related_id,
          is_read,
          created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC, notification_id DESC
      `).all(
        db.prepare(`
          SELECT user_id
          FROM farmers
          WHERE farmer_id = ?
        `).get(req.farmerId)?.user_id
      );

      res.json({
        notifications
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| FARMER — UNREAD NOTIFICATION COUNT
|--------------------------------------------------------------------------
|
| GET /api/farmer/activity/notifications/unread-count
|
|--------------------------------------------------------------------------
*/

router.get(
  "/notifications/unread-count",
  requireFarmer,
  (req, res, next) => {
    try {
      const farmer = db.prepare(`
        SELECT user_id
        FROM farmers
        WHERE farmer_id = ?
      `).get(req.farmerId);

      if (!farmer?.user_id) {
        return res.status(404).json({
          message: "Farmer user account not found."
        });
      }

      const result = db.prepare(`
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE user_id = ?
          AND is_read = 0
      `).get(
        farmer.user_id
      );

      res.json({
        unreadCount: result.count
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| FARMER — MARK NOTIFICATION AS READ
|--------------------------------------------------------------------------
|
| PATCH /api/farmer/activity/notifications/:id/read
|
|--------------------------------------------------------------------------
*/

router.patch(
  "/notifications/:id/read",
  requireFarmer,
  (req, res, next) => {
    try {
      const notificationId =
        Number(req.params.id);

      const farmer = db.prepare(`
        SELECT user_id
        FROM farmers
        WHERE farmer_id = ?
      `).get(req.farmerId);

      if (!farmer?.user_id) {
        return res.status(404).json({
          message:
            "Farmer user account not found."
        });
      }

      const notification =
        db.prepare(`
          SELECT *
          FROM notifications
          WHERE notification_id = ?
            AND user_id = ?
        `).get(
          notificationId,
          farmer.user_id
        );

      if (!notification) {
        return res.status(404).json({
          message:
            "Notification not found."
        });
      }

      db.prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE notification_id = ?
          AND user_id = ?
      `).run(
        notificationId,
        farmer.user_id
      );

      const updated =
        db.prepare(`
          SELECT *
          FROM notifications
          WHERE notification_id = ?
        `).get(
          notificationId
        );

      res.json({
        message:
          "Notification marked as read.",
        notification: updated
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| FARMER — MARK ALL NOTIFICATIONS AS READ
|--------------------------------------------------------------------------
|
| PATCH /api/farmer/activity/notifications/read-all
|
|--------------------------------------------------------------------------
*/

router.patch(
  "/notifications/read-all",
  requireFarmer,
  (req, res, next) => {
    try {
      const farmer = db.prepare(`
        SELECT user_id
        FROM farmers
        WHERE farmer_id = ?
      `).get(req.farmerId);

      if (!farmer?.user_id) {
        return res.status(404).json({
          message:
            "Farmer user account not found."
        });
      }

      db.prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = ?
      `).run(
        farmer.user_id
      );

      res.json({
        message:
          "All notifications marked as read."
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| FARMER — PROCUREMENT HISTORY
|--------------------------------------------------------------------------
|
| GET /api/farmer/activity/history
|
|--------------------------------------------------------------------------
*/

router.get(
  "/history",
  requireFarmer,
  (req, res, next) => {
    try {
      const history = db.prepare(`
        SELECT
          p.id AS procurement_id,
          p.procurement_number,
          p.procurement_date,
          p.status AS procurement_status,
          p.gross_weight,
          p.tare_weight,
          p.net_weight,
          p.price_per_kg,
          p.total_amount,

          c.crop_name,
          c.crop_variety,

          pc.name AS centre,

          q.token_number,
          q.queue_date,

          qa.grade AS quality_grade,
          qa.moisture_percent,
          qa.foreign_matter_percent,
          qa.damaged_percent,
          qa.decision AS quality_decision,

          r.receipt_number,
          r.issued_at,

          pa.id AS payment_id,
          pa.amount AS payment_amount,
          pa.payment_method,
          pa.transaction_reference,
          pa.status AS payment_status,
          pa.paid_at

        FROM procurements p

        JOIN crops c
          ON c.crop_id = p.crop_id

        JOIN procurement_centres pc
          ON pc.id = p.centre_id

        LEFT JOIN queues q
          ON q.procurement_id = p.id

        LEFT JOIN quality_assessments qa
          ON qa.procurement_id = p.id

        LEFT JOIN receipts r
          ON r.procurement_id = p.id

        LEFT JOIN payments pa
          ON pa.procurement_id = p.id

        WHERE p.farmer_id = ?

        ORDER BY
          p.procurement_date DESC,
          p.id DESC
      `).all(
        req.farmerId
      );

      res.json({
        history
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| FARMER — SINGLE PROCUREMENT HISTORY
|--------------------------------------------------------------------------
|
| GET /api/farmer/activity/history/:id
|
|--------------------------------------------------------------------------
*/

router.get(
  "/history/:id",
  requireFarmer,
  (req, res, next) => {
    try {
      const procurementId =
        Number(req.params.id);

      const history = db.prepare(`
        SELECT
          p.id AS procurement_id,
          p.procurement_number,
          p.procurement_date,
          p.status AS procurement_status,
          p.gross_weight,
          p.tare_weight,
          p.net_weight,
          p.price_per_kg,
          p.total_amount,

          c.crop_name,
          c.crop_variety,

          pc.name AS centre,

          q.token_number,
          q.queue_date,
          q.position,

          qa.grade AS quality_grade,
          qa.moisture_percent,
          qa.foreign_matter_percent,
          qa.damaged_percent,
          qa.remarks AS quality_remarks,
          qa.decision AS quality_decision,
          qa.assessed_at AS quality_checked_at,

          r.id AS receipt_id,
          r.receipt_number,
          r.issued_at,

          pa.id AS payment_id,
          pa.amount AS payment_amount,
          pa.payment_method,
          pa.transaction_reference,
          pa.status AS payment_status,
          pa.paid_at,
          pa.created_at AS payment_created_at

        FROM procurements p

        JOIN crops c
          ON c.crop_id = p.crop_id

        JOIN procurement_centres pc
          ON pc.id = p.centre_id

        LEFT JOIN queues q
          ON q.procurement_id = p.id

        LEFT JOIN quality_assessments qa
          ON qa.procurement_id = p.id

        LEFT JOIN receipts r
          ON r.procurement_id = p.id

        LEFT JOIN payments pa
          ON pa.procurement_id = p.id

        WHERE p.id = ?
          AND p.farmer_id = ?
      `).get(
        procurementId,
        req.farmerId
      );

      if (!history) {
        return res.status(404).json({
          message:
            "Procurement history not found."
        });
      }

      res.json({
        history
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;