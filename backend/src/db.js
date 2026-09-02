import Database from "better-sqlite3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// ============================================================
// DATABASE LOCATION
// ============================================================

const dbFile =
  process.env.DB_FILE || "./data/procurement.sqlite";

const dbDir = path.dirname(dbFile);

if (dbDir && dbDir !== ".") {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbFile);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// USERS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK(role IN ('FARMER','ADMIN')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// ============================================================
// FARMERS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS farmers (
  farmer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  email TEXT,
  location TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  village TEXT NOT NULL DEFAULT '',
  preferred_language TEXT NOT NULL DEFAULT 'en'
    CHECK(preferred_language IN ('en','te','hi')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL
);
`);

// ============================================================
// ADMINS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL
);
`);

// ============================================================
// CROPS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS crops (
  crop_id INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id INTEGER NOT NULL,
  crop_name TEXT NOT NULL,
  crop_variety TEXT NOT NULL,
  quantity_kg REAL NOT NULL CHECK(quantity_kg > 0),
  harvest_date TEXT NOT NULL,
  expected_procurement_date TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(farmer_id)
    REFERENCES farmers(farmer_id)
    ON DELETE CASCADE
);
`);

// ============================================================
// CROP TYPES
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS crop_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// ============================================================
// PROCUREMENT CENTRES
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS procurement_centres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  village TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  contact_number TEXT NOT NULL DEFAULT '',
  capacity_per_day REAL NOT NULL CHECK(capacity_per_day > 0),
  current_load REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK(status IN ('ACTIVE','INACTIVE','MAINTENANCE','FULL')),
  opening_time TEXT NOT NULL DEFAULT '08:00',
  closing_time TEXT NOT NULL DEFAULT '18:00',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// ============================================================
// CENTRE SLOTS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS centre_slots (
  slot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  centre_id INTEGER NOT NULL,
  slot_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1
    CHECK(capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0
    CHECK(booked_count >= 0),
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK(status IN ('AVAILABLE','FULL','BLOCKED','CLOSED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(centre_id)
    REFERENCES procurement_centres(id)
    ON DELETE CASCADE,
  UNIQUE(centre_id, slot_date, start_time, end_time)
);
`);

// ============================================================
// BOOKINGS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
  booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id INTEGER NOT NULL,
  crop_id INTEGER NOT NULL,
  centre_id INTEGER NOT NULL,
  slot_id INTEGER NOT NULL,
  booking_date TEXT NOT NULL,
  token_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'BOOKED'
    CHECK(
      status IN (
        'BOOKED',
        'CANCELLED',
        'CHECKED_IN',
        'VERIFIED',
        'PROCESSING',
        'COMPLETED',
        'REJECTED'
      )
    ),
  booking_source TEXT NOT NULL DEFAULT 'FARMER'
    CHECK(booking_source IN ('FARMER','ADMIN','SYSTEM','AI')),
  recommendation_score REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(farmer_id)
    REFERENCES farmers(farmer_id)
    ON DELETE CASCADE,

  FOREIGN KEY(crop_id)
    REFERENCES crops(crop_id)
    ON DELETE CASCADE,

  FOREIGN KEY(centre_id)
    REFERENCES procurement_centres(id)
    ON DELETE CASCADE,

  FOREIGN KEY(slot_id)
    REFERENCES centre_slots(slot_id)
    ON DELETE CASCADE,

  UNIQUE(centre_id, booking_date, token_number)
);
`);

// ============================================================
// QUEUES
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS queues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER,
  centre_id INTEGER NOT NULL,
  farmer_id INTEGER NOT NULL,
  crop_id INTEGER NOT NULL,
  procurement_id INTEGER,
  token_number INTEGER NOT NULL,
  queue_date TEXT NOT NULL,
  position INTEGER NOT NULL,
  estimated_wait_minutes INTEGER NOT NULL DEFAULT 0,
  check_in_time TEXT,
  service_start_time TEXT,
  service_end_time TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING'
    CHECK(
      status IN (
        'WAITING',
        'CALLED',
        'CHECKED_IN',
        'VERIFIED',
        'PROCESSING',
        'COMPLETED',
        'REJECTED',
        'CANCELLED'
      )
    ),

  FOREIGN KEY(booking_id)
    REFERENCES bookings(booking_id)
    ON DELETE SET NULL,

  FOREIGN KEY(centre_id)
    REFERENCES procurement_centres(id),

  FOREIGN KEY(farmer_id)
    REFERENCES farmers(farmer_id),

  FOREIGN KEY(crop_id)
    REFERENCES crops(crop_id),

  FOREIGN KEY(procurement_id)
    REFERENCES procurements(id)
);
`);

