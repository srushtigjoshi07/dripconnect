// IV Sentinel server actions. The browser runs the real-time simulation
// engine; the server owns durable state (patients, nurses, wards, alerts,
// events, readings, settings) so nothing is lost on refresh, and seeds the
// sample hospital on first launch.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { desc, eq } from "drizzle-orm";
import * as schema from "./schema";

type Db = ReturnType<Ctx["db"]>;

const patientShape = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  gender: z.string(),
  diagnosis: z.string(),
  bed: z.string(),
  wardId: z.string(),
  nurseId: z.string(),
  fluid: z.string(),
  initialVolume: z.number(),
  remainingVolume: z.number(),
  prescribedRate: z.number(),
  flowRate: z.number(),
  dripFactor: z.number(),
  status: z.enum(["normal", "warning", "critical", "completed"]),
  conditionState: z.string(),
  conditionSinceSimMin: z.number(),
  lowFlowSinceSimMin: z.number().nullable(),
  zeroFlowTicks: z.number(),
  startedAt: z.number(),
  startedSimMin: z.number(),
  completedAt: z.number().nullable(),
  completedSimMin: z.number().nullable(),
  lastUpdated: z.number(),
});

const nurseShape = z.object({
  id: z.string(),
  name: z.string(),
  wardId: z.string(),
  shift: z.string(),
  phone: z.string(),
});

const wardShape = z.object({
  id: z.string(),
  name: z.string(),
  totalBeds: z.number(),
});

const alertShape = z.object({
  id: z.string(),
  patientId: z.string(),
  nurseId: z.string(),
  type: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  status: z.enum(["new", "acknowledged", "in_progress", "resolved"]),
  title: z.string(),
  description: z.string(),
  createdAt: z.number(),
  createdSimMin: z.number(),
  ackSimMin: z.number().nullable(),
  resolvedSimMin: z.number().nullable(),
  escalated: z.number(),
});

const eventShape = z.object({
  id: z.number(),
  patientId: z.string().nullable(),
  kind: z.string(),
  message: z.string(),
  ts: z.number(),
  simMin: z.number(),
});

const readingShape = z.object({
  patientId: z.string(),
  simMin: z.number(),
  remaining: z.number(),
  flow: z.number(),
});

const settingsShape = z.object({
  lowThresholdPct: z.number(),
  escalationSimMin: z.number(),
  autoScenarios: z.number(),
  simMin: z.number(),
});

const bootstrapResponse = z.object({
  wards: z.array(wardShape),
  nurses: z.array(nurseShape),
  patients: z.array(patientShape),
  alerts: z.array(alertShape),
  events: z.array(eventShape),
  readings: z.array(readingShape),
  settings: settingsShape,
});

type Bootstrap = z.infer<typeof bootstrapResponse>;

// ---------------------------------------------------------------------------
// Seed data — the sample hospital loaded on first launch (brief §10/§11).
// ---------------------------------------------------------------------------

const WARDS = [
  { id: "general", name: "General Ward", totalBeds: 24 },
  { id: "medical", name: "Medical Ward", totalBeds: 20 },
  { id: "surgical", name: "Surgical Ward", totalBeds: 18 },
  { id: "icu", name: "ICU", totalBeds: 10 },
  { id: "private", name: "Private Rooms", totalBeds: 12 },
];

const MAIN_NURSES = [
  { id: "N-101", name: "Ananya Rao", wardId: "general", shift: "Day", phone: "+91 98220 41011" },
  { id: "N-102", name: "Vikram Shetty", wardId: "medical", shift: "Day", phone: "+91 98220 41012" },
  { id: "N-103", name: "Sarah Thomas", wardId: "surgical", shift: "Day", phone: "+91 98220 41013" },
  { id: "N-104", name: "Rajesh Kumar", wardId: "icu", shift: "Day", phone: "+91 98220 41014" },
  { id: "N-105", name: "Meena Patil", wardId: "general", shift: "Night", phone: "+91 98220 41015" },
  { id: "N-106", name: "David D'Souza", wardId: "medical", shift: "Night", phone: "+91 98220 41016" },
];

