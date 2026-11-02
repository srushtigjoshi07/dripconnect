// DripConnect — browser-state store (beta / static deployment build)
//
// This build keeps ALL state in the browser (localStorage) instead of a
// server database. That is what lets the exact same app run on static
// hosting such as GitHub Pages, where there is no server to answer
// action requests — the previous server-backed build loaded its
// shell there and then stopped at "Could not load the monitoring state".
//
// Trade-off (accepted for the beta): state lives per-browser. Each
// visitor / device gets its own ward, persisted across reloads on that
// browser only. All simulation, alert, nurse-response and analytics
// behaviour is identical — only the persistence layer changed.
//
// The exported `api` object intentionally keeps the same method names
// and shapes App.tsx already used for the server actions, so no other
// component had to change.

export interface Ward { id: string; name: string; totalBeds: number }
export interface Nurse { id: string; name: string; wardId: string; shift: string; phone: string }
export type PatientStatus = "normal" | "warning" | "critical" | "completed";
export interface Patient {
  id: string; name: string; age: number; gender: string; diagnosis: string;
  bed: string; wardId: string; nurseId: string; fluid: string;
  initialVolume: number; remainingVolume: number; prescribedRate: number;
  flowRate: number; dripFactor: number; status: PatientStatus;
  conditionState: string; conditionSinceSimMin: number;
  lowFlowSinceSimMin: number | null; zeroFlowTicks: number;
  startedAt: number; startedSimMin: number;
  completedAt: number | null; completedSimMin: number | null; lastUpdated: number;
}
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "new" | "acknowledged" | "in_progress" | "resolved";
export interface Alert {
  id: string; patientId: string; nurseId: string; type: string;
  severity: AlertSeverity; status: AlertStatus; title: string; description: string;
  createdAt: number; createdSimMin: number; ackSimMin: number | null;
  resolvedSimMin: number | null; escalated: number;
}
export interface Evt { id: number; patientId: string | null; kind: string; message: string; ts: number; simMin: number }
export interface Reading { patientId: string; simMin: number; remaining: number; flow: number }
export interface Settings { lowThresholdPct: number; escalationSimMin: number; autoScenarios: number; simMin: number }
export interface Bootstrap {
  wards: Ward[]; nurses: Nurse[]; patients: Patient[]; alerts: Alert[];
  events: Evt[]; readings: Reading[]; settings: Settings;
}

interface Db {
  wards: Ward[]; nurses: Nurse[]; patients: Patient[]; alerts: Alert[];
  events: Evt[]; readings: Reading[]; settings: Settings; nextEventId: number;
}

const STORAGE_KEY = "dripconnect-browser-state-v1";
let memoryFallback: Db | null = null;

function loadDb(): Db | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed && Array.isArray(parsed.patients)) return parsed;
    }
  } catch { /* localStorage unavailable — fall through to memory */ }
  return memoryFallback;
}

