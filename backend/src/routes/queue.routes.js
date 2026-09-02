import { Router } from "express";
import db from "../db.js";
import { requireFarmer, requireAdmin } from "../auth.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| FARMER — LIVE QUEUE
|--------------------------------------------------------------------------
*/

router.get("/live", requireFarmer, (req, res) => {
  const queue = db.prepare(`
    SELECT
      q.id, q.booking_id, q.centre_id, q.farmer_id, q.crop_id,
      q.token_number, q.queue_date, q.position,
      q.estimated_wait_minutes, q.check_in_time,
      q.service_start_time, q.service_end_time, q.status,
      c.name AS centre_name, c.code AS centre_code,
      cr.crop_name, cr.crop_variety
    FROM queues q
    JOIN procurement_centres c ON c.id = q.centre_id
    JOIN crops cr ON cr.crop_id = q.crop_id
    WHERE q.farmer_id = ?
      AND q.status IN ('WAITING','CALLED','CHECKED_IN','VERIFIED','PROCESSING')
    ORDER BY q.queue_date DESC, q.position ASC
  `).all(req.farmerId);

  const activeStatuses = "('WAITING','CALLED','CHECKED_IN','VERIFIED','PROCESSING')";

  function serviceMinutes(centreId) {
    const row = db.prepare(`
      SELECT AVG((julianday(service_end_time) - julianday(service_start_time)) * 1440.0) AS avg_minutes
      FROM queues
      WHERE centre_id=? AND status='COMPLETED'
        AND service_start_time IS NOT NULL AND service_end_time IS NOT NULL
        AND (julianday(service_end_time) - julianday(service_start_time)) > 0
    `).get(centreId);
    return Math.max(5, Math.min(60, Number(row?.avg_minutes || 10)));
  }

  function liveMetrics(item) {
    const aheadRows = db.prepare(`
      SELECT id, token_number, position, status, service_start_time
      FROM queues
      WHERE centre_id=? AND queue_date=?
        AND status IN ${activeStatuses}
        AND position < ?
      ORDER BY position ASC
    `).all(item.centre_id, item.queue_date, item.position);

    const current = db.prepare(`
      SELECT id, token_number, position, status, service_start_time
      FROM queues
      WHERE centre_id=? AND queue_date=?
        AND status IN ('CALLED','CHECKED_IN','VERIFIED','PROCESSING')
      ORDER BY position ASC
      LIMIT 1
    `).get(item.centre_id, item.queue_date);

    const nowServing = Number(current?.token_number || 0);
    const aheadCount = aheadRows.length;
    const avg = serviceMinutes(item.centre_id);
    let wait = aheadCount * avg;

    if (current && current.position < item.position && current.status === 'PROCESSING' && current.service_start_time) {
      const elapsedRow = db.prepare(`SELECT (julianday('now') - julianday(?)) * 1440.0 AS minutes`).get(current.service_start_time);
      const elapsed = Math.max(0, Number(elapsedRow?.minutes || 0));
      const remainingCurrent = Math.max(0, avg - elapsed);
      wait = Math.max(0, (aheadCount - 1) * avg + remainingCurrent);
    }

    if (item.status === 'PROCESSING' || item.status === 'CALLED' || item.status === 'CHECKED_IN' || item.status === 'VERIFIED') {
      wait = 0;
    }

    return {
      nowServing,
      peopleAhead: aheadCount,
      estimatedWait: Math.max(0, Math.round(wait))
    };
  }

  const result = queue.map(item => {
    const metrics = liveMetrics(item);
    return {
      ...item,
      now_serving: metrics.nowServing,
      people_ahead: metrics.peopleAhead,
      calculated_wait_minutes: metrics.estimatedWait,
      service_minutes: serviceMinutes(item.centre_id)
    };
  });

  const mine = result[0] || null;
  res.json({
    queue: result,
    summary: {
      nowServing: mine?.now_serving || 0,
      peopleAhead: mine?.people_ahead || 0,
      estimatedWaitMinutes: mine?.calculated_wait_minutes || 0,
      serviceMinutes: mine?.service_minutes || 10
    }
  });
});

/*
|--------------------------------------------------------------------------
| FARMER — SINGLE QUEUE ENTRY
|--------------------------------------------------------------------------
*/

router.get("/:id", requireFarmer, (req, res) => {
  const queueId = Number(req.params.id);

  const queue = db.prepare(`
    SELECT
      q.*,
      c.name AS centre_name,
      c.code AS centre_code,
      cr.crop_name,
      cr.crop_variety
    FROM queues q
    JOIN procurement_centres c
      ON c.id = q.centre_id
    JOIN crops cr
      ON cr.crop_id = q.crop_id
    WHERE q.id = ?
      AND q.farmer_id = ?
  `).get(queueId, req.farmerId);

  if (!queue) {
    return res.status(404).json({
      message: "Queue entry not found."
    });
  }

  const nowServingRow = db.prepare(`
    SELECT
      COALESCE(MAX(token_number), 0) AS now_serving
    FROM queues
    WHERE centre_id = ?
      AND queue_date = ?
      AND status IN (
        'CALLED',
        'CHECKED_IN',
        'VERIFIED',
        'PROCESSING'
      )
  `).get(
    queue.centre_id,
    queue.queue_date
  );

  const nowServing =
    Number(nowServingRow.now_serving || 0);

  const peopleAheadRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM queues
    WHERE centre_id=?
      AND queue_date=?
      AND status IN ('WAITING','CALLED','CHECKED_IN','VERIFIED','PROCESSING')
      AND position < ?
  `).get(queue.centre_id, queue.queue_date, queue.position);

  const avgRow = db.prepare(`
    SELECT AVG((julianday(service_end_time) - julianday(service_start_time)) * 1440.0) AS avg_minutes
    FROM queues
    WHERE centre_id=? AND status='COMPLETED'
      AND service_start_time IS NOT NULL AND service_end_time IS NOT NULL
      AND (julianday(service_end_time) - julianday(service_start_time)) > 0
  `).get(queue.centre_id);

  const serviceMinutes = Math.max(5, Math.min(60, Number(avgRow?.avg_minutes || 10)));
  const peopleAhead = Number(peopleAheadRow?.count || 0);
  const estimatedWait = Math.max(0, Math.round(peopleAhead * serviceMinutes));

  res.json({
    queue: {
      ...queue,
      now_serving: nowServing,
      people_ahead: peopleAhead,
      calculated_wait_minutes: estimatedWait,
      service_minutes: serviceMinutes
    }
  });
});

/*
|--------------------------------------------------------------------------
| ADMIN — VIEW LIVE QUEUE
|--------------------------------------------------------------------------
*/

router.get("/admin/live", requireAdmin, (req, res) => {
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
    ORDER BY q.queue_date ASC,
             q.position ASC
  `).all();

  res.json({ queue });
});

