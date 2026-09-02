import db from "../db.js";

/*
|--------------------------------------------------------------------------
| DEMAND PREDICTION SERVICE
|--------------------------------------------------------------------------
|
| Baseline model:
| - Uses completed procurement records.
| - Calculates average net quantity for the selected crop.
| - Uses recent history where available.
| - Stores the prediction in ai_predictions.
|
| This is intentionally transparent and deterministic.
| A trained ML model can replace this service later.
|
|--------------------------------------------------------------------------
*/

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

export function predictDemand({
  cropId = null,
  centreId = null,
  predictionDate = getToday()
} = {}) {
  const params = [];
  const filters = [
    "p.status = 'COMPLETED'"
  ];

  if (cropId !== null) {
    filters.push("p.crop_id = ?");
    params.push(Number(cropId));
  }

  if (centreId !== null) {
    filters.push("p.centre_id = ?");
    params.push(Number(centreId));
  }

  const rows = db.prepare(`
    SELECT
      p.id,
      p.crop_id,
      p.centre_id,
      p.net_weight,
      p.procurement_date
    FROM procurements p
    WHERE ${filters.join(" AND ")}
    ORDER BY p.procurement_date DESC
  `).all(...params);

  if (rows.length === 0) {
    return {
      predictedValue: 0,
      confidence: 0,
      modelName: "historical-average",
      modelVersion: "1.0",
      inputData: {
        cropId,
        centreId,
        historicalRecords: 0
      },
      outputData: {
        method: "No historical data available"
      }
    };
  }

  const quantities = rows
    .map(row => Number(row.net_weight))
    .filter(
      value =>
        Number.isFinite(value) &&
        value > 0
    );

  if (quantities.length === 0) {
    return {
      predictedValue: 0,
      confidence: 0,
      modelName: "historical-average",
      modelVersion: "1.0",
      inputData: {
        cropId,
        centreId,
        historicalRecords: rows.length
      },
      outputData: {
        method: "No valid quantity records"
      }
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Weighted average
  |--------------------------------------------------------------------------
  |
  | Recent records receive more weight than older records.
  |
  */

  let weightedTotal = 0;
  let weightSum = 0;

  rows.forEach((row, index) => {
    const quantity =
      Number(row.net_weight);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return;
    }

    const weight =
      1 / (index + 1);

    weightedTotal +=
      quantity * weight;

    weightSum += weight;
  });

  const predictedValue =
    weightSum > 0
      ? Number(
          (
            weightedTotal /
            weightSum
          ).toFixed(2)
        )
      : 0;

  /*
  |--------------------------------------------------------------------------
  | Simple confidence
  |--------------------------------------------------------------------------
  |
  | More historical records => higher confidence.
  | Maximum confidence for this baseline model is 0.95.
  |
  */

  const confidence =
    Number(
      Math.min(
        0.95,
        0.5 +
          quantities.length *
            0.1
      ).toFixed(2)
    );

  return {
    predictedValue,
    confidence,

    modelName:
      "historical-weighted-average",

    modelVersion:
      "1.0",

    inputData: {
      cropId,
      centreId,
      historicalRecords:
        quantities.length,

      quantities
    },

    outputData: {
      method:
        "Recency-weighted historical average"
    }
  };
}

/*
|--------------------------------------------------------------------------
| SAVE DEMAND PREDICTION
|--------------------------------------------------------------------------
*/

export function saveDemandPrediction({
  cropId = null,
  centreId = null,
  predictionDate = getToday()
} = {}) {
  const prediction =
    predictDemand({
      cropId,
      centreId,
      predictionDate
    });

  const result =
    db.prepare(`
      INSERT INTO ai_predictions (
        prediction_type,
        crop_id,
        centre_id,
        prediction_date,
        predicted_value,
        confidence,
        model_name,
        model_version,
        input_data,
        output_data
      )
      VALUES (
        'DEMAND',
        ?,
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
      centreId,
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