// ============================================================
// CHECK-INS / VERIFICATION
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS checkins (
  checkin_id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  farmer_id INTEGER NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(
      verification_status IN (
        'PENDING',
        'VERIFIED',
        'FAILED'
      )
    ),
  verified_by INTEGER,
  check_in_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_time TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(booking_id)
    REFERENCES bookings(booking_id)
    ON DELETE CASCADE,

  FOREIGN KEY(farmer_id)
    REFERENCES farmers(farmer_id)
    ON DELETE CASCADE,

  FOREIGN KEY(verified_by)
    REFERENCES admins(admin_id)
);
`);

// ============================================================
// CROP PRICES
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS crop_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crop_type_id INTEGER NOT NULL,
  variety TEXT NOT NULL DEFAULT '',
  price_per_kg REAL NOT NULL CHECK(price_per_kg >= 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(crop_type_id)
    REFERENCES crop_types(id),

  FOREIGN KEY(created_by)
    REFERENCES admins(admin_id)
);
`);

// ============================================================
// PROCUREMENTS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS procurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  procurement_number TEXT NOT NULL UNIQUE,
  booking_id INTEGER,
  farmer_id INTEGER NOT NULL,
  crop_id INTEGER NOT NULL,
  centre_id INTEGER NOT NULL,
  procurement_date TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'REGISTERED'
    CHECK(
      status IN (
        'REGISTERED',
        'QUALITY_PENDING',
        'QUALITY_ACCEPTED',
        'QUALITY_REJECTED',
        'WEIGHT_PENDING',
        'COMPLETED',
        'CANCELLED'
      )
    ),

  gross_weight REAL,
  tare_weight REAL,
  net_weight REAL,

  price_per_kg REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,

  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(booking_id)
    REFERENCES bookings(booking_id)
    ON DELETE SET NULL,

  FOREIGN KEY(farmer_id)
    REFERENCES farmers(farmer_id),

  FOREIGN KEY(crop_id)
    REFERENCES crops(crop_id),

  FOREIGN KEY(centre_id)
    REFERENCES procurement_centres(id),

  FOREIGN KEY(created_by)
    REFERENCES admins(admin_id)
);
`);

// ============================================================
// QUALITY ASSESSMENTS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS quality_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  procurement_id INTEGER NOT NULL UNIQUE,
  grade TEXT NOT NULL,
  moisture_percent REAL,
  foreign_matter_percent REAL,
  damaged_percent REAL,
  remarks TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(
      decision IN (
        'PENDING',
        'ACCEPTED',
        'REJECTED',
        'RETURNED'
      )
    ),
  assessed_by INTEGER,
  assessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(procurement_id)
    REFERENCES procurements(id)
    ON DELETE CASCADE,

  FOREIGN KEY(assessed_by)
    REFERENCES admins(admin_id)
);
`);

// ============================================================
// PAYMENTS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  procurement_id INTEGER NOT NULL UNIQUE,
  farmer_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(
      status IN (
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'FAILED',
        'CANCELLED'
      )
    ),
  paid_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(procurement_id)
    REFERENCES procurements(id)
    ON DELETE CASCADE,

  FOREIGN KEY(farmer_id)
    REFERENCES farmers(farmer_id)
);
`);

// ============================================================
// RECEIPTS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  procurement_id INTEGER NOT NULL UNIQUE,
  receipt_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by INTEGER,

  FOREIGN KEY(procurement_id)
    REFERENCES procurements(id)
    ON DELETE CASCADE,

  FOREIGN KEY(generated_by)
    REFERENCES admins(admin_id)
);
`);

// ============================================================
// NOTIFICATIONS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_type TEXT,
  related_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);
`);

// ============================================================
// AI PREDICTIONS
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS ai_predictions (
  prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,

  prediction_type TEXT NOT NULL
    CHECK(
      prediction_type IN (
        'DEMAND',
        'QUEUE',
        'PRICE',
        'RECOMMENDATION'
      )
    ),

  farmer_id INTEGER,
  crop_id INTEGER,
  centre_id INTEGER,
  slot_id INTEGER,

  prediction_date TEXT NOT NULL,

  predicted_value REAL,
  confidence REAL,

  recommendation_rank INTEGER,
  recommendation_score REAL,

  model_name TEXT,
  model_version TEXT,

  input_data TEXT,
  output_data TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(farmer_id)
    REFERENCES farmers(farmer_id)
    ON DELETE SET NULL,

  FOREIGN KEY(crop_id)
    REFERENCES crops(crop_id)
    ON DELETE SET NULL,

  FOREIGN KEY(centre_id)
    REFERENCES procurement_centres(id)
    ON DELETE SET NULL,

  FOREIGN KEY(slot_id)
    REFERENCES centre_slots(slot_id)
    ON DELETE SET NULL
);
`);

