import { Router } from "express";
import db from "../db.js";

import { requireFarmer } from "../auth.js";

import {
  saveRecommendations
} from "../ai/recommendation.service.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| FARMER — AI RECOMMENDATIONS
|--------------------------------------------------------------------------
|
| GET /api/farmer/ai/recommendations
|
| Example:
| /api/farmer/ai/recommendations?cropId=1&predictionDate=2026-09-05
|
|--------------------------------------------------------------------------
*/

router.get(
  "/recommendations",
  requireFarmer,
  (req, res, next) => {
    try {
      const farmerId = Number(req.farmerId);

      const cropId =
        req.query?.cropId !== undefined &&
        req.query?.cropId !== ""
          ? Number(req.query.cropId)
          : null;

      const predictionDate =
        String(
          req.query?.predictionDate ||
            new Date()
              .toISOString()
              .slice(0, 10)
        );

      if (
        !Number.isInteger(farmerId) ||
        farmerId <= 0
      ) {
        return res.status(401).json({
          message:
            "Farmer authentication is required."
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
            "Farmer profile not found."
        });
      }

      const crop =
        db.prepare(`
          SELECT
            crop_id,
            crop_name,
            crop_variety,
            location
          FROM crops
          WHERE crop_id = ?
            AND farmer_id = ?
        `).get(
          cropId,
          farmerId
        );

      if (!crop) {
        return res.status(404).json({
          message:
            "Crop not found for this farmer."
        });
      }

      const result =
        saveRecommendations({
          farmerId,
          cropId,
          predictionDate
        });

      const recommendations =
        result?.recommendations ||
        result ||
        [];

      res.json({
        message:
          "AI recommendations retrieved successfully.",
        farmer: {
          farmer_id: farmer.farmer_id,
          name: farmer.name
        },
        crop,
        predictionDate,
        recommendations
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| FARMER — GET SAVED AI RECOMMENDATIONS
|--------------------------------------------------------------------------
|
| GET /api/farmer/ai/recommendations/saved
|
|--------------------------------------------------------------------------
*/

router.get(
  "/recommendations/saved",
  requireFarmer,
  (req, res, next) => {
    try {
      const farmerId = Number(req.farmerId);

      const cropId =
        req.query?.cropId !== undefined &&
        req.query?.cropId !== ""
          ? Number(req.query.cropId)
          : null;

      const predictionDate =
        req.query?.predictionDate
          ? String(req.query.predictionDate)
          : null;

      if (
        !Number.isInteger(farmerId) ||
        farmerId <= 0
      ) {
        return res.status(401).json({
          message:
            "Farmer authentication is required."
        });
      }

      const conditions = [
        "prediction_type = 'RECOMMENDATION'",
        "farmer_id = ?"
      ];

      const params = [
        farmerId
      ];

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
          SELECT
            *
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