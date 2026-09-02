import db from "../db.js";

/*
|--------------------------------------------------------------------------
| QUEUE PREDICTION SERVICE
|--------------------------------------------------------------------------
|
| Baseline model:
| - Uses completed queue/service records.
| - Calculates average service time.
| - Estimates waiting time from people ahead.
|
|--------------------------------------------------------------------------
*/

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| GET HISTORICAL SERVICE TIME
|--------------------------------------------------------------------------
*/

function getAverageServiceMinutes(centreId = null) {
  const params = [];

  let query = `
    SELECT
      service_start_time,
      service_end_time
    FROM queues
    WHERE service_start_time IS NOT NULL
      AND service_end_time IS NOT NULL
  `;

  if (centreId !== null) {
    query += ` AND centre_id = ?`;
    params.push(Number(centreId));
  }

  const rows = db
    .prepare(query)
    .all(...params);

  const durations = [];

  for (const row of rows) {
    const start =
      new Date(
        String(
          row.service_start_time
        ).replace(" ", "T")
      );

    const end =
      new Date(
        String(
          row.service_end_time
        ).replace(" ", "T")
      );

    const minutes =
      (end.getTime() -
        start.getTime()) /
      60000;

    if (
      Number.isFinite(minutes) &&
      minutes >= 0
    ) {
      durations.push(minutes);
    }
  }

  if (durations.length === 0) {
    return {
      averageMinutes: 20,
      records: 0
    };
  }

  const averageMinutes =
    durations.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / durations.length;

  return {
    averageMinutes:
      Number(
        averageMinutes.toFixed(2)
      ),
    records:
      durations.length
  };
}

/*
|--------------------------------------------------------------------------
| PREDICT QUEUE WAIT
|--------------------------------------------------------------------------
*/

export function predictQueue({
  centreId = null,
  position = 1,
  predictionDate = getToday()
} = {}) {
  const safePosition =
    Math.max(
      1,
      Number(position) || 1
    );

  const service =
    getAverageServiceMinutes(
      centreId
    );

  const peopleAhead =
    Math.max(
      0,
      safePosition - 1
    );

  const predictedWait =
    Number(
      (
        peopleAhead *
        service.averageMinutes
      ).toFixed(2)
    );

  /*
  |--------------------------------------------------------------------------
  | Confidence
  |--------------------------------------------------------------------------
  */

  const confidence =
    Number(
      Math.min(
        0.95,
        0.5 +
          service.records *
            0.1
      ).toFixed(2)
    );

  return {
    predictedValue:
      predictedWait,

    confidence,

    modelName:
      "historical-service-time",

    modelVersion:
      "1.0",

    inputData: {
      centreId,
      position: safePosition,
      peopleAhead,
      historicalServiceRecords:
        service.records,
      averageServiceMinutes:
        service.averageMinutes
    },

    outputData: {
      method:
        "People ahead × historical average service time",
      predictionDate
    }
  };
}

/*
|--------------------------------------------------------------------------
| SAVE QUEUE PREDICTION
|--------------------------------------------------------------------------
*/

export function saveQueuePrediction({
  centreId = null,
  position = 1,
  predictionDate = getToday(),
  slotId = null
} = {}) {
  const prediction =
    predictQueue({
      centreId,
      position,
      predictionDate
    });

  const result =
    db.prepare(`
      INSERT INTO ai_predictions (
        prediction_type,
        centre_id,
        slot_id,
        prediction_date,
        predicted_value,
        confidence,
        model_name,
        model_version,
        input_data,
        output_data
      )
      VALUES (
        'QUEUE',
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
      centreId,
      slotId,
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