// ============================================================
// SAFE MIGRATION HELPERS
// ============================================================

function addColumnIfMissing(
  tableName,
  columnName,
  columnDefinition
) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all();

  const exists = columns.some(
    column => column.name === columnName
  );

  if (!exists) {
    db.exec(
      `ALTER TABLE ${tableName}
       ADD COLUMN ${columnName} ${columnDefinition}`
    );
  }
}

// Existing Phase 4 database migration
addColumnIfMissing(
  "farmers",
  "user_id",
  "INTEGER"
);

addColumnIfMissing(
  "admins",
  "user_id",
  "INTEGER"
);

// New Phase 5 migrations for an existing database
addColumnIfMissing(
  "bookings",
  "booking_source",
  "TEXT NOT NULL DEFAULT 'FARMER'"
);

addColumnIfMissing(
  "bookings",
  "recommendation_score",
  "REAL"
);

addColumnIfMissing(
  "queues",
  "booking_id",
  "INTEGER"
);

addColumnIfMissing(
  "procurements",
  "booking_id",
  "INTEGER"
);

addColumnIfMissing(
  "quality_assessments",
  "decision",
  "TEXT NOT NULL DEFAULT 'PENDING'"
);

addColumnIfMissing(
  "payments",
  "processed_at",
  "TEXT"
);

addColumnIfMissing(
  "payments",
  "updated_at",
  "TEXT"
);

// ============================================================
// INDEXES
// ============================================================

db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_farmers_user_id
ON farmers(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_user_id
ON admins(user_id);

CREATE INDEX IF NOT EXISTS idx_crops_farmer_id
ON crops(farmer_id);

CREATE INDEX IF NOT EXISTS idx_procurements_farmer
ON procurements(farmer_id);

CREATE INDEX IF NOT EXISTS idx_procurements_centre
ON procurements(centre_id);

CREATE INDEX IF NOT EXISTS idx_procurements_date
ON procurements(procurement_date);

CREATE INDEX IF NOT EXISTS idx_procurements_booking
ON procurements(booking_id);

CREATE INDEX IF NOT EXISTS idx_queue_centre_date
ON queues(centre_id, queue_date);

CREATE INDEX IF NOT EXISTS idx_queue_booking
ON queues(booking_id);

CREATE INDEX IF NOT EXISTS idx_queue_status
ON queues(status);

CREATE INDEX IF NOT EXISTS idx_bookings_farmer
ON bookings(farmer_id);

CREATE INDEX IF NOT EXISTS idx_bookings_centre_date
ON bookings(centre_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_bookings_slot
ON bookings(slot_id);

CREATE INDEX IF NOT EXISTS idx_slots_centre_date
ON centre_slots(centre_id, slot_date);

CREATE INDEX IF NOT EXISTS idx_checkins_booking
ON checkins(booking_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_type_date
ON ai_predictions(prediction_type, prediction_date);
`);

// ============================================================
// DEFAULT CROP TYPES
// ============================================================

const defaults = [
  "Paddy",
  "Wheat",
  "Maize",
  "Cotton",
  "Groundnut",
  "Chilli",
  "Turmeric",
  "Red Gram",
  "Green Gram"
];

const insertCrop = db.prepare(
  "INSERT OR IGNORE INTO crop_types(name) VALUES(?)"
);

for (const name of defaults) {
  insertCrop.run(name);
}

// ============================================================
// DEFAULT SYSTEM ADMIN
// ============================================================

db.prepare(`
  INSERT OR IGNORE INTO admins(name, email)
  VALUES(?, ?)
`).run(
  "System Admin",
  "admin@smartprocure.local"
);

// ============================================================
// EXISTING TEST DATA LINKING
// ============================================================

// Link existing farmer records to users where possible.
db.exec(`
UPDATE farmers
SET user_id = (
  SELECT u.user_id
  FROM users u
  WHERE u.mobile = farmers.mobile
     OR (
       u.email IS NOT NULL
       AND farmers.email IS NOT NULL
       AND LOWER(u.email) = LOWER(farmers.email)
     )
  ORDER BY u.user_id
  LIMIT 1
)
WHERE user_id IS NULL;
`);

// Link existing admin records to users where possible.
db.exec(`
UPDATE admins
SET user_id = (
  SELECT u.user_id
  FROM users u
  WHERE (
    u.email IS NOT NULL
    AND LOWER(u.email) = LOWER(admins.email)
  )
  ORDER BY u.user_id
  LIMIT 1
)
WHERE user_id IS NULL;
`);

// ============================================================
// EXPORT
// ============================================================

export default db;