type SeedPatient = {
  id: string; name: string; age: number; gender: string; diagnosis: string;
  bed: string; wardId: string; nurseId: string; fluid: string;
  initial: number; remaining: number; rate: number; condition?: string;
  completed?: boolean;
};

const MAIN_PATIENTS: SeedPatient[] = [
  { id: "P-1001", name: "Ramesh Kulkarni", age: 62, gender: "M", diagnosis: "Post-operative recovery", bed: "G-04", wardId: "general", nurseId: "N-101", fluid: "Normal Saline", initial: 500, remaining: 380, rate: 80 },
  { id: "P-1002", name: "Lakshmi Devi", age: 55, gender: "F", diagnosis: "Dehydration — gastroenteritis", bed: "G-07", wardId: "general", nurseId: "N-101", fluid: "Ringer's Lactate", initial: 1000, remaining: 640, rate: 100 },
  { id: "P-1003", name: "Arjun Nair", age: 34, gender: "M", diagnosis: "Fever — IV antibiotics", bed: "G-09", wardId: "general", nurseId: "N-105", fluid: "Dextrose 5%", initial: 500, remaining: 210, rate: 60 },
  { id: "P-1004", name: "Fatima Sheikh", age: 71, gender: "F", diagnosis: "Pneumonia — IV antibiotics", bed: "M-02", wardId: "medical", nurseId: "N-102", fluid: "Normal Saline", initial: 500, remaining: 455, rate: 75 },
  { id: "P-1005", name: "Suresh Yadav", age: 48, gender: "M", diagnosis: "Diabetic care — maintenance fluids", bed: "M-05", wardId: "medical", nurseId: "N-102", fluid: "DNS (Dextrose Normal Saline)", initial: 1000, remaining: 820, rate: 90 },
  { id: "P-1006", name: "Kavita Joshi", age: 29, gender: "F", diagnosis: "Post-partum fluid support", bed: "M-08", wardId: "medical", nurseId: "N-106", fluid: "Ringer's Lactate", initial: 500, remaining: 130, rate: 110 },
  { id: "P-1007", name: "Mohan Reddy", age: 66, gender: "M", diagnosis: "Post-surgical — bowel surgery", bed: "S-01", wardId: "surgical", nurseId: "N-103", fluid: "Normal Saline", initial: 1000, remaining: 540, rate: 85 },
  { id: "P-1008", name: "Priya Deshmukh", age: 41, gender: "F", diagnosis: "Appendectomy — recovery", bed: "S-03", wardId: "surgical", nurseId: "N-103", fluid: "Dextrose 5%", initial: 500, remaining: 320, rate: 70 },
  { id: "P-1009", name: "Imran Khan", age: 58, gender: "M", diagnosis: "Sepsis — monitored infusion", bed: "ICU-02", wardId: "icu", nurseId: "N-104", fluid: "Normal Saline", initial: 500, remaining: 260, rate: 100, condition: "too_slow" },
  { id: "P-1010", name: "Grace Mathew", age: 77, gender: "F", diagnosis: "Cardiac observation", bed: "ICU-04", wardId: "icu", nurseId: "N-104", fluid: "0.45% Saline", initial: 250, remaining: 175, rate: 40 },
  { id: "P-1011", name: "Nikhil Verma", age: 23, gender: "M", diagnosis: "Fracture — pre-operative fluids", bed: "S-06", wardId: "surgical", nurseId: "N-103", fluid: "Ringer's Lactate", initial: 500, remaining: 470, rate: 95 },
  { id: "P-1012", name: "Sunita Rao", age: 63, gender: "F", diagnosis: "Electrolyte correction", bed: "P-01", wardId: "private", nurseId: "N-101", fluid: "Normal Saline", initial: 500, remaining: 290, rate: 60 },
  { id: "P-1013", name: "Joseph D'Costa", age: 69, gender: "M", diagnosis: "COPD exacerbation — IV therapy", bed: "M-11", wardId: "medical", nurseId: "N-106", fluid: "Dextrose 5%", initial: 500, remaining: 88, rate: 55 },
  { id: "P-1014", name: "Anita Pillai", age: 36, gender: "F", diagnosis: "Dengue — fluid management", bed: "G-12", wardId: "general", nurseId: "N-105", fluid: "Normal Saline", initial: 1000, remaining: 730, rate: 120, condition: "fluctuation" },
  { id: "P-1015", name: "Harish Chandra", age: 81, gender: "M", diagnosis: "Post-stroke observation", bed: "ICU-06", wardId: "icu", nurseId: "N-104", fluid: "Normal Saline", initial: 500, remaining: 410, rate: 65 },
  { id: "P-1016", name: "Kamala Bai", age: 59, gender: "F", diagnosis: "Hydration therapy — completed", bed: "G-15", wardId: "general", nurseId: "N-101", fluid: "Ringer's Lactate", initial: 500, remaining: 0, rate: 80, completed: true },
];