/*
|--------------------------------------------------------------------------
| ADMIN — CALL NEXT TOKEN
|--------------------------------------------------------------------------
*/

router.post("/admin/:id/call", requireAdmin, (req, res) => {
  const queueId = Number(req.params.id);

  const queue = db.prepare(`
    SELECT *
    FROM queues
    WHERE id = ?
  `).get(queueId);

  if (!queue) {
    return res.status(404).json({
      message: "Queue entry not found."
    });
  }

  if (queue.status !== "WAITING") {
    return res.status(409).json({
      message:
        "Only a WAITING queue entry can be called."
    });
  }

  db.prepare(`
    UPDATE queues
    SET
      status = 'CALLED',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(queueId);

  res.json({
    message: "Token called successfully."
  });
});

/*
|--------------------------------------------------------------------------
| ADMIN — CHECK IN
|--------------------------------------------------------------------------
*/

router.post("/admin/:id/check-in", requireAdmin, (req, res) => {
  const queueId = Number(req.params.id);

  const queue = db.prepare(`
    SELECT *
    FROM queues
    WHERE id = ?
  `).get(queueId);

  if (!queue) {
    return res.status(404).json({
      message: "Queue entry not found."
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
        check_in_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(queueId);

    db.prepare(`
      INSERT INTO checkins (
        booking_id,
        farmer_id,
        verification_status,
        check_in_time
      )
      VALUES (?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `).run(
      queue.booking_id,
      queue.farmer_id
    );
  })();

  res.json({
    message: "Farmer checked in successfully."
  });
});

/*
|--------------------------------------------------------------------------
| ADMIN — VERIFY FARMER
|--------------------------------------------------------------------------
*/

router.post("/admin/:id/verify", requireAdmin, (req, res) => {
  const queueId = Number(req.params.id);

  const queue = db.prepare(`
    SELECT *
    FROM queues
    WHERE id = ?
  `).get(queueId);

  if (!queue) {
    return res.status(404).json({
      message: "Queue entry not found."
    });
  }

  if (
    queue.status !== "CHECKED_IN"
  ) {
    return res.status(409).json({
      message:
        "Farmer must be checked in before verification."
    });
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE queues
      SET status = 'VERIFIED'
      WHERE id = ?
    `).run(queueId);

    db.prepare(`
      UPDATE checkins
      SET
        verification_status = 'VERIFIED',
        verified_by = ?,
        verification_time = CURRENT_TIMESTAMP
      WHERE booking_id = ?
        AND farmer_id = ?
        AND verification_status = 'PENDING'
      ORDER BY checkin_id DESC
      LIMIT 1
    `).run(
      req.adminId,
      queue.booking_id,
      queue.farmer_id
    );
  })();

  res.json({
    message: "Farmer verified successfully."
  });
});

/*
|--------------------------------------------------------------------------
| ADMIN — START PROCESSING
|--------------------------------------------------------------------------
*/

router.post("/admin/:id/start", requireAdmin, (req, res) => {
  const queueId = Number(req.params.id);

  const queue = db.prepare(`
    SELECT *
    FROM queues
    WHERE id = ?
  `).get(queueId);

  if (!queue) {
    return res.status(404).json({
      message: "Queue entry not found."
    });
  }

  if (queue.status !== "VERIFIED") {
    return res.status(409).json({
      message:
        "Farmer must be verified before processing."
    });
  }

  db.prepare(`
    UPDATE queues
    SET
      status = 'PROCESSING',
      service_start_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(queueId);

  res.json({
    message: "Procurement processing started."
  });
});

/*
|--------------------------------------------------------------------------
| ADMIN — COMPLETE QUEUE
|--------------------------------------------------------------------------
*/

router.post("/admin/:id/complete", requireAdmin, (req, res) => {
  const queueId = Number(req.params.id);

  const queue = db.prepare(`
    SELECT *
    FROM queues
    WHERE id = ?
  `).get(queueId);

  if (!queue) {
    return res.status(404).json({
      message: "Queue entry not found."
    });
  }

  if (
    queue.status !== "PROCESSING"
  ) {
    return res.status(409).json({
      message:
        "Queue entry must be PROCESSING before completion."
    });
  }

  db.prepare(`
    UPDATE queues
    SET
      status = 'COMPLETED',
      service_end_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(queueId);

  if (queue.booking_id) {
    db.prepare(`
      UPDATE bookings
      SET
        status = 'COMPLETED',
        updated_at = CURRENT_TIMESTAMP
      WHERE booking_id = ?
    `).run(queue.booking_id);
  }

  res.json({
    message: "Queue service completed."
  });
});

export default router;