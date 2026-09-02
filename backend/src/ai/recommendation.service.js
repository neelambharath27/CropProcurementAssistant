import db from "../db.js";

/*
|--------------------------------------------------------------------------
| AI RECOMMENDATION SERVICE
|--------------------------------------------------------------------------
|
| Produces a ranked list of centre + slot combinations.
|
| Score components:
| - Lower queue wait      = better
| - Available capacity    = better
| - Higher price          = better
| - Stable / rising price = better
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
| NORMALIZE SCORE
|--------------------------------------------------------------------------
*/

function normalize(value, min, max) {
  if (max === min) {
    return 1;
  }

  return (
    (value - min) /
    (max - min)
  );
}

/*
|--------------------------------------------------------------------------
| GET CURRENT PRICE
|--------------------------------------------------------------------------
*/

function getCropPrice(crop) {
  const cropType = db.prepare(`
    SELECT id
    FROM crop_types
    WHERE LOWER(name) = LOWER(?)
    LIMIT 1
  `).get(crop.crop_name);

  if (!cropType) {
    return null;
  }

  const price = db.prepare(`
    SELECT
      price_per_kg
    FROM crop_prices
    WHERE crop_type_id = ?
      AND active = 1
    ORDER BY
      effective_from DESC,
      id DESC
    LIMIT 1
  `).get(cropType.id);

  return price
    ? Number(price.price_per_kg)
    : null;
}

/*
|--------------------------------------------------------------------------
| GET AVAILABLE CENTRES
|--------------------------------------------------------------------------
*/

function getCentres() {
  return db.prepare(`
    SELECT
      id,
      name,
      code,
      location,
      district,
      village,
      opening_time,
      closing_time,
      capacity_per_day,
      current_load,
      status
    FROM procurement_centres
    WHERE status = 'ACTIVE'
    ORDER BY name ASC
  `).all();
}