const DEMO_NURSES = [
  { id: "D-N1", name: "Asha Verma", wardId: "general", shift: "Day", phone: "+91 98220 42001" },
  { id: "D-N2", name: "Rohan Patil", wardId: "medical", shift: "Day", phone: "+91 98220 42002" },
  { id: "D-N3", name: "Leena George", wardId: "icu", shift: "Day", phone: "+91 98220 42003" },
  { id: "D-N4", name: "Kiran Bose", wardId: "medical", shift: "Night", phone: "+91 98220 42004" },
];

const DEMO_PATIENTS: SeedPatient[] = [
  { id: "D-P01", name: "Sanjay Gupta", age: 54, gender: "M", diagnosis: "Post-operative hydration", bed: "G-01", wardId: "general", nurseId: "D-N1", fluid: "Normal Saline", initial: 500, remaining: 420, rate: 80 },
  { id: "D-P02", name: "Rekha Sharma", age: 47, gender: "F", diagnosis: "Dehydration", bed: "G-02", wardId: "general", nurseId: "D-N1", fluid: "Ringer's Lactate", initial: 1000, remaining: 610, rate: 100 },
  { id: "D-P03", name: "Deepak Yadav", age: 39, gender: "M", diagnosis: "IV antibiotics — cellulitis", bed: "G-03", wardId: "general", nurseId: "D-N1", fluid: "Dextrose 5%", initial: 500, remaining: 240, rate: 60 },
  { id: "D-P04", name: "Manju Pillai", age: 68, gender: "F", diagnosis: "Electrolyte correction", bed: "G-05", wardId: "general", nurseId: "D-N4", fluid: "Normal Saline", initial: 500, remaining: 45, rate: 90 },
  { id: "D-P05", name: "Omar Farooq", age: 61, gender: "M", diagnosis: "Pneumonia — IV therapy", bed: "M-01", wardId: "medical", nurseId: "D-N2", fluid: "Normal Saline", initial: 500, remaining: 350, rate: 75 },
  { id: "D-P06", name: "Teresa D'Silva", age: 73, gender: "F", diagnosis: "Cardiac monitoring fluids", bed: "M-03", wardId: "medical", nurseId: "D-N2", fluid: "0.45% Saline", initial: 250, remaining: 160, rate: 40 },
  { id: "D-P07", name: "Vimala Krishnan", age: 52, gender: "F", diagnosis: "Post-partum support", bed: "M-04", wardId: "medical", nurseId: "D-N4", fluid: "Ringer's Lactate", initial: 500, remaining: 285, rate: 110, condition: "too_fast" },
  { id: "D-P08", name: "George Varghese", age: 66, gender: "M", diagnosis: "Diabetic maintenance fluids", bed: "M-06", wardId: "medical", nurseId: "D-N2", fluid: "DNS (Dextrose Normal Saline)", initial: 1000, remaining: 790, rate: 85 },
  { id: "D-P09", name: "Salim Ansari", age: 59, gender: "M", diagnosis: "Sepsis — monitored infusion", bed: "ICU-01", wardId: "icu", nurseId: "D-N3", fluid: "Normal Saline", initial: 500, remaining: 310, rate: 100 },
  { id: "D-P10", name: "Rose Thomas", age: 79, gender: "F", diagnosis: "Post-stroke observation", bed: "ICU-03", wardId: "icu", nurseId: "D-N3", fluid: "Normal Saline", initial: 500, remaining: 195, rate: 55 },
  { id: "D-P11", name: "Bhavesh Patel", age: 44, gender: "M", diagnosis: "Fracture — pre-op fluids", bed: "ICU-05", wardId: "icu", nurseId: "D-N3", fluid: "Ringer's Lactate", initial: 500, remaining: 465, rate: 95 },
  { id: "D-P12", name: "Indu Malhotra", age: 31, gender: "F", diagnosis: "Dengue — fluid management", bed: "G-06", wardId: "general", nurseId: "D-N4", fluid: "Normal Saline", initial: 1000, remaining: 880, rate: 120 },
];

