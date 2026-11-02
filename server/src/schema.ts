// IV Sentinel data model: wards, nurses, patients (infusion sessions),
// alerts, event log, monitoring readings, and simulation settings.

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const wards = sqliteTable("wards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  totalBeds: integer("total_beds").notNull(),
});

export const nurses = sqliteTable("nurses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  wardId: text("ward_id").notNull(),
  shift: text("shift").notNull(),
  phone: text("phone").notNull().default(""),
});

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  diagnosis: text("diagnosis").notNull(),
  bed: text("bed").notNull(),
  wardId: text("ward_id").notNull(),
  nurseId: text("nurse_id").notNull(),
  fluid: text("fluid").notNull(),
  initialVolume: real("initial_volume").notNull(),
  remainingVolume: real("remaining_volume").notNull(),
  prescribedRate: real("prescribed_rate").notNull(),
  flowRate: real("flow_rate").notNull(),
  dripFactor: integer("drip_factor").notNull().default(20),
  status: text("status", {
    enum: ["normal", "warning", "critical", "completed"],
  })
    .notNull()
    .default("normal"),
  // Simulated condition driving the flow pattern: normal | too_fast |
  // too_slow | stopped | blockage | fluctuation | backflow
  conditionState: text("condition_state").notNull().default("normal"),
  conditionSinceSimMin: real("condition_since_sim_min").notNull().default(0),
  lowFlowSinceSimMin: real("low_flow_since_sim_min"),
  zeroFlowTicks: integer("zero_flow_ticks").notNull().default(0),
  startedAt: integer("started_at").notNull(),
  startedSimMin: real("started_sim_min").notNull().default(0),
  completedAt: integer("completed_at"),
  completedSimMin: real("completed_sim_min"),
  lastUpdated: integer("last_updated").notNull(),
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  nurseId: text("nurse_id").notNull(),
  type: text("type").notNull(),
  severity: text("severity", { enum: ["info", "warning", "critical"] })
    .notNull()
    .default("warning"),
  status: text("status", {
    enum: ["new", "acknowledged", "in_progress", "resolved"],
  })
    .notNull()
    .default("new"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at").notNull(),
  createdSimMin: real("created_sim_min").notNull().default(0),
  ackSimMin: real("ack_sim_min"),
  resolvedSimMin: real("resolved_sim_min"),
  escalated: integer("escalated").notNull().default(0),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id"),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  ts: integer("ts").notNull(),
  simMin: real("sim_min").notNull().default(0),
});

export const readings = sqliteTable("readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  simMin: real("sim_min").notNull(),
  remaining: real("remaining").notNull(),
  flow: real("flow").notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  lowThresholdPct: integer("low_threshold_pct").notNull().default(20),
  escalationSimMin: real("escalation_sim_min").notNull().default(5),
  autoScenarios: integer("auto_scenarios").notNull().default(0),
  simMin: real("sim_min").notNull().default(0),
});
