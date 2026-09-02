import db from "../db.js";

/*
|--------------------------------------------------------------------------
| PRICE / TREND ANALYSIS SERVICE
|--------------------------------------------------------------------------
|
| Baseline model:
| - Reads current active crop price.
| - Reads historical procurement prices.
| - Calculates historical average.
| - Calculates price trend.
|
|--------------------------------------------------------------------------
*/

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function getPriceData({
  cropId = null,
  predictionDate = getToday()
} = {}) {
  let cropType = null;

  if (cropId !== null) {
    const crop = db.prepare(`
      SELECT
        crop_id,
        crop_name,
        crop_variety
      FROM crops
      WHERE crop_id = ?
    `).get(
      Number(cropId)
    );

    if (!crop) {
      return {
        error: "Crop not found."
      };
    }

    cropType = db.prepare(`
      SELECT
        id,
        name
      FROM crop_types
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1
    `).get(
      crop.crop_name
    );
  }

  const historicalConditions = [
    "p.status = 'COMPLETED'",
    "p.price_per_kg IS NOT NULL",
    "p.price_per_kg > 0"
  ];

  const historicalParams = [];

  if (cropId !== null) {
    historicalConditions.push(
      "p.crop_id = ?"
    );

    historicalParams.push(
      Number(cropId)
    );
  }

  const historicalRows =
    db.prepare(`
      SELECT
        p.id,
        p.crop_id,
        p.price_per_kg,
        p.procurement_date
      FROM procurements p
      WHERE ${historicalConditions.join(" AND ")}
      ORDER BY p.procurement_date DESC, p.id DESC
    `).all(
      ...historicalParams
    );

  const historicalPrices =
    historicalRows
      .map(
        row =>
          Number(
            row.price_per_kg
          )
      )
      .filter(
        value =>
          Number.isFinite(value) &&
          value > 0
      );

  let activePrice = null;

  if (cropType?.id) {
    const priceRow =
      db.prepare(`
        SELECT
          price_per_kg,
          effective_from
        FROM crop_prices
        WHERE crop_type_id = ?
          AND active = 1
          AND effective_from <= ?
        ORDER BY effective_from DESC, id DESC
        LIMIT 1
      `).get(
        cropType.id,
        predictionDate
      );

    if (priceRow) {
      activePrice =
        Number(
          priceRow.price_per_kg
        );
    }
  }

  const historicalAverage =
    historicalPrices.length > 0
      ? historicalPrices.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / historicalPrices.length
      : null;

  let trend = "STABLE";
  let trendPercent = 0;

  if (
    historicalPrices.length >= 2
  ) {
    const latest =
      historicalPrices[0];

    const oldest =
      historicalPrices[
        historicalPrices.length - 1
      ];

    if (oldest > 0) {
      trendPercent =
        Number(
          (
            (
              (latest - oldest) /
              oldest
            ) * 100
          ).toFixed(2)
        );

      if (trendPercent > 2) {
        trend = "UP";
      } else if (
        trendPercent < -2
      ) {
        trend = "DOWN";
      }
    }
  }

  const predictedPrice =
    activePrice ??
    historicalAverage ??
    0;

  const confidence =
    Number(
      Math.min(
        0.95,
        0.5 +
          historicalPrices.length *
            0.1
      ).toFixed(2)
    );

  return {
    predictedValue:
      Number(
        predictedPrice.toFixed(2)
      ),

    confidence,

    modelName:
      "historical-price-trend",

    modelVersion:
      "1.0",

    inputData: {
      cropId,
      cropTypeId:
        cropType?.id || null,
      predictionDate,
      activePrice,
      historicalRecords:
        historicalPrices.length,
      historicalPrices
    },

    outputData: {
      method:
        "Active price with historical trend analysis",
      historicalAverage:
        historicalAverage === null
          ? null
          : Number(
              historicalAverage.toFixed(
                2
              )
            ),
      trend,
      trendPercent
    }
  };
}

/*
|--------------------------------------------------------------------------
| SAVE PRICE PREDICTION
|--------------------------------------------------------------------------
*/

export function savePricePrediction({
  cropId = null,
  predictionDate = getToday()
} = {}) {
  const prediction =
    getPriceData({
      cropId,
      predictionDate
    });

  if (prediction.error) {
    throw new Error(
      prediction.error
    );
  }

  const result =
    db.prepare(`
      INSERT INTO ai_predictions (
        prediction_type,
        crop_id,
        prediction_date,
        predicted_value,
        confidence,
        model_name,
        model_version,
        input_data,
        output_data
      )
      VALUES (
        'PRICE',
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
      cropId,
      predictionDate,
      prediction.predictedValue,
      prediction.confidence,
      prediction.modelName,
      prediction.modelVersion,
      JSON.stringify(
        prediction.inputData
      ),
      JSON.stringify(
        prediction.outputData
      )
    );

  return db.prepare(`
    SELECT *
    FROM ai_predictions
    WHERE prediction_id = ?
  `).get(
    result.lastInsertRowid
  );
}