const HISTORY_TYPES: Array<{ type: string; title: string; severity: "info" | "warning" | "critical" }> = [
  { type: "LOW_FLUID", title: "Low fluid warning", severity: "warning" },
  { type: "FLOW_TOO_SLOW", title: "Flow rate too slow", severity: "warning" },
  { type: "BOTTLE_EMPTY", title: "Bottle empty — infusion complete", severity: "critical" },
  { type: "FLOW_TOO_FAST", title: "Flow rate too fast", severity: "warning" },
  { type: "SUSPECTED_BLOCKAGE", title: "Suspected blockage or kinked line", severity: "warning" },
  { type: "FLOW_STOPPED", title: "Flow stopped", severity: "critical" },
  { type: "FLOW_FLUCTUATION", title: "Unstable flow rate", severity: "info" },
];

async function seed(db: Db, mode: "main" | "demo") {
  const now = Date.now();
  await db.delete(schema.readings);
  await db.delete(schema.events);
  await db.delete(schema.alerts);
  await db.delete(schema.patients);
  await db.delete(schema.nurses);
  await db.delete(schema.wards);
  await db.delete(schema.settings);

  for (const w of WARDS) await db.insert(schema.wards).values(w);
  const nurseList = mode === "demo" ? DEMO_NURSES : MAIN_NURSES;
  for (const n of nurseList) await db.insert(schema.nurses).values(n);
  const patientList = mode === "demo" ? DEMO_PATIENTS : MAIN_PATIENTS;

  for (const p of patientList) {
    const startedAt = now - 1000 * 60 * (30 + ((p.age * 7) % 150));
    const cond = p.condition ?? "normal";
    const flow =
      cond === "too_slow" ? p.rate * 0.35 :
      cond === "too_fast" ? p.rate * 1.9 :
      cond === "stopped" ? 0 : p.rate;
    await db.insert(schema.patients).values({
      id: p.id, name: p.name, age: p.age, gender: p.gender, diagnosis: p.diagnosis,
      bed: p.bed, wardId: p.wardId, nurseId: p.nurseId, fluid: p.fluid,
      initialVolume: p.initial, remainingVolume: p.remaining,
      prescribedRate: p.rate, flowRate: p.completed ? 0 : flow, dripFactor: 20,
      status: (p.completed ? "completed" : cond === "normal" ? "normal" : "warning") as "normal" | "warning" | "critical" | "completed",
      conditionState: cond, conditionSinceSimMin: 0,
      lowFlowSinceSimMin: cond === "too_slow" ? 0 : null,
      zeroFlowTicks: 0, startedAt, startedSimMin: 0,
      completedAt: p.completed ? now - 1000 * 60 * 42 : null,
      completedSimMin: p.completed ? 375 : null,
      lastUpdated: now,
    });
    await db.insert(schema.events).values({
      patientId: p.id, kind: "started",
      message: `Infusion started — ${p.fluid} ${p.initial} mL at ${p.rate} mL/hr for ${p.name} (${p.bed}).`,
      ts: startedAt, simMin: 0,
    });
    if (p.completed) {
      await db.insert(schema.events).values({
        patientId: p.id, kind: "completed",
        message: `Infusion completed for ${p.name} (${p.bed}) — bottle empty, line closed.`,
        ts: now - 1000 * 60 * 42, simMin: 375,
      });
    }
    // Seed a short reading history so charts have a trend on first open.
    const steps = 18;
    for (let i = steps; i >= 1; i--) {
      const back = i * 4; // sim-minutes ago
      const rem = Math.min(p.initial, p.remaining + (flow * back) / 60);
      await db.insert(schema.readings).values({
        patientId: p.id, simMin: -back, remaining: Math.round(rem * 10) / 10,
        flow: Math.round(flow * 10) / 10,
      });
    }
  }

  if (mode === "main") {
    // Resolved historical alerts across the past week, for analytics.
    for (let i = 0; i < 30; i++) {
      const t = HISTORY_TYPES[i % HISTORY_TYPES.length]!;
      const p = MAIN_PATIENTS[i % MAIN_PATIENTS.length]!;
      const daysAgo = (i % 7) + (i >= 21 ? 0 : 0);
      const createdAt = now - daysAgo * 86400000 - (i % 9) * 3600000 - 1800000;
      const ack = 3 + ((i * 7) % 14);
      await db.insert(schema.alerts).values({
        id: `H-${1000 + i}`, patientId: p.id, nurseId: p.nurseId,
        type: t.type, severity: t.severity, status: "resolved",
        title: t.title,
        description: `${t.title} detected for ${p.name} (${p.bed}). Attended and resolved by the assigned nurse.`,
        createdAt, createdSimMin: 0, ackSimMin: ack, resolvedSimMin: ack + 6 + (i % 10),
        escalated: 0,
      });
    }
  }

  await db.insert(schema.settings).values({
    id: 1, lowThresholdPct: 20, escalationSimMin: 5, autoScenarios: 0, simMin: 0,
  });
}

