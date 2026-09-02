import { Router } from "express";
import db from "../db.js";

import { requireAdmin } from "../auth.js";

import {
  saveDemandPrediction
} from "../ai/demand.service.js";

import {
  saveQueuePrediction
} from "../ai/queue.service.js";

import {
  savePricePrediction
} from "../ai/price.service.js";

import {
  saveRecommendations
} from "../ai/recommendation.service.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| ADMIN — DEMAND PREDICTION
|--------------------------------------------------------------------------
*/

router.post(
  "/demand",
  requireAdmin,
  (req, res, next) => {
    try {
      const cropId =
        req.body?.cropId !== undefined &&
        req.body?.cropId !== null &&
        req.body?.cropId !== ""
          ? Number(req.body.cropId)
          : null;

      const centreId =
        req.body?.centreId !== undefined &&
        req.body?.centreId !== null &&
        req.body?.centreId !== ""
          ? Number(req.body.centreId)
          : null;

      const predictionDate =
        String(
          req.body?.predictionDate ||
            new Date()
              .toISOString()
              .slice(0, 10)
        );

      if (
        cropId !== null &&
        (
          !Number.isInteger(cropId) ||
          cropId <= 0
        )
      ) {
        return res.status(400).json({
          message: "Invalid cropId."
        });
      }

      if (
        centreId !== null &&
        (
          !Number.isInteger(centreId) ||
          centreId <= 0
        )
      ) {
        return res.status(400).json({
          message: "Invalid centreId."
        });
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/
          .test(predictionDate)
      ) {
        return res.status(400).json({
          message:
            "predictionDate must use YYYY-MM-DD format."
        });
      }

      if (cropId !== null) {
        const crop =
          db.prepare(`
            SELECT
              crop_id,
              crop_name,
              crop_variety
            FROM crops
            WHERE crop_id = ?
          `).get(cropId);

        if (!crop) {
          return res.status(404).json({
            message: "Crop not found."
          });
        }
      }

      if (centreId !== null) {
        const centre =
          db.prepare(`
            SELECT
              id,
              name,
              code
            FROM procurement_centres
            WHERE id = ?
          `).get(centreId);

        if (!centre) {
          return res.status(404).json({
            message:
              "Procurement centre not found."
          });
        }
      }

      const prediction =
        saveDemandPrediction({
          cropId,
          centreId,
          predictionDate
        });

      res.status(201).json({
        message:
          "Demand prediction generated successfully.",
        prediction
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — GET DEMAND PREDICTIONS
|--------------------------------------------------------------------------
*/

router.get(
  "/demand",
  requireAdmin,
  (req, res, next) => {
    try {
      const cropId =
        req.query?.cropId !== undefined &&
        req.query?.cropId !== ""
          ? Number(req.query.cropId)
          : null;

      const centreId =
        req.query?.centreId !== undefined &&
        req.query?.centreId !== ""
          ? Number(req.query.centreId)
          : null;

      const conditions = [
        "prediction_type = 'DEMAND'"
      ];

      const params = [];

      if (cropId !== null) {
        conditions.push(
          "crop_id = ?"
        );

        params.push(cropId);
      }

      if (centreId !== null) {
        conditions.push(
          "centre_id = ?"
        );

        params.push(centreId);
      }

      const predictions =
        db.prepare(`
          SELECT *
          FROM ai_predictions
          WHERE ${conditions.join(" AND ")}
          ORDER BY
            prediction_date DESC,
            prediction_id DESC
        `).all(...params);

      res.json({
        predictions
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — QUEUE PREDICTION
|--------------------------------------------------------------------------
*/

router.post(
  "/queue",
  requireAdmin,
  (req, res, next) => {
    try {
      const centreId =
        req.body?.centreId !== undefined &&
        req.body?.centreId !== null &&
        req.body?.centreId !== ""
          ? Number(req.body.centreId)
          : null;

      const position =
        Number(
          req.body?.position || 1
        );

      const slotId =
        req.body?.slotId !== undefined &&
        req.body?.slotId !== null &&
        req.body?.slotId !== ""
          ? Number(req.body.slotId)
          : null;

      const predictionDate =
        String(
          req.body?.predictionDate ||
            new Date()
              .toISOString()
              .slice(0, 10)
        );

      if (
        centreId !== null &&
        (
          !Number.isInteger(centreId) ||
          centreId <= 0
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid centreId."
        });
      }

      if (
        !Number.isInteger(position) ||
        position <= 0
      ) {
        return res.status(400).json({
          message:
            "Position must be a positive integer."
        });
      }

      if (
        slotId !== null &&
        (
          !Number.isInteger(slotId) ||
          slotId <= 0
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid slotId."
        });
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/
          .test(predictionDate)
      ) {
        return res.status(400).json({
          message:
            "predictionDate must use YYYY-MM-DD format."
        });
      }

      if (centreId !== null) {
        const centre =
          db.prepare(`
            SELECT
              id,
              name,
              code
            FROM procurement_centres
            WHERE id = ?
          `).get(centreId);

        if (!centre) {
          return res.status(404).json({
            message:
              "Procurement centre not found."
          });
        }
      }

      if (slotId !== null) {
        const slot =
          db.prepare(`
            SELECT
              slot_id,
              centre_id,
              slot_date,
              start_time,
              end_time
            FROM centre_slots
            WHERE slot_id = ?
          `).get(slotId);

        if (!slot) {
          return res.status(404).json({
            message:
              "Slot not found."
          });
        }

        if (
          centreId !== null &&
          Number(slot.centre_id) !==
            Number(centreId)
        ) {
          return res.status(400).json({
            message:
              "Slot does not belong to the selected centre."
          });
        }
      }

      const prediction =
        saveQueuePrediction({
          centreId,
          position,
          predictionDate,
          slotId
        });

      res.status(201).json({
        message:
          "Queue prediction generated successfully.",
        prediction
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — GET QUEUE PREDICTIONS
|--------------------------------------------------------------------------
*/

router.get(
  "/queue",
  requireAdmin,
  (req, res, next) => {
    try {
      const centreId =
        req.query?.centreId !== undefined &&
        req.query?.centreId !== ""
          ? Number(req.query.centreId)
          : null;

      const conditions = [
        "prediction_type = 'QUEUE'"
      ];

      const params = [];

      if (centreId !== null) {
        conditions.push(
          "centre_id = ?"
        );

        params.push(centreId);
      }

      const predictions =
        db.prepare(`
          SELECT *
          FROM ai_predictions
          WHERE ${conditions.join(" AND ")}
          ORDER BY
            prediction_date DESC,
            prediction_id DESC
        `).all(...params);

      res.json({
        predictions
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — PRICE / TREND PREDICTION
|--------------------------------------------------------------------------
*/

router.post(
  "/price",
  requireAdmin,
  (req, res, next) => {
    try {
      const cropId =
        req.body?.cropId !== undefined &&
        req.body?.cropId !== null &&
        req.body?.cropId !== ""
          ? Number(req.body.cropId)
          : null;

      const predictionDate =
        String(
          req.body?.predictionDate ||
            new Date()
              .toISOString()
              .slice(0, 10)
        );

      if (
        cropId !== null &&
        (
          !Number.isInteger(cropId) ||
          cropId <= 0
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid cropId."
        });
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/
          .test(predictionDate)
      ) {
        return res.status(400).json({
          message:
            "predictionDate must use YYYY-MM-DD format."
        });
      }

      if (cropId !== null) {
        const crop =
          db.prepare(`
            SELECT
              crop_id,
              crop_name,
              crop_variety
            FROM crops
            WHERE crop_id = ?
          `).get(cropId);

        if (!crop) {
          return res.status(404).json({
            message:
              "Crop not found."
          });
        }
      }

      const prediction =
        savePricePrediction({
          cropId,
          predictionDate
        });

      res.status(201).json({
        message:
          "Price prediction generated successfully.",
        prediction
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — GET PRICE PREDICTIONS
|--------------------------------------------------------------------------
*/

router.get(
  "/price",
  requireAdmin,
  (req, res, next) => {
    try {
      const cropId =
        req.query?.cropId !== undefined &&
        req.query?.cropId !== ""
          ? Number(req.query.cropId)
          : null;

      const conditions = [
        "prediction_type = 'PRICE'"
      ];

      const params = [];

      if (cropId !== null) {
        conditions.push(
          "crop_id = ?"
        );

        params.push(cropId);
      }

      const predictions =
        db.prepare(`
          SELECT *
          FROM ai_predictions
          WHERE ${conditions.join(" AND ")}
          ORDER BY
            prediction_date DESC,
            prediction_id DESC
        `).all(...params);

      res.json({
        predictions
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — AI RECOMMENDATION ENGINE
|--------------------------------------------------------------------------
|
| POST /api/admin/ai/recommendation
|
| Body:
| {
|   "farmerId": 1,
|   "cropId": 1,
|   "predictionDate": "2026-09-05"
| }
|
|--------------------------------------------------------------------------
*/

router.post(
  "/recommendation",
  requireAdmin,
  (req, res, next) => {
    try {
      const farmerId =
        req.body?.farmerId !== undefined &&
        req.body?.farmerId !== null &&
        req.body?.farmerId !== ""
          ? Number(req.body.farmerId)
          : null;

      const cropId =
        req.body?.cropId !== undefined &&
        req.body?.cropId !== null &&
        req.body?.cropId !== ""
          ? Number(req.body.cropId)
          : null;

      const predictionDate =
        String(
          req.body?.predictionDate ||
            new Date()
              .toISOString()
              .slice(0, 10)
        );

      if (
        farmerId === null ||
        !Number.isInteger(farmerId) ||
        farmerId <= 0
      ) {
        return res.status(400).json({
          message:
            "Valid farmerId is required."
        });
      }

      if (
        cropId === null ||
        !Number.isInteger(cropId) ||
        cropId <= 0
      ) {
        return res.status(400).json({
          message:
            "Valid cropId is required."
        });
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/
          .test(predictionDate)
      ) {
        return res.status(400).json({
          message:
            "predictionDate must use YYYY-MM-DD format."
        });
      }

      const farmer =
        db.prepare(`
          SELECT
            farmer_id,
            user_id,
            name,
            mobile,
            email
          FROM farmers
          WHERE farmer_id = ?
        `).get(farmerId);

      if (!farmer) {
        return res.status(404).json({
          message:
            "Farmer not found."
        });
      }

      /*
      |--------------------------------------------------------------------------
      | IMPORTANT:
      | The crops table does NOT contain a quantity column.
      | Only select columns that exist in the current schema.
      |--------------------------------------------------------------------------
      */

      const crop =
        db.prepare(`
          SELECT
            crop_id,
            crop_name,
            crop_variety,
            location
          FROM crops
          WHERE crop_id = ?
        `).get(cropId);

      if (!crop) {
        return res.status(404).json({
          message:
            "Crop not found."
        });
      }

      const result =
        saveRecommendations({
          farmerId,
          cropId,
          predictionDate
        });

      res.status(201).json({
        message:
          "AI recommendations generated successfully.",
        farmer,
        crop,
        predictionDate,
        recommendations:
          result.recommendations || result
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN — GET AI RECOMMENDATIONS
|--------------------------------------------------------------------------
*/

router.get(
  "/recommendation",
  requireAdmin,
  (req, res, next) => {
    try {
      const farmerId =
        req.query?.farmerId !== undefined &&
        req.query?.farmerId !== ""
          ? Number(req.query.farmerId)
          : null;

      const cropId =
        req.query?.cropId !== undefined &&
        req.query?.cropId !== ""
          ? Number(req.query.cropId)
          : null;

      const predictionDate =
        req.query?.predictionDate
          ? String(req.query.predictionDate)
          : null;

      const conditions = [
        "prediction_type = 'RECOMMENDATION'"
      ];

      const params = [];

      if (farmerId !== null) {
        if (
          !Number.isInteger(farmerId) ||
          farmerId <= 0
        ) {
          return res.status(400).json({
            message:
              "Invalid farmerId."
          });
        }

        conditions.push(
          "farmer_id = ?"
        );

        params.push(farmerId);
      }

      if (cropId !== null) {
        if (
          !Number.isInteger(cropId) ||
          cropId <= 0
        ) {
          return res.status(400).json({
            message:
              "Invalid cropId."
          });
        }

        conditions.push(
          "crop_id = ?"
        );

        params.push(cropId);
      }

      if (predictionDate !== null) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/
            .test(predictionDate)
        ) {
          return res.status(400).json({
            message:
              "predictionDate must use YYYY-MM-DD format."
          });
        }

        conditions.push(
          "prediction_date = ?"
        );

        params.push(predictionDate);
      }

      const recommendations =
        db.prepare(`
          SELECT *
          FROM ai_predictions
          WHERE ${conditions.join(" AND ")}
          ORDER BY
            prediction_date DESC,
            recommendation_rank ASC,
            recommendation_score DESC,
            prediction_id DESC
        `).all(...params);

      res.json({
        recommendations
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;