function ensureSlotsForDate(centres, date) {
  const transaction = db.transaction(() => {
    for (const centre of centres) {
      const count = db.prepare(`SELECT COUNT(*) AS c FROM centre_slots WHERE centre_id=? AND slot_date=?`).get(centre.id, date).c;
      if (Number(count) > 0) continue;
      const toMinutes = value => { const [h,m] = String(value || "08:00").slice(0,5).split(":").map(Number); return h*60+m; };
      const toTime = n => `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
      let cursor = toMinutes(centre.opening_time || "08:00");
      const finish = toMinutes(centre.closing_time || "18:00");
      while (cursor + 60 <= finish) {
        db.prepare(`INSERT OR IGNORE INTO centre_slots (centre_id,slot_date,start_time,end_time,capacity,booked_count,status) VALUES (?,?,?,?,10,0,'AVAILABLE')`).run(centre.id, date, toTime(cursor), toTime(cursor+60));
        cursor += 60;
      }
    }
  });
  transaction();
}

/*
|--------------------------------------------------------------------------
| GET AVAILABLE SLOTS
|--------------------------------------------------------------------------
*/

function getSlots(
  centreId,
  predictionDate
) {
  return db.prepare(`
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
      AND status IN (
        'AVAILABLE',
        'OPEN'
      )
      AND booked_count < capacity
    ORDER BY start_time ASC
  `).all(
    centreId,
    predictionDate
  );
}

/*
|--------------------------------------------------------------------------
| GET CURRENT QUEUE LENGTH
|--------------------------------------------------------------------------
*/

function getQueueLength(
  centreId,
  predictionDate
) {
  const result = db.prepare(`
    SELECT
      COUNT(*) AS count
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
    predictionDate
  );

  return Number(
    result.count || 0
  );
}

/*
|--------------------------------------------------------------------------
| GET PREDICTED QUEUE WAIT
|--------------------------------------------------------------------------
*/

function getPredictedWait(
  centreId,
  slotId,
  predictionDate,
  position
) {
  const prediction = db.prepare(`
    SELECT
      predicted_value
    FROM ai_predictions
    WHERE prediction_type = 'QUEUE'
      AND centre_id = ?
      AND slot_id = ?
      AND prediction_date = ?
    ORDER BY
      prediction_id DESC
    LIMIT 1
  `).get(
    centreId,
    slotId,
    predictionDate
  );

  if (prediction) {
    return Number(
      prediction.predicted_value || 0
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Fallback estimate
  |--------------------------------------------------------------------------
  */

  return Math.max(
    0,
    (Number(position) - 1) * 20
  );
}

/*
|--------------------------------------------------------------------------
| GET PRICE TREND
|--------------------------------------------------------------------------
*/

function getPriceTrend(
  cropId,
  predictionDate
) {
  const prediction = db.prepare(`
    SELECT
      predicted_value,
      output_data
    FROM ai_predictions
    WHERE prediction_type = 'PRICE'
      AND crop_id = ?
      AND prediction_date = ?
    ORDER BY
      prediction_id DESC
    LIMIT 1
  `).get(
    cropId,
    predictionDate
  );

  if (!prediction) {
    return {
      price: 0,
      trend: "UNKNOWN",
      trendPercent: 0
    };
  }

  let output = {};

  try {
    output =
      JSON.parse(
        prediction.output_data || "{}"
      );
  } catch {
    output = {};
  }

  return {
    price: Number(
      prediction.predicted_value || 0
    ),
    trend:
      output.trend || "UNKNOWN",
    trendPercent:
      Number(
        output.trendPercent || 0
      )
  };
}

/*
|--------------------------------------------------------------------------
| GENERATE RECOMMENDATIONS
|--------------------------------------------------------------------------
*/

export function generateRecommendations({
  farmerId,
  cropId,
  predictionDate = getToday()
}) {
  const farmer = db.prepare(`
    SELECT *
    FROM farmers
    WHERE farmer_id = ?
  `).get(farmerId);

  if (!farmer) {
    throw new Error(
      "Farmer not found."
    );
  }

  const crop = db.prepare(`
    SELECT *
    FROM crops
    WHERE crop_id = ?
      AND farmer_id = ?
  `).get(
    cropId,
    farmerId
  );

  if (!crop) {
    throw new Error(
      "Crop not found for farmer."
    );
  }

  const centres =
    getCentres();

  ensureSlotsForDate(centres, predictionDate);

  const candidates = [];

  const price =
    getCropPrice(crop);

  const pricePrediction =
    getPriceTrend(
      cropId,
      predictionDate
    );

  for (const centre of centres) {
    const slots =
      getSlots(
        centre.id,
        predictionDate
      );

    const queueLength =
      getQueueLength(
        centre.id,
        predictionDate
      );

    if (slots.length === 0) {
      continue;
    }

    for (const slot of slots) {
      const position =
        queueLength + 1;

      const predictedWait =
        getPredictedWait(
          centre.id,
          slot.slot_id,
          predictionDate,
          position
        );

      const availableCapacity =
        Math.max(
          0,
          Number(slot.capacity) -
          Number(slot.booked_count)
        );

      const farmerText = `${farmer.village || ""} ${farmer.district || ""} ${farmer.location || ""}`.toLowerCase();
      const centreText = `${centre.village || ""} ${centre.district || ""} ${centre.location || ""} ${centre.name || ""}`.toLowerCase();
      const proximityScore = farmerText && centreText && centreText.includes(farmerText.trim()) ? 1 :
        (farmer.village && centreText.includes(String(farmer.village).toLowerCase()) ? 1 :
          (farmer.district && centreText.includes(String(farmer.district).toLowerCase()) ? 0.7 : 0.4));

      candidates.push({
        centreId:
          centre.id,

        centreName:
          centre.name,

        centreCode:
          centre.code,

        slotId:
          slot.slot_id,

        slotDate:
          slot.slot_date,

        startTime:
          slot.start_time,

        endTime:
          slot.end_time,

        queueLength,

        proximityScore,

        predictedWait,

        availableCapacity,

        price:
          price ??
          pricePrediction.price,

        priceTrend:
          pricePrediction.trend,

        priceTrendPercent:
          pricePrediction.trendPercent
      });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  /*
  |--------------------------------------------------------------------------
  | FIND NORMALIZATION RANGES
  |--------------------------------------------------------------------------
  */

  const waits =
    candidates.map(
      item => item.predictedWait
    );

  const capacities =
    candidates.map(
      item => item.availableCapacity
    );

  const prices =
    candidates.map(
      item => item.price
    );

  const proximities = candidates.map(item => item.proximityScore);
  const minProximity = Math.min(...proximities);
  const maxProximity = Math.max(...proximities);

  const minWait =
    Math.min(...waits);

  const maxWait =
    Math.max(...waits);

  const minCapacity =
    Math.min(...capacities);

  const maxCapacity =
    Math.max(...capacities);

  const minPrice =
    Math.min(...prices);

  const maxPrice =
    Math.max(...prices);

  /*
  |--------------------------------------------------------------------------
  | CALCULATE SCORE
  |--------------------------------------------------------------------------
  |
  | Score:
  |
  | 40% = lower waiting time
  | 25% = available capacity
  | 25% = price
  | 10% = price trend
  |
  |--------------------------------------------------------------------------
  */

  const scored =
    candidates.map(
      item => {
        const waitScore =
          1 -
          normalize(
            item.predictedWait,
            minWait,
            maxWait
          );

        const capacityScore =
          normalize(
            item.availableCapacity,
            minCapacity,
            maxCapacity
          );

        const priceScore =
          normalize(
            item.price,
            minPrice,
            maxPrice
          );

        const proximityScore = normalize(item.proximityScore, minProximity, maxProximity);

        let trendScore = 0.5;

        if (
          item.priceTrend ===
          "UP"
        ) {
          trendScore = 1;
        } else if (
          item.priceTrend ===
          "DOWN"
        ) {
          trendScore = 0.25;
        }

        const score =
          (
            waitScore * 0.35 +
            capacityScore * 0.20 +
            priceScore * 0.20 +
            proximityScore * 0.15 +
            trendScore * 0.10
          );

        return {
          ...item,

          recommendationScore:
            Number(
              score.toFixed(4)
            )
        };
      }
    );

  /*
  |--------------------------------------------------------------------------
  | RANK
  |--------------------------------------------------------------------------
  */

  scored.sort(
    (a, b) =>
      b.recommendationScore -
      a.recommendationScore
  );

  return scored.map(
    (item, index) => ({
      ...item,
      recommendationRank:
        index + 1
    })
  );
}

/*
|--------------------------------------------------------------------------
| SAVE RECOMMENDATIONS
|--------------------------------------------------------------------------
|
| IMPORTANT:
| For the same farmer + crop + prediction date,
| replace the previous recommendation set.
|
| This prevents duplicate recommendation rows
| when the farmer refreshes the recommendation API.
|
|--------------------------------------------------------------------------
*/

export function saveRecommendations({
  farmerId,
  cropId,
  predictionDate = getToday()
}) {
  const recommendations =
    generateRecommendations({
      farmerId,
      cropId,
      predictionDate
    });

  const saved = [];

  db.transaction(() => {

    /*
    |--------------------------------------------------------------------------
    | Remove previous recommendation set
    |--------------------------------------------------------------------------
    */

    db.prepare(`
      DELETE FROM ai_predictions
      WHERE prediction_type = 'RECOMMENDATION'
        AND farmer_id = ?
        AND crop_id = ?
        AND prediction_date = ?
    `).run(
      farmerId,
      cropId,
      predictionDate
    );

    /*
    |--------------------------------------------------------------------------
    | Save latest recommendation set
    |--------------------------------------------------------------------------
    */

    for (const item of recommendations) {
      const result =
        db.prepare(`
          INSERT INTO ai_predictions (
            prediction_type,
            farmer_id,
            crop_id,
            centre_id,
            slot_id,
            prediction_date,
            predicted_value,
            confidence,
            recommendation_rank,
            recommendation_score,
            model_name,
            model_version,
            input_data,
            output_data
          )
          VALUES (
            'RECOMMENDATION',
            ?,
            ?,
            ?,
            ?,
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
          farmerId,
          cropId,
          item.centreId,
          item.slotId,
          predictionDate,
          item.predictedWait,
          0.7,
          item.recommendationRank,
          item.recommendationScore,
          "weighted-recommendation",
          "1.0",
          JSON.stringify({
            farmerId,
            cropId,
            centreId:
              item.centreId,
            slotId:
              item.slotId
          }),
          JSON.stringify({
            centreName:
              item.centreName,
            centreCode:
              item.centreCode,
            startTime:
              item.startTime,
            endTime:
              item.endTime,
            predictedWait:
              item.predictedWait,
            availableCapacity:
              item.availableCapacity,
            queueLength:
              item.queueLength,
            proximityScore:
              item.proximityScore,
            price:
              item.price,
            priceTrend:
              item.priceTrend,
            priceTrendPercent:
              item.priceTrendPercent,
            recommendationRank:
              item.recommendationRank,
            recommendationScore:
              item.recommendationScore
          })
        );

      saved.push(
        db.prepare(`
          SELECT *
          FROM ai_predictions
          WHERE prediction_id = ?
        `).get(
          result.lastInsertRowid
        )
      );
    }
  })();

  return saved;
}