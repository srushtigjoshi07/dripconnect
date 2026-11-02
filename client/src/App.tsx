import { useEffect, useMemo, useRef, useState } from "react";
import {
Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./api";
import Ward3D, { type NurseAgent, type ScenePatient } from "./Ward3D";

// ---------------------------------------------------------------------------
// Types (mirror the server row shapes)
// ---------------------------------------------------------------------------

type Status = "normal" | "warning" | "critical" | "completed";
type Severity = "info" | "warning" | "critical";
type AlertStatus = "new" | "acknowledged" | "in_progress" | "resolved";

interface Ward { id: string; name: string; totalBeds: number }
interface Nurse { id: string; name: string; wardId: string; shift: string; phone: string }
interface Patient {
  id: string; name: string; age: number; gender: string; diagnosis: string;
  bed: string; wardId: string; nurseId: string; fluid: string;
  initialVolume: number; remainingVolume: number; prescribedRate: number;
  flowRate: number; dripFactor: number; status: Status;
  conditionState: string; conditionSinceSimMin: number;
  lowFlowSinceSimMin: number | null; zeroFlowTicks: number;
  startedAt: number; startedSimMin: number;
  completedAt: number | null; completedSimMin: number | null; lastUpdated: number;
}
interface Alert {
  id: string; patientId: string; nurseId: string; type: string;
  severity: Severity; status: AlertStatus; title: string; description: string;
  createdAt: number; createdSimMin: number; ackSimMin: number | null;
  resolvedSimMin: number | null; escalated: number;
}
interface Evt { id: number; patientId: string | null; kind: string; message: string; ts: number; simMin: number }
interface Reading { patientId: string; simMin: number; remaining: number; flow: number }
interface Settings { lowThresholdPct: number; escalationSimMin: number; autoScenarios: number; simMin: number }

interface SimState {
  wards: Ward[]; nurses: Nurse[]; patients: Patient[]; alerts: Alert[];
  events: Evt[]; readings: Record<string, Reading[]>; settings: Settings; simMin: number;
}

type View = "dashboard" | "live" | "ward3d" | "patient" | "patients" | "alerts" | "nurses" | "wards" | "analytics" | "events" | "settings" | "scenarios" | "demo";

// ---------------------------------------------------------------------------
// Automated nurse response — one active response per nurse, driven entirely
// by the alert system. Statuses advance automatically: an alert lands on the
// assigned nurse (ALERT RECEIVED), she is dispatched by severity
// (RESPONDING), the 3D scene reports her physical arrival (ARRIVED AT
// BEDSIDE), she inspects the IV (INSPECTING PATIENT) and the incident closes
// (RESPONSE COMPLETED) before she returns to AVAILABLE at the station.
// ---------------------------------------------------------------------------

type NurseStatus = "AVAILABLE" | "ALERT RECEIVED" | "RESPONDING" | "ARRIVED AT BEDSIDE" | "INSPECTING PATIENT" | "RESPONSE COMPLETED";
interface NurseResponse {
  nurseId: string; patientId: string; alertId: string; alertType: string;
  severity: Severity; status: NurseStatus;
  alertSimMin: number; arrivedSimMin: number | null; completedSimMin: number | null;
}
const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const NURSE_STATUS_META: Record<NurseStatus, { color: string; soft: string }> = {
  "AVAILABLE": { color: "var(--ok)", soft: "var(--ok-soft)" },
  "ALERT RECEIVED": { color: "var(--warn)", soft: "var(--warn-soft)" },
  "RESPONDING": { color: "var(--blue)", soft: "var(--blue-soft)" },
  "ARRIVED AT BEDSIDE": { color: "var(--teal)", soft: "#e6f4f2" },
  "INSPECTING PATIENT": { color: "var(--teal)", soft: "#e6f4f2" },
  "RESPONSE COMPLETED": { color: "var(--ok)", soft: "var(--ok-soft)" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10;

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDateTime(ts: number) {
  return `${new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" })} ${fmtTime(ts)}`;
}
function fmtETA(p: Patient): string {
  if (p.status === "completed") return "Completed";
  if (p.flowRate <= 0) return "— (no flow)";
  const mins = (p.remainingVolume / p.flowRate) * 60;
  if (!isFinite(mins)) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
function fmtDuration(mins: number | null): string {
  if (mins == null || !isFinite(mins)) return "—";
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${Math.floor(mins / 60)} h ${Math.round(mins % 60)} min`;
}
function progressPct(p: Patient): number {
  if (p.initialVolume <= 0) return 0;
  return Math.min(100, Math.max(0, ((p.initialVolume - p.remainingVolume) / p.initialVolume) * 100));
}
function dripRate(p: Patient): number {
  return round1((p.flowRate * p.dripFactor) / 60);
}

const STATUS_META: Record<Status, { label: string; color: string; soft: string; bar: string }> = {
  normal: { label: "Normal", color: "var(--ok)", soft: "var(--ok-soft)", bar: "#177e5f" },
  warning: { label: "Warning", color: "var(--warn)", soft: "var(--warn-soft)", bar: "#c07f10" },
  critical: { label: "Critical", color: "var(--crit)", soft: "var(--crit-soft)", bar: "#bc2a30" },
  completed: { label: "Completed", color: "#5d7186", soft: "#e8edf1", bar: "#7d93a8" },
};
const SEV_META: Record<Severity, { label: string; color: string; soft: string }> = {
  info: { label: "Information", color: "var(--info)", soft: "var(--info-soft)" },
  warning: { label: "Warning", color: "var(--warn)", soft: "var(--warn-soft)" },
  critical: { label: "Critical", color: "var(--crit)", soft: "var(--crit-soft)" },
};
const CONDITION_LABEL: Record<string, string> = {
  normal: "Stable infusion",
  too_fast: "Flow too fast",
  too_slow: "Flow too slow",
  stopped: "Flow stopped",
  blockage: "Suspected blockage / kinked line",
  fluctuation: "Unstable flow",
  backflow: "Possible backflow (simulated, suspected)",
};

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h / 997;
}

/** Simulated flow (mL/hr) for a patient given their condition. */
function flowFor(p: Patient, simMin: number): number {
  const r = p.prescribedRate;
  const s = seedOf(p.id) * 6.28;
  switch (p.conditionState) {
    case "too_fast": return r * (1.9 + 0.05 * Math.sin(simMin * 1.7 + s));
    case "too_slow": return r * (0.35 + 0.03 * Math.sin(simMin + s));
    case "stopped": return 0;
    case "blockage": {
      const cyc = simMin % 7;
      return cyc < 4 ? r * 0.06 : r * (0.22 + 0.08 * Math.sin(simMin * 2.3 + s));
    }
    case "fluctuation": return Math.max(2, r * (0.95 + 0.65 * Math.sin(simMin * 2.1 + s) * Math.sin(simMin * 0.63 + s * 2)));
    case "backflow": return -r * 0.2;
    default: return r * (1 + 0.03 * Math.sin(simMin * 0.7 + s));
  }
}

/** Immediate flow value used when a scenario button sets a condition. */
function conditionFlow(condition: string, rate: number): number {
  switch (condition) {
    case "too_fast": return round1(rate * 1.9);
    case "too_slow": return round1(rate * 0.35);
    case "stopped": return 0;
    case "blockage": return round1(rate * 0.08);
    case "fluctuation": return round1(rate * 0.6);
    case "backflow": return round1(-rate * 0.2);
    default: return rate;
  }
}

// ---------------------------------------------------------------------------
// Icons — one consistent 1.7px stroke line-icon set (24px grid)
// ---------------------------------------------------------------------------

type IconName = "grid" | "activity" | "cube" | "users" | "building" | "bell" | "nurse" | "chart" | "history" | "gear" | "flask" | "play" | "chevron" | "search" | "check" | "x" | "pulse" | "clock" | "dot";

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  grid: (<><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>),
  activity: (<polyline points="2.5 12 6.5 12 9.5 4.5 14 19 17 12 21.5 12" />),
  cube: (<><path d="M12 2.8 21 7.6v8.8l-9 4.8-9-4.8V7.6Z" /><path d="M3.2 7.6 12 12.2l8.8-4.6" /><path d="M12 12.2v8.8" /></>),
  users: (<><circle cx="9" cy="8" r="3.4" /><path d="M3.5 20c.6-3.2 2.8-4.8 5.5-4.8s4.9 1.6 5.5 4.8" /><path d="M16 5.2a3.4 3.4 0 0 1 0 5.9" /><path d="M17.8 15.6c1.6.7 2.5 2.1 2.8 4.4" /></>),
  building: (<><rect x="5" y="3.5" width="14" height="17" rx="1" /><path d="M9.5 8h2M12.5 8h2M9.5 12h2M12.5 12h2" /><path d="M10.5 20.5v-3.4h3v3.4" /></>),
  bell: (<><path d="M6 16.5v-5.2a6 6 0 0 1 12 0v5.2l1.4 2.8H4.6Z" /><path d="M10 21.5a2.2 2.2 0 0 0 4 0" /></>),
  nurse: (<><circle cx="12" cy="7.6" r="3.6" /><path d="M5 20.5c.8-3.8 3.6-5.7 7-5.7s6.2 1.9 7 5.7" /></>),
  chart: (<><path d="M4 4v16h16" /><path d="M8.5 16v-5M12.5 16V8M16.5 16v-8" /></>),
  history: (<><path d="M4.5 5.5A9 9 0 1 1 3.6 13" /><path d="M3.5 4v5h5" /><path d="M12 8v4.4l3 1.8" /></>),
  gear: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.7M12 18.5v2.7M2.8 12h2.7M18.5 12h2.7M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" /></>),
  flask: (<><path d="M9.5 3h5M10.5 3v5.2L5.6 17a2.4 2.4 0 0 0 2.1 3.5h8.6a2.4 2.4 0 0 0 2.1-3.5L13.5 8.2V3" /><path d="M8 14.5h8" /></>),
  play: (<><circle cx="12" cy="12" r="9" /><path d="M10 8.2v7.6l6-3.8Z" /></>),
  chevron: (<polyline points="14.5 6 8.5 12 14.5 18" />),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></>),
  check: (<polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />),
  x: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  pulse: (<><path d="M3 12h4l2.5-6 4 12 2.5-6h5" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  dot: (<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />),
};

function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {ICON_PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------

function Pill({ text, color, soft, dot }: { text: string; color: string; soft: string; dot?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-2 py-[3px] text-[11px] font-medium uppercase tracking-[0.07em]"
      style={{ color, background: soft, borderColor: color }}>
      {dot ? <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: dot }} /> : null}
      {text}
    </span>
  );
}

function StatCard({ label, value, color, soft, sub }: { label: string; value: number | string; color?: string; soft?: boolean; sub?: string }) {
  return (
    <div className="border-t-2 px-1 pb-1 pt-4"
      style={{ borderTopColor: color ?? "var(--border-strong)" }}>
      <div className="flex items-baseline gap-2">
        <span className="reading-mono text-[26px] leading-none" style={{ color: color ?? "var(--accent)" }}>{value}</span>
        {sub ? <span className="text-xs font-medium" style={{ color: "var(--dim)" }}>{sub}</span> : null}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.09em]" style={{ color: "var(--dim)" }}>
        {soft ? <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} /> : null}
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="section-heading">{children}</h2>;
}

function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 border-b pb-6" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display-title">{title}</h1>
          {desc ? <p className="intro-serif mt-2 max-w-2xl">{desc}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2 pb-1">{children}</div> : null}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-[var(--radius)] border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgba(40,120,181,0.30)]";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" } as const;

function Btn({ children, onClick, variant = "primary", disabled, ariaLabel }: {
  children: React.ReactNode; onClick: () => void; variant?: "primary" | "ghost" | "danger" | "ok";
  disabled?: boolean; ariaLabel?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" },
    ghost: { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" },
    danger: { background: "var(--crit)", color: "#fff", borderColor: "var(--crit)" },
    ok: { background: "var(--teal)", color: "#fff", borderColor: "var(--teal)" },
  };
  return (
    <button type="button" aria-label={ariaLabel} disabled={disabled} onClick={onClick}
      className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[var(--radius)] border px-3.5 py-1.5 text-[13px] font-medium tracking-[0.01em] transition hover:opacity-90 active:opacity-80 disabled:opacity-40"
      style={styles[variant]}>{children}</button>
  );
}

// ---------------------------------------------------------------------------
// Patient card (dashboard grid)
// ---------------------------------------------------------------------------

function PatientCard({ p, nurseName, wardName, activeAlerts, onOpen }: {
  p: Patient; nurseName: string; wardName: string; activeAlerts: number;
  onOpen: () => void;
}) {
  const meta = STATUS_META[p.status];
  const remainingPct = p.initialVolume > 0 ? Math.round((p.remainingVolume / p.initialVolume) * 100) : 0;
  return (
    <button type="button" onClick={onOpen}
      aria-label={`Open monitoring detail for ${p.name}, bed ${p.bed}`}
      className={`card-hover w-full rounded-[var(--radius)] border p-5 text-left ${p.status === "critical" ? "crit-pulse" : ""}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono2 text-[12px] font-medium tracking-[0.06em]" style={{ color: "var(--blue)" }}>{p.bed}</span>
            <span className="h-3 w-px" style={{ background: "var(--border-strong)" }} aria-hidden="true" />
            <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--dim)" }}>{wardName}</span>
          </div>
          <div className="mt-1.5 truncate text-[17px] font-medium leading-snug tracking-[-0.01em]">{p.name}</div>
          <div className="truncate text-[12.5px]" style={{ color: "var(--dim)" }}>
            {p.age} yrs · {p.gender} · {p.id}
          </div>
        </div>
        <Pill text={meta.label} color={meta.color} soft={meta.soft} dot={meta.bar} />
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="clinical-label">Remaining</div>
          <div className="reading-mono mt-1 text-[24px] leading-none">{Math.round(p.remainingVolume)}<span className="ml-1 text-[13px]" style={{ color: "var(--dim)" }}>mL</span>
            <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--dim)" }}>{remainingPct}% of {Math.round(p.initialVolume)} mL</span>
          </div>
        </div>
        <div className="text-right">
          <div className="clinical-label">Flow rate</div>
          <div className="reading-mono mt-1 text-[16px] leading-none">{p.status === "completed" ? 0 : round1(p.flowRate)}<span className="ml-1 text-[11px]" style={{ color: "var(--dim)" }}>mL/hr</span></div>
        </div>
      </div>
      <div className="mt-3 h-[3px] overflow-hidden" style={{ background: "var(--surface-alt)" }}>
        <div className="h-full transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, remainingPct))}%`, background: meta.bar }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px]">
        <div className="truncate"><span style={{ color: "var(--dim)" }}>Fluid </span><span className="font-medium">{p.fluid}</span></div>
        <div className="truncate text-right"><span style={{ color: "var(--dim)" }}>Nurse </span><span className="font-medium">{nurseName}</span></div>
        <div><span style={{ color: "var(--dim)" }}>Condition </span><span className="font-medium">{CONDITION_LABEL[p.conditionState] ?? p.conditionState}</span></div>
        <div className="tnum text-right"><span style={{ color: "var(--dim)" }}>ETA </span><span className="font-medium">{fmtETA(p)}</span></div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--dim)" }}>
        <span className="font-mono2">{remainingPct}% remaining · {round1(progressPct(p))}% infused</span>
        {activeAlerts > 0
          ? <span className="font-medium" style={{ color: "var(--crit)" }}>{activeAlerts} active alert{activeAlerts > 1 ? "s" : ""}</span>
          : <span>Updated <span className="font-mono2">{fmtTime(p.lastUpdated)}</span></span>}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const [state, setState] = useState<SimState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [wardFilter, setWardFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("active");
  const [scenarioPatientId, setScenarioPatientId] = useState<string>("");
  const [demoStep, setDemoStep] = useState(0);
  const [sceneMode, setSceneMode] = useState<"single" | "multi">("multi");
  const [simScenarioSel, setSimScenarioSel] = useState<string>("normal");
  const [sceneFocusId, setSceneFocusId] = useState<string | null>(null);
  const [sceneEpoch, setSceneEpoch] = useState(0);
  const [ivChange, setIvChange] = useState<{ patientId: string; seq: number } | null>(null);
  const [changingBottle, setChangingBottle] = useState(false);
  const [changeSummary, setChangeSummary] = useState<string | null>(null);
  const [camPreset, setCamPreset] = useState({ name: "overview", seq: 0 });
  const [confirmReset, setConfirmReset] = useState(false);
  const [anaWard, setAnaWard] = useState("all");
  const [anaRange, setAnaRange] = useState("all");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [eventQuery, setEventQuery] = useState("");
  // Automated nurse response state (per nurse: one active response + queue)
  const [nurseResponses, setNurseResponses] = useState<Record<string, NurseResponse>>({});
  const [nurseQueue, setNurseQueue] = useState<Record<string, string[]>>({});
  const responsesRef = useRef<Record<string, NurseResponse>>({});
  const queueRef = useRef<Record<string, string[]>>({});
  const handledAlertsRef = useRef<Set<string>>(new Set());
  const responseTimersRef = useRef<Record<string, number>>({});
  const sceneVisibleIdsRef = useRef<string[]>([]);
  useEffect(() => { responsesRef.current = nurseResponses; }, [nurseResponses]);
  useEffect(() => { queueRef.current = nurseQueue; }, [nurseQueue]);

  useEffect(() => {
    const iv = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const showToast = (message: string) => setToast({ id: Date.now(), message });
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast((cur) => (cur && cur.id === toast.id ? null : cur)), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const stateRef = useRef<SimState | null>(null);
  const speedRef = useRef(1);
  const mutedRef = useRef(false);
  const cooldownRef = useRef<Record<string, number>>({});
  const tempIdRef = useRef(-1);
  const demoAlertRef = useRef<string | null>(null);
  const changeTimerRef = useRef<number | null>(null);
  const changePendingRef = useRef<{ alertId: string; patientId: string } | null>(null);
  const trioIdsRef = useRef<{ key: string; ids: string[] } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const beep = (kind: "warn" | "crit") => {
    if (mutedRef.current) return;
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      audioRef.current ??= new AC();
      const ctx = audioRef.current;
      const t = ctx.currentTime;
      const offsets = kind === "crit" ? [0, 0.28] : [0];
      for (const off of offsets) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = kind === "crit" ? 620 : 880;
        o.type = "sine";
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.1, t + off);
        g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.2);
        o.start(t + off); o.stop(t + off + 0.22);
      }
    } catch { /* audio unavailable */ }
  };

  const applyBootstrap = (b: {
    wards: Ward[]; nurses: Nurse[]; patients: Patient[]; alerts: Alert[];
    events: Evt[]; readings: Reading[]; settings: Settings;
  }) => {
    const grouped: Record<string, Reading[]> = {};
    for (const r of b.readings) {
      (grouped[r.patientId] ??= []).push(r);
    }
    for (const k of Object.keys(grouped)) {
      grouped[k] = (grouped[k] ?? []).sort((a, z) => a.simMin - z.simMin).slice(-160);
    }
    const next: SimState = {
      wards: b.wards, nurses: b.nurses, patients: b.patients, alerts: b.alerts,
      events: b.events, readings: grouped, settings: b.settings, simMin: b.settings.simMin,
    };
    stateRef.current = next;
    setState(next);
    if (!scenarioPatientId && b.patients.length > 0) {
      setScenarioPatientId(b.patients.find((p) => p.status !== "completed")?.id ?? b.patients[0]!.id);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.getBootstrap({})
      .then((b) => { if (!cancelled) applyBootstrap(b); })
      .catch(() => { if (!cancelled) setLoadError("Could not load the monitoring state. Please reload."); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nurseName = (s: SimState, id: string) => s.nurses.find((n) => n.id === id)?.name ?? id;
  const wardName = (s: SimState, id: string) => s.wards.find((w) => w.id === id)?.name ?? id;

  const computeStatus = (p: Patient, alerts: Alert[]): Status => {
    if (p.remainingVolume <= 0 || p.status === "completed") return "completed";
    const active = alerts.filter((a) => a.patientId === p.id && a.status !== "resolved");
    if (active.some((a) => a.severity === "critical")) return "critical";
    if (active.length > 0) return "warning";
    if (p.conditionState !== "normal") return "warning";
    return "normal";
  };

  // -------------------------------------------------------------------------
  // Simulation engine — one tick = `speed` simulated minutes per real second
  // -------------------------------------------------------------------------

  const tick = () => {
    const s = stateRef.current;
    if (!s) return;
    const dt = speedRef.current;
    const simMin = round1(s.simMin + dt);
    const now = Date.now();
    const settings = s.settings;
    const newAlerts: Alert[] = [];
    const newEvents: Evt[] = [];
    const newReadings: Reading[] = [];
    const alertUpdates: { id: string; escalated: number }[] = [];
    const alertsNow: Alert[] = [...s.alerts];
    const cooldown = { ...cooldownRef.current };

    const pushEvent = (patientId: string | null, kind: string, message: string) => {
      newEvents.push({ id: tempIdRef.current--, patientId, kind, message, ts: now, simMin });
    };
    const canAlert = (p: Patient, type: string) => {
      if (alertsNow.some((a) => a.patientId === p.id && a.type === type && a.status !== "resolved")) return false;
      const last = cooldown[`${p.id}:${type}`];
      return last == null || simMin - last >= 15;
    };
    const mkAlert = (p: Patient, type: string, severity: Severity, title: string, description: string) => {
      const a: Alert = {
        id: `A-${now}-${Math.floor(Math.random() * 100000)}`,
        patientId: p.id, nurseId: p.nurseId, type, severity, status: "new",
        title, description, createdAt: now, createdSimMin: simMin,
        ackSimMin: null, resolvedSimMin: null, escalated: 0,
      };
      newAlerts.push(a); alertsNow.unshift(a);
      cooldown[`${p.id}:${type}`] = simMin;
      pushEvent(p.id, "alert", `Alert generated — ${title} for ${p.name} (${p.bed}, ${wardName(s, p.wardId)}). ${nurseName(s, p.nurseId)} notified.`);
      beep(severity === "critical" ? "crit" : "warn");
    };

    const patients = s.patients.map((orig) => {
      const p: Patient = { ...orig };
      if (p.status === "completed") return p;
      const flow = flowFor(p, simMin);
      p.flowRate = round1(flow);
      p.remainingVolume = round1(Math.min(p.initialVolume, Math.max(0, p.remainingVolume - (flow * dt) / 60)));
      p.lastUpdated = now;
      newReadings.push({ patientId: p.id, simMin, remaining: p.remainingVolume, flow: round1(flow) });

      if (flow < 0.5 && p.remainingVolume > 0) p.zeroFlowTicks += 1; else p.zeroFlowTicks = 0;
      if (flow > 0.5 && flow < p.prescribedRate * 0.6) {
        if (p.lowFlowSinceSimMin == null) p.lowFlowSinceSimMin = simMin;
      } else if (flow >= p.prescribedRate * 0.6) {
        p.lowFlowSinceSimMin = null;
      }

      if (p.remainingVolume <= 0) {
        p.status = "completed";
        p.completedAt = now;
        p.completedSimMin = simMin;
        p.flowRate = 0;
        pushEvent(p.id, "completed", `Infusion completed for ${p.name} (${p.bed}) — bottle empty. Record moved to completed infusions.`);
        if (canAlert(p, "BOTTLE_EMPTY")) {
          mkAlert(p, "BOTTLE_EMPTY", "critical", "Bottle empty — infusion complete",
            `The IV bottle for ${p.name} (${p.bed}, ${wardName(s, p.wardId)}) is empty. ${p.fluid} infusion is complete and the line needs closing / the bottle needs replacing.`);
        }
        return p;
      }

      // Scenario-driven + threshold detections
      if (p.conditionState === "stopped" && p.zeroFlowTicks >= 1 && canAlert(p, "FLOW_STOPPED")) {
        mkAlert(p, "FLOW_STOPPED", "critical", "Flow stopped",
          `No flow detected for ${p.name} (${p.bed}) while ${Math.round(p.remainingVolume)} mL remains in the bottle. The drip has stopped completely — bedside check needed.`);
      }
      if (p.conditionState === "blockage" && simMin - p.conditionSinceSimMin >= 2 && canAlert(p, "SUSPECTED_BLOCKAGE")) {
        mkAlert(p, "SUSPECTED_BLOCKAGE", "warning", "Suspected blockage or kinked line",
          `Flow pattern for ${p.name} (${p.bed}) is consistent with a possible obstruction — the line may be kinked or blocked. This is a suspected condition only; the system cannot confirm the physical cause.`);
      }
      if (p.conditionState === "backflow" && canAlert(p, "POSSIBLE_BACKFLOW")) {
        mkAlert(p, "POSSIBLE_BACKFLOW", "warning", "Possible backflow (simulated, suspected)",
          `Simulated demonstration anomaly suggesting possible reverse flow in the line for ${p.name} (${p.bed}). This is a simulated suspected condition, not a confirmed measurement.`);
      }
      if (p.conditionState === "fluctuation" && simMin - p.conditionSinceSimMin >= 3 && canAlert(p, "FLOW_FLUCTUATION")) {
        mkAlert(p, "FLOW_FLUCTUATION", "warning", "Unstable flow rate",
          `Flow rate for ${p.name} (${p.bed}) is fluctuating irregularly between ${Math.max(2, Math.round(p.prescribedRate * 0.3))} and ${Math.round(p.prescribedRate * 1.6)} mL/hr around the prescribed ${p.prescribedRate} mL/hr. Instability recorded.`);
      }
      if (p.conditionState === "too_fast" && canAlert(p, "FLOW_TOO_FAST")) {
        const sev: Severity = flow > p.prescribedRate * 1.75 ? "critical" : "warning";
        mkAlert(p, "FLOW_TOO_FAST", sev, "Flow rate too fast",
          `Flow for ${p.name} (${p.bed}) has risen to ${Math.round(flow)} mL/hr against a prescribed ${p.prescribedRate} mL/hr — beyond the demonstration limit. The clamp may have been adjusted.`);
      }
      if (p.conditionState === "too_slow" && p.lowFlowSinceSimMin != null && simMin - p.lowFlowSinceSimMin >= 5 && canAlert(p, "FLOW_TOO_SLOW")) {
        mkAlert(p, "FLOW_TOO_SLOW", "warning", "Flow rate too slow",
          `Flow for ${p.name} (${p.bed}) has stayed at about ${Math.round(flow)} mL/hr (prescribed ${p.prescribedRate} mL/hr) for ${fmtDuration(simMin - p.lowFlowSinceSimMin)}. The infusion is falling behind schedule.`);
      }
      const lowAt = (p.initialVolume * settings.lowThresholdPct) / 100;
      if (p.remainingVolume <= lowAt && p.remainingVolume > 0 && canAlert(p, "LOW_FLUID")) {
        mkAlert(p, "LOW_FLUID", "warning", "Low fluid warning",
          `${p.name} (${p.bed}, ${wardName(s, p.wardId)}) has ${Math.round(p.remainingVolume)} mL of ${p.fluid} remaining — about ${fmtETA(p)} at the current rate. Assigned nurse ${nurseName(s, p.nurseId)} notified.`);
      }

      p.status = computeStatus(p, alertsNow);
      return p;
    });

    // Automatic random scenarios
    if (settings.autoScenarios === 1 && Math.random() < 0.22) {
      const candidates = patients.filter((p) => p.status !== "completed" && p.conditionState === "normal");
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (pick) {
        const faults = ["too_fast", "too_slow", "stopped", "blockage", "fluctuation", "backflow"];
        const fault = faults[Math.floor(Math.random() * faults.length)] ?? "too_slow";
        pick.conditionState = fault;
        pick.conditionSinceSimMin = simMin;
        pick.flowRate = conditionFlow(fault, pick.prescribedRate);
        if (fault === "too_slow") pick.lowFlowSinceSimMin = simMin;
        pushEvent(pick.id, "scenario", `Automatic scenario generated — ${CONDITION_LABEL[fault]} for ${pick.name} (${pick.bed}).`);
      }
    }

    // Escalation of unacknowledged critical alerts
    for (const a of alertsNow) {
      if (a.severity === "critical" && a.status === "new" && a.escalated === 0 &&
        a.id.startsWith("A-") && simMin - a.createdSimMin >= settings.escalationSimMin) {
        a.escalated = 1;
        alertUpdates.push({ id: a.id, escalated: 1 });
        const p = patients.find((x) => x.id === a.patientId);
        pushEvent(a.patientId, "escalated",
          `ESCALATED — critical alert "${a.title}" for ${p ? `${p.name} (${p.bed})` : a.patientId} unacknowledged for ${fmtDuration(simMin - a.createdSimMin)}. Escalated to the head nurse / duty in-charge with a repeat voice call.`);
        beep("crit");
      }
    }

    cooldownRef.current = cooldown;
    const nextReadings = { ...s.readings };
    for (const r of newReadings) {
      nextReadings[r.patientId] = [...(nextReadings[r.patientId] ?? []), r].slice(-160);
    }
    const next: SimState = {
      ...s, patients, alerts: alertsNow, simMin,
      events: [...newEvents, ...s.events].slice(0, 300),
      readings: nextReadings,
    };
    stateRef.current = next;
    setState(next);

    api.applyTick({
      patients, newAlerts,
      newEvents: newEvents.map((e) => ({ patientId: e.patientId, kind: e.kind, message: e.message, ts: e.ts, simMin: e.simMin })),
      newReadings, alertUpdates, simMin,
    }).catch(() => { /* persistence retry on next tick */ });
  };

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => tick(), 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // -------------------------------------------------------------------------
  // User actions (optimistic local update + server persistence)
  // -------------------------------------------------------------------------

  const patchPatientLocal = (id: string, patch: Partial<Patient>) => {
    const s = stateRef.current;
    if (!s) return;
    const patients = s.patients.map((p) => (p.id === id ? { ...p, ...patch } : p));
    const next = { ...s, patients };
    stateRef.current = next; setState(next);
  };

  const pushLocalEvent = (patientId: string | null, kind: string, message: string) => {
    const s = stateRef.current;
    if (!s) return;
    const e: Evt = { id: tempIdRef.current--, patientId, kind, message, ts: Date.now(), simMin: s.simMin };
    const next = { ...s, events: [e, ...s.events].slice(0, 300) };
    stateRef.current = next; setState(next);
  };

  const setCondition = (p: Patient, condition: string) => {
    const s = stateRef.current;
    if (!s) return;
    const flow = conditionFlow(condition, p.prescribedRate);
    const label = CONDITION_LABEL[condition] ?? condition;
    const msg = condition === "normal"
      ? `Flow restored to normal for ${p.name} (${p.bed}) — scenario cleared. Infusion running at the prescribed ${p.prescribedRate} mL/hr.`
      : `Scenario triggered — ${label} simulated for ${p.name} (${p.bed}). Flow now ${flow} mL/hr against a prescribed ${p.prescribedRate} mL/hr.`;
    patchPatientLocal(p.id, {
      conditionState: condition, flowRate: flow, conditionSinceSimMin: s.simMin,
      lowFlowSinceSimMin: condition === "too_slow" ? s.simMin : null, zeroFlowTicks: 0,
      lastUpdated: Date.now(),
    });
    pushLocalEvent(p.id, "scenario", msg);
    const after = stateRef.current;
    if (after) {
      const np = after.patients.find((x) => x.id === p.id);
      if (np) patchPatientLocal(p.id, { status: computeStatus(np, after.alerts) });
    }
    api.setPatientCondition({
      patientId: p.id, conditionState: condition, flowRate: flow,
      status: p.status === "completed" ? "completed" : condition === "normal" ? "normal" : "warning",
      simMin: s.simMin, eventMessage: msg, eventKind: "scenario",
    }).catch(() => {});
  };

  const setVolume = (p: Patient, volume: number, note: string) => {
    const s = stateRef.current;
    if (!s) return;
    patchPatientLocal(p.id, { remainingVolume: round1(volume), lastUpdated: Date.now() });
    pushLocalEvent(p.id, "scenario", note);
    api.setPatientVolume({ patientId: p.id, remainingVolume: round1(volume), eventMessage: note, simMin: s.simMin }).catch(() => {});
  };

  const alertAction = (a: Alert, status: AlertStatus) => {
    const s = stateRef.current;
    if (!s) return;
    const p = s.patients.find((x) => x.id === a.patientId);
    const who = nurseName(s, a.nurseId);
    const label = status === "acknowledged" ? "acknowledged" : status === "in_progress" ? "marked in progress" : "resolved";
    const msg = `Alert ${label} by ${who} — "${a.title}" for ${p ? `${p.name} (${p.bed})` : a.patientId}.`;
    const alerts = s.alerts.map((x) => x.id === a.id ? {
      ...x, status,
      ackSimMin: (status === "acknowledged" || status === "in_progress") && x.ackSimMin == null ? s.simMin : x.ackSimMin,
      resolvedSimMin: status === "resolved" ? s.simMin : x.resolvedSimMin,
    } : x);
    const patients = s.patients.map((x) => ({ ...x }));
    const next = { ...s, alerts };
    stateRef.current = next; setState(next);
    const np = patients.find((x) => x.id === a.patientId);
    if (np) patchPatientLocal(np.id, { status: computeStatus(np, alerts) });
    pushLocalEvent(a.patientId, status === "resolved" ? "resolved" : "acknowledged", msg);
    showToast(msg);
    api.updateAlertStatus({
      alertId: a.id, status, simMin: s.simMin, eventMessage: msg,
      eventKind: status === "resolved" ? "resolved" : "acknowledged",
    }).catch(() => {});
  };

  // Bedside IV bottle change: clicking the button sends the 3D nurse to THIS
  // patient's bedside (she is pinned to this bed for the whole sequence).
  // The infusion restarts in the shared state only when Ward3D reports the
  // fresh bottle physically hung on the stand (onBagHung) — never on a blind
  // timer, which previously refilled the bottle while the nurse was still
  // walking or heading to a different bed. A long fallback timer remains
  // only so the sequence can never deadlock (e.g. WebGL unavailable).
  const completeBottleChange = () => {
    const pend = changePendingRef.current;
    if (!pend) return;
    changePendingRef.current = null;
    if (changeTimerRef.current != null) { window.clearTimeout(changeTimerRef.current); changeTimerRef.current = null; }
    const s2 = stateRef.current;
    if (!s2) { setChangingBottle(false); return; }
    const p2 = s2.patients.find((x) => x.id === pend.patientId);
    if (!p2) { setChangingBottle(false); return; }
    const alert2 = s2.alerts.find((x) => x.id === pend.alertId);
    const nurseId2 = alert2?.nurseId ?? p2.nurseId;
    const msg = `IV bottle changed at the bedside by ${nurseName(s2, nurseId2)} — empty ${p2.fluid} bottle removed, fresh ${Math.round(p2.initialVolume)} mL bottle hung and the infusion restarted at ${p2.prescribedRate} mL/hr for ${p2.name} (${p2.bed}).`;
    patchPatientLocal(p2.id, {
      remainingVolume: p2.initialVolume, flowRate: p2.prescribedRate,
      status: "normal", conditionState: "normal", conditionSinceSimMin: s2.simMin,
      lowFlowSinceSimMin: null, zeroFlowTicks: 0, startedAt: Date.now(),
      startedSimMin: s2.simMin, completedAt: null, completedSimMin: null,
      lastUpdated: Date.now(),
    });
    const s3 = stateRef.current;
    if (s3) {
      const nextReadings = {
        ...s3.readings,
        [p2.id]: [...(s3.readings[p2.id] ?? []),
          { patientId: p2.id, simMin: s3.simMin, remaining: p2.initialVolume, flow: p2.prescribedRate }].slice(-160),
      };
      const n3 = { ...s3, readings: nextReadings };
      stateRef.current = n3; setState(n3);
    }
    pushLocalEvent(p2.id, "restarted", msg);
    api.restartInfusion({
      patientId: p2.id, remainingVolume: p2.initialVolume,
      flowRate: p2.prescribedRate, simMin: s2.simMin, eventMessage: msg,
    }).catch(() => {});
    const alertNow = stateRef.current?.alerts.find((x) => x.id === pend.alertId);
    if (alertNow && alertNow.status !== "resolved") alertAction(alertNow, "resolved");
    setChangeSummary(msg);
    showToast(`Bottle changed at Bed ${p2.bed} — fresh ${Math.round(p2.initialVolume)} mL hung, infusion restarted.`);
    setChangingBottle(false);
  };

  const onBagHung = (patientId: string) => {
    if (changePendingRef.current?.patientId === patientId) completeBottleChange();
  };

  const changeBottle = (a: Alert) => {
    const s = stateRef.current;
    if (!s || changingBottle) return;
    const p = s.patients.find((x) => x.id === a.patientId);
    if (!p) return;
    setChangingBottle(true);
    setChangeSummary(null);
    changePendingRef.current = { alertId: a.id, patientId: p.id };
    setIvChange((prev) => ({ patientId: p.id, seq: (prev?.seq ?? 0) + 1 }));
    setCamPreset((c) => ({ name: "bedside", seq: c.seq + 1 }));
    pushLocalEvent(p.id, "scenario",
      `${nurseName(s, a.nurseId)} is changing the IV bottle at Bed ${p.bed} — taking the empty ${p.fluid} bottle down and hanging a fresh one.`);
    if (changeTimerRef.current != null) window.clearTimeout(changeTimerRef.current);
    changeTimerRef.current = window.setTimeout(() => {
      changeTimerRef.current = null;
      completeBottleChange();
    }, 20000);
  };

  // -------------------------------------------------------------------------
  // Automated nurse response state machine. The evaluator never clicks to
  // move a nurse: alerts dispatch their own assigned nurse automatically.
  // -------------------------------------------------------------------------

  const alertActionRef = useRef(alertAction);
  alertActionRef.current = alertAction;
  const changeBottleRef = useRef(changeBottle);
  changeBottleRef.current = changeBottle;
  const changingBottleRef = useRef(false);
  changingBottleRef.current = changingBottle;

  const setResponseStatus = (nurseId: string, status: NurseStatus, patch?: Partial<NurseResponse>) => {
    setNurseResponses((prev) => {
      const cur = prev[nurseId];
      if (!cur) return prev;
      const next = { ...prev, [nurseId]: { ...cur, ...patch, status } };
      responsesRef.current = next;
      return next;
    });
  };

  const clearResponseTimer = (key: string) => {
    const t = responseTimersRef.current[key];
    if (t != null) { window.clearTimeout(t); delete responseTimersRef.current[key]; }
  };
  const scheduleResponseTimer = (key: string, ms: number, fn: () => void) => {
    if (responseTimersRef.current[key] != null) return;
    responseTimersRef.current[key] = window.setTimeout(() => {
      delete responseTimersRef.current[key];
      fn();
    }, ms);
  };

  // The 3D scene reports a nurse's physical arrival at her patient's bed.
  const onNurseArrived = (nurseId: string, patientId: string) => {
    const cur = responsesRef.current[nurseId];
    if (!cur || cur.patientId !== patientId) return;
    if (cur.status !== "RESPONDING" && cur.status !== "ALERT RECEIVED") return;
    const s = stateRef.current;
    setResponseStatus(nurseId, "ARRIVED AT BEDSIDE", { arrivedSimMin: s?.simMin ?? cur.alertSimMin });
    const p = s?.patients.find((x) => x.id === patientId);
    if (s && p) {
      pushLocalEvent(patientId, "acknowledged",
        `${nurseName(s, nurseId)} arrived at the bedside of ${p.name} (Bed ${p.bed}) — responding to "${cur.alertId ? (s.alerts.find((a) => a.id === cur.alertId)?.title ?? "alert") : "alert"}".`);
    }
    scheduleResponseTimer(`inspect:${cur.alertId}`, 1400, () => {
      const c2 = responsesRef.current[nurseId];
      if (c2 && c2.alertId === cur.alertId && c2.status === "ARRIVED AT BEDSIDE") {
        setResponseStatus(nurseId, "INSPECTING PATIENT");
      }
    });
  };

  // Detection: every new unresolved alert for a patient visible in the 3D
  // scene is routed to THAT patient's assigned nurse — never a random one.
  // If the nurse is busy, the alert queues behind her current response,
  // ordered by severity when it is picked up.
  useEffect(() => {
    if (!state || view !== "ward3d") return;
    const visible = new Set(sceneVisibleIdsRef.current);
    if (visible.size === 0) return;
    const fresh = state.alerts.filter((a) => a.status !== "resolved" && visible.has(a.patientId)
      && !handledAlertsRef.current.has(a.id) && a.id.startsWith("A-"));
    if (fresh.length === 0) return;
    fresh.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.createdAt - b.createdAt);
    // Decide entries vs queue LOCALLY in this pass: React state updaters do
    // not run synchronously, so reading responsesRef inside the loop would
    // still show the pre-pass map and every alert would look "unassigned" —
    // the last one processed would overwrite the rest and the critical
    // alerts would never queue. Track busy nurses in a local set instead.
    const busy = new Set<string>();
    for (const [nid, r] of Object.entries(responsesRef.current)) {
      if (r.status !== "RESPONSE COMPLETED") busy.add(nid);
    }
    const entriesToAdd: Record<string, NurseResponse> = {};
    const queueToAdd: Record<string, string[]> = {};
    const queuedNotes: Alert[] = [];
    for (const a of fresh) {
      handledAlertsRef.current.add(a.id);
      const nurseId = a.nurseId;
      if (busy.has(nurseId)) {
        (queueToAdd[nurseId] ??= []).push(a.id);
        queuedNotes.push(a);
      } else {
        busy.add(nurseId);
        entriesToAdd[nurseId] = {
          nurseId, patientId: a.patientId, alertId: a.id, alertType: a.type,
          severity: a.severity, status: "ALERT RECEIVED",
          alertSimMin: a.createdSimMin, arrivedSimMin: null, completedSimMin: null,
        };
      }
    }
    if (Object.keys(entriesToAdd).length > 0) {
      const merged = { ...responsesRef.current, ...entriesToAdd };
      responsesRef.current = merged;
      setNurseResponses(merged);
    }
    if (Object.keys(queueToAdd).length > 0) {
      const mergedQ = { ...queueRef.current };
      for (const [nid, ids] of Object.entries(queueToAdd)) {
        mergedQ[nid] = [...new Set([...(mergedQ[nid] ?? []), ...ids])];
      }
      queueRef.current = mergedQ;
      setNurseQueue(mergedQ);
      for (const a of queuedNotes) {
        pushLocalEvent(a.patientId, "alert",
          `Alert queued for ${nurseName(state, a.nurseId)} — she is attending another patient first. "${a.title}" will be dispatched by severity as soon as she is free.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.alerts, view]);

  // Dispatch + bedside follow-through: ALERT RECEIVED nurses are dispatched
  // automatically (critical first/fastest), the alert is acknowledged by the
  // nurse in the shared state as she sets off, an empty bottle is changed
  // automatically once she is inspecting it, and other alerts are recorded
  // and resolved after her bedside check.
  useEffect(() => {
    if (!state) return;
    for (const entry of Object.values(nurseResponses)) {
      const alert = state.alerts.find((a) => a.id === entry.alertId);
      if (entry.status === "ALERT RECEIVED") {
        const delay = entry.severity === "critical" ? 900 : entry.severity === "warning" ? 1800 : 2600;
        scheduleResponseTimer(`dispatch:${entry.alertId}`, delay, () => {
          const cur = responsesRef.current[entry.nurseId];
          if (!cur || cur.alertId !== entry.alertId || cur.status !== "ALERT RECEIVED") return;
          setResponseStatus(entry.nurseId, "RESPONDING");
          const aNow = stateRef.current?.alerts.find((a) => a.id === entry.alertId);
          if (aNow && aNow.status === "new") alertActionRef.current(aNow, "acknowledged");
          else if (aNow && aNow.status === "acknowledged") alertActionRef.current(aNow, "in_progress");
        });
      } else if (entry.status === "INSPECTING PATIENT" && alert && alert.status !== "resolved") {
        if (entry.alertType === "BOTTLE_EMPTY") {
          scheduleResponseTimer(`change:${entry.alertId}`, 1500, () => {
            const cur = responsesRef.current[entry.nurseId];
            if (!cur || cur.alertId !== entry.alertId || cur.status !== "INSPECTING PATIENT") return;
            const aNow = stateRef.current?.alerts.find((a) => a.id === entry.alertId);
            if (aNow && aNow.status !== "resolved" && !changingBottleRef.current) {
              if (aNow.status === "acknowledged") alertActionRef.current(aNow, "in_progress");
              changeBottleRef.current(aNow);
            }
          });
        } else {
          scheduleResponseTimer(`resolve:${entry.alertId}`, 4000, () => {
            const cur = responsesRef.current[entry.nurseId];
            if (!cur || cur.alertId !== entry.alertId || cur.status !== "INSPECTING PATIENT") return;
            const aNow = stateRef.current?.alerts.find((a) => a.id === entry.alertId);
            if (aNow && aNow.status !== "resolved") alertActionRef.current(aNow, "resolved");
          });
        }
      } else if (entry.status === "RESPONSE COMPLETED") {
        scheduleResponseTimer(`free:${entry.alertId}`, 2600, () => {
          const cur = responsesRef.current[entry.nurseId];
          if (!cur || cur.alertId !== entry.alertId) return;
          // Free the nurse, then dispatch her next queued alert by severity.
          setNurseResponses((prev) => {
            const next = { ...prev };
            delete next[entry.nurseId];
            responsesRef.current = next;
            return next;
          });
          const sNow = stateRef.current;
          if (!sNow) return;
          const queued = (queueRef.current[entry.nurseId] ?? [])
            .map((id) => sNow.alerts.find((a) => a.id === id))
            .filter((a): a is Alert => a != null && a.status !== "resolved")
            .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.createdAt - b.createdAt);
          const nextAlert = queued[0];
          setNurseQueue((prev) => {
            const next = { ...prev, [entry.nurseId]: (prev[entry.nurseId] ?? []).filter((id) => id !== nextAlert?.id) };
            queueRef.current = next;
            return next;
          });
          if (nextAlert) {
            const e2: NurseResponse = {
              nurseId: entry.nurseId, patientId: nextAlert.patientId, alertId: nextAlert.id,
              alertType: nextAlert.type, severity: nextAlert.severity, status: "ALERT RECEIVED",
              alertSimMin: nextAlert.createdSimMin, arrivedSimMin: null, completedSimMin: null,
            };
            setNurseResponses((prev) => {
              const next = { ...prev, [entry.nurseId]: e2 };
              responsesRef.current = next;
              return next;
            });
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nurseResponses, state?.alerts]);

  // Completion: when the alert behind a response resolves (bedside check
  // recorded, bottle changed, or closed from the alert centre), the nurse's
  // response is marked completed with her total response time.
  useEffect(() => {
    if (!state) return;
    for (const entry of Object.values(responsesRef.current)) {
      if (entry.status === "RESPONSE COMPLETED") continue;
      const alert = state.alerts.find((a) => a.id === entry.alertId);
      if (alert && alert.status === "resolved") {
        clearResponseTimer(`dispatch:${entry.alertId}`);
        clearResponseTimer(`resolve:${entry.alertId}`);
        clearResponseTimer(`change:${entry.alertId}`);
        setResponseStatus(entry.nurseId, "RESPONSE COMPLETED", {
          completedSimMin: alert.resolvedSimMin ?? state.simMin,
          arrivedSimMin: entry.arrivedSimMin ?? entry.alertSimMin,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.alerts]);

  const assignAlert = (a: Alert, nurseId: string) => {
    const s = stateRef.current;
    if (!s) return;
    const msg = `Alert "${a.title}" reassigned from ${nurseName(s, a.nurseId)} to ${nurseName(s, nurseId)}.`;
    const next = { ...s, alerts: s.alerts.map((x) => (x.id === a.id ? { ...x, nurseId } : x)) };
    stateRef.current = next; setState(next);
    pushLocalEvent(a.patientId, "assigned", msg);
    api.assignAlert({ alertId: a.id, nurseId, simMin: s.simMin, eventMessage: msg }).catch(() => {});
  };

  const reassignPatient = (p: Patient, nurseId: string) => {
    const s = stateRef.current;
    if (!s) return;
    const msg = `${p.name} (${p.bed}) reassigned from ${nurseName(s, p.nurseId)} to ${nurseName(s, nurseId)}. Active alerts follow the patient.`;
    patchPatientLocal(p.id, { nurseId });
    const next = stateRef.current;
    if (next) {
      const alerts = next.alerts.map((a) => (a.patientId === p.id && a.status !== "resolved" ? { ...a, nurseId } : a));
      const n2 = { ...next, alerts };
      stateRef.current = n2; setState(n2);
    }
    pushLocalEvent(p.id, "assigned", msg);
    api.reassignPatient({ patientId: p.id, nurseId, simMin: s.simMin, eventMessage: msg }).catch(() => {});
  };

  const doReseed = async (mode: "main" | "demo") => {
    try {
      const b = await api.reseed({ mode });
      setRunning(false);
      setDemoStep(0);
      demoAlertRef.current = null;
      if (changeTimerRef.current != null) { window.clearTimeout(changeTimerRef.current); changeTimerRef.current = null; }
      changePendingRef.current = null;
      setChangingBottle(false);
      setChangeSummary(null);
      setIvChange(null);
      // Reset the automated nurse response state with the scenario.
      for (const k of Object.keys(responseTimersRef.current)) clearResponseTimer(k);
      handledAlertsRef.current = new Set();
      responsesRef.current = {};
      queueRef.current = {};
      setNurseResponses({});
      setNurseQueue({});
      setSceneEpoch((e) => e + 1);
      cooldownRef.current = {};
      setSelectedPatientId(null);
      setSelectedAlertId(null);
      applyBootstrap(b);
      setView("dashboard");
    } catch { setLoadError("Reset failed — please reload the page."); }
  };

  // -------------------------------------------------------------------------
  // Form / view-local state
  // -------------------------------------------------------------------------

  const [nurseForm, setNurseForm] = useState({ name: "", wardId: "general", shift: "Day", phone: "" });
  const [editingNurseId, setEditingNurseId] = useState<string | null>(null);
  const [showNurseForm, setShowNurseForm] = useState(false);
  const [patientForm, setPatientForm] = useState({
    name: "", age: 45, gender: "F", diagnosis: "", bed: "", wardId: "general",
    nurseId: "", fluid: "Normal Saline", initialVolume: 500, prescribedRate: 80,
  });
  const [settingsDraft, setSettingsDraft] = useState<{ lowThresholdPct: number; escalationSimMin: number; autoScenarios: number } | null>(null);

  // Analytics filter computation (hook — must stay above the loading return).
  const anaAlerts = useMemo(() => {
    if (!state) return [] as Alert[];
    const nowMs = Date.now();
    return state.alerts.filter((a) => {
      if (anaWard !== "all") {
        const p = state.patients.find((x) => x.id === a.patientId);
        if (!p || p.wardId !== anaWard) return false;
      }
      if (anaRange === "today") {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        if (a.createdAt < start.getTime()) return false;
      } else if (anaRange === "7d") {
        if (a.createdAt < nowMs - 7 * 86400000) return false;
      } else if (anaRange === "30d") {
        if (a.createdAt < nowMs - 30 * 86400000) return false;
      }
      return true;
    });
  }, [state, anaWard, anaRange]);

  // Load fuller reading history when a patient detail opens.
  useEffect(() => {
    if (view !== "patient" || !selectedPatientId) return;
    const pid = selectedPatientId;
    api.getPatientReadings({ patientId: pid, limit: 200 })
      .then((r) => {
        const s = stateRef.current;
        if (!s) return;
        const next = { ...s, readings: { ...s.readings, [pid]: r.readings.slice(-200) } };
        stateRef.current = next; setState(next);
      })
      .catch(() => {});
  }, [view, selectedPatientId]);

  if (!state) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)" }} aria-busy={!loadError}>
        <div className="mx-auto max-w-[1200px] px-4 py-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-white" style={{ background: "var(--accent)" }}>
              <Icon name="pulse" size={22} />
            </span>
            <div>
              <div className="font-display text-[26px] font-medium leading-none" style={{ color: "var(--accent)" }}>DripConnect</div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--dim)" }}>Clinical IV monitoring platform</div>
            </div>
          </div>
          {loadError ? (
            <p className="mt-8 text-sm font-medium" style={{ color: "var(--crit)" }}>{loadError}</p>
          ) : (
            <div className="mt-8" aria-label="Loading the monitoring state">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[74px]" />)}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[168px]" />)}
              </div>
              <p className="mt-4 text-sm" style={{ color: "var(--dim)" }}>Loading the simulated ward…</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const inDemo = state.nurses.some((n) => n.id.startsWith("D-"));
  const activeAlerts = state.alerts.filter((a) => a.status !== "resolved");
  const criticalActive = activeAlerts.filter((a) => a.severity === "critical");
  const stats = {
    total: state.patients.length,
    normal: state.patients.filter((p) => p.status === "normal").length,
    warning: state.patients.filter((p) => p.status === "warning").length,
    critical: state.patients.filter((p) => p.status === "critical").length,
    completed: state.patients.filter((p) => p.status === "completed").length,
    notifications: activeAlerts.length,
  };
  const selectedPatient = state.patients.find((p) => p.id === selectedPatientId) ?? null;
  const settingsView = settingsDraft ?? state.settings;

  const openPatient = (id: string) => { setSelectedPatientId(id); setView("patient"); };

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  const filteredPatients = state.patients.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (wardFilter !== "all" && p.wardId !== wardFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.bed.toLowerCase().includes(q)) return false;
    return true;
  });

  const submitPatient = () => {
    if (!patientForm.name.trim() || !patientForm.bed.trim()) return;
    const nurseId = patientForm.nurseId || state.nurses[0]?.id || "";
    const id = `P-${Date.now() % 1000000}`;
    const p: Patient = {
      id, name: patientForm.name.trim(), age: patientForm.age, gender: patientForm.gender,
      diagnosis: patientForm.diagnosis || "IV fluid therapy", bed: patientForm.bed.trim(),
      wardId: patientForm.wardId, nurseId, fluid: patientForm.fluid,
      initialVolume: patientForm.initialVolume, remainingVolume: patientForm.initialVolume,
      prescribedRate: patientForm.prescribedRate, flowRate: patientForm.prescribedRate,
      dripFactor: 20, status: "normal", conditionState: "normal",
      conditionSinceSimMin: state.simMin, lowFlowSinceSimMin: null, zeroFlowTicks: 0,
      startedAt: Date.now(), startedSimMin: state.simMin, completedAt: null,
      completedSimMin: null, lastUpdated: Date.now(),
    };
    const next = {
      ...state, patients: [...state.patients, p],
      events: [{ id: tempIdRef.current--, patientId: id, kind: "started", message: `Infusion started — ${p.fluid} ${p.initialVolume} mL at ${p.prescribedRate} mL/hr for ${p.name} (${p.bed}).`, ts: Date.now(), simMin: state.simMin }, ...state.events],
      readings: { ...state.readings, [id]: [{ patientId: id, simMin: state.simMin, remaining: p.initialVolume, flow: p.prescribedRate }] },
    };
    stateRef.current = next; setState(next);
    setShowAddPatient(false);
    showToast(`Infusion started for ${p.name} (Bed ${p.bed}) — ${p.fluid} ${p.initialVolume} mL at ${p.prescribedRate} mL/hr.`);
    api.addPatient({
      id, name: p.name, age: p.age, gender: p.gender, diagnosis: p.diagnosis, bed: p.bed,
      wardId: p.wardId, nurseId, fluid: p.fluid, initialVolume: p.initialVolume,
      prescribedRate: p.prescribedRate, simMin: state.simMin,
    }).catch(() => {});
  };

  const renderDashboard = (liveMode = false) => (
    <div>
      <PageHeader
        title={liveMode ? "Live Monitoring" : "Overview"}
        desc={liveMode
          ? "Real-time infusion status for every monitored bed. Values update with each simulation tick."
          : "Hospital-wide IV monitoring at a glance — every bed, alert and infusion in one command view."}>
        <span className="inline-flex items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5 text-xs font-medium"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: running ? "var(--ok)" : "var(--dim)" }}>
          <span className={`inline-block h-2 w-2 rounded-full ${running ? "live-dot" : ""}`} style={{ background: running ? "var(--ok)" : "#b6c2cd" }} />
          {running ? `Monitoring live · ${speed}× speed` : "Simulation paused"}
        </span>
        <Btn variant="primary" onClick={() => setView("ward3d")}>Open 3D hospital</Btn>
      </PageHeader>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-y px-1 py-2 lg:grid-cols-3 xl:grid-cols-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <StatCard label="Patients monitored" value={stats.total} />
        <StatCard label="Normal infusions" value={stats.normal} color="var(--ok)" soft />
        <StatCard label="Warning conditions" value={stats.warning} color="var(--warn)" soft />
        <StatCard label="Critical alerts" value={stats.critical} color="var(--crit)" soft />
        <StatCard label="Completed infusions" value={stats.completed} />
        <StatCard label="Active nurse notifications" value={stats.notifications} color="var(--accent)" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "normal", "warning", "critical", "completed"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            aria-label={`Filter patients: ${f}`}
            className="rounded-[var(--radius)] border px-3 py-1.5 text-[13px] font-medium capitalize"
            style={filter === f
              ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
              : { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
            {f === "all" ? "All patients" : STATUS_META[f].label}
          </button>
        ))}
        <input aria-label="Search by patient name or bed number" value={search}
          onChange={(e) => setSearch(e.target.value)} placeholder="Search name or bed…"
          className={`${inputCls} sm:w-56`} style={{ ...inputStyle, width: undefined }} />
        <select aria-label="Filter by ward" value={wardFilter} onChange={(e) => setWardFilter(e.target.value)}
          className="rounded-[var(--radius)] border px-2.5 py-2 text-sm" style={inputStyle}>
          <option value="all">All wards</option>
          {state.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <span className="flex-1" />
        <Btn variant="ghost" onClick={() => setShowAddPatient((v) => !v)}>
          {showAddPatient ? "Close registration" : "＋ Register patient"}
        </Btn>
      </div>

      {showAddPatient && (
        <form className="mt-3 grid grid-cols-2 gap-2 rounded-[var(--radius)] border p-3 sm:grid-cols-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          onSubmit={(e) => { e.preventDefault(); submitPatient(); }}>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Patient name
            <input aria-label="New patient name" required value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} className={inputCls} style={inputStyle} /></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Age
            <input aria-label="New patient age" type="number" min={0} max={120} value={patientForm.age} onChange={(e) => setPatientForm({ ...patientForm, age: Number(e.target.value) })} className={inputCls} style={inputStyle} /></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Gender
            <select aria-label="New patient gender" value={patientForm.gender} onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })} className={inputCls} style={inputStyle}>
              <option>F</option><option>M</option><option>Other</option></select></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Bed number
            <input aria-label="New patient bed" required value={patientForm.bed} onChange={(e) => setPatientForm({ ...patientForm, bed: e.target.value })} className={inputCls} style={inputStyle} placeholder="e.g. G-16" /></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Ward
            <select aria-label="New patient ward" value={patientForm.wardId} onChange={(e) => setPatientForm({ ...patientForm, wardId: e.target.value })} className={inputCls} style={inputStyle}>
              {state.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Assigned nurse
            <select aria-label="New patient nurse" value={patientForm.nurseId} onChange={(e) => setPatientForm({ ...patientForm, nurseId: e.target.value })} className={inputCls} style={inputStyle}>
              <option value="">First available</option>
              {state.nurses.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>IV fluid
            <select aria-label="New patient fluid" value={patientForm.fluid} onChange={(e) => setPatientForm({ ...patientForm, fluid: e.target.value })} className={inputCls} style={inputStyle}>
              {["Normal Saline", "Ringer's Lactate", "Dextrose 5%", "DNS (Dextrose Normal Saline)", "0.45% Saline"].map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Diagnosis
            <input aria-label="New patient diagnosis" value={patientForm.diagnosis} onChange={(e) => setPatientForm({ ...patientForm, diagnosis: e.target.value })} className={inputCls} style={inputStyle} /></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Bottle volume (mL)
            <input aria-label="New patient bottle volume" type="number" min={50} step={50} value={patientForm.initialVolume} onChange={(e) => setPatientForm({ ...patientForm, initialVolume: Number(e.target.value) })} className={inputCls} style={inputStyle} /></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Prescribed rate (mL/hr)
            <input aria-label="New patient prescribed rate" type="number" min={5} step={5} value={patientForm.prescribedRate} onChange={(e) => setPatientForm({ ...patientForm, prescribedRate: Number(e.target.value) })} className={inputCls} style={inputStyle} /></label>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-2">
            <Btn variant="ok" onClick={submitPatient}>Start infusion</Btn>
          </div>
        </form>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-5 sm:grid-cols-2 xl:col-span-2">
          {filteredPatients.length === 0 && (
            <p className="text-sm" style={{ color: "var(--dim)" }}>No patients match this filter.</p>
          )}
          {filteredPatients.map((p) => (
            <PatientCard key={p.id} p={p}
              nurseName={nurseName(state, p.nurseId)} wardName={wardName(state, p.wardId)}
              activeAlerts={activeAlerts.filter((a) => a.patientId === p.id).length}
              onOpen={() => openPatient(p.id)} />
          ))}
        </div>
        <div className="space-y-6">
          <div className="rounded-[var(--radius)] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>Active alerts</SectionTitle>
              <Btn variant="ghost" onClick={() => setView("alerts")}>Open alert centre</Btn>
            </div>
            {activeAlerts.length === 0 && <p className="text-sm" style={{ color: "var(--dim)" }}>No active alerts. All infusions are running within limits.</p>}
            <div className="space-y-2">
              {activeAlerts.slice(0, 5).map((a) => {
                const p = state.patients.find((x) => x.id === a.patientId);
                const sev = SEV_META[a.severity];
                return (
                  <button key={a.id} type="button" onClick={() => { setSelectedAlertId(a.id); setView("alerts"); }}
                    aria-label={`View alert: ${a.title}`}
                    className="block w-full rounded-[var(--radius)] border p-2.5 text-left"
                    style={{ borderColor: "var(--border)", background: sev.soft }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{a.title}</span>
                      <Pill text={sev.label} color={sev.color} soft="rgba(255,255,255,0.65)" />
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--dim)" }}>
                      {p ? `${p.name} · Bed ${p.bed} · ${wardName(state, p.wardId)}` : a.patientId} · <span className="font-mono2">{fmtTime(a.createdAt)}</span>
                      {a.escalated === 1 ? " · ESCALATED" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-[var(--radius)] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <SectionTitle>Recent activity</SectionTitle>
              <Btn variant="ghost" onClick={() => setView("events")}>Full history</Btn>
            </div>
            <div className="mt-3 max-h-[420px] space-y-0 overflow-y-auto pr-1">
              {state.events.slice(0, 20).map((e, i, arr) => (
                <div key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute left-[3px] top-3 h-full w-px" style={{ background: "var(--border)" }} />}
                  <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: e.kind === "alert" || e.kind === "escalated" ? "var(--crit)" : e.kind === "resolved" || e.kind === "restarted" || e.kind === "completed" ? "var(--teal)" : "var(--blue)" }} />
                  <div className="min-w-0">
                    <div className="text-[13px] leading-snug">{e.message}</div>
                    <div className="font-mono2 mt-0.5 text-[11px]" style={{ color: "var(--dim)" }}>{fmtTime(e.ts)}</div>
                  </div>
                </div>
              ))}
              {state.events.length === 0 && <p className="text-sm" style={{ color: "var(--dim)" }}>No events recorded yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // 3D hospital — digital-twin view over the SAME simulation state
  // -------------------------------------------------------------------------

  const renderWard3D = () => {
    const trioKey = `${sceneMode}-${sceneEpoch}`;
    let trioIds = trioIdsRef.current?.key === trioKey ? trioIdsRef.current.ids : null;
    if (!trioIds || trioIds.some((id) => !state.patients.some((p) => p.id === id))) {
      const trio: Patient[] = [];
      const pushTrio = (p?: Patient) => { if (p && !trio.includes(p)) trio.push(p); };
      pushTrio(state.patients.find((p) => p.status === "normal"));
      pushTrio(state.patients.find((p) => p.status === "warning")
        ?? state.patients.find((p) => p.status !== "completed" && p.initialVolume > 0
          && p.remainingVolume / p.initialVolume <= state.settings.lowThresholdPct / 100));
      pushTrio(state.patients.find((p) => p.status === "critical")
        ?? state.patients.find((p) => p.status === "completed"));
      for (const p of state.patients) { if (trio.length >= 3) break; pushTrio(p); }
      trioIds = trio.slice(0, 3).map((p) => p.id);
      trioIdsRef.current = { key: trioKey, ids: trioIds };
    }
    const trioFinal = trioIds
      .map((id) => state.patients.find((p) => p.id === id))
      .filter((p): p is Patient => p != null);

    const focus = (sceneFocusId ? state.patients.find((p) => p.id === sceneFocusId) : undefined)
      ?? (selectedPatientId ? state.patients.find((p) => p.id === selectedPatientId) : undefined)
      ?? trioFinal.find((p) => p.status === "critical")
      ?? trioFinal[0]
      ?? state.patients[0];
    if (!focus) return <p className="text-sm" style={{ color: "var(--dim)" }}>No patients loaded.</p>;

    const visible = sceneMode === "single" ? [focus] : trioFinal;
    const scenePatients: ScenePatient[] = visible.map((p) => ({
      id: p.id, name: p.name, bed: p.bed, fluid: p.fluid,
      initialVolume: p.initialVolume, remainingVolume: p.remainingVolume,
      flowRate: p.flowRate, prescribedRate: p.prescribedRate,
      status: p.status, conditionState: p.conditionState,
      nurseId: p.nurseId, nurseName: nurseName(state, p.nurseId),
    }));

    const visibleIds = visible.map((p) => p.id);
    sceneVisibleIdsRef.current = visibleIds;
    const changeTargetId = changingBottle ? ivChange?.patientId ?? null : null;
    const statusRank = (a: Alert) => (a.status === "in_progress" ? 0 : a.status === "acknowledged" ? 1 : 2);
    const sceneAlerts = state.alerts
      .filter((a) => visibleIds.includes(a.patientId) && a.status !== "resolved")
      .sort((a, b) => statusRank(a) - statusRank(b)
        || (a.patientId === focus.id ? 0 : 1) - (b.patientId === focus.id ? 0 : 1)
        || (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1)
        || b.createdAt - a.createdAt);
    const sceneAlert = sceneAlerts[0];

    // Nurse agents for the 3D scene — one figure per distinct assigned
    // nurse of the visible beds, driven by the automated response state.
    // A nurse responds ONLY to her own assigned patients; with no active
    // response she stays at the nurse station (AVAILABLE).
    const sceneNurseIds = [...new Set(visible.map((p) => p.nurseId))];
    const nurseAgents: NurseAgent[] = sceneNurseIds.map((nid) => {
      const resp = nurseResponses[nid];
      const forced = changeTargetId != null
        && state.patients.find((x) => x.id === changeTargetId)?.nurseId === nid;
      if (forced) {
        return { nurseId: nid, nurseName: nurseName(state, nid), targetPatientId: changeTargetId, mode: "inspect" as const };
      }
      if (!resp) return { nurseId: nid, nurseName: nurseName(state, nid), targetPatientId: null, mode: "station" as const };
      if (resp.status === "ALERT RECEIVED") {
        return { nurseId: nid, nurseName: nurseName(state, nid), targetPatientId: resp.patientId, mode: "alert" as const };
      }
      if (resp.status === "RESPONDING") {
        return { nurseId: nid, nurseName: nurseName(state, nid), targetPatientId: resp.patientId, mode: "respond" as const };
      }
      return { nurseId: nid, nurseName: nurseName(state, nid), targetPatientId: resp.patientId, mode: "inspect" as const };
    });

    const lowAt = (focus.initialVolume * state.settings.lowThresholdPct) / 100;
    const emptyAlert = state.alerts.find((a) => a.patientId === focus.id && a.type === "BOTTLE_EMPTY");
    const focusMeta = STATUS_META[focus.status];

    let stageIdx = 1;
    if (emptyAlert?.status === "resolved") stageIdx = 7;
    else if (emptyAlert && emptyAlert.status !== "new") stageIdx = 6;
    else if (emptyAlert) stageIdx = 5;
    else if (focus.status === "completed" || focus.remainingVolume <= 0) stageIdx = 4;
    else if (focus.remainingVolume <= lowAt) stageIdx = 3;
    else if (running || focus.remainingVolume < focus.initialVolume) stageIdx = 2;
    const stages = [
      { n: 1, title: "Patient admitted", text: `${focus.name} is asleep in Bed ${focus.bed}; ${nurseName(state, focus.nurseId)} has started the ${focus.fluid} infusion.` },
      { n: 2, title: "Normal infusion", text: "Fluid falls gradually inside the bag; remaining volume, flow and completion estimate update with the dashboard." },
      { n: 3, title: "Low-fluid warning", text: `At or below ${state.settings.lowThresholdPct}% remaining, the bag beacon turns amber, a warning is raised and the nurse is notified with a sound.` },
      { n: 4, title: "Bottle empty", text: "The bag is visibly empty, the infusion completes, the patient turns CRITICAL and the empty-bottle event is timestamped." },
      { n: 5, title: "Nurse receives the alert", text: "The critical alert lands on the nurse-station board and is routed automatically to this patient's assigned nurse — watch her name label at the station and the live Nurse Response panel below the scene." },
      { n: 6, title: "Nurse responds & changes the IV", text: "No clicks needed: the assigned nurse automatically leaves the station, walks the aisle to the bedside, inspects the patient and IV, takes the empty bottle down, fetches a fresh full bottle from the supply trolley, hangs it and restarts the infusion." },
      { n: 7, title: "Incident resolved", text: "Resolution is recorded with the response time; the patient is back to NORMAL on the fresh bottle, and the event history and analytics update. The scenario can be replayed." },
    ];
    const nextSpeed = [1, 2, 5, 10].find((s) => s > speed) ?? 1;
    const replay = async () => {
      await doReseed(inDemo ? "demo" : "main");
      setSceneFocusId(null);
      setView("ward3d");
    };

    const scenarioName = "Patient IV Infusion — Critical Empty Bottle Event";
    const chartAxis = { fontSize: 11, fill: "#7a7264" } as const;
    const chartTooltip = { fontSize: 12, borderRadius: 4, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" } as const;
    const focusRows = (state.readings[focus.id] ?? []).map((r) => ({
      min: Math.round(r.simMin), remaining: round1(r.remaining), flow: round1(r.flow),
      progress: round1(Math.min(100, Math.max(0, ((focus.initialVolume - r.remaining) / focus.initialVolume) * 100))),
    }));
    const focusEvents = state.events.filter((e) => e.patientId == null || visibleIds.includes(e.patientId)).slice(0, 14);
    const applyScenarioSelection = () => {
      if (focus.status === "completed") return;
      if (simScenarioSel === "normal") { setCondition(focus, "normal"); setRunning(true); }
      else if (simScenarioSel === "low") { setVolume(focus, Math.max(3, lowAt - 5), `3D scenario — bottle for ${focus.name} (${focus.bed}) advanced to the low-fluid threshold.`); setRunning(true); }
      else if (simScenarioSel === "empty") { setVolume(focus, 0, `3D scenario — bottle for ${focus.name} (${focus.bed}) emptied.`); setRunning(true); }
      else if (simScenarioSel === "too_fast") { setCondition(focus, "too_fast"); setRunning(true); }
      else if (simScenarioSel === "stopped") { setCondition(focus, "stopped"); setRunning(true); }
      else if (simScenarioSel === "blockage") { setCondition(focus, "blockage"); setRunning(true); }
      else if (simScenarioSel === "fluctuation") { setCondition(focus, "fluctuation"); setRunning(true); }
    };

    return (
      <div className="space-y-6">
        {/* 1 — SIMULATION HEADER (above the scene) */}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-[200px]">
            <div className="clinical-label">Digital twin · Live ward</div>
            <h1 className="display-title mt-1">Hospital Simulation</h1>
          </div>
          <div>
            <div className="clinical-label">Current scenario</div>
            <div className="font-display mt-0.5 text-[19px] font-medium leading-tight" style={{ color: "var(--accent)" }}>{scenarioName}</div>
          </div>
          <div>
            <div className="clinical-label">Simulation status</div>
            <div className="mt-0.5 inline-flex items-center gap-2 text-[13.5px] font-medium">
              <span className={`inline-block h-2 w-2 rounded-full ${running ? "live-dot" : ""}`} style={{ background: running ? "var(--ok)" : "#b6c2cd" }} />
              {running ? "Running" : "Paused"}
            </div>
          </div>
          <div>
            <div className="clinical-label">Simulation time</div>
            <div className="reading-mono mt-0.5 text-[15px] leading-tight">T+{fmtDuration(state.simMin)}</div>
          </div>
          <div>
            <div className="clinical-label">Patients simulated</div>
            <div className="reading-mono mt-0.5 text-[15px] leading-tight">{visible.length} in scene · {state.patients.length} total</div>
          </div>
          <span className="flex-1" />
          <div>
            <div className="clinical-label">Bed in focus</div>
            <div className="mt-0.5 text-[13.5px] font-medium leading-tight">{focus.name} · Bed {focus.bed}</div>
          </div>
          <div>
            <div className="clinical-label">Active event</div>
            <div className="mt-0.5 text-[13px] font-semibold leading-tight" style={{ color: sceneAlert ? SEV_META[sceneAlert.severity].color : "var(--ok)" }}>
              {sceneAlert ? `${sceneAlert.title} — Bed ${state.patients.find((x) => x.id === sceneAlert.patientId)?.bed ?? ""}` : "No active events"}
            </div>
          </div>
        </div>

        {/* 2 — FULL-WIDTH LANDSCAPE 3D HOSPITAL SCENE */}
        <div className="sim-viewport relative overflow-hidden rounded-[var(--radius)] border" style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}>
          <Ward3D
            key={`${sceneMode}-${sceneEpoch}-${visible.map((p) => p.id).join(",")}`}
            patients={scenePatients}
            selectedId={focus.id}
            onSelect={(id) => { setSceneFocusId(id); setSelectedPatientId(id); }}
            nurseAgents={nurseAgents}
            onNurseArrived={onNurseArrived}
            preset={camPreset}
            ivChange={ivChange}
            onBagHung={onBagHung}
          />
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-[3px] px-3 py-2 text-xs font-medium tracking-[0.02em] text-white" style={{ background: "rgba(20,43,69,0.86)" }}>
            <span className={`inline-block h-2 w-2 rounded-full ${running ? "live-dot" : ""}`} style={{ background: running ? "#2fbf9b" : "#b6c2cd" }} />
            {sceneMode === "multi" ? "Multi-bed ward · 3 beds" : "Single room"} · {running ? "Live" : "Paused"}
          </div>
          <div className="font-mono2 pointer-events-none absolute right-3 top-3 rounded-[3px] px-3 py-2 text-xs font-medium text-white" style={{ background: "rgba(20,43,69,0.86)" }}>
            Bed {focus.bed} · {Math.round(focus.remainingVolume)} mL · {focus.status === "completed" ? 0 : round1(focus.flowRate)} mL/hr
          </div>
          {sceneAlert && sceneAlert.severity === "critical" && (
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-[3px] px-3 py-2 text-[13px] font-medium text-white sm:right-auto" style={{ background: "rgba(150,26,32,0.92)" }}>
              <Icon name="bell" size={15} />
              Critical — {sceneAlert.title} · Bed {state.patients.find((x) => x.id === sceneAlert.patientId)?.bed ?? ""}
            </div>
          )}
        </div>
        <p className="-mt-3 max-w-3xl text-sm" style={{ color: "var(--dim)" }}>
          Patient lying on the bed with visible breathing / sleeping movement, IV stand beside the bed, transparent bottle with live fluid level and tube to the patient&apos;s hand. The same live state drives this scene, the dashboard, alert centre and analytics — click a bed in the scene to focus it.
        </p>

        {/* 3 — SIMULATION CONTROLS (below the scene, full-width toolbar) */}
        <section aria-label="Simulation controls" className="rounded-[var(--radius)] border px-4 py-3 sm:px-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="clinical-label mr-1">Controls</span>
            <Btn variant="ok" disabled={focus.status === "completed"} onClick={() => { if (focus.conditionState !== "normal") setCondition(focus, "normal"); setRunning(true); }}>▶ Start</Btn>
            <Btn variant="ghost" disabled={!running} onClick={() => setRunning(false)}>⏸ Pause</Btn>
            <Btn variant="primary" disabled={running} onClick={() => setRunning(true)}>Resume</Btn>
            <Btn variant="danger" onClick={() => { void replay(); }}>Reset</Btn>
            <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: "var(--border)" }} aria-hidden="true" />
            <span className="text-xs font-medium" style={{ color: "var(--dim)" }}>Playback speed</span>
            {[1, 2, 5, 10].map((sp) => (
              <button key={sp} type="button" onClick={() => setSpeed(sp)} aria-label={`Simulation speed ${sp}x`}
                className="tnum min-h-[36px] rounded-[var(--radius)] border px-2.5 text-[13px] font-semibold"
                style={speed === sp ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
                {sp}×
              </button>
            ))}
            <Btn variant="ghost" onClick={() => { setSpeed(nextSpeed); setRunning(true); }}>Fast forward → {nextSpeed}×</Btn>
            <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: "var(--border)" }} aria-hidden="true" />
            <Btn variant="ghost" onClick={() => setMuted((m) => !m)} ariaLabel={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "Sound: Off" : "Sound: On"}</Btn>
            <span className="flex-1" />
            <label className="flex items-center gap-2 text-[13px] font-medium">
              Scenario
              <select aria-label="Scenario selection for the focused bed" value={simScenarioSel} onChange={(e) => setSimScenarioSel(e.target.value)} className="rounded-[var(--radius)] border px-2.5 py-2 text-sm" style={inputStyle}>
                <option value="normal">Normal infusion</option>
                <option value="low">Low fluid warning</option>
                <option value="empty">Empty container — critical event</option>
                <option value="too_fast">Abnormal flow — too fast</option>
                <option value="stopped">Flow interruption — stopped</option>
                <option value="blockage">Suspected blockage / kinked line</option>
                <option value="fluctuation">Unstable flow — fluctuation</option>
              </select>
            </label>
            <Btn variant="primary" disabled={focus.status === "completed"} onClick={applyScenarioSelection}>Apply scenario</Btn>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex gap-1.5" role="group" aria-label="Scene mode">
              <Btn variant={sceneMode === "single" ? "primary" : "ghost"} onClick={() => setSceneMode("single")}>Single room</Btn>
              <Btn variant={sceneMode === "multi" ? "primary" : "ghost"} onClick={() => setSceneMode("multi")}>Multi-bed ward · 3 beds</Btn>
            </div>
            {sceneMode === "multi" && (
              <Btn variant="primary" onClick={() => {
                const [b1, b2, b3] = trioFinal;
                if (b1 && b1.status !== "completed" && b1.conditionState !== "normal") setCondition(b1, "normal");
                if (b2 && b2.status !== "completed") setVolume(b2, Math.max(3, (b2.initialVolume * state.settings.lowThresholdPct) / 100 - 5), `3-bed demonstration — ${b2.name} (${b2.bed}) staged at the low-fluid warning level.`);
                if (b3 && b3.status !== "completed") setVolume(b3, 0, `3-bed demonstration — ${b3.name} (${b3.bed}) staged with an empty IV container.`);
                setRunning(true);
              }}>Stage 3-bed demo: normal · low · empty</Btn>
            )}
            <span className="flex-1" />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Camera views">
              {([["overview", "Overview"], ["bedside", "Bedside"], ["station", "Nurse station"], ["top", "Top view"]] as const).map(([name, label]) => (
                <Btn key={name} variant="ghost" onClick={() => setCamPreset((c) => ({ name, seq: c.seq + 1 }))}>{label}</Btn>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <span className="mr-1 text-xs font-medium" style={{ color: "var(--dim)" }}>Quick triggers — Bed {focus.bed}</span>
            <Btn variant="primary" disabled={focus.status === "completed"} onClick={() => { setVolume(focus, Math.max(3, lowAt - 5), `3D scenario — bottle for ${focus.name} (${focus.bed}) advanced to the low-fluid threshold.`); setRunning(true); }}>Trigger low fluid</Btn>
            <Btn variant="danger" disabled={focus.status === "completed"} onClick={() => { setVolume(focus, 0, `3D scenario — bottle for ${focus.name} (${focus.bed}) emptied.`); setRunning(true); }}>Trigger empty container</Btn>
            <Btn variant="primary" disabled={focus.status === "completed"} onClick={() => { setCondition(focus, "too_fast"); setRunning(true); }}>Trigger abnormal flow</Btn>
            <Btn variant="danger" disabled={focus.status === "completed"} onClick={() => { setCondition(focus, "stopped"); setRunning(true); }}>Trigger flow interruption</Btn>
            {focus.conditionState !== "normal" && focus.status !== "completed" && (
              <Btn variant="ok" onClick={() => setCondition(focus, "normal")}>Restore normal flow</Btn>
            )}
          </div>
        </section>

        {/* 3b — LIVE NURSE RESPONSE (below the scene & controls) */}
        <section aria-label="Live nurse response" className="rounded-[var(--radius)] border p-4 sm:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <SectionTitle>Nurse response — live</SectionTitle>
              <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--dim)" }}>
                Automated response: every alert is routed to the patient&apos;s own assigned nurse, who is dispatched automatically by severity — no manual dispatch. Statuses below are driven by the nurse figures moving in the 3D scene above.
              </p>
            </div>
            <Pill text={`${Object.values(nurseResponses).filter((r) => r.status !== "RESPONSE COMPLETED").length} responding · ${Object.values(nurseQueue).reduce((n, q) => n + q.length, 0)} queued`}
              color="var(--accent)" soft="var(--accent-soft)" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]" style={{ color: "var(--dim)" }}>
            <span className="font-medium" style={{ color: "var(--text)" }}>Assignments in scene:</span>
            {visible.map((p) => (
              <span key={p.id}><span className="font-mono2">{p.bed}</span> · {p.name} — <span className="font-medium" style={{ color: "var(--text)" }}>{nurseName(state, p.nurseId)}</span></span>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr style={{ color: "var(--dim)" }}>
                  {["Nurse", "Assigned patient", "Bed", "Alert severity", "Current location", "Response status", "Time since alert", "Time to bedside"].map((h) => (
                    <th key={h} className="border-b px-2.5 py-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ borderColor: "var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sceneNurseIds.map((nid) => {
                  const resp = nurseResponses[nid];
                  const queuedCount = (nurseQueue[nid] ?? []).length;
                  const rp = resp ? state.patients.find((x) => x.id === resp.patientId) : visible.find((p) => p.nurseId === nid);
                  const rAlert = resp ? state.alerts.find((a) => a.id === resp.alertId) : undefined;
                  const status: NurseStatus = resp?.status ?? "AVAILABLE";
                  const meta = NURSE_STATUS_META[status];
                  const location = !resp ? "Nurse station"
                    : resp.status === "ALERT RECEIVED" ? "Nurse station — notified"
                    : resp.status === "RESPONDING" ? `En route to Bed ${rp?.bed ?? ""}`
                    : resp.status === "RESPONSE COMPLETED" ? `Bed ${rp?.bed ?? ""} — returning to station`
                    : `Bed ${rp?.bed ?? ""} — bedside`;
                  const sinceAlert = resp ? Math.max(0, state.simMin - resp.alertSimMin) : null;
                  const toBedside = resp?.arrivedSimMin != null ? Math.max(0, resp.arrivedSimMin - resp.alertSimMin) : null;
                  return (
                    <tr key={nid} style={{ background: resp && resp.status !== "RESPONSE COMPLETED" ? SEV_META[resp.severity].soft : "transparent" }}>
                      <td className="border-b px-2.5 py-2.5 font-medium" style={{ borderColor: "var(--border)" }}>
                        {nurseName(state, nid)}
                        {queuedCount > 0 && <span className="ml-2 text-xs font-medium" style={{ color: "var(--warn)" }}>+{queuedCount} queued</span>}
                      </td>
                      <td className="border-b px-2.5 py-2.5" style={{ borderColor: "var(--border)" }}>{rp ? rp.name : "—"}</td>
                      <td className="border-b px-2.5 py-2.5 font-mono2" style={{ borderColor: "var(--border)" }}>{rp ? rp.bed : "—"}</td>
                      <td className="border-b px-2.5 py-2.5" style={{ borderColor: "var(--border)" }}>
                        {resp ? <Pill text={SEV_META[resp.severity].label} color={SEV_META[resp.severity].color} soft="rgba(255,255,255,0.7)" /> : <span style={{ color: "var(--dim)" }}>—</span>}
                      </td>
                      <td className="border-b px-2.5 py-2.5" style={{ borderColor: "var(--border)" }}>{location}</td>
                      <td className="border-b px-2.5 py-2.5" style={{ borderColor: "var(--border)" }}>
                        <Pill text={status} color={meta.color} soft={meta.soft} dot={meta.color} />
                        {resp && rAlert && <div className="mt-1 text-xs" style={{ color: "var(--dim)" }}>{rAlert.title}</div>}
                      </td>
                      <td className="border-b px-2.5 py-2.5 font-mono2" style={{ borderColor: "var(--border)" }}>{sinceAlert != null ? fmtDuration(sinceAlert) : "—"}</td>
                      <td className="border-b px-2.5 py-2.5 font-mono2" style={{ borderColor: "var(--border)" }}>{toBedside != null ? fmtDuration(toBedside) : resp ? "En route…" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4 — PATIENT MONITORING (below controls) */}
        <section aria-label="Patient monitoring">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <SectionTitle>Patient monitoring</SectionTitle>
              <p className="mt-1 text-sm" style={{ color: "var(--dim)" }}>Compact clinical cards for every bed in the scene. Select a card to focus that bed in the 3D view.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">Bed in focus
              <select aria-label="Choose the bed shown in the 3D scene" value={focus.id}
                onChange={(e) => { setSceneFocusId(e.target.value); setSelectedPatientId(e.target.value); }}
                className="rounded-[var(--radius)] border px-2.5 py-2 text-sm" style={inputStyle}>
                {visible.map((p) => <option key={p.id} value={p.id}>{p.name} — Bed {p.bed} ({STATUS_META[p.status].label})</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => {
              const meta = STATUS_META[p.status];
              const pctRem = p.initialVolume > 0 ? Math.round((p.remainingVolume / p.initialVolume) * 100) : 0;
              const isFocus = p.id === focus.id;
              return (
                <button key={p.id} type="button" onClick={() => { setSceneFocusId(p.id); setSelectedPatientId(p.id); }}
                  aria-label={`Focus Bed ${p.bed}, ${p.name}`}
                  className="card-hover w-full rounded-[var(--radius)] border p-4 text-left"
                  style={{ background: "var(--surface)", borderColor: isFocus ? "var(--accent)" : "var(--border)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono2 text-[12px] font-medium" style={{ color: "var(--blue)" }}>Bed {p.bed}</span>
                        <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--dim)" }}>{wardName(state, p.wardId)}</span>
                      </div>
                      <div className="mt-1 truncate text-[16px] font-medium leading-snug">{p.name}</div>
                      <div className="truncate text-xs" style={{ color: "var(--dim)" }}>{p.age} yrs · {p.gender} · {p.id} · Nurse {nurseName(state, p.nurseId)}</div>
                    </div>
                    <Pill text={meta.label} color={meta.color} soft={meta.soft} dot={meta.bar} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                    <div><div className="clinical-label">IV fluid</div><div className="mt-0.5 font-medium">{p.fluid}</div></div>
                    <div><div className="clinical-label">Est. completion</div><div className="mt-0.5 font-medium">{fmtETA(p)}</div></div>
                    <div><div className="clinical-label">Remaining</div><div className="reading-mono mt-0.5 text-[18px] leading-none">{Math.round(p.remainingVolume)}<span className="ml-1 text-[11px]" style={{ color: "var(--dim)" }}>mL · {pctRem}%</span></div></div>
                    <div><div className="clinical-label">Flow rate</div><div className="reading-mono mt-0.5 text-[18px] leading-none">{p.status === "completed" ? 0 : round1(p.flowRate)}<span className="ml-1 text-[11px]" style={{ color: "var(--dim)" }}>mL/hr</span></div></div>
                  </div>
                  <div className="mt-3 h-[3px] overflow-hidden" style={{ background: "var(--surface-alt)" }}>
                    <div className="h-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, pctRem))}%`, background: meta.bar }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--dim)" }}>
                    <span>{CONDITION_LABEL[p.conditionState] ?? p.conditionState}</span>
                    <span className="font-mono2">{round1(progressPct(p))}% infused</span>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Focused patient detail — full width, below the cards */}
          <div className="mt-4 rounded-[var(--radius)] border p-4 sm:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[20px] font-medium" style={{ color: "var(--accent)" }}>{focus.name} — Bed {focus.bed}</span>
              <Pill text={focusMeta.label} color={focusMeta.color} soft={focusMeta.soft} />
              <span className="flex-1" />
              <Btn variant="ghost" onClick={() => openPatient(focus.id)}>Full patient page</Btn>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Patient", `${focus.name} (${focus.id})`],
                ["Bed / ward", `${focus.bed} · ${wardName(state, focus.wardId)}`],
                ["Assigned nurse", nurseName(state, focus.nurseId)],
                ["IV fluid", focus.fluid],
                ["Initial volume", `${Math.round(focus.initialVolume)} mL`],
                ["Remaining", `${Math.round(focus.remainingVolume)} mL (${focus.initialVolume > 0 ? Math.round((focus.remainingVolume / focus.initialVolume) * 100) : 0}%)`],
                ["Flow rate", `${focus.status === "completed" ? 0 : round1(focus.flowRate)} mL/hr (prescribed ${focus.prescribedRate})`],
                ["Est. completion", fmtETA(focus)],
                ["Condition", CONDITION_LABEL[focus.conditionState] ?? focus.conditionState],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                  <dt style={{ color: "var(--dim)" }}>{k}</dt><dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 h-[4px] overflow-hidden" style={{ background: "var(--surface-alt)" }}>
              <div className="h-full transition-all duration-700" style={{ width: `${progressPct(focus)}%`, background: focusMeta.bar }} />
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--dim)" }}>{round1(progressPct(focus))}% infused — the bag in the 3D scene shows the same remaining volume.</div>
          </div>
        </section>

        {/* 5 — MONITORING ANALYTICS (below patient information) */}
        <section aria-label="Monitoring analytics">
          <SectionTitle>{`Live monitoring — Bed ${focus.bed}`}</SectionTitle>
          <p className="mt-1 text-sm" style={{ color: "var(--dim)" }}>Live graphs for the bed in focus, drawn from the same readings that drive the 3D fluid level.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="font-display text-[19px] font-medium" style={{ color: "var(--accent)" }}>Remaining fluid — live (mL)</div>
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={focusRows}><CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="min" tick={chartAxis} label={{ value: "sim min", fontSize: 11, fill: "#7a7264" }} /><YAxis tick={chartAxis} domain={[0, focus.initialVolume]} /><Tooltip contentStyle={chartTooltip} /><Line type="monotone" dataKey="remaining" name="Remaining (mL)" stroke="#142b45" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="font-display text-[19px] font-medium" style={{ color: "var(--accent)" }}>Flow rate (mL/hr)</div>
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={focusRows}><CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="min" tick={chartAxis} /><YAxis tick={chartAxis} /><Tooltip contentStyle={chartTooltip} /><ReferenceLine y={focus.prescribedRate} stroke="#159b91" strokeDasharray="5 5" label={{ value: "prescribed", fontSize: 11, fill: "#159b91" }} /><Line type="monotone" dataKey="flow" name="Flow (mL/hr)" stroke="#a86a08" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="font-display text-[19px] font-medium" style={{ color: "var(--accent)" }}>Infusion progress (%)</div>
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={focusRows}><CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="min" tick={chartAxis} /><YAxis tick={chartAxis} domain={[0, 100]} /><Tooltip contentStyle={chartTooltip} /><Area type="monotone" dataKey="progress" name="Infused (%)" stroke="#142b45" fill="#142b45" fillOpacity={0.15} isAnimationActive={false} /></AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px]"><span style={{ color: "var(--dim)" }}>Progress for Bed {focus.bed}</span><span className="reading-mono text-[18px]">{round1(progressPct(focus))}%</span></div>
            </div>
            <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <div className="font-display text-[19px] font-medium" style={{ color: "var(--accent)" }}>Active alerts in scene</div>
                <Pill text={`${sceneAlerts.length} active`} color={sceneAlerts.length ? "var(--crit)" : "var(--ok)"} soft={sceneAlerts.length ? "var(--crit-soft)" : "var(--ok-soft)"} />
              </div>
              <div className="mt-2 space-y-2">
                {sceneAlerts.length === 0 && <p className="text-sm" style={{ color: "var(--dim)" }}>No active alerts for the beds in this scene.</p>}
                {sceneAlerts.slice(0, 4).map((a) => {
                  const ap = state.patients.find((x) => x.id === a.patientId);
                  const sev = SEV_META[a.severity];
                  return (
                    <button key={a.id} type="button" onClick={() => { setSelectedAlertId(a.id); setView("alerts"); }} aria-label={`View alert: ${a.title}`} className="block w-full rounded-[var(--radius)] border p-2.5 text-left" style={{ borderColor: "var(--border)", background: sev.soft }}>
                      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{a.title}</span><Pill text={sev.label} color={sev.color} soft="rgba(255,255,255,0.65)" /></div>
                      <div className="mt-0.5 text-xs" style={{ color: "var(--dim)" }}>{ap ? `${ap.name} · Bed ${ap.bed}` : a.patientId} · <span className="font-mono2">{fmtTime(a.createdAt)}</span> · {a.status.replace("_", " ")}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 6 — EVENT HISTORY & ALERT MANAGEMENT (below analytics) */}
        <section aria-label="Event history and alert management">
          <SectionTitle>Alert management &amp; event history</SectionTitle>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius)] border p-4 sm:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="font-display text-[19px] font-medium" style={{ color: "var(--accent)" }}>Event timeline</div>
              <div className="mt-3 max-h-[380px] space-y-0 overflow-y-auto pr-1">
                {focusEvents.map((e, i, arr) => (
                  <div key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < arr.length - 1 && <span className="absolute left-[3px] top-3 h-full w-px" style={{ background: "var(--border)" }} />}
                    <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: e.kind === "alert" || e.kind === "escalated" ? "var(--crit)" : e.kind === "resolved" || e.kind === "restarted" || e.kind === "completed" ? "var(--teal)" : "var(--blue)" }} />
                    <div className="min-w-0">
                      <div className="text-[13px] leading-snug">{e.message}</div>
                      <div className="font-mono2 mt-0.5 text-[11px]" style={{ color: "var(--dim)" }}>{fmtDateTime(e.ts)} · T+{fmtDuration(e.simMin)}</div>
                    </div>
                  </div>
                ))}
                {focusEvents.length === 0 && <p className="text-sm" style={{ color: "var(--dim)" }}>No events yet for these beds.</p>}
              </div>
              <div className="mt-3"><Btn variant="ghost" onClick={() => setView("events")}>Full event history</Btn></div>
            </div>

            <div className="rounded-[var(--radius)] border p-4 sm:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <div className="font-display text-[19px] font-medium" style={{ color: "var(--accent)" }}>Active alerts — management</div>
                <Btn variant="ghost" onClick={() => setView("alerts")}>Alert centre</Btn>
              </div>
              <div className="mt-3 space-y-2">
                {sceneAlerts.length === 0 && <p className="text-sm" style={{ color: "var(--dim)" }}>No active alerts. All infusions in this scene are within limits.</p>}
                {sceneAlerts.map((a) => {
                  const ap = state.patients.find((x) => x.id === a.patientId);
                  const sev = SEV_META[a.severity];
                  return (
                    <div key={a.id} className="rounded-[var(--radius)] border p-3" style={{ borderColor: "var(--border)", background: sev.soft }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: sev.color }} />
                        <span className="text-sm font-semibold">{a.title}</span>
                        <Pill text={sev.label} color={sev.color} soft="rgba(255,255,255,0.65)" />
                        <Pill text={a.status.replace("_", " ")} color="var(--accent)" soft="var(--accent-soft)" />
                        {a.escalated === 1 && <Pill text="ESCALATED" color="#fff" soft="var(--crit)" />}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--dim)" }}>
                        {ap ? `${ap.name} · Bed ${ap.bed} · ${wardName(state, ap.wardId)}` : a.patientId} · Nurse: {nurseName(state, a.nurseId)} · <span className="font-mono2">{fmtDateTime(a.createdAt)}</span>
                        {a.ackSimMin != null ? ` · Acknowledged after ${fmtDuration(a.ackSimMin - a.createdSimMin)}` : " · Not yet acknowledged"}
                      </div>
                      {a.status !== "resolved" && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {a.status === "new" && <Btn variant="primary" onClick={() => alertAction(a, "acknowledged")}>Acknowledge</Btn>}
                          {a.status === "acknowledged" && <Btn variant="primary" onClick={() => alertAction(a, "in_progress")}>Mark in progress</Btn>}
                          {(a.status === "acknowledged" || a.status === "in_progress") && <Btn variant="ok" onClick={() => alertAction(a, "resolved")}>Resolve</Btn>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {emptyAlert && emptyAlert.status !== "resolved" && (
                <div className="crit-pulse mt-3 rounded-[var(--radius)] border p-3" style={{ borderColor: "var(--crit)", background: "var(--crit-soft)" }}>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--crit)" }}>Critical alert — IV infusion completed</div>
                  <dl className="mt-1.5 space-y-1 text-sm">
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Patient</dt><dd className="font-medium">{focus.name} ({focus.id})</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Bed</dt><dd className="font-medium">{focus.bed}</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Ward</dt><dd className="font-medium">{wardName(state, focus.wardId)}</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Event</dt><dd className="font-medium">IV container empty</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Time</dt><dd className="font-mono2 font-medium">{fmtDateTime(emptyAlert.createdAt)}</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Nurse</dt><dd className="font-medium">{nurseName(state, emptyAlert.nurseId)} · status: {emptyAlert.status.replace("_", " ")}</dd></div>
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {emptyAlert.status === "new" && <Btn variant="danger" onClick={() => alertAction(emptyAlert, "acknowledged")}>Acknowledge alert</Btn>}
                    {emptyAlert.status === "acknowledged" && <Btn variant="primary" onClick={() => alertAction(emptyAlert, "in_progress")}>Mark in progress</Btn>}
                    {(emptyAlert.status === "acknowledged" || emptyAlert.status === "in_progress") && !changingBottle &&
                      <Btn variant="ok" onClick={() => changeBottle(emptyAlert)}>Change the IV bottle</Btn>}
                    {changingBottle && <Btn variant="ok" disabled onClick={() => {}}>Nurse is changing the bottle…</Btn>}
                    {(emptyAlert.status === "acknowledged" || emptyAlert.status === "in_progress") && !changingBottle &&
                      <Btn variant="ghost" onClick={() => alertAction(emptyAlert, "resolved")}>Close line &amp; resolve (no new bottle)</Btn>}
                    {emptyAlert.status === "new" && <Btn variant="ghost" onClick={() => alertAction(emptyAlert, "resolved")}>Resolve directly</Btn>}
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>
                    {changingBottle
                      ? "Watch the 3D scene above: the nurse takes the empty bottle down, swaps it for a fresh full bottle from the supply trolley, hangs it and checks the line. The infusion restarts in the shared state as the new bottle goes up, and this alert then resolves."
                      : "Automated response: the assigned nurse has been notified and is dispatched automatically — watch her walk to this bedside in the 3D scene and follow her status in the Nurse Response panel. She will inspect the IV and change the empty bottle herself; the buttons here remain available as a manual override."}
                  </p>
                </div>
              )}

              {emptyAlert?.status === "resolved" && (
                <div className="mt-3 rounded-[var(--radius)] border p-3" style={{ borderColor: "var(--ok)", background: "var(--ok-soft)" }}>
                  <div className="font-display text-[20px] font-medium" style={{ color: "var(--ok)" }}>Incident summary — resolved</div>
                  <dl className="mt-1.5 space-y-1 text-sm">
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Patient / bed</dt><dd className="font-medium">{focus.name} · Bed {focus.bed}</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Event</dt><dd className="font-medium">IV container empty — infusion completed</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Raised</dt><dd className="font-mono2 font-medium">{fmtDateTime(emptyAlert.createdAt)}</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Nurse response time</dt><dd className="font-medium">{emptyAlert.ackSimMin != null ? fmtDuration(emptyAlert.ackSimMin - emptyAlert.createdSimMin) : "—"}</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Time to resolve</dt><dd className="font-medium">{emptyAlert.resolvedSimMin != null ? fmtDuration(emptyAlert.resolvedSimMin - emptyAlert.createdSimMin) : "—"}</dd></div>
                    <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Handled by</dt><dd className="font-medium">{nurseName(state, emptyAlert.nurseId)}</dd></div>
                    {changeSummary && <div className="flex justify-between gap-3"><dt style={{ color: "var(--dim)" }}>Bottle change</dt><dd className="text-right font-medium">Fresh bottle hung — infusion restarted</dd></div>}
                  </dl>
                  {changeSummary && <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>{changeSummary}</p>}
                  <p className="mt-1.5 text-xs" style={{ color: "var(--dim)" }}>Recorded in the patient&apos;s event history and the analytics dashboard.</p>
                  <div className="mt-2"><Btn variant="primary" onClick={() => { void replay(); }}>Replay scenario</Btn></div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 7 — ADDITIONAL ANALYTICS / GUIDED SCENARIO */}
        <section aria-label="Guided scenario" className="rounded-[var(--radius)] border p-4 sm:p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <SectionTitle>Patient IV Infusion — Critical Empty Bottle Event</SectionTitle>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--dim)" }}>Guided stages for the focused bed, derived live from the simulation state. Completing each stage updates the scene, charts and alerts above.</p>
          <ol className="mt-3 grid gap-2 lg:grid-cols-2">
            {stages.map((s) => {
              const done = s.n < stageIdx;
              const current = s.n === stageIdx;
              return (
                <li key={s.n} className="flex gap-2.5 rounded-[var(--radius)] border p-2.5"
                  style={{ borderColor: current ? "var(--accent)" : "var(--border)", background: current ? "var(--accent-soft)" : "transparent", opacity: done ? 0.62 : 1 }}>
                  <span className="font-mono2 flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] text-xs font-medium text-white" style={{ background: done ? "var(--ok)" : "var(--accent)" }}>{done ? "✓" : s.n}</span>
                  <div>
                    <div className="text-sm font-semibold">Stage {s.n} — {s.title}</div>
                    <div className="text-xs" style={{ color: "var(--dim)" }}>{s.text}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Patient detail
  // -------------------------------------------------------------------------

  const renderPatient = () => {
    if (!selectedPatient) {
      return <p className="text-sm" style={{ color: "var(--dim)" }}>Select a patient from the dashboard.</p>;
    }
    const p = selectedPatient;
    const meta = STATUS_META[p.status];
    const rows = (state.readings[p.id] ?? []).map((r) => ({
      min: Math.round(r.simMin), remaining: round1(r.remaining), flow: round1(r.flow),
      drip: round1((r.flow * p.dripFactor) / 60),
      progress: round1(Math.min(100, Math.max(0, ((p.initialVolume - r.remaining) / p.initialVolume) * 100))),
    }));
    const pEvents = state.events.filter((e) => e.patientId === p.id).slice(0, 30);
    const pAlerts = state.alerts.filter((a) => a.patientId === p.id && a.status !== "resolved");
    const chartAxis = { fontSize: 11, fill: "#7a7264" } as const;
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="ghost" onClick={() => setView("dashboard")}>← Back to dashboard</Btn>
          <div>
            <h2 className="font-display text-[34px] font-medium leading-none" style={{ color: "var(--accent)" }}>{p.name}</h2>
            <div className="font-mono2 mt-1 text-xs" style={{ color: "var(--dim)" }}>Bed {p.bed} · {wardName(state, p.wardId)} · {p.id}</div>
          </div>
          <Pill text={meta.label} color={meta.color} soft={meta.soft} />
          {pAlerts.length > 0 && <Pill text={`${pAlerts.length} active alert${pAlerts.length > 1 ? "s" : ""}`} color="var(--crit)" soft="var(--crit-soft)" />}
          <span className="flex-1" />
          {p.conditionState !== "normal" && p.status !== "completed" && (
            <Btn variant="ok" onClick={() => setCondition(p, "normal")}>Restore normal flow</Btn>
          )}
          <Btn variant="ghost" onClick={() => { setScenarioPatientId(p.id); setView("scenarios"); }}>Open in Scenario Simulator</Btn>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="rounded-[var(--radius)] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <SectionTitle>Patient information</SectionTitle>
            <dl className="mt-2 space-y-1.5 text-sm">
              {[
                ["Patient ID", p.id], ["Age / gender", `${p.age} yrs / ${p.gender}`],
                ["Ward & bed", `${wardName(state, p.wardId)} · Bed ${p.bed}`],
                ["Diagnosis", p.diagnosis], ["Assigned nurse", nurseName(state, p.nurseId)],
                ["IV fluid", p.fluid],
                ["Prescribed (demo)", `${p.initialVolume} mL at ${p.prescribedRate} mL/hr · drip factor ${p.dripFactor} gtt/mL`],
                ["Infusion started", fmtDateTime(p.startedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt style={{ color: "var(--dim)" }}>{k}</dt><dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <label className="mt-3 block text-xs font-medium" style={{ color: "var(--dim)" }}>
              Reassign nurse
              <select aria-label={`Reassign nurse for ${p.name}`} value={p.nurseId}
                onChange={(e) => reassignPatient(p, e.target.value)} className={`${inputCls} mt-1`} style={inputStyle}>
                {state.nurses.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.id})</option>)}
              </select>
            </label>
          </div>
          <div className="rounded-[var(--radius)] border p-5 lg:col-span-2" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <SectionTitle>Live infusion</SectionTitle>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div><div className="reading-mono text-[25px]">{Math.round(p.remainingVolume)} <span className="text-[13px]" style={{ color: "var(--dim)" }}>mL</span></div><div className="clinical-label mt-1">Remaining volume</div></div>
              <div><div className="reading-mono text-[25px]">{p.status === "completed" ? 0 : round1(p.flowRate)} <span className="text-[13px]" style={{ color: "var(--dim)" }}>mL/hr</span></div><div className="clinical-label mt-1">Flow rate</div></div>
              <div><div className="reading-mono text-[25px]">{dripRate(p)}</div><div className="clinical-label mt-1">Drip rate (gtt/min)</div></div>
              <div><div className="reading-mono text-[25px]">{fmtETA(p)}</div><div className="clinical-label mt-1">Est. completion</div></div>
              <div><div className="reading-mono text-[25px]">{round1(progressPct(p))}%</div><div className="clinical-label mt-1">Infused</div></div>
            </div>
            <div className="mt-3 h-[4px] overflow-hidden" style={{ background: "var(--surface-alt)" }}>
              <div className="h-full transition-all duration-700" style={{ width: `${progressPct(p)}%`, background: meta.bar }} />
            </div>
            <p className="mt-2 text-sm">Current condition: <strong>{CONDITION_LABEL[p.conditionState] ?? p.conditionState}</strong>
              {p.conditionState === "too_slow" && p.lowFlowSinceSimMin != null &&
                <> · low flow for {fmtDuration(state.simMin - p.lowFlowSinceSimMin)}</>}
              {p.conditionState !== "normal" && <> · since simulated T+{fmtDuration(p.conditionSinceSimMin)}</>}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {[
            { title: "Remaining volume vs time (mL)", node: (
              <LineChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="min" tick={chartAxis} label={{ value: "sim min", fontSize: 11, fill: "#7a7264" }} /><YAxis tick={chartAxis} domain={[0, p.initialVolume]} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} /><Line type="monotone" dataKey="remaining" stroke="#142b45" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>) },
            { title: "Flow rate vs time (mL/hr)", node: (
              <LineChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="min" tick={chartAxis} /><YAxis tick={chartAxis} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} /><ReferenceLine y={p.prescribedRate} stroke="#159b91" strokeDasharray="5 5" label={{ value: "prescribed", fontSize: 11, fill: "#159b91" }} /><Line type="monotone" dataKey="flow" stroke="#a86a08" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>) },
            { title: "Drip rate variation (gtt/min)", node: (
              <AreaChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="min" tick={chartAxis} /><YAxis tick={chartAxis} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} /><Area type="monotone" dataKey="drip" stroke="#159b91" fill="#159b91" fillOpacity={0.18} isAnimationActive={false} /></AreaChart>) },
            { title: "Infusion progress (%)", node: (
              <AreaChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="min" tick={chartAxis} /><YAxis tick={chartAxis} domain={[0, 100]} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} /><Area type="monotone" dataKey="progress" stroke="#142b45" fill="#142b45" fillOpacity={0.15} isAnimationActive={false} /></AreaChart>) },
          ].map((c) => (
            <div key={c.title} className="rounded-[var(--radius)] border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="font-display mb-1 text-[20px] font-medium" style={{ color: "var(--accent)" }}>{c.title}</div>
              <div className="h-52"><ResponsiveContainer width="100%" height="100%">{c.node}</ResponsiveContainer></div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <SectionTitle>Event history</SectionTitle>
          <div className="font-mono2 mt-2 space-y-1.5 text-xs leading-relaxed">
            {pEvents.map((e) => (
              <div key={e.id} className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--dim)" }}>{fmtDateTime(e.ts)}</span>{" "}{e.message}
              </div>
            ))}
            {pEvents.length === 0 && <p style={{ color: "var(--dim)" }}>No events yet for this patient.</p>}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Alert centre
  // -------------------------------------------------------------------------

  const alertList = state.alerts.filter((a) => {
    if (alertStatusFilter === "active") return a.status !== "resolved";
    if (alertStatusFilter === "all") return true;
    return a.status === alertStatusFilter;
  });

  const renderAlerts = () => (
    <div>
      <PageHeader title="Alert Centre" desc="Every active and historical alert, prioritised by severity. Acknowledge, assign and resolve — changes apply across the whole platform instantly.">
        <select aria-label="Filter alerts by status" value={alertStatusFilter}
          onChange={(e) => setAlertStatusFilter(e.target.value)}
          className="rounded-[var(--radius)] border px-2.5 py-2 text-sm" style={inputStyle}>
          <option value="active">Active alerts</option>
          <option value="all">All alerts</option>
          <option value="new">New</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </PageHeader>
      <p className="text-sm" style={{ color: "var(--dim)" }}>
        Alerts notify the assigned nurse on four channels together — bedside beep, dashboard notification,
        WhatsApp voice call, and GSM call + SMS when there is no internet — repeating and escalating until a person answers.
        Unacknowledged critical alerts escalate after {state.settings.escalationSimMin} simulated minutes.
      </p>
      <div className="mt-3 w-full space-y-2">
        {alertList.length === 0 && <p className="text-sm" style={{ color: "var(--dim)" }}>No alerts in this view.</p>}
        {alertList.map((a) => {
          const p = state.patients.find((x) => x.id === a.patientId);
          const sev = SEV_META[a.severity];
          const expanded = selectedAlertId === a.id;
          return (
            <div key={a.id}
              className={`card-hover w-full rounded-[var(--radius)] border ${a.severity === "critical" && a.status === "new" ? "crit-pulse" : ""}`}
              style={{ background: expanded ? sev.soft : "var(--surface)", borderColor: expanded ? sev.color : "var(--border)", borderLeft: `3px solid ${sev.color}`, boxShadow: "var(--shadow-sm)" }}>
              <div className="flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-2 px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sev.color }} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="font-semibold leading-snug">{a.title}</div>
                    <div className="mt-0.5 text-sm" style={{ color: "var(--dim)" }}>
                      {p ? <>{p.name} · Bed {p.bed} · {wardName(state, p.wardId)}</> : a.patientId}
                      {" · "}Nurse: {nurseName(state, a.nurseId)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill text={sev.label} color={sev.color} soft={sev.soft} />
                  <Pill text={a.status.replace("_", " ")} color="var(--accent)" soft="var(--accent-soft)" />
                  {a.escalated === 1 && <Pill text="ESCALATED" color="#fff" soft="var(--crit)" />}
                  <span className="font-mono2 text-xs" style={{ color: "var(--dim)" }}>{fmtDateTime(a.createdAt)}</span>
                  {a.status === "new" && <Btn variant="primary" onClick={() => alertAction(a, "acknowledged")}>Acknowledge</Btn>}
                  {a.status === "acknowledged" && <Btn variant="primary" onClick={() => alertAction(a, "in_progress")}>Mark in progress</Btn>}
                  {a.status !== "resolved" && (
                    <select aria-label={`Assign alert "${a.title}" to nurse`} value={a.nurseId}
                      onChange={(e) => assignAlert(a, e.target.value)}
                      className="min-h-[36px] max-w-[190px] rounded-[var(--radius)] border px-2 py-1.5 text-[13px]" style={inputStyle}>
                      {state.nurses.map((n) => <option key={n.id} value={n.id}>Assign: {n.name}</option>)}
                    </select>
                  )}
                  {(a.status === "acknowledged" || a.status === "in_progress") &&
                    <Btn variant="ok" onClick={() => alertAction(a, "resolved")}>Resolve</Btn>}
                  {a.status === "new" && <Btn variant="ok" onClick={() => alertAction(a, "resolved")}>Resolve directly</Btn>}
                  <Btn variant="ghost" ariaLabel={`${expanded ? "Hide" : "View"} details for alert: ${a.title} for ${p?.name ?? a.patientId}`}
                    onClick={() => setSelectedAlertId(expanded ? null : a.id)}>
                    {expanded ? "Hide details" : "View details"}
                  </Btn>
                </div>
              </div>
              {expanded && (
                <div className="fade-in border-t px-3.5 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <dl className="grid gap-x-10 gap-y-1.5 text-sm sm:grid-cols-2">
                    {[
                      ["Patient", p ? `${p.name} (${p.id})` : a.patientId],
                      ["Bed / ward", p ? `${p.bed} · ${wardName(state, p.wardId)}` : "—"],
                      ["Alert type", a.type.replaceAll("_", " ")],
                      ["Status", a.status.replace("_", " ")],
                      ["Assigned nurse", nurseName(state, a.nurseId)],
                      ["Raised", fmtDateTime(a.createdAt)],
                      ["Acknowledged after", a.ackSimMin != null ? fmtDuration(a.ackSimMin - a.createdSimMin) : "Not yet"],
                      ["Escalated", a.escalated === 1 ? "Yes — to head nurse / duty in-charge" : "No"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt style={{ color: "var(--dim)" }}>{k}</dt><dd className="text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 rounded-[var(--radius)] p-2.5 text-sm" style={{ background: "var(--surface-alt)" }}>{a.description}</p>
                  {a.status !== "resolved" && (
                    <p className="mt-2 text-xs" style={{ color: "var(--dim)" }}>
                      Resolving records the outcome in the event log. If the underlying fault is still simulated,
                      restore normal flow from the patient page or Scenario Simulator.
                    </p>
                  )}
                  {p && <div className="mt-3"><Btn variant="ghost" onClick={() => openPatient(p.id)}>Open patient monitoring</Btn></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Nurses
  // -------------------------------------------------------------------------

  const submitNurse = () => {
    if (!nurseForm.name.trim()) return;
    if (editingNurseId) {
      const next = { ...state, nurses: state.nurses.map((n) => (n.id === editingNurseId ? { ...n, ...nurseForm } : n)) };
      stateRef.current = next; setState(next);
      api.updateNurse({ id: editingNurseId, ...nurseForm }).catch(() => {});
    } else {
      const id = `N-${Date.now() % 100000}`;
      const nurse: Nurse = { id, ...nurseForm };
      const next = { ...state, nurses: [...state.nurses, nurse] };
      stateRef.current = next; setState(next);
      api.addNurse(nurse).catch(() => {});
    }
    setEditingNurseId(null);
    setShowNurseForm(false);
    setNurseForm({ name: "", wardId: "general", shift: "Day", phone: "" });
  };

  const renderNurses = () => (
    <div>
      <PageHeader title="Nurses" desc="Roster, ward assignments and live workload. Reassign patients and alerts as the shift changes.">
        <Btn variant="primary" onClick={() => { setEditingNurseId(null); setNurseForm({ name: "", wardId: "general", shift: "Day", phone: "" }); setShowNurseForm((v) => !v); }}>
          {showNurseForm ? "Close form" : "＋ Add nurse"}
        </Btn>
      </PageHeader>
      {showNurseForm && (
        <form className="mt-3 grid grid-cols-2 gap-2 rounded-[var(--radius)] border p-3 sm:grid-cols-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          onSubmit={(e) => { e.preventDefault(); submitNurse(); }}>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nurse name
            <input aria-label="Nurse name" required value={nurseForm.name} onChange={(e) => setNurseForm({ ...nurseForm, name: e.target.value })} className={inputCls} style={inputStyle} /></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Ward
            <select aria-label="Nurse ward" value={nurseForm.wardId} onChange={(e) => setNurseForm({ ...nurseForm, wardId: e.target.value })} className={inputCls} style={inputStyle}>
              {state.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Shift
            <select aria-label="Nurse shift" value={nurseForm.shift} onChange={(e) => setNurseForm({ ...nurseForm, shift: e.target.value })} className={inputCls} style={inputStyle}>
              <option>Day</option><option>Night</option><option>Rotating</option></select></label>
          <label className="text-xs font-medium" style={{ color: "var(--dim)" }}>Phone (for voice-call alerts)
            <input aria-label="Nurse phone" value={nurseForm.phone} onChange={(e) => setNurseForm({ ...nurseForm, phone: e.target.value })} className={inputCls} style={inputStyle} placeholder="+91 …" /></label>
          <div className="flex items-end"><Btn variant="ok" onClick={submitNurse}>{editingNurseId ? "Save changes" : "Add nurse"}</Btn></div>
        </form>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.nurses.map((n) => {
          const myPatients = state.patients.filter((p) => p.nurseId === n.id);
          const myActive = state.alerts.filter((a) => a.nurseId === n.id && a.status !== "resolved");
          const myResolved = state.alerts.filter((a) => a.nurseId === n.id && a.status === "resolved");
          return (
            <div key={n.id} className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[17px] font-medium">{n.name}</div>
                  <div className="text-xs" style={{ color: "var(--dim)" }}>{n.id} · {wardName(state, n.wardId)} · {n.shift} shift{n.phone ? ` · ${n.phone}` : ""}</div>
                </div>
                <Btn variant="ghost" ariaLabel={`Edit nurse ${n.name}`} onClick={() => {
                  setEditingNurseId(n.id);
                  setNurseForm({ name: n.name, wardId: n.wardId, shift: n.shift, phone: n.phone });
                  setShowNurseForm(true);
                }}>Edit</Btn>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[var(--radius)] p-2" style={{ background: "var(--surface-alt)" }}>
                  <div className="reading-mono text-[20px]">{myPatients.length}</div><div className="text-xs" style={{ color: "var(--dim)" }}>Patients</div></div>
                <div className="rounded-[var(--radius)] p-2" style={{ background: "var(--surface-alt)" }}>
                  <div className="reading-mono text-[20px]" style={{ color: myActive.length ? "var(--crit)" : undefined }}>{myActive.length}</div><div className="text-xs" style={{ color: "var(--dim)" }}>Active alerts</div></div>
                <div className="rounded-[var(--radius)] p-2" style={{ background: "var(--surface-alt)" }}>
                  <div className="reading-mono text-[20px]">{myResolved.length}</div><div className="text-xs" style={{ color: "var(--dim)" }}>Resolved</div></div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-alt)" }}>
                <div className="h-full" style={{ width: `${Math.min(100, myPatients.length * 14 + myActive.length * 10)}%`, background: myActive.some((a) => a.severity === "critical") ? "var(--crit)" : "var(--accent)" }} />
              </div>
              <div className="text-xs" style={{ color: "var(--dim)" }}>Workload indicator — patients + active alerts</div>
              {myPatients.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {myPatients.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <button type="button" className="font-medium underline decoration-dotted" onClick={() => openPatient(p.id)}
                        aria-label={`Open ${p.name}`}>{p.name} ({p.bed})</button>
                      <Pill text={STATUS_META[p.status].label} color={STATUS_META[p.status].color} soft={STATUS_META[p.status].soft} />
                      <span className="flex-1" />
                      <select aria-label={`Reassign ${p.name} to another nurse`} value={p.nurseId}
                        onChange={(e) => reassignPatient(p, e.target.value)}
                        className="rounded-[var(--radius)] border px-1.5 py-1 text-xs" style={inputStyle}>
                        {state.nurses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Wards
  // -------------------------------------------------------------------------

  const renderWards = () => (
    <div>
      <PageHeader title="Wards" desc="Bed occupancy and live infusion status by ward. Select a ward to filter the monitoring dashboard." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {state.wards.map((w) => {
          const wp = state.patients.filter((p) => p.wardId === w.id);
          const wAlerts = activeAlerts.filter((a) => wp.some((p) => p.id === a.patientId));
          return (
            <button key={w.id} type="button" aria-label={`View patients in ${w.name}`}
              onClick={() => { setWardFilter(w.id); setFilter("all"); setView("dashboard"); }}
              className="card-hover rounded-[var(--radius)] border p-4 text-left"
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-center justify-between">
                <span className="font-display text-[24px] font-medium leading-none" style={{ color: "var(--accent)" }}>{w.name}</span>
                <Pill text={`${wp.length} / ${w.totalBeds} beds`} color="var(--accent)" soft="var(--accent-soft)" />
              </div>
              <div className="mt-2 h-[4px] overflow-hidden" style={{ background: "var(--surface-alt)" }}>
                <div className="h-full" style={{ width: `${(wp.length / w.totalBeds) * 100}%`, background: "var(--accent)" }} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                <div><div className="reading-mono text-[17px]">{wp.filter((p) => p.status === "normal").length}</div><div className="text-xs" style={{ color: "var(--ok)" }}>Normal</div></div>
                <div><div className="reading-mono text-[17px]">{wp.filter((p) => p.status === "warning").length}</div><div className="text-xs" style={{ color: "var(--warn)" }}>Warning</div></div>
                <div><div className="reading-mono text-[17px]">{wp.filter((p) => p.status === "critical").length}</div><div className="text-xs" style={{ color: "var(--crit)" }}>Critical</div></div>
                <div><div className="reading-mono text-[17px]">{wAlerts.length}</div><div className="text-xs" style={{ color: "var(--dim)" }}>Active alerts</div></div>
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--dim)" }}>
                {wp.length ? wp.map((p) => `${p.bed} ${p.name}`).join(" · ") : "No patients currently monitored in this ward."}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  const renderAnalytics = () => {
    const axis = { fontSize: 11, fill: "#7a7264" } as const;
    const abnormal = anaAlerts.filter((a) => a.severity !== "info").length;
    const criticalCount = anaAlerts.filter((a) => a.severity === "critical").length;
    const acked = anaAlerts.filter((a) => a.ackSimMin != null);
    const avgAck = acked.length ? acked.reduce((sum, a) => sum + ((a.ackSimMin ?? 0) - Math.max(0, a.createdSimMin)), 0) / acked.length : null;
    const completed = state.patients.filter((p) => p.status === "completed" && p.completedSimMin != null);
    const avgDuration = completed.length
      ? completed.reduce((sum, p) => sum + ((p.completedSimMin ?? 0) - p.startedSimMin), 0) / completed.length : null;

    const typeCounts = new Map<string, number>();
    for (const a of anaAlerts) typeCounts.set(a.type, (typeCounts.get(a.type) ?? 0) + 1);
    const typeData = [...typeCounts.entries()].map(([type, count]) => ({ type: type.replaceAll("_", " "), count }))
      .sort((a, b) => b.count - a.count);
    const wardData = state.wards.map((w) => ({
      ward: w.name.replace(" Ward", "").replace(" Rooms", ""),
      alerts: anaAlerts.filter((a) => state.patients.find((p) => p.id === a.patientId)?.wardId === w.id).length,
    })).filter((d) => d.alerts > 0 || anaWard === "all");
    const days: { day: string; alerts: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toDateString();
      days.push({
        day: d.toLocaleDateString([], { weekday: "short" }),
        alerts: anaAlerts.filter((a) => new Date(a.createdAt).toDateString() === key).length,
      });
    }
    const thisWeek = anaAlerts.filter((a) => a.createdAt >= Date.now() - 7 * 86400000).length;
    const lastWeek = state.alerts.filter((a) => a.createdAt < Date.now() - 7 * 86400000 && a.createdAt >= Date.now() - 14 * 86400000).length;
    const nurseData = state.nurses.map((n) => ({
      nurse: n.name.split(" ")[0] ?? n.name,
      active: state.alerts.filter((a) => a.nurseId === n.id && a.status !== "resolved").length,
      resolved: state.alerts.filter((a) => a.nurseId === n.id && a.status === "resolved").length,
    }));
    const sevData = (["info", "warning", "critical"] as Severity[]).map((sev) => ({
      name: SEV_META[sev].label, value: anaAlerts.filter((a) => a.severity === sev).length,
      fill: sev === "critical" ? "#bc2a30" : sev === "warning" ? "#c07f10" : "#2878b5",
    })).filter((d) => d.value > 0);

    return (
      <div>
        <PageHeader title="Analytics" desc="Alert patterns, response performance and nurse workload across the hospital. Figures update live with the simulation.">
          <select aria-label="Analytics ward filter" value={anaWard} onChange={(e) => setAnaWard(e.target.value)}
            className="rounded-[var(--radius)] border px-2.5 py-2 text-sm" style={inputStyle}>
            <option value="all">All wards</option>
            {state.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select aria-label="Analytics date range" value={anaRange} onChange={(e) => setAnaRange(e.target.value)}
            className="rounded-[var(--radius)] border px-2.5 py-2 text-sm" style={inputStyle}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </PageHeader>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Infusions monitored" value={state.patients.length} />
          <StatCard label="Abnormal events" value={abnormal} color="var(--warn)" soft />
          <StatCard label="Critical alerts" value={criticalCount} color="var(--crit)" soft />
          <StatCard label="Avg infusion duration" value={avgDuration != null ? fmtDuration(avgDuration) : "—"} />
          <StatCard label="Avg time to acknowledge" value={avgAck != null ? fmtDuration(avgAck) : "—"} />
          <StatCard label="Alerts: this wk vs last wk" value={`${thisWeek} / ${lastWeek}`} />
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--dim)" }}>
          Most frequent abnormality: <strong style={{ color: "var(--text)" }}>{typeData[0] ? `${typeData[0].type} (${typeData[0].count})` : "none recorded"}</strong>.
          Analytics update live as the simulation generates, acknowledges and resolves alerts.
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[var(--radius)] border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="font-display mb-1 text-[20px] font-medium" style={{ color: "var(--accent)" }}>Abnormality types</div>
            <div className="h-60"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical" margin={{ left: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis type="number" tick={axis} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ ...axis, fontSize: 10 }} width={118} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} />
                <Bar dataKey="count" fill="#142b45" radius={[0, 4, 4, 0]} />
              </BarChart></ResponsiveContainer></div>
          </div>
          <div className="rounded-[var(--radius)] border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="font-display mb-1 text-[20px] font-medium" style={{ color: "var(--accent)" }}>Daily alert trend — last 7 days</div>
            <div className="h-60"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="day" tick={axis} />
                <YAxis tick={axis} allowDecimals={false} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} />
                <Bar dataKey="alerts" fill="#159b91" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
          </div>
          <div className="rounded-[var(--radius)] border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="font-display mb-1 text-[20px] font-medium" style={{ color: "var(--accent)" }}>Ward-wise alert distribution</div>
            <div className="h-60"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="ward" tick={axis} />
                <YAxis tick={axis} allowDecimals={false} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} />
                <Bar dataKey="alerts" fill="#a86a08" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
          </div>
          <div className="rounded-[var(--radius)] border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="font-display mb-1 text-[20px] font-medium" style={{ color: "var(--accent)" }}>Severity mix &amp; nurse workload</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={sevData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={2}>
                  {sevData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Pie><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} /></PieChart></ResponsiveContainer></div>
              <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={nurseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d2" /><XAxis dataKey="nurse" tick={axis} />
                  <YAxis tick={axis} allowDecimals={false} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e0d2", boxShadow: "0 2px 8px rgba(20,43,69,0.06)", fontFamily: "DM Sans, sans-serif" }} />
                  <Bar dataKey="active" stackId="a" fill="#bc2a30" name="Active" />
                  <Bar dataKey="resolved" stackId="a" fill="#159b91" name="Resolved" radius={[4, 4, 0, 0]} />
                </BarChart></ResponsiveContainer></div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--dim)" }}>
              {sevData.map((d) => <span key={d.name}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: d.fill }} />{d.name}: {d.value}</span>)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Scenario simulator + settings
  // -------------------------------------------------------------------------

  const scenarioPatient = state.patients.find((p) => p.id === scenarioPatientId) ?? state.patients[0];

  const renderScenarios = () => {
    const p = scenarioPatient;
    if (!p) return <p className="text-sm" style={{ color: "var(--dim)" }}>No patients loaded.</p>;
    const scenarios: { key: string; letter: string; title: string; desc: string; run: () => void; danger?: boolean }[] = [
      { key: "normal", letter: "A", title: "Normal infusion", desc: "Stable flow at the prescribed rate; volume falls gradually and completion time recalculates.", run: () => setCondition(p, "normal") },
      { key: "low", letter: "B", title: "Low fluid warning", desc: `Advance the bottle to just below the ${settingsView.lowThresholdPct}% warning threshold — the engine raises the warning and notifies ${nurseName(state, p.nurseId)}.`, run: () => setVolume(p, Math.max(3, (p.initialVolume * settingsView.lowThresholdPct) / 100 - 5), `Demonstration — bottle for ${p.name} (${p.bed}) advanced to the low-fluid threshold.`) },
      { key: "empty", letter: "C", title: "Bottle empty", desc: "Advance the bottle to 1 mL remaining; with the simulation running it completes, turns critical and is recorded in alert history.", run: () => setVolume(p, 1, `Demonstration — bottle for ${p.name} (${p.bed}) advanced to nearly empty.`) },
      { key: "too_fast", letter: "D", title: "Flow rate too fast", desc: "Sudden rise to ~190% of prescribed rate (e.g. clamp adjusted) — warning or critical by severity.", run: () => setCondition(p, "too_fast"), danger: true },
      { key: "too_slow", letter: "E", title: "Flow rate too slow", desc: "Flow drops to ~35% of prescribed; the alert fires once the low flow has persisted 5 simulated minutes, with its duration.", run: () => setCondition(p, "too_slow") },
      { key: "stopped", letter: "F", title: "Flow stopped", desc: "Complete interruption with fluid remaining — critical alert.", run: () => setCondition(p, "stopped"), danger: true },
      { key: "blockage", letter: "G", title: "Blockage / kinked line", desc: "Irregular near-zero flow pattern. Reported as a suspected obstruction only — the physical cause is not claimed.", run: () => setCondition(p, "blockage") },
      { key: "fluctuation", letter: "H", title: "Sudden flow fluctuation", desc: "Irregular swings around the prescribed rate; instability is detected and recorded.", run: () => setCondition(p, "fluctuation") },
      { key: "backflow", letter: "I", title: "Possible backflow", desc: "Simulated suspected reverse-flow pattern, clearly labelled as a simulated suspected condition.", run: () => setCondition(p, "backflow") },
    ];
    return (
      <div>
        <PageHeader title="Scenario Simulator" desc="Trigger clinical scenarios against real simulated patients — detection, alerting and escalation all run through the live engine." />
        <p className="max-w-3xl text-sm" style={{ color: "var(--dim)" }}>
          Every scenario changes the patient's real simulated data — flow pattern, volume, charts, alerts and event
          history. Detection runs in the engine, so run the simulation (top bar) to watch alerts fire.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium">Patient
            <select aria-label="Scenario patient" value={p.id} onChange={(e) => setScenarioPatientId(e.target.value)}
              className="ml-2 rounded-[var(--radius)] border px-2.5 py-2 text-sm" style={inputStyle}>
              {state.patients.map((x) => <option key={x.id} value={x.id}>{x.name} — Bed {x.bed} ({STATUS_META[x.status].label})</option>)}
            </select>
          </label>
          <span className="text-sm" style={{ color: "var(--dim)" }}>
            Current condition: <strong style={{ color: "var(--text)" }}>{CONDITION_LABEL[p.conditionState] ?? p.conditionState}</strong>
            {" · "}Flow <span className="tnum">{round1(p.flowRate)}</span> / prescribed {p.prescribedRate} mL/hr
            {" · "}Remaining <span className="tnum">{Math.round(p.remainingVolume)}</span> mL
          </span>
          <span className="flex-1" />
          <Btn variant="ghost" onClick={() => openPatient(p.id)}>View patient charts</Btn>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((sc) => (
            <div key={sc.key} className="flex flex-col rounded-[var(--radius)] border p-4"
              style={{ background: "var(--surface)", borderColor: p.conditionState === sc.key || (sc.key === "low" && p.remainingVolume <= (p.initialVolume * settingsView.lowThresholdPct) / 100 && p.remainingVolume > 0) ? "var(--accent)" : "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="font-display flex h-7 w-7 items-center justify-center rounded-[3px] text-[16px] font-medium text-white" style={{ background: "var(--accent)" }}>{sc.letter}</span>
                <span className="font-semibold">{sc.title}</span>
              </div>
              <p className="mt-1.5 flex-1 text-sm" style={{ color: "var(--dim)" }}>{sc.desc}</p>
              <div className="mt-3">
                <Btn variant={sc.danger ? "danger" : "primary"} onClick={sc.run} disabled={p.status === "completed"}>
                  {sc.key === "normal" ? "Restore normal flow" : `Trigger — ${p.bed}`}
                </Btn>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <SectionTitle>Detection &amp; escalation settings</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">Low-fluid warning threshold (% of bottle)
              <input aria-label="Low fluid threshold percent" type="number" min={1} max={90}
                value={settingsView.lowThresholdPct}
                onChange={(e) => setSettingsDraft({ ...settingsView, lowThresholdPct: Number(e.target.value) })}
                className={`${inputCls} mt-1`} style={inputStyle} /></label>
            <label className="text-sm font-medium">Escalate unacknowledged critical alerts after (sim min)
              <input aria-label="Escalation interval in simulated minutes" type="number" min={0.5} step={0.5}
                value={settingsView.escalationSimMin}
                onChange={(e) => setSettingsDraft({ ...settingsView, escalationSimMin: Number(e.target.value) })}
                className={`${inputCls} mt-1`} style={inputStyle} /></label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input aria-label="Automatic random scenarios" type="checkbox"
                checked={settingsView.autoScenarios === 1}
                onChange={(e) => setSettingsDraft({ ...settingsView, autoScenarios: e.target.checked ? 1 : 0 })}
                className="h-4 w-4" />
              Automatic random scenarios while the simulation runs
            </label>
          </div>
          <div className="mt-3">
            <Btn variant="ok" onClick={saveSettings}>Save settings</Btn>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Guided demonstration
  // -------------------------------------------------------------------------

  const demoPatient = (bed: string, fallbackIdx = 0) =>
    state.patients.find((p) => p.bed === bed) ?? state.patients[fallbackIdx];

  const demoSteps: { title: string; text: string; action: string; run: () => void }[] = [
    {
      title: "The nurse opens the dashboard",
      text: "One screen shows every monitored bed across the General, Medical and ICU wards — status, remaining volume and time-to-empty, sorted by what needs attention.",
      action: "Open the dashboard",
      run: () => setView("dashboard"),
    },
    {
      title: "Monitoring starts for all 12 patients at once",
      text: "The simulation starts at 5× speed. Every patient's volume, flow rate and completion estimate now update continuously — no manual rounds needed.",
      action: "Start the simulation at 5×",
      run: () => { setSpeed(5); setRunning(true); setView("dashboard"); },
    },
    {
      title: "One patient's fluid level falls, live",
      text: "Open Sanjay Gupta (G-01): the remaining-volume and flow charts draw themselves as the bottle drains, and the completion estimate recalculates every tick.",
      action: "Open the patient's live charts",
      run: () => { const p = demoPatient("G-01"); if (p) openPatient(p.id); },
    },
    {
      title: "Another patient's flow turns abnormal",
      text: "Vimala Krishnan's clamp is 'adjusted' — her flow jumps to about 190% of the prescribed rate. Watch her card turn amber/red on the dashboard.",
      action: "Trigger abnormal flow (M-04)",
      run: () => { const p = demoPatient("M-04", 6); if (p) setCondition(p, "too_fast"); setView("dashboard"); },
    },
    {
      title: "A low-fluid warning appears",
      text: "Manju Pillai's bottle (G-05) crosses the low-fluid threshold. A warning is raised and her nurse is notified — beep, dashboard notification and voice call together.",
      action: "Advance G-05 to the low threshold",
      run: () => { const p = demoPatient("G-05", 3); if (p) setVolume(p, 30, `Demonstration — bottle for ${p.name} (${p.bed}) advanced into the low-fluid zone.`); setView("dashboard"); },
    },
    {
      title: "A critical alert is generated",
      text: "Salim Ansari's line (ICU-01) stops flowing with fluid still in the bottle. A critical alert fires immediately; leave it unacknowledged and it escalates to the head nurse.",
      action: "Stop the flow at ICU-01",
      run: () => { const p = demoPatient("ICU-01", 8); if (p) setCondition(p, "stopped"); setView("dashboard"); },
    },
    {
      title: "The nurse acknowledges the alert",
      text: "In the alert centre, the duty nurse acknowledges the critical alert — its status changes everywhere at once: alert centre, patient card and analytics.",
      action: "Acknowledge the critical alert",
      run: () => {
        const s = stateRef.current; if (!s) return;
        const a = s.alerts.find((x) => x.severity === "critical" && x.status === "new")
          ?? s.alerts.find((x) => x.status === "new");
        if (a) { demoAlertRef.current = a.id; alertAction(a, "acknowledged"); }
        setView("alerts");
      },
    },
    {
      title: "The nurse marks it in progress",
      text: "She is on her way to the bed — the alert moves to 'in progress', which stops the escalation timer and tells the whole ward the case is owned.",
      action: "Mark the alert in progress",
      run: () => {
        const s = stateRef.current; if (!s) return;
        const a = s.alerts.find((x) => x.id === demoAlertRef.current)
          ?? s.alerts.find((x) => x.status === "acknowledged");
        if (a) { demoAlertRef.current = a.id; alertAction(a, "in_progress"); }
        setView("alerts");
      },
    },
    {
      title: "The event is resolved and the flow restored",
      text: "At the bedside the line is freed, flow returns to the prescribed rate, and the alert is resolved — the full episode stays in the patient's event history and the handover record.",
      action: "Resolve the alert & restore ICU-01",
      run: () => {
        const s = stateRef.current; if (!s) return;
        const a = s.alerts.find((x) => x.id === demoAlertRef.current)
          ?? s.alerts.find((x) => x.status === "in_progress");
        if (a) alertAction(a, "resolved");
        const p = demoPatient("ICU-01", 8);
        if (p) setCondition(p, "normal");
        setView("alerts");
      },
    },
    {
      title: "Records and analytics update themselves",
      text: "Every detection, call, acknowledgement and resolution has been written to the event log and the analytics — acknowledgement time, abnormality mix and nurse workload included. That log is the shift handover.",
      action: "Open analytics",
      run: () => setView("analytics"),
    },
  ];

  const renderDemo = () => (
    <div>
      <PageHeader title="Guided Demo" desc="A scripted, repeatable walkthrough of the full monitoring loop on a sample hospital." />
      <p className="max-w-3xl text-sm" style={{ color: "var(--dim)" }}>
        A scripted walkthrough on a sample hospital of 3 wards, 12 patients and 4 nurses, with mixed normal and
        abnormal infusions. It is fully repeatable and resettable.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!inDemo
          ? <Btn variant="primary" onClick={() => doReseed("demo")}>Load demonstration hospital (12 patients)</Btn>
          : <Btn variant="danger" onClick={() => { if (confirmReset) { void doReseed("demo"); setConfirmReset(false); } else setConfirmReset(true); }}>
              {confirmReset ? "Click again to confirm restart" : "Restart demonstration"}</Btn>}
        {inDemo && <Btn variant="ghost" onClick={() => doReseed("main")}>Exit demo — restore standard hospital</Btn>}
      </div>
      {inDemo && (
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          <ol className="space-y-2 lg:col-span-3">
            {demoSteps.map((step, i) => {
              const done = i < demoStep;
              const current = i === demoStep;
              return (
                <li key={step.title} className="flex gap-3 rounded-[var(--radius)] border p-3"
                  style={{ background: current ? "var(--accent-soft)" : "var(--surface)", borderColor: current ? "var(--accent)" : "var(--border)", opacity: done ? 0.65 : 1 }}>
                  <span className="font-mono2 flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-sm font-medium text-white"
                    style={{ background: done ? "var(--ok)" : "var(--accent)" }}>{done ? "✓" : i + 1}</span>
                  <div>
                    <div className="font-semibold">{step.title}</div>
                    <div className="text-sm" style={{ color: "var(--dim)" }}>{step.text}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="lg:col-span-2">
            <div className="rounded-[var(--radius)] border p-4 lg:sticky lg:top-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              {demoStep < demoSteps.length ? (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--dim)" }}>Step {demoStep + 1} of {demoSteps.length}</div>
                  <div className="font-display mt-1 text-[24px] font-medium" style={{ color: "var(--accent)" }}>{demoSteps[demoStep]!.title}</div>
                  <p className="mt-1 text-sm" style={{ color: "var(--dim)" }}>{demoSteps[demoStep]!.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn variant="primary" onClick={() => { demoSteps[demoStep]!.run(); setDemoStep((v) => Math.min(demoSteps.length, v + 1)); }}>
                      {demoSteps[demoStep]!.action}
                    </Btn>
                    <Btn variant="ghost" onClick={() => setDemoStep((v) => Math.min(demoSteps.length, v + 1))}>Skip step</Btn>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-display text-[24px] font-medium" style={{ color: "var(--accent)" }}>Demonstration complete</div>
                  <p className="mt-1 text-sm" style={{ color: "var(--dim)" }}>
                    The full loop — monitoring, detection, multi-channel alerting, acknowledgement, resolution and
                    analytics — ran end to end. Restart it any time, or keep operating the hospital freely.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn variant="primary" onClick={() => setDemoStep(0)}>Run it again</Btn>
                    <Btn variant="ghost" onClick={() => setView("dashboard")}>Go to dashboard</Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const saveSettings = () => {
    const next = { ...state, settings: { ...state.settings, ...settingsView } };
    stateRef.current = next; setState(next);
    api.saveSettings({
      lowThresholdPct: settingsView.lowThresholdPct,
      escalationSimMin: settingsView.escalationSimMin,
      autoScenarios: settingsView.autoScenarios,
    }).catch(() => {});
    showToast("Detection & escalation settings saved.");
  };

  // -------------------------------------------------------------------------
  // Patients directory
  // -------------------------------------------------------------------------

  const renderPatients = () => {
    const q = search.trim().toLowerCase();
    const list = state.patients.filter((p) =>
      !q || p.name.toLowerCase().includes(q) || p.bed.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    return (
      <div>
        <PageHeader title="Patients" desc="Every patient currently under IV monitoring. Select a patient for live charts, event history and nurse reassignment.">
          <Btn variant="primary" onClick={() => { setView("dashboard"); setShowAddPatient(true); }}>＋ Register patient</Btn>
        </PageHeader>
        <div className="overflow-hidden rounded-[var(--radius)] border" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div className="hidden grid-cols-[1.4fr_0.7fr_1fr_1.2fr_0.8fr_0.9fr] gap-3 border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] md:grid"
            style={{ borderColor: "var(--border)", color: "var(--dim)", background: "var(--surface-hover)" }}>
            <span>Patient</span><span>Bed · Ward</span><span>Fluid</span><span>Remaining</span><span>Flow</span><span>Status</span>
          </div>
          {list.length === 0 && <p className="px-4 py-6 text-sm" style={{ color: "var(--dim)" }}>No patients match the current search.</p>}
          {list.map((p) => {
            const meta = STATUS_META[p.status];
            const pct = p.initialVolume > 0 ? Math.round((p.remainingVolume / p.initialVolume) * 100) : 0;
            return (
              <button key={p.id} type="button" onClick={() => openPatient(p.id)}
                aria-label={`Open monitoring detail for ${p.name}, bed ${p.bed}`}
                className="grid w-full grid-cols-2 items-center gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-[var(--surface-hover)] md:grid-cols-[1.4fr_0.7fr_1fr_1.2fr_0.8fr_0.9fr]"
                style={{ borderColor: "var(--border)" }}>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold leading-tight">{p.name}</span>
                  <span className="block truncate text-xs" style={{ color: "var(--dim)" }}>{p.id} · {p.age} yrs · {p.diagnosis}</span>
                </span>
                <span className="text-[13px]"><span className="font-mono2 font-semibold">{p.bed}</span><span style={{ color: "var(--dim)" }}> · {wardName(state, p.wardId)}</span></span>
                <span className="truncate text-[13px] font-medium">{p.fluid}</span>
                <span>
                  <span className="tnum block text-[13px] font-semibold">{Math.round(p.remainingVolume)} mL <span className="font-medium" style={{ color: "var(--dim)" }}>({pct}%)</span></span>
                  <span className="mt-1 block h-1.5 w-full max-w-[140px] overflow-hidden rounded-full" style={{ background: "var(--surface-alt)" }}>
                    <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.bar }} />
                  </span>
                </span>
                <span className="tnum text-[13px] font-medium">{p.status === "completed" ? 0 : round1(p.flowRate)} mL/hr</span>
                <span><Pill text={meta.label} color={meta.color} soft={meta.soft} dot={meta.bar} /></span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--dim)" }}>{list.length} of {state.patients.length} patients · Nurse assignments are shown on each patient's page.</p>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Event history
  // -------------------------------------------------------------------------

  const renderEvents = () => {
    const q = eventQuery.trim().toLowerCase();
    const list = state.events.filter((e) => !q || e.message.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q));
    const kindColor = (k: string) =>
      k === "alert" || k === "escalated" ? "var(--crit)"
      : k === "resolved" || k === "restarted" || k === "completed" ? "var(--teal)"
      : k === "acknowledged" || k === "assigned" ? "var(--blue)" : "var(--info)";
    return (
      <div>
        <PageHeader title="Event History" desc="The complete, timestamped record of detections, notifications, acknowledgements, bedside actions and resolutions — the shift handover record.">
          <span className="relative block w-full sm:w-64">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--dim)" }}><Icon name="search" size={15} /></span>
            <input aria-label="Search event history" value={eventQuery} onChange={(e) => setEventQuery(e.target.value)}
              placeholder="Search events…" className={`${inputCls} pl-8`} style={inputStyle} />
          </span>
        </PageHeader>
        <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
          {list.length === 0 && <p className="text-sm" style={{ color: "var(--dim)" }}>No events match this search.</p>}
          <div>
            {list.slice(0, 200).map((e, i, arr) => {
              const p = e.patientId ? state.patients.find((x) => x.id === e.patientId) : null;
              return (
                <div key={e.id} className="relative flex gap-3 pb-3.5 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute left-[3px] top-3 h-full w-px" style={{ background: "var(--border)" }} />}
                  <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: kindColor(e.kind) }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] leading-snug">{e.message}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--dim)" }}>
                      <span className="font-mono2">{fmtDateTime(e.ts)}</span>
                      <span className="font-semibold uppercase tracking-wide" style={{ color: kindColor(e.kind) }}>{e.kind.replaceAll("_", " ")}</span>
                      {p ? <span>{p.name} · Bed {p.bed}</span> : null}
                      <span className="tnum">Sim T+{fmtDuration(e.simMin)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  const renderSettings = () => (
    <div>
      <PageHeader title="Settings" desc="Detection thresholds, escalation behaviour and simulation preferences for this monitoring unit." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <SectionTitle>Detection &amp; escalation</SectionTitle>
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-medium">Low-fluid warning threshold (% of bottle)
              <input aria-label="Low fluid threshold percent" type="number" min={1} max={90}
                value={settingsView.lowThresholdPct}
                onChange={(e) => setSettingsDraft({ ...settingsView, lowThresholdPct: Number(e.target.value) })}
                className={`${inputCls} mt-1`} style={inputStyle} /></label>
            <label className="block text-sm font-medium">Escalate unacknowledged critical alerts after (sim min)
              <input aria-label="Escalation interval in simulated minutes" type="number" min={0.5} step={0.5}
                value={settingsView.escalationSimMin}
                onChange={(e) => setSettingsDraft({ ...settingsView, escalationSimMin: Number(e.target.value) })}
                className={`${inputCls} mt-1`} style={inputStyle} /></label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input aria-label="Automatic random scenarios" type="checkbox"
                checked={settingsView.autoScenarios === 1}
                onChange={(e) => setSettingsDraft({ ...settingsView, autoScenarios: e.target.checked ? 1 : 0 })}
                className="h-4 w-4" />
              Automatic random scenarios while the simulation runs
            </label>
          </div>
          <div className="mt-4"><Btn variant="ok" onClick={saveSettings}>Save settings</Btn></div>
        </div>
        <div className="space-y-4">
          <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <SectionTitle>Simulation</SectionTitle>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Status</dt><dd className="font-medium">{running ? `Running at ${speed}×` : "Paused"}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Simulation clock</dt><dd className="tnum font-mono2 font-medium">T+{fmtDuration(state.simMin)}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Hospital</dt><dd className="font-medium">{inDemo ? "Demonstration hospital (12 patients)" : "Standard sample hospital"}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--dim)" }}>Alert sounds</dt><dd className="font-medium">{muted ? "Off" : "On"}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {running
                ? <Btn variant="ghost" onClick={() => setRunning(false)}>Pause simulation</Btn>
                : <Btn variant="primary" onClick={() => setRunning(true)}>Start simulation</Btn>}
              <Btn variant="ghost" onClick={() => setMuted((m) => !m)}>{muted ? "Unmute sounds" : "Mute sounds"}</Btn>
              <Btn variant="danger" onClick={() => { if (confirmReset) { void doReseed(inDemo ? "demo" : "main"); setConfirmReset(false); } else setConfirmReset(true); }}>
                {confirmReset ? "Click again to confirm reset" : "Reset simulation"}
              </Btn>
            </div>
          </div>
          <div className="rounded-[var(--radius)] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <SectionTitle>Demonstration hospital</SectionTitle>
            <p className="mt-1.5 text-sm" style={{ color: "var(--dim)" }}>
              Load the 12-patient guided demonstration hospital, or return to the standard sample hospital. Resetting clears the current simulation state.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!inDemo
                ? <Btn variant="primary" onClick={() => doReseed("demo")}>Load demonstration hospital</Btn>
                : <Btn variant="ghost" onClick={() => doReseed("main")}>Restore standard hospital</Btn>}
              <Btn variant="ghost" onClick={() => setView("demo")}>Open guided demo</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  const dutyNurse = state.nurses[0];
  const navItems: { key: View; label: string; icon: IconName; badge?: number }[] = [
    { key: "dashboard", label: "Overview", icon: "grid" },
    { key: "live", label: "Live Monitoring", icon: "activity" },
    { key: "ward3d", label: "Hospital Simulation", icon: "cube" },
    { key: "patients", label: "Patients", icon: "users", badge: stats.total },
    { key: "wards", label: "Wards", icon: "building" },
    { key: "alerts", label: "Alert Centre", icon: "bell", badge: activeAlerts.length },
    { key: "nurses", label: "Nurses", icon: "nurse" },
    { key: "analytics", label: "Analytics", icon: "chart" },
    { key: "events", label: "Event History", icon: "history" },
    { key: "scenarios", label: "Scenario Simulator", icon: "flask" },
    { key: "demo", label: "Guided Demo", icon: "play" },
    { key: "settings", label: "Settings", icon: "gear" },
  ];
  const pageTitles: Record<View, string> = {
    dashboard: "Overview", live: "Live Monitoring", ward3d: "Hospital Simulation",
    patient: "Patient Detail", patients: "Patients", alerts: "Alert Centre",
    nurses: "Nurses", wards: "Wards", analytics: "Analytics", events: "Event History",
    settings: "Settings", scenarios: "Scenario Simulator", demo: "Guided Demo",
  };
  const isNavActive = (key: View) =>
    view === key || (key === "dashboard" && view === "patient") || (key === "patients" && view === "patient");
  const clockDate = new Date(clockNow).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const clockTime = new Date(clockNow).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const initials = (name: string) => name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen lg:flex" style={{ background: "var(--bg)" }}>
      {/* ---------------- Sidebar (desktop / tablet) ---------------- */}
      <aside className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col text-white transition-all duration-200 lg:flex ${sidebarCollapsed ? "w-[68px]" : "w-[228px]"}`}
        style={{ background: "var(--accent)" }} aria-label="Application sidebar">
        <div className={`flex items-center gap-2.5 border-b border-white/10 px-4 py-4 ${sidebarCollapsed ? "justify-center px-2" : ""}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)]" style={{ background: "var(--teal)" }}>
            <Icon name="pulse" size={20} />
          </span>
          {!sidebarCollapsed && (
            <span className="min-w-0">
              <span className="font-display block truncate text-[22px] font-medium leading-none tracking-[0.01em]">DripConnect</span>
              <span className="mt-1 block text-[10px] font-medium uppercase leading-tight tracking-[0.14em] text-white/55">Clinical Monitoring</span>
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = isNavActive(item.key);
            return (
              <button key={item.key} type="button" onClick={() => setView(item.key)}
                aria-label={`Open ${item.label}`} aria-current={active ? "page" : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-[9px] text-[13.5px] font-medium ${sidebarCollapsed ? "justify-center" : ""}`}
                style={active
                  ? { background: "rgba(255,255,255,0.14)", color: "#fff", boxShadow: "inset 2.5px 0 0 var(--teal)" }
                  : { color: "rgba(255,255,255,0.72)" }}>
                <Icon name={item.icon} size={17} className="shrink-0" />
                {!sidebarCollapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                {!sidebarCollapsed && item.badge ? (
                  <span className="rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none"
                    style={item.key === "alerts" && item.badge > 0
                      ? { background: "var(--crit)", color: "#fff" }
                      : { background: "rgba(255,255,255,0.16)", color: "#fff" }}>{item.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-3 py-3">
          {!sidebarCollapsed && (
            <div className="mb-2.5 rounded-[var(--radius)] bg-white/[0.07] px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">
                <Icon name="clock" size={12} /> Simulation
              </div>
              <div className="tnum mt-0.5 font-mono2 text-xs text-white/90">T+{fmtDuration(state.simMin)} · {speed}× · {running ? "Running" : "Paused"}</div>
              {inDemo && <div className="mt-0.5 text-[11px] font-semibold text-amber-300">Demonstration hospital</div>}
            </div>
          )}
          <button type="button" onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-2 rounded-[var(--radius)] px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <span className={`inline-block transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}><Icon name="chevron" size={14} /></span>
            {!sidebarCollapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {/* Brand row — small screens only (sidebar is hidden) */}
          <div className="flex items-center gap-2.5 px-3 pt-3 sm:px-5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-white" style={{ background: "var(--teal)" }}>
              <Icon name="pulse" size={17} />
            </span>
            <span className="font-display text-[21px] font-medium leading-none" style={{ color: "var(--accent)" }}>DripConnect</span>
            <span className="font-mono2 rounded-[3px] border px-2 py-0.5 text-[11px] font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)", borderColor: "var(--border-strong)" }}>
              SIMULATION · T+{fmtDuration(state.simMin)} · {speed}×
            </span>
            {criticalActive.length > 0 && (
              <button type="button" onClick={() => setView("alerts")}
                aria-label={`${criticalActive.length} critical alerts — open alert centre`}
                className="crit-pulse rounded-[3px] px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: "var(--crit)" }}>
                {criticalActive.length} CRITICAL
              </button>
            )}
          </div>

          {/* Top navigation row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5">
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em]" style={{ color: "var(--dim)" }}>
                <span>DripConnect</span>
                <span aria-hidden="true">/</span>
                <span style={{ color: "var(--dim-strong)" }}>{pageTitles[view]}</span>
                {view === "patient" && selectedPatient ? (<><span aria-hidden="true">/</span><span style={{ color: "var(--dim-strong)" }}>{selectedPatient.name}</span></>) : null}
              </nav>
              <div className="font-display truncate text-[25px] font-medium leading-tight" style={{ color: "var(--accent)" }}>{pageTitles[view]}</div>
            </div>
            <span className="flex-1" />

            {/* Global patient search */}
            <span className="relative order-5 block w-full sm:order-none sm:w-52 xl:w-64">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--dim)" }}><Icon name="search" size={15} /></span>
              <input aria-label="Global patient search" value={search}
                onChange={(e) => { setSearch(e.target.value); if (view !== "dashboard" && view !== "live" && view !== "patients" && view !== "patient") setView("live"); }}
                placeholder="Search patient or bed…"
                className="w-full rounded-[var(--radius)] border py-2 pl-8 pr-2.5 text-sm outline-none focus:ring-2 focus:ring-[rgba(40,120,181,0.35)]"
                style={inputStyle} />
            </span>

            {/* Notification centre */}
            <span className="relative">
              <button type="button" onClick={() => setShowNotifications((v) => !v)}
                aria-label={`Notification centre — ${activeAlerts.length} active alerts`} aria-expanded={showNotifications}
                className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius)] border"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--dim-strong)" }}>
                <Icon name="bell" size={18} />
                {activeAlerts.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: criticalActive.length > 0 ? "var(--crit)" : "var(--warn)" }}>{activeAlerts.length}</span>
                )}
              </button>
              {showNotifications && (
                <div className="fade-in absolute right-0 top-[46px] z-40 w-[320px] max-w-[86vw] rounded-[var(--radius)] border p-2"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
                  role="dialog" aria-label="Notifications">
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="font-display text-[19px] font-medium" style={{ color: "var(--accent)" }}>Notifications</span>
                    <span className="text-xs" style={{ color: "var(--dim)" }}>{activeAlerts.length} active</span>
                  </div>
                  {activeAlerts.length === 0 && <p className="px-1.5 py-2 text-sm" style={{ color: "var(--dim)" }}>No active alerts. All infusions are within limits.</p>}
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {activeAlerts.slice(0, 6).map((a) => {
                      const p = state.patients.find((x) => x.id === a.patientId);
                      const sev = SEV_META[a.severity];
                      return (
                        <button key={a.id} type="button"
                          onClick={() => { setSelectedAlertId(a.id); setShowNotifications(false); setView("alerts"); }}
                          aria-label={`View alert: ${a.title}`}
                          className="block w-full rounded-[var(--radius)] px-2 py-2 text-left hover:bg-[var(--surface-hover)]">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sev.color }} />
                            <span className="flex-1 truncate text-[13px] font-semibold">{a.title}</span>
                            <span className="font-mono2 text-[11px]" style={{ color: "var(--dim)" }}>{fmtTime(a.createdAt)}</span>
                          </span>
                          <span className="mt-0.5 block pl-4 text-xs" style={{ color: "var(--dim)" }}>
                            {p ? `${p.name} · Bed ${p.bed}` : a.patientId}{a.escalated === 1 ? " · ESCALATED" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => { setShowNotifications(false); setView("alerts"); }}
                    className="mt-1 w-full rounded-[var(--radius)] px-2 py-2 text-center text-[13px] font-semibold"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    Open alert centre
                  </button>
                </div>
              )}
            </span>

            {/* Date & time */}
            <span className="hidden text-right md:block" aria-label={`Current date and time: ${clockDate}, ${clockTime}`}>
              <span className="block text-[13px] font-semibold leading-tight">{clockDate}</span>
              <span className="tnum font-mono2 block text-[11px] leading-tight" style={{ color: "var(--dim)" }}>{clockTime}</span>
            </span>

            {/* Nurse profile + role */}
            {dutyNurse && (
              <span className="flex items-center gap-2 border-l pl-3" style={{ borderColor: "var(--border)" }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--blue)" }}>
                  {initials(dutyNurse.name)}
                </span>
                <span className="hidden xl:block">
                  <span className="block text-[13px] font-semibold leading-tight">{dutyNurse.name}</span>
                  <span className="block text-[11px] leading-tight" style={{ color: "var(--dim)" }}>{wardName(state, dutyNurse.wardId)} · {dutyNurse.shift} shift</span>
                </span>
                <span className="rounded-[3px] border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ background: "var(--blue-soft)", color: "var(--blue)", borderColor: "var(--blue)" }}>Duty Nurse</span>
              </span>
            )}
          </div>

          {/* Simulation control strip */}
          <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2 sm:px-5" style={{ borderColor: "var(--border)", background: "var(--surface-hover)" }}>
            <span className="mr-1 hidden items-center gap-1.5 rounded-[3px] px-2.5 py-1 font-mono2 text-[11px] font-medium sm:inline-flex"
              style={{ background: "var(--accent)", color: "#fff" }}>
              SIMULATION · T+{fmtDuration(state.simMin)} · {speed}×
            </span>
            {criticalActive.length > 0 && (
              <button type="button" onClick={() => setView("alerts")}
                aria-label={`${criticalActive.length} critical alerts — open alert centre`}
                className="crit-pulse mr-1 hidden rounded-[3px] px-2.5 py-1 text-[11px] font-semibold text-white lg:inline-block" style={{ background: "var(--crit)" }}>
                {criticalActive.length} CRITICAL
              </button>
            )}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Simulation controls">
              {!running
                ? <button type="button" onClick={() => setRunning(true)} className="rounded-[var(--radius)] px-3 py-1.5 text-[13px] font-semibold text-white" style={{ background: "var(--teal)" }}>▶ Start simulation</button>
                : <button type="button" onClick={() => setRunning(false)} className="rounded-[var(--radius)] border px-3 py-1.5 text-[13px] font-semibold" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>⏸ Pause</button>}
              {[1, 2, 5, 10].map((sp) => (
                <button key={sp} type="button" onClick={() => setSpeed(sp)} aria-label={`Simulation speed ${sp}x`}
                  className="tnum rounded-[var(--radius)] border px-2 py-1.5 text-[13px] font-semibold"
                  style={speed === sp
                    ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                    : { background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}>
                  {sp}×
                </button>
              ))}
              <button type="button"
                onClick={() => { if (confirmReset) { void doReseed(inDemo ? "demo" : "main"); setConfirmReset(false); } else setConfirmReset(true); }}
                className="rounded-[var(--radius)] border px-3 py-1.5 text-[13px] font-semibold"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                {confirmReset ? "Confirm reset?" : "Reset simulation"}
              </button>
              <button type="button" onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute notification sounds" : "Mute notification sounds"}
                className="rounded-[var(--radius)] border px-3 py-1.5 text-[13px] font-semibold"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                {muted ? "Sound: Off" : "Sound: On"}
              </button>
            </div>
            <span className="flex-1" />
            <span className="hidden text-xs xl:block" style={{ color: "var(--dim)" }}>
              {inDemo ? "Demonstration hospital · simulated environment" : "Simulated environment · sample hospital"}
            </span>
          </div>

          {/* Mobile / tablet navigation */}
          <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 sm:px-5 lg:hidden" style={{ borderColor: "var(--border)" }} aria-label="Main navigation">
            {navItems.map((item) => (
              <button key={item.key} type="button" onClick={() => setView(item.key)}
                aria-label={`Open ${item.label}`} aria-current={isNavActive(item.key) ? "page" : undefined}
                className="relative whitespace-nowrap rounded-[var(--radius)] px-2.5 py-1.5 text-[13px] font-medium"
                style={isNavActive(item.key)
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--surface-alt)", color: "var(--dim-strong)" }}>
                {item.label}
                {item.key === "alerts" && item.badge ? <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "var(--crit)" }}>{item.badge}</span> : null}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8 sm:py-9">
          {view === "dashboard" && renderDashboard()}
          {view === "live" && renderDashboard(true)}
          {view === "ward3d" && renderWard3D()}
          {view === "patient" && renderPatient()}
          {view === "patients" && renderPatients()}
          {view === "alerts" && renderAlerts()}
          {view === "nurses" && renderNurses()}
          {view === "wards" && renderWards()}
          {view === "analytics" && renderAnalytics()}
          {view === "events" && renderEvents()}
          {view === "settings" && renderSettings()}
          {view === "scenarios" && renderScenarios()}
          {view === "demo" && renderDemo()}
        </main>

        <footer className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-8">
          <p className="border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "var(--border)", color: "var(--dim)" }}>
            DripConnect is an educational software prototype. Every reading, alert and patient on this page is simulated
            inside the application — it is not a clinically validated medical device, takes no real measurements, and
            never changes a prescribed infusion rate. In the product this software demonstrates, alerts reach the nurse
            four ways at once — bedside beep, dashboard notification, WhatsApp voice call, and GSM call + SMS when there
            is no internet — escalating until a person answers.
          </p>
        </footer>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast-in fixed bottom-4 right-4 z-50 flex max-w-[min(92vw,380px)] items-start gap-2.5 rounded-[var(--radius)] border px-3.5 py-3"
          style={{ background: "var(--accent)", borderColor: "var(--accent)", boxShadow: "var(--shadow-lg)" }}
          role="status" aria-live="polite">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "var(--teal)" }}>
            <Icon name="check" size={12} />
          </span>
          <span className="flex-1 text-[13px] font-medium leading-snug text-white">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"
            className="shrink-0 text-white/70 hover:text-white">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