function saveDb(db: Db): void {
  memoryFallback = db;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch { /* storage full / unavailable — memory copy still works this session */ }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const WARDS: Ward[] = [
  { id: "general", name: "General Ward", totalBeds: 24 },
  { id: "medical", name: "Medical Ward", totalBeds: 20 },
  { id: "surgical", name: "Surgical Ward", totalBeds: 18 },
  { id: "icu", name: "ICU", totalBeds: 10 },
  { id: "private", name: "Private Rooms", totalBeds: 12 },
];

const MAIN_NURSES: Nurse[] = [
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

const DEMO_NURSES: Nurse[] = [
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

const HISTORY_TYPES: Array<{ type: string; title: string; severity: AlertSeverity }> = [
  { type: "LOW_FLUID", title: "Low fluid warning", severity: "warning" },
  { type: "FLOW_TOO_SLOW", title: "Flow rate too slow", severity: "warning" },
  { type: "BOTTLE_EMPTY", title: "Bottle empty — infusion complete", severity: "critical" },
  { type: "FLOW_TOO_FAST", title: "Flow rate too fast", severity: "warning" },
  { type: "SUSPECTED_BLOCKAGE", title: "Suspected blockage or kinked line", severity: "warning" },
  { type: "FLOW_STOPPED", title: "Flow stopped", severity: "critical" },
  { type: "FLOW_FLUCTUATION", title: "Unstable flow rate", severity: "info" },
];

function createSeed(mode: "main" | "demo"): Db {
  const now = Date.now();
  const db: Db = {
    wards: clone(WARDS),
    nurses: clone(mode === "demo" ? DEMO_NURSES : MAIN_NURSES),
    patients: [], alerts: [], events: [], readings: [],
    settings: { lowThresholdPct: 20, escalationSimMin: 5, autoScenarios: 0, simMin: 0 },
    nextEventId: 1,
  };
  const patientList = mode === "demo" ? DEMO_PATIENTS : MAIN_PATIENTS;
  const pushEvent = (patientId: string | null, kind: string, message: string, ts: number, simMin: number) => {
    db.events.push({ id: db.nextEventId++, patientId, kind, message, ts, simMin });
  };
  for (const p of patientList) {
    const startedAt = now - 1000 * 60 * (30 + ((p.age * 7) % 150));
    const cond = p.condition ?? "normal";
    const flow = cond === "too_slow" ? p.rate * 0.35 : cond === "too_fast" ? p.rate * 1.9 : cond === "stopped" ? 0 : p.rate;
    const status: PatientStatus = p.completed ? "completed" : cond === "normal" ? "normal" : "warning";
    db.patients.push({
      id: p.id, name: p.name, age: p.age, gender: p.gender, diagnosis: p.diagnosis,
      bed: p.bed, wardId: p.wardId, nurseId: p.nurseId, fluid: p.fluid,
      initialVolume: p.initial, remainingVolume: p.remaining,
      prescribedRate: p.rate, flowRate: p.completed ? 0 : flow, dripFactor: 20,
      status, conditionState: cond, conditionSinceSimMin: 0,
      lowFlowSinceSimMin: cond === "too_slow" ? 0 : null,
      zeroFlowTicks: 0, startedAt, startedSimMin: 0,
      completedAt: p.completed ? now - 1000 * 60 * 42 : null,
      completedSimMin: p.completed ? 375 : null,
      lastUpdated: now,
    });
    pushEvent(p.id, "started", `Infusion started — ${p.fluid} ${p.initial} mL at ${p.rate} mL/hr for ${p.name} (${p.bed}).`, startedAt, 0);
    if (p.completed) {
      pushEvent(p.id, "completed", `Infusion completed for ${p.name} (${p.bed}) — bottle empty, line closed.`, now - 1000 * 60 * 42, 375);
    }
    const steps = 18;
    for (let i = steps; i >= 1; i--) {
      const back = i * 4;
      const rem = Math.min(p.initial, p.remaining + (flow * back) / 60);
      db.readings.push({ patientId: p.id, simMin: -back, remaining: Math.round(rem * 10) / 10, flow: Math.round(flow * 10) / 10 });
    }
  }
  if (mode === "main") {
    for (let i = 0; i < 30; i++) {
      const t = HISTORY_TYPES[i % HISTORY_TYPES.length] ?? HISTORY_TYPES[0];
      const p = MAIN_PATIENTS[i % MAIN_PATIENTS.length];
      if (!t || !p) continue;
      const daysAgo = i % 7;
      const createdAt = now - daysAgo * 86400000 - (i % 9) * 3600000 - 1800000;
      const ack = 3 + ((i * 7) % 14);
      db.alerts.push({
        id: `H-${1000 + i}`, patientId: p.id, nurseId: p.nurseId,
        type: t.type, severity: t.severity, status: "resolved",
        title: t.title,
        description: `${t.title} detected for ${p.name} (${p.bed}). Attended and resolved by the assigned nurse.`,
        createdAt, createdSimMin: 0, ackSimMin: ack, resolvedSimMin: ack + 6 + (i % 10),
        escalated: 0,
      });
    }
  }
  return db;
}

function toBootstrap(db: Db): Bootstrap {
  return clone({
    wards: db.wards,
    nurses: db.nurses,
    patients: db.patients,
    alerts: [...db.alerts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 400),
    events: [...db.events].sort((a, b) => b.id - a.id).slice(0, 250),
    readings: db.readings.slice(-900),
    settings: db.settings,
  });
}

function ensureDb(): Db {
  let db = loadDb();
  if (!db || db.patients.length === 0) {
    db = createSeed("main");
    saveDb(db);
  }
  return db;
}

function capReadings(db: Db): void {
  const byPatient = new Map<string, Reading[]>();
  for (const r of db.readings) {
    const arr = byPatient.get(r.patientId) ?? [];
    arr.push(r);
    byPatient.set(r.patientId, arr);
  }
  const capped: Reading[] = [];
  for (const arr of byPatient.values()) capped.push(...arr.slice(-200));
  db.readings = capped;
  if (db.events.length > 600) db.events = db.events.slice(-600);
  if (db.alerts.length > 500) db.alerts = db.alerts.slice(-500);
}

const okResult = { ok: true as const };

export const api = {
  async getBootstrap(_args: Record<string, never>): Promise<Bootstrap> {
    void _args;
    return toBootstrap(ensureDb());
  },
  async applyTick(args: {
    patients: Patient[];
    newAlerts: Alert[];
    newEvents: Array<{ patientId: string | null; kind: string; message: string; ts: number; simMin: number }>;
    newReadings: Reading[];
    alertUpdates: Array<{ id: string; escalated?: number }>;
    simMin: number;
  }): Promise<{ ok: true }> {
    const db = ensureDb();
    for (const p of args.patients) {
      const idx = db.patients.findIndex((x) => x.id === p.id);
      if (idx >= 0) db.patients[idx] = clone(p);
      else db.patients.push(clone(p));
    }
    for (const a of args.newAlerts) {
      if (!db.alerts.some((x) => x.id === a.id)) db.alerts.push(clone(a));
    }
    for (const e of args.newEvents) {
      db.events.push({ id: db.nextEventId++, patientId: e.patientId, kind: e.kind, message: e.message, ts: e.ts, simMin: e.simMin });
    }
    db.readings.push(...clone(args.newReadings));
    for (const u of args.alertUpdates) {
      const alert = db.alerts.find((x) => x.id === u.id);
      if (alert) alert.escalated = u.escalated ?? 1;
    }
    db.settings.simMin = args.simMin;
    capReadings(db);
    saveDb(db);
    return okResult;
  },
  async setPatientCondition(args: {
    patientId: string; conditionState: string; flowRate: number;
    status: PatientStatus; simMin: number; eventMessage: string; eventKind: string;
  }): Promise<{ ok: true }> {
    const db = ensureDb();
    const p = db.patients.find((x) => x.id === args.patientId);
    if (p) {
      p.conditionState = args.conditionState;
      p.flowRate = args.flowRate;
      p.status = args.status;
      p.conditionSinceSimMin = args.simMin;
      p.lowFlowSinceSimMin = args.conditionState === "too_slow" ? args.simMin : null;
      p.zeroFlowTicks = 0;
      p.lastUpdated = Date.now();
    }
    db.events.push({ id: db.nextEventId++, patientId: args.patientId, kind: args.eventKind, message: args.eventMessage, ts: Date.now(), simMin: args.simMin });
    saveDb(db);
    return okResult;
  },
  async setPatientVolume(args: { patientId: string; remainingVolume: number; eventMessage: string; simMin: number }): Promise<{ ok: true }> {
    const db = ensureDb();
    const p = db.patients.find((x) => x.id === args.patientId);
    if (p) { p.remainingVolume = args.remainingVolume; p.lastUpdated = Date.now(); }
    db.events.push({ id: db.nextEventId++, patientId: args.patientId, kind: "scenario", message: args.eventMessage, ts: Date.now(), simMin: args.simMin });
    saveDb(db);
    return okResult;
  },
  async restartInfusion(args: { patientId: string; remainingVolume: number; flowRate: number; simMin: number; eventMessage: string }): Promise<{ ok: true }> {
    const db = ensureDb();
    const now = Date.now();
    const p = db.patients.find((x) => x.id === args.patientId);
    if (p) {
      p.remainingVolume = args.remainingVolume;
      p.flowRate = args.flowRate;
      p.status = "normal";
      p.conditionState = "normal";
      p.conditionSinceSimMin = args.simMin;
      p.lowFlowSinceSimMin = null;
      p.zeroFlowTicks = 0;
      p.startedAt = now;
      p.startedSimMin = args.simMin;
      p.completedAt = null;
      p.completedSimMin = null;
      p.lastUpdated = now;
    }
    db.events.push({ id: db.nextEventId++, patientId: args.patientId, kind: "restarted", message: args.eventMessage, ts: now, simMin: args.simMin });
    db.readings.push({ patientId: args.patientId, simMin: args.simMin, remaining: args.remainingVolume, flow: args.flowRate });
    capReadings(db);
    saveDb(db);
    return okResult;
  },
  async updateAlertStatus(args: { alertId: string; status: AlertStatus; simMin: number; eventMessage: string; eventKind: string }): Promise<{ ok: true }> {
    const db = ensureDb();
    const alert = db.alerts.find((x) => x.id === args.alertId);
    if (!alert) return okResult;
    alert.status = args.status;
    if ((args.status === "acknowledged" || args.status === "in_progress") && alert.ackSimMin == null) alert.ackSimMin = args.simMin;
    if (args.status === "resolved") alert.resolvedSimMin = args.simMin;
    db.events.push({ id: db.nextEventId++, patientId: alert.patientId, kind: args.eventKind, message: args.eventMessage, ts: Date.now(), simMin: args.simMin });
    saveDb(db);
    return okResult;
  },
  async assignAlert(args: { alertId: string; nurseId: string; simMin: number; eventMessage: string }): Promise<{ ok: true }> {
    const db = ensureDb();
    const alert = db.alerts.find((x) => x.id === args.alertId);
    if (!alert) return okResult;
    alert.nurseId = args.nurseId;
    db.events.push({ id: db.nextEventId++, patientId: alert.patientId, kind: "assigned", message: args.eventMessage, ts: Date.now(), simMin: args.simMin });
    saveDb(db);
    return okResult;
  },
  async reassignPatient(args: { patientId: string; nurseId: string; simMin: number; eventMessage: string }): Promise<{ ok: true }> {
    const db = ensureDb();
    const p = db.patients.find((x) => x.id === args.patientId);
    if (p) { p.nurseId = args.nurseId; p.lastUpdated = Date.now(); }
    db.events.push({ id: db.nextEventId++, patientId: args.patientId, kind: "assigned", message: args.eventMessage, ts: Date.now(), simMin: args.simMin });
    saveDb(db);
    return okResult;
  },
  async addNurse(args: Nurse): Promise<{ ok: true }> {
    const db = ensureDb();
    if (!db.nurses.some((n) => n.id === args.id)) db.nurses.push(clone(args));
    saveDb(db);
    return okResult;
  },
  async updateNurse(args: Nurse): Promise<{ ok: true }> {
    const db = ensureDb();
    const n = db.nurses.find((x) => x.id === args.id);
    if (n) { n.name = args.name; n.wardId = args.wardId; n.shift = args.shift; n.phone = args.phone; }
    saveDb(db);
    return okResult;
  },
  async addPatient(args: {
    id: string; name: string; age: number; gender: string; diagnosis: string; bed: string;
    wardId: string; nurseId: string; fluid: string; initialVolume: number; prescribedRate: number; simMin: number;
  }): Promise<{ ok: true }> {
    const db = ensureDb();
    if (!db.patients.some((x) => x.id === args.id)) {
      const now = Date.now();
      db.patients.push({
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
      db.events.push({ id: db.nextEventId++, patientId: args.id, kind: "started", message: `Infusion started — ${args.fluid} ${args.initialVolume} mL at ${args.prescribedRate} mL/hr for ${args.name} (${args.bed}).`, ts: now, simMin: args.simMin });
      db.readings.push({ patientId: args.id, simMin: args.simMin, remaining: args.initialVolume, flow: args.prescribedRate });
      capReadings(db);
      saveDb(db);
    }
    return okResult;
  },
  async saveSettings(args: { lowThresholdPct: number; escalationSimMin: number; autoScenarios: number }): Promise<{ ok: true }> {
    const db = ensureDb();
    db.settings.lowThresholdPct = args.lowThresholdPct;
    db.settings.escalationSimMin = args.escalationSimMin;
    db.settings.autoScenarios = args.autoScenarios;
    saveDb(db);
    return okResult;
  },
  async getPatientReadings(args: { patientId: string; limit?: number }): Promise<{ readings: Reading[] }> {
    const db = ensureDb();
    const limit = args.limit ?? 120;
    const rows = db.readings.filter((r) => r.patientId === args.patientId).slice(-limit);
    return { readings: clone(rows) };
  },
  async reseed(args: { mode: "main" | "demo" }): Promise<Bootstrap> {
    const db = createSeed(args.mode);
    saveDb(db);
    return toBootstrap(db);
  },
};