async function loadBootstrap(db: Db): Promise<Bootstrap> {
  const patientRows = await db.select().from(schema.patients);
  if (patientRows.length === 0) {
    await seed(db, "main");
  }
  const [wardRows, nurseRows, patients, alertRows, eventRows, readingRows, settingRows] =
    await Promise.all([
      db.select().from(schema.wards),
      db.select().from(schema.nurses),
      db.select().from(schema.patients),
      db.select().from(schema.alerts).orderBy(desc(schema.alerts.createdAt)).limit(400),
      db.select().from(schema.events).orderBy(desc(schema.events.id)).limit(250),
      db.select().from(schema.readings).orderBy(desc(schema.readings.id)).limit(900),
      db.select().from(schema.settings),
    ]);
  const s = settingRows[0];
  return {
    wards: wardRows,
    nurses: nurseRows,
    patients,
    alerts: alertRows,
    events: eventRows,
    readings: readingRows.map((r) => ({
      patientId: r.patientId, simMin: r.simMin, remaining: r.remaining, flow: r.flow,
    })),
    settings: s
      ? { lowThresholdPct: s.lowThresholdPct, escalationSimMin: s.escalationSimMin, autoScenarios: s.autoScenarios, simMin: s.simMin }
      : { lowThresholdPct: 20, escalationSimMin: 5, autoScenarios: 0, simMin: 0 },
  };
}

const okResponse = z.object({ ok: z.literal(true) });

