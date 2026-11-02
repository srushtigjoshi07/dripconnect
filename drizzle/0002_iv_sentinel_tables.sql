DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE wards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_beds INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE nurses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ward_id TEXT NOT NULL,
  shift TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  bed TEXT NOT NULL,
  ward_id TEXT NOT NULL,
  nurse_id TEXT NOT NULL,
  fluid TEXT NOT NULL,
  initial_volume REAL NOT NULL,
  remaining_volume REAL NOT NULL,
  prescribed_rate REAL NOT NULL,
  flow_rate REAL NOT NULL,
  drip_factor INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'normal',
  condition_state TEXT NOT NULL DEFAULT 'normal',
  condition_since_sim_min REAL NOT NULL DEFAULT 0,
  low_flow_since_sim_min REAL,
  zero_flow_ticks INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  started_sim_min REAL NOT NULL DEFAULT 0,
  completed_at INTEGER,
  completed_sim_min REAL,
  last_updated INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  nurse_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  status TEXT NOT NULL DEFAULT 'new',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_sim_min REAL NOT NULL DEFAULT 0,
  ack_sim_min REAL,
  resolved_sim_min REAL,
  escalated INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  ts INTEGER NOT NULL,
  sim_min REAL NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  sim_min REAL NOT NULL,
  remaining REAL NOT NULL,
  flow REAL NOT NULL
);
--> statement-breakpoint
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  low_threshold_pct INTEGER NOT NULL DEFAULT 20,
  escalation_sim_min REAL NOT NULL DEFAULT 5,
  auto_scenarios INTEGER NOT NULL DEFAULT 0,
  sim_min REAL NOT NULL DEFAULT 0
);
