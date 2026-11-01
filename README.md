# DripConnect — Intelligent IV Infusion Monitoring and Automated Nurse Response System

A software-based simulation prototype for continuous IV infusion monitoring across a
multi-bed hospital ward. DripConnect simulates drop counting, flow-rate calculation,
fluid-level tracking and time-to-empty estimation for every bed, detects abnormal
conditions, and drives a nurse notification, escalation, intervention and
**verified-resolution** workflow.

> **Prototype disclaimer:** This is a simulated environment. No physical sensors,
> hospital equipment or real patient monitoring are connected. Notification channels
> (WhatsApp voice, GSM voice/SMS) are simulated in the browser.

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite 8
- **Styling:** Tailwind CSS 4 (`@tailwindcss/vite`)
- **Charts:** Recharts · **Icons:** Lucide · **Animation:** Motion
- **State:** A single `SimulationProvider` (React Context) owns beds, alerts,
  escalation, event history, telemetry and settings, persisted to `localStorage`
- **Package manager:** Bun (a `bun.lock` is committed); npm works as well

## Getting started

```bash
bun install        # or: npm install
bun run dev        # or: npm run dev   → http://localhost:3000
```

## Scripts

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `bun run dev`    | Start the Vite dev server on port 3000        |
| `bun run build`  | Production build to `dist/`                   |
| `bun run preview`| Preview the production build                  |
| `bun run lint`   | Type-check the whole project (`tsc --noEmit`) |

## Project structure

```
src/
  App.tsx                        App shell, login gate, page routing
  context/SimulationContext.tsx  Simulation engine + all shared state
  types/index.ts                 Domain types (beds, alerts, events, settings, presets)
  services/
    scenarios.ts                 Built-in scenario configs (A–F)
    audioService.ts              Buzzer, chimes, ringtone (WebAudio)
    hardwareInterface.ts         Contract types for future physical sensors
  components/                    Layout, ward bed cards, monitoring, alerts,
                                 escalation call UI, simulation controls
  pages/                         Dashboard, Live Monitoring, Simulator, Alerts,
                                 Escalation, Patients, Analytics, Settings, Login
```

## How the simulation works

- **Multi-bed monitoring** — Six beds (Bed 01–06) are simulated in parallel from one
  engine loop. Each bed carries its own patient, fluid, prescribed rate, remaining
  volume and status.
- **Independent infusions** — Every bed can be started, paused, resumed, stopped and
  reset independently; the physics loop advances each active bed on its own state
  (drop rate derived from flow rate × drop factor, volume depletion, no-drop and
  abnormal-flow timers).
- **Detection thresholds** (configurable in Settings) — flow deviation tolerance
  **20%**, abnormal-flow duration **15 s**, blocked-line no-drop duration **20 s**,
  low-fluid warning at **≤ 15 minutes** to empty. Scenario multipliers: high flow
  **1.85×**, low flow **0.55×** the prescribed rate.
- **Alert workflow** — Alerts move through `ACTIVE_UNACKNOWLEDGED →
  ACKNOWLEDGED_PENDING → INTERVENTION_IN_PROGRESS → RESOLVED_VERIFIED`.
  Acknowledgement starts an overdue timer; interventions record the corrective
  action actually applied to the bed (replace bag, clear kink, recalibrate rate);
  **resolution is only accepted after sensor verification re-checks live telemetry**
  for that alert type (rate within tolerance, drops flowing, volume safe).
- **Notification & escalation** — Bedside buzzer, then simulated voice calls:
  WhatsApp when internet is available, GSM voice + SMS when it is not.
  Escalation runs Duty Nurse → Ward Attendant → Senior Nurse with shift-specific
  rosters, timeouts (day default 4 s / 14 s / 28 s), staffing levels and an
  optional simulated auto-answer.
- **Event history & analytics** — Every detection, notification, acknowledgement,
  intervention and verification is written to a structured event log. The Analytics
  page computes ward statistics from live state (alert volumes, response and
  resolution times, per-bed telemetry charts) and can export the event history
  as CSV.

## Demonstration presets (configurable)

Guided demonstrations are **data, not code**. Open the **Simulator** page →
Simulation Control Panel → choose a preset → **Run Demo Preset**, or **Configure**
to edit it:

- A preset has a name, description, a target bed and an ordered list of steps.
- Each step targets a bed (default: the preset's bed), optionally applies a built-in
  scenario and/or direct setpoints (volume, actual rate), waits a configurable
  number of seconds, and may perform a workflow action: raise an alert, place an
  escalation call (stage 1–3), acknowledge the demo alert, or record an
  intervention and run verification against live telemetry.
- Two presets ship by default: **Standard Clinical Demo (Bed 06)** — the original
  12-step end-to-end demonstration — and **Multi-Bed Ward Round**, which drives
  different scenarios on different beds simultaneously.
- Presets are saved to `localStorage` (`dripconnect_demo_presets`) and can be
  created, edited, deleted and reset to defaults from the control panel.

## Settings

The Settings page configures shift management (day/night rosters and escalation
timeouts), staffing levels and simulated call response times, clinical detection
thresholds, communication/audio preferences, and documents the hardware
integration contract for future physical deployment.