export const Actions = {
  getBootstrap: defineAction({
    description: "Loads the full IV Sentinel state: wards, nurses, patients, alerts, events, readings and settings, seeding the sample hospital on first launch.",
    request: z.object({}),
    response: bootstrapResponse,
    async handler(ctx): Promise<Bootstrap> {
      return loadBootstrap(ctx.db<typeof schema>());
    },
  }),

  applyTick: defineAction({
    description: "Persists one simulation tick: updated patient rows, new alerts, new events, new readings, alert escalations and the simulation clock.",
    request: z.object({
      patients: z.array(patientShape),
      newAlerts: z.array(alertShape),
      newEvents: z.array(z.object({
        patientId: z.string().nullable(), kind: z.string(), message: z.string(),
        ts: z.number(), simMin: z.number(),
      })),
      newReadings: z.array(readingShape),
      alertUpdates: z.array(z.object({
        id: z.string(), escalated: z.number().optional(),
      })),
      simMin: z.number(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      for (const p of args.patients) {
        await db.update(schema.patients).set({
          name: p.name, age: p.age, gender: p.gender, diagnosis: p.diagnosis,
          bed: p.bed, wardId: p.wardId, nurseId: p.nurseId, fluid: p.fluid,
          initialVolume: p.initialVolume, remainingVolume: p.remainingVolume,
          prescribedRate: p.prescribedRate, flowRate: p.flowRate,
          dripFactor: p.dripFactor, status: p.status,
          conditionState: p.conditionState,
          conditionSinceSimMin: p.conditionSinceSimMin,
          lowFlowSinceSimMin: p.lowFlowSinceSimMin,
          zeroFlowTicks: p.zeroFlowTicks, startedAt: p.startedAt,
          startedSimMin: p.startedSimMin, completedAt: p.completedAt,
          completedSimMin: p.completedSimMin, lastUpdated: p.lastUpdated,
        }).where(eq(schema.patients.id, p.id));
      }
      for (const a of args.newAlerts) await db.insert(schema.alerts).values(a);
      for (const e of args.newEvents) await db.insert(schema.events).values(e);
      for (const r of args.newReadings) await db.insert(schema.readings).values(r);
      for (const u of args.alertUpdates) {
        await db.update(schema.alerts)
          .set({ escalated: u.escalated ?? 1 })
          .where(eq(schema.alerts.id, u.id));
      }
      await db.update(schema.settings)
        .set({ simMin: args.simMin })
        .where(eq(schema.settings.id, 1));
      return { ok: true as const };
    },
  }),

  setPatientCondition: defineAction({
    description: "Sets a patient's simulated condition (scenario) and flow pattern, recording an event.",
    request: z.object({
      patientId: z.string(), conditionState: z.string(), flowRate: z.number(),
      status: z.enum(["normal", "warning", "critical", "completed"]),
      simMin: z.number(), eventMessage: z.string(), eventKind: z.string(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.update(schema.patients).set({
        conditionState: args.conditionState, flowRate: args.flowRate,
        status: args.status, conditionSinceSimMin: args.simMin,
        lowFlowSinceSimMin: args.conditionState === "too_slow" ? args.simMin : null,
        zeroFlowTicks: 0, lastUpdated: Date.now(),
      }).where(eq(schema.patients.id, args.patientId));
      await db.insert(schema.events).values({
        patientId: args.patientId, kind: args.eventKind,
        message: args.eventMessage, ts: Date.now(), simMin: args.simMin,
      });
      return { ok: true as const };
    },
  }),

  setPatientVolume: defineAction({
    description: "Sets a patient's remaining volume directly (used by the guided demonstration's low-fluid step).",
    request: z.object({
      patientId: z.string(), remainingVolume: z.number(),
      eventMessage: z.string(), simMin: z.number(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.update(schema.patients).set({
        remainingVolume: args.remainingVolume, lastUpdated: Date.now(),
      }).where(eq(schema.patients.id, args.patientId));
      await db.insert(schema.events).values({
        patientId: args.patientId, kind: "scenario",
        message: args.eventMessage, ts: Date.now(), simMin: args.simMin,
      });
      return { ok: true as const };
    },
  }),

  restartInfusion: defineAction({
    description: "Restarts a completed infusion after the nurse changes the IV bottle at the bedside: refills to the full bottle volume, restores the prescribed flow, clears the completion state and logs the bottle-change event plus a fresh reading.",
    request: z.object({
      patientId: z.string(), remainingVolume: z.number(), flowRate: z.number(),
      simMin: z.number(), eventMessage: z.string(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const now = Date.now();
      await db.update(schema.patients).set({
        remainingVolume: args.remainingVolume, flowRate: args.flowRate,
        status: "normal", conditionState: "normal",
        conditionSinceSimMin: args.simMin, lowFlowSinceSimMin: null,
        zeroFlowTicks: 0, startedAt: now, startedSimMin: args.simMin,
        completedAt: null, completedSimMin: null, lastUpdated: now,
      }).where(eq(schema.patients.id, args.patientId));
      await db.insert(schema.events).values({
        patientId: args.patientId, kind: "restarted",
        message: args.eventMessage, ts: now, simMin: args.simMin,
      });
      await db.insert(schema.readings).values({
        patientId: args.patientId, simMin: args.simMin,
        remaining: args.remainingVolume, flow: args.flowRate,
      });
      return { ok: true as const };
    },
  }),

  updateAlertStatus: defineAction({
    description: "Acknowledges, starts work on, or resolves an alert, stamping acknowledgement/resolution simulation times and logging an event.",
    request: z.object({
      alertId: z.string(),
      status: z.enum(["new", "acknowledged", "in_progress", "resolved"]),
      simMin: z.number(), eventMessage: z.string(), eventKind: z.string(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.alerts)
        .where(eq(schema.alerts.id, args.alertId));
      const alert = rows[0];
      if (!alert) throw new Error("Alert not found");
      const patch: Partial<typeof schema.alerts.$inferInsert> = { status: args.status };
      if ((args.status === "acknowledged" || args.status === "in_progress") && alert.ackSimMin == null) {
        patch.ackSimMin = args.simMin;
      }
      if (args.status === "resolved") patch.resolvedSimMin = args.simMin;
      await db.update(schema.alerts).set(patch).where(eq(schema.alerts.id, args.alertId));
      await db.insert(schema.events).values({
        patientId: alert.patientId, kind: args.eventKind,
        message: args.eventMessage, ts: Date.now(), simMin: args.simMin,
      });
      return { ok: true as const };
    },
  }),

  assignAlert: defineAction({
    description: "Reassigns an alert to a different nurse and logs the reassignment event.",
    request: z.object({
      alertId: z.string(), nurseId: z.string(), simMin: z.number(),
      eventMessage: z.string(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.alerts)
        .where(eq(schema.alerts.id, args.alertId));
      const alert = rows[0];
      if (!alert) throw new Error("Alert not found");
      await db.update(schema.alerts).set({ nurseId: args.nurseId })
        .where(eq(schema.alerts.id, args.alertId));
      await db.insert(schema.events).values({
        patientId: alert.patientId, kind: "assigned",
        message: args.eventMessage, ts: Date.now(), simMin: args.simMin,
      });
      return { ok: true as const };
    },
  }),

  addNurse: defineAction({
    description: "Adds a nurse to the roster.",
    request: z.object({
      id: z.string(), name: z.string().min(1), wardId: z.string(),
      shift: z.string(), phone: z.string(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.insert(schema.nurses).values(args);
      return { ok: true as const };
    },
  }),

  updateNurse: defineAction({
    description: "Edits a nurse's name, ward, shift or phone.",
    request: z.object({
      id: z.string(), name: z.string().min(1), wardId: z.string(),
      shift: z.string(), phone: z.string(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.update(schema.nurses).set({
        name: args.name, wardId: args.wardId, shift: args.shift, phone: args.phone,
      }).where(eq(schema.nurses.id, args.id));
      return { ok: true as const };
    },
  }),

  reassignPatient: defineAction({
    description: "Reassigns a patient to a different nurse and logs the handover event.",
    request: z.object({
      patientId: z.string(), nurseId: z.string(), simMin: z.number(),
      eventMessage: z.string(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.update(schema.patients).set({ nurseId: args.nurseId, lastUpdated: Date.now() })
        .where(eq(schema.patients.id, args.patientId));
      await db.insert(schema.events).values({
        patientId: args.patientId, kind: "assigned",
        message: args.eventMessage, ts: Date.now(), simMin: args.simMin,
      });
      return { ok: true as const };
    },
  }),

  addPatient: defineAction({
    description: "Registers a new patient and starts their infusion session, logging the start event and first reading.",
    request: z.object({
      id: z.string(), name: z.string().min(1), age: z.number().int().min(0).max(120),
      gender: z.string(), diagnosis: z.string(), bed: z.string().min(1),
      wardId: z.string(), nurseId: z.string(), fluid: z.string(),
      initialVolume: z.number().positive(), prescribedRate: z.number().positive(),
      simMin: z.number(),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      const now = Date.now();
      await db.insert(schema.patients).values({
        id: args.id, name: args.name, age: args.age, gender: args.gender,
        diagnosis: args.diagnosis, bed: args.bed, wardId: args.wardId,
        nurseId: args.nurseId, fluid: args.fluid,
        initialVolume: args.initialVolume, remainingVolume: args.initialVolume,
        prescribedRate: args.prescribedRate, flowRate: args.prescribedRate,
        dripFactor: 20, status: "normal", conditionState: "normal",
        conditionSinceSimMin: args.simMin, lowFlowSinceSimMin: null,
        zeroFlowTicks: 0, startedAt: now, startedSimMin: args.simMin,
        completedAt: null, completedSimMin: null, lastUpdated: now,
      });
      await db.insert(schema.events).values({
        patientId: args.id, kind: "started",
        message: `Infusion started — ${args.fluid} ${args.initialVolume} mL at ${args.prescribedRate} mL/hr for ${args.name} (${args.bed}).`,
        ts: now, simMin: args.simMin,
      });
      await db.insert(schema.readings).values({
        patientId: args.id, simMin: args.simMin,
        remaining: args.initialVolume, flow: args.prescribedRate,
      });
      return { ok: true as const };
    },
  }),

  saveSettings: defineAction({
    description: "Saves simulation settings: low-fluid threshold percent, escalation interval and automatic random scenarios.",
    request: z.object({
      lowThresholdPct: z.number().int().min(1).max(90),
      escalationSimMin: z.number().min(0.5).max(120),
      autoScenarios: z.number().int().min(0).max(1),
    }),
    response: okResponse,
    async handler(ctx, args): Promise<z.infer<typeof okResponse>> {
      const db = ctx.db<typeof schema>();
      await db.update(schema.settings).set(args).where(eq(schema.settings.id, 1));
      return { ok: true as const };
    },
  }),

  getPatientReadings: defineAction({
    description: "Returns the most recent monitoring readings for one patient, oldest first, for the detail charts.",
    request: z.object({ patientId: z.string(), limit: z.number().int().positive().max(300).default(120) }),
    response: z.object({ readings: z.array(readingShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.readings)
        .where(eq(schema.readings.patientId, args.patientId))
        .orderBy(desc(schema.readings.id)).limit(args.limit);
      return {
        readings: rows.reverse().map((r) => ({
          patientId: r.patientId, simMin: r.simMin, remaining: r.remaining, flow: r.flow,
        })),
      };
    },
  }),

  reseed: defineAction({
    description: "Resets the whole simulation: reloads either the standard sample hospital or the 12-patient guided demonstration hospital.",
    request: z.object({ mode: z.enum(["main", "demo"]) }),
    response: bootstrapResponse,
    async handler(ctx, args): Promise<Bootstrap> {
      const db = ctx.db<typeof schema>();
      await seed(db, args.mode);
      return loadBootstrap(db);
    },
  }),
} satisfies ActionsModule;
