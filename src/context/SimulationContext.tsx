import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  BedData,
  BedFaultCondition,
  AlertItem,
  EventLogEntry,
  SystemSettings,
  TelemetryPoint,
  ScenarioType,
  EscalationResponder,
  AlertSeverity,
  AlertType,
  ShiftType,
  EscalationTimeouts,
  ActiveCallState,
  DemoScenarioState,
  AlertWorkflowStatus,
} from '../types';
import { SIMULATION_SCENARIOS } from '../services/scenarios';
import { audioService } from '../services/audioService';

const DEFAULT_DAY_RESPONDERS: EscalationResponder[] = [
  {
    id: 'resp-day-1',
    role: 'Duty Nurse',
    name: 'Nurse Sarah Chen, RN',
    phone: '+1 (555) 349-2810',
    department: 'Intensive Care Unit (Ward 4B Day Lead)',
    avatarColor: 'bg-teal-600',
    initials: 'SC',
  },
  {
    id: 'resp-day-2',
    role: 'Ward Attendant',
    name: 'Marcus Vance, EMT-B',
    phone: '+1 (555) 782-9411',
    department: 'Patient Transport & Floor Support',
    avatarColor: 'bg-blue-600',
    initials: 'MV',
  },
  {
    id: 'resp-day-3',
    role: 'Senior Nurse',
    name: 'Sister Elena Rostova, MSN',
    phone: '+1 (555) 901-4432',
    department: 'Clinical Nursing Supervisor',
    avatarColor: 'bg-indigo-600',
    initials: 'ER',
  },
];

const DEFAULT_NIGHT_RESPONDERS: EscalationResponder[] = [
  {
    id: 'resp-night-1',
    role: 'Duty Nurse',
    name: 'Nurse James Wilson, BSN, RN',
    phone: '+1 (555) 412-8873',
    department: 'Overnight Intensive Care Lead RN',
    avatarColor: 'bg-violet-700',
    initials: 'JW',
  },
  {
    id: 'resp-night-2',
    role: 'Ward Attendant',
    name: 'Dr. Priya Patel, MD',
    phone: '+1 (555) 833-2190',
    department: 'On-Call Nocturnist Physician',
    avatarColor: 'bg-cyan-700',
    initials: 'PP',
  },
  {
    id: 'resp-night-3',
    role: 'Senior Nurse',
    name: 'Charge Nurse Patricia Miller, RN',
    phone: '+1 (555) 670-3491',
    department: 'Night Hospital House Nursing Supervisor',
    avatarColor: 'bg-purple-800',
    initials: 'PM',
  },
];

const DEFAULT_SETTINGS: SystemSettings = {
  defaultPrescribedRate: 100,
  defaultInitialVolume: 500,
  dropFactor: 20, // 20 drops per mL
  flowRateDeviationTolerancePct: 20, // ±20%
  abnormalFlowDurationThresholdSec: 15,
  blockedLineDurationThresholdSec: 20,
  lowFluidWarningMinutesThreshold: 15,
  simulationSpeedMultiplier: 1, // 1x, 2x, 5x
  internetAvailable: true, // true: WhatsApp voice call, false: GSM voice + SMS
  soundNotificationsEnabled: true,
  activeShift: 'DAY',
  simulatedCallVolume: 80, // Day: 80%, Night: 45%
  dayShiftResponders: DEFAULT_DAY_RESPONDERS,
  nightShiftResponders: DEFAULT_NIGHT_RESPONDERS,
  dayShiftTimeouts: { stage1: 4, stage2: 14, stage3: 28 },
  nightShiftTimeouts: { stage1: 3, stage2: 10, stage3: 20 },
  responders: DEFAULT_DAY_RESPONDERS,
  dayStaffingLevel: 100, // 100% full floor staffing
  nightStaffingLevel: 45, // 45% lean nocturnal staffing
  dayCallResponseTimeSec: 4, // 4s response time during daytime full staffing
  nightCallResponseTimeSec: 10, // 10s response time during lean nocturnal staffing
  autoNurseResponseEnabled: true,
  interventionOverdueThresholdSec: 60, // 60s response deadline
};

const INITIAL_BEDS: BedData[] = [
  {
    id: 'bed-01',
    bedNumber: 'Bed 01',
    ward: 'ICU Ward 4B',
    isDemoPrimary: true,
    patient: {
      id: 'p-01',
      name: 'Alex Morgan',
      age: 38,
      gender: 'M',
      mrn: 'MRN-10142',
      admissionDate: '2026-10-30',
      attendingPhysician: 'Dr. Evelyn Reed, MD',
      diagnosis: 'Post-operative recovery & maintenance hydration',
    },
    fluid: {
      solutionName: '0.9% Normal Saline (NaCl)',
      bagCapacityMl: 500,
      lotNumber: 'LOT-NS-2026-001',
      prescribedDrug: 'Standard Maintenance Saline',
      osmolarity: '308 mOsm/L',
    },
    prescribedRate: 100,
    actualRate: 100,
    dropFactor: 20,
    dropRate: 33, // (100 * 20)/60 ≈ 33.3 gtt/min
    initialVolume: 500,
    remainingVolume: 420,
    infusedVolume: 80,
    timeToEmptyMinutes: 252, // (420 / 100) * 60 = 252 min
    status: 'NORMAL',
    isActive: true,
    isPaused: false,
    noDropDurationSec: 0,
    abnormalFlowDurationSec: 0,
    activeScenarioId: 'NORMAL',
    faultCondition: 'NORMAL',
  },
  {
    id: 'bed-02',
    bedNumber: 'Bed 02',
    ward: 'ICU Ward 4B',
    isDemoPrimary: false,
    patient: {
      id: 'p-02',
      name: 'Sarah Wilson',
      age: 45,
      gender: 'F',
      mrn: 'MRN-20419',
      admissionDate: '2026-10-31',
      attendingPhysician: 'Dr. Gregory Hayes, MD',
      diagnosis: 'Severe dehydration & electrolyte rebalancing',
    },
    fluid: {
      solutionName: "Lactated Ringer's Solution",
      bagCapacityMl: 500,
      lotNumber: 'LOT-LR-2026-002',
      osmolarity: '273 mOsm/L',
    },
    prescribedRate: 100,
    actualRate: 100,
    dropFactor: 20,
    dropRate: 33,
    initialVolume: 500,
    remainingVolume: 20, // Low fluid approaching exhaustion (~12 min to empty)
    infusedVolume: 480,
    timeToEmptyMinutes: 12,
    status: 'WARNING',
    isActive: true,
    isPaused: false,
    noDropDurationSec: 0,
    abnormalFlowDurationSec: 0,
    activeScenarioId: 'LOW_FLUID',
    faultCondition: 'LOW_FLUID',
  },
  {
    id: 'bed-03',
    bedNumber: 'Bed 03',
    ward: 'ICU Ward 4B',
    isDemoPrimary: false,
    patient: {
      id: 'p-03',
      name: 'Daniel Thomas',
      age: 52,
      gender: 'M',
      mrn: 'MRN-30911',
      admissionDate: '2026-11-01',
      attendingPhysician: 'Dr. Evelyn Reed, MD',
      diagnosis: 'Sepsis resuscitation protocol',
    },
    fluid: {
      solutionName: '0.9% Normal Saline (NaCl)',
      bagCapacityMl: 500,
      lotNumber: 'LOT-NS-2026-003',
      osmolarity: '308 mOsm/L',
    },
    prescribedRate: 100,
    actualRate: 0, // Blocked line: 0 flow & 0 drops
    dropFactor: 20,
    dropRate: 0,
    initialVolume: 500,
    remainingVolume: 340,
    infusedVolume: 160,
    timeToEmptyMinutes: null,
    status: 'CRITICAL',
    isActive: true,
    isPaused: false,
    noDropDurationSec: 22, // Exceeds 20s blocked line threshold
    abnormalFlowDurationSec: 0,
    activeScenarioId: 'BLOCKED_LINE',
    faultCondition: 'BLOCKED_LINE',
  },
  {
    id: 'bed-04',
    bedNumber: 'Bed 04',
    ward: 'Step-Down 2A',
    isDemoPrimary: false,
    patient: {
      id: 'p-04',
      name: 'Emma Davis',
      age: 29,
      gender: 'F',
      mrn: 'MRN-40182',
      admissionDate: '2026-10-29',
      attendingPhysician: 'Dr. Marcus Brody, MD',
      diagnosis: 'Acute gastroenteritis rehydration',
    },
    fluid: {
      solutionName: '5% Dextrose in Water (D5W)',
      bagCapacityMl: 500,
      lotNumber: 'LOT-D5W-2026-004',
      osmolarity: '252 mOsm/L',
    },
    prescribedRate: 100,
    actualRate: 185, // High flow: +85% deviation exceeds 20% tolerance
    dropFactor: 20,
    dropRate: 62,
    initialVolume: 500,
    remainingVolume: 280,
    infusedVolume: 220,
    timeToEmptyMinutes: 91,
    status: 'WARNING',
    isActive: true,
    isPaused: false,
    noDropDurationSec: 0,
    abnormalFlowDurationSec: 16, // Exceeds 15s deviation threshold
    activeScenarioId: 'HIGH_FLOW',
    faultCondition: 'HIGH_FLOW',
  },
  {
    id: 'bed-05',
    bedNumber: 'Bed 05',
    ward: 'Step-Down 2A',
    isDemoPrimary: false,
    patient: {
      id: 'p-05',
      name: 'Noah Wilson',
      age: 64,
      gender: 'M',
      mrn: 'MRN-50731',
      admissionDate: '2026-11-01',
      attendingPhysician: 'Dr. Evelyn Reed, MD',
      diagnosis: 'Cardiac telemetry fluid titration',
    },
    fluid: {
      solutionName: 'Plasmalyte-A pH 7.4',
      bagCapacityMl: 500,
      lotNumber: 'LOT-PLA-2026-005',
      osmolarity: '294 mOsm/L',
    },
    prescribedRate: 100,
    actualRate: 55, // Low flow: -45% deviation exceeds 20% tolerance
    dropFactor: 20,
    dropRate: 18,
    initialVolume: 500,
    remainingVolume: 390,
    infusedVolume: 110,
    timeToEmptyMinutes: 425,
    status: 'WARNING',
    isActive: true,
    isPaused: false,
    noDropDurationSec: 0,
    abnormalFlowDurationSec: 16, // Exceeds 15s deviation threshold
    activeScenarioId: 'LOW_FLOW',
    faultCondition: 'LOW_FLOW',
  },
  {
    id: 'bed-06',
    bedNumber: 'Bed 06',
    ward: 'Step-Down 2A',
    isDemoPrimary: false,
    patient: {
      id: 'p-06',
      name: 'Olivia Martin',
      age: 61,
      gender: 'F',
      mrn: 'MRN-60824',
      admissionDate: '2026-10-28',
      attendingPhysician: 'Dr. Gregory Hayes, MD',
      diagnosis: 'Severe dehydration recovery',
    },
    fluid: {
      solutionName: '0.45% Sodium Chloride (Half Normal Saline)',
      bagCapacityMl: 500,
      lotNumber: 'LOT-HNS-2026-006',
      osmolarity: '154 mOsm/L',
    },
    prescribedRate: 100,
    actualRate: 0, // Depleted bottle: 0 flow & 0 drops
    dropFactor: 20,
    dropRate: 0,
    initialVolume: 500,
    remainingVolume: 0, // 0 mL remaining
    infusedVolume: 500,
    timeToEmptyMinutes: 0,
    status: 'CRITICAL',
    isActive: true,
    isPaused: false,
    noDropDurationSec: 28,
    abnormalFlowDurationSec: 0,
    activeScenarioId: 'EMPTY_BOTTLE',
    faultCondition: 'EMPTY_BOTTLE',
  },
];

// Demonstration seed records corresponding to multi-bed ward simulation
const SEED_ALERTS: AlertItem[] = [
  {
    id: 'ALT-B03-BLOCKED',
    bedId: 'bed-03',
    bedNumber: 'Bed 03',
    patientName: 'Daniel Thomas',
    patientMrn: 'MRN-30911',
    type: 'BLOCKED_LINE',
    severity: 'CRITICAL',
    title: 'Blocked or Kinked IV Line',
    description: 'No drops registered for >20 seconds (0 mL/h delivery). Mechanical line occlusion or roller clamp closed.',
    triggeredAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    timestampMs: Date.now() - 3 * 60 * 1000,
    workflowStatus: 'ACTIVE_UNACKNOWLEDGED',
    isAcknowledged: false,
    acknowledgedSecondsElapsed: 0,
    isOverdue: false,
    isResolved: false,
    escalationStage: 'CALLING_DUTY_NURSE',
    escalationSeconds: 8,
    communicationChannelUsed: 'WHATSAPP_VOICE',
    timeline: [
      { time: '10:48:00 AM', action: 'Critical occlusion detected: 0 drops/min registered by drip chamber sensor' },
      { time: '10:48:04 AM', action: 'Bedside audible buzzer and optical alarm triggered' },
      { time: '10:48:04 AM', action: 'Escalation Stage 1: Dispatched priority voice notification to Duty Nurse' },
    ],
  },
  {
    id: 'ALT-B06-EMPTY',
    bedId: 'bed-06',
    bedNumber: 'Bed 06',
    patientName: 'Olivia Martin',
    patientMrn: 'MRN-60824',
    type: 'EMPTY_BOTTLE',
    severity: 'CRITICAL',
    title: 'Empty Infusion Bottle',
    description: 'Fluid reservoir depleted (0 mL remaining). Delivery stopped automatically to prevent air embolism.',
    triggeredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    timestampMs: Date.now() - 5 * 60 * 1000,
    workflowStatus: 'ACTIVE_UNACKNOWLEDGED',
    isAcknowledged: false,
    acknowledgedSecondsElapsed: 0,
    isOverdue: false,
    isResolved: false,
    escalationStage: 'CALLING_DUTY_NURSE',
    escalationSeconds: 10,
    communicationChannelUsed: 'WHATSAPP_VOICE',
    timeline: [
      { time: '10:45:00 AM', action: 'Empty bottle condition detected: 0 mL remaining fluid volume' },
      { time: '10:45:04 AM', action: 'Bedside safety alarm sounded; nurse escalation active' },
    ],
  },
  {
    id: 'ALT-B02-LOWFLUID',
    bedId: 'bed-02',
    bedNumber: 'Bed 02',
    patientName: 'Sarah Wilson',
    patientMrn: 'MRN-20419',
    type: 'LOW_FLUID',
    severity: 'WARNING',
    title: 'Low Fluid Level Warning',
    description: 'Estimated time to empty is 12 minutes (20 mL left). Prepare replacement fluid bottle.',
    triggeredAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    timestampMs: Date.now() - 9 * 60 * 1000,
    workflowStatus: 'ACKNOWLEDGED_PENDING',
    isAcknowledged: true,
    acknowledgedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    acknowledgedBy: 'Nurse Sarah Chen, RN',
    acknowledgedSecondsElapsed: 30,
    isOverdue: false,
    isResolved: false,
    escalationStage: 'ACKNOWLEDGED',
    escalationSeconds: 4,
    communicationChannelUsed: 'WHATSAPP_VOICE',
    timeline: [
      { time: '10:41:00 AM', action: 'Low fluid warning triggered at 12m threshold (20 mL remaining)' },
      { time: '10:41:04 AM', action: 'Escalation Stage 1: Initiated simulated call to Nurse Sarah Chen, RN' },
      { time: '10:41:05 AM', action: 'Acknowledged by Nurse Sarah Chen, RN. Status: Acknowledged – Intervention Pending.' },
    ],
  },
  {
    id: 'ALT-B04-HIGHFLOW',
    bedId: 'bed-04',
    bedNumber: 'Bed 04',
    patientName: 'Emma Davis',
    patientMrn: 'MRN-40182',
    type: 'HIGH_FLOW',
    severity: 'WARNING',
    title: 'High Flow Rate Detected',
    description: 'Actual rate 185 mL/h exceeds prescribed 100 mL/h (+85% deviation) for >15s.',
    triggeredAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    timestampMs: Date.now() - 14 * 60 * 1000,
    workflowStatus: 'INTERVENTION_IN_PROGRESS',
    isAcknowledged: true,
    acknowledgedAt: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
    acknowledgedBy: 'Nurse Sarah Chen, RN',
    acknowledgedSecondsElapsed: 45,
    isOverdue: false,
    isResolved: false,
    intervention: {
      interventionType: 'Recalibrate roller clamp to prescribed 100 mL/h',
      notes: 'Bedside roller clamp inspection and rate recalibration in progress.',
      startedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      nurseName: 'Nurse Sarah Chen, RN',
    },
    escalationStage: 'ACKNOWLEDGED',
    escalationSeconds: 4,
    communicationChannelUsed: 'WHATSAPP_VOICE',
    timeline: [
      { time: '10:36:00 AM', action: 'High flow rate alert generated: 185 mL/h (+85% deviation)' },
      { time: '10:36:04 AM', action: 'Acknowledged by Nurse Sarah Chen, RN. Status: Acknowledged – Intervention Pending.' },
      { time: '10:38:00 AM', action: 'Nurse Sarah Chen, RN commenced clinical intervention at bedside.' },
    ],
  },
  {
    id: 'ALT-B05-LOWFLOW',
    bedId: 'bed-05',
    bedNumber: 'Bed 05',
    patientName: 'Noah Wilson',
    patientMrn: 'MRN-50731',
    type: 'LOW_FLOW',
    severity: 'WARNING',
    title: 'Low Flow Rate Detected',
    description: 'Actual rate 55 mL/h below prescribed 100 mL/h (-45% deviation) for >15s.',
    triggeredAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    timestampMs: Date.now() - 18 * 60 * 1000,
    workflowStatus: 'ACTIVE_UNACKNOWLEDGED',
    isAcknowledged: false,
    acknowledgedSecondsElapsed: 0,
    isOverdue: false,
    isResolved: false,
    escalationStage: 'CALLING_DUTY_NURSE',
    escalationSeconds: 6,
    communicationChannelUsed: 'WHATSAPP_VOICE',
    timeline: [
      { time: '10:32:00 AM', action: 'Low flow rate alert generated: 55 mL/h (-45% deviation)' },
      { time: '10:32:04 AM', action: 'Escalation Stage 1: Initiated call to Duty Nurse' },
    ],
  },
  {
    id: 'ALT-B01-PREV',
    bedId: 'bed-01',
    bedNumber: 'Bed 01',
    patientName: 'Alex Morgan',
    patientMrn: 'MRN-10142',
    type: 'LOW_FLUID',
    severity: 'WARNING',
    title: 'Low Fluid Level Warning',
    description: 'Scheduled bag replacement completed and verified safe.',
    triggeredAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    timestampMs: Date.now() - 40 * 60 * 1000,
    workflowStatus: 'RESOLVED_VERIFIED',
    isAcknowledged: true,
    acknowledgedAt: new Date(Date.now() - 39 * 60 * 1000).toISOString(),
    acknowledgedBy: 'Nurse Sarah Chen, RN',
    acknowledgedSecondsElapsed: 240,
    isOverdue: false,
    isResolved: true,
    resolvedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    resolvedBy: 'Nurse Sarah Chen, RN',
    verifiedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    verifiedBy: 'Nurse Sarah Chen, RN',
    escalationStage: 'RESOLVED',
    escalationSeconds: 5,
    communicationChannelUsed: 'WHATSAPP_VOICE',
    timeline: [
      { time: '10:10:00 AM', action: 'Low fluid warning triggered at 15m threshold' },
      { time: '10:10:05 AM', action: 'Acknowledged by Nurse Sarah Chen, RN' },
      { time: '10:14:00 AM', action: 'Replacement bottle hung' },
      { time: '10:15:00 AM', action: 'Verification Passed: Remaining volume (420 mL) confirmed safe. Alert resolved.' },
    ],
  },
];

const SEED_EVENTS: EventLogEntry[] = [
  {
    id: 'evt-seed-1',
    timestamp: new Date(Date.now() - 50 * 60 * 1000).toLocaleTimeString(),
    timestampMs: Date.now() - 50 * 60 * 1000,
    bedNumber: 'System',
    eventType: 'INFUSION_STARTED',
    severity: 'SUCCESS',
    message: 'Ward 4B multi-bed infusion monitoring network initialized.',
    details: '6 active IV stations online. Real-time telemetry optical sensor streaming active.',
  },
  {
    id: 'evt-seed-2',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toLocaleTimeString(),
    timestampMs: Date.now() - 42 * 60 * 1000,
    bedNumber: 'Bed 04',
    eventType: 'LOW_FLUID_WARNING',
    severity: 'WARNING',
    message: 'Low Fluid Level Warning: 14 min remaining in bag',
    details: 'Volume depleted to 18 mL at 60 mL/h delivery rate.',
    alertId: 'ALT-109401',
  },
  {
    id: 'evt-seed-3',
    timestamp: new Date(Date.now() - 41 * 60 * 1000).toLocaleTimeString(),
    timestampMs: Date.now() - 41 * 60 * 1000,
    bedNumber: 'Bed 04',
    eventType: 'ALERT_ACKNOWLEDGED',
    severity: 'INFO',
    message: 'Alert ALT-109401 acknowledged by Nurse Sarah Chen, RN. Intervention pending.',
    alertId: 'ALT-109401',
  },
  {
    id: 'evt-seed-3b',
    timestamp: new Date(Date.now() - 36 * 60 * 1000).toLocaleTimeString(),
    timestampMs: Date.now() - 36 * 60 * 1000,
    bedNumber: 'Bed 04',
    eventType: 'INTERVENTION_RECORDED',
    severity: 'SUCCESS',
    message: 'Bedside intervention recorded: Replaced IV fluid container with 1000 mL bag.',
    alertId: 'ALT-109401',
  },
  {
    id: 'evt-seed-4',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toLocaleTimeString(),
    timestampMs: Date.now() - 35 * 60 * 1000,
    bedNumber: 'Bed 04',
    eventType: 'VERIFICATION_PASSED',
    severity: 'SUCCESS',
    message: 'Verification passed: Remaining fluid volume confirmed safe. Alert resolved.',
    alertId: 'ALT-109401',
  },
];

export interface SimulationContextType {
  beds: BedData[];
  selectedBedId: string;
  selectedBed: BedData;
  settings: SystemSettings;
  activeShift: ShiftType;
  activeResponders: EscalationResponder[];
  activeTimeouts: EscalationTimeouts;
  simulatedCallVolume: number;
  activeStaffingLevel: number;
  activeCallResponseTime: number;
  autoNurseResponseEnabled: boolean;
  alerts: AlertItem[];
  activeAlerts: AlertItem[];
  eventHistory: EventLogEntry[];
  telemetryHistory: TelemetryPoint[];
  buzzerActive: boolean;
  activeCall: ActiveCallState | null;
  currentSimulatedTime: Date;
  isSimulationRunning: boolean;
  demoScenario: DemoScenarioState;

  // Intervention Modal Control
  activeInterventionAlert: AlertItem | null;
  openInterventionModal: (alert: AlertItem) => void;
  closeInterventionModal: () => void;

  // Controls
  setSelectedBedId: (id: string) => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  resetSettingsToDefault: () => void;
  toggleShift: () => void;
  setActiveShift: (shift: ShiftType) => void;
  setSimulatedCallVolume: (volume: number) => void;
  triggerScenario: (scenario: ScenarioType, bedId?: string) => void;
  setBedFaultCondition: (bedId: string, condition: BedFaultCondition) => void;
  getBedTelemetry: (bedId: string) => TelemetryPoint[];
  startInfusion: (bedId?: string) => void;
  pauseInfusion: (bedId?: string) => void;
  resumeInfusion: (bedId?: string) => void;
  stopInfusion: (bedId?: string) => void;
  resetSimulation: (bedId?: string) => void;
  setFlowRateManual: (rate: number, bedId?: string) => void;
  setRemainingVolumeManual: (volume: number, bedId?: string) => void;

  // Global Engine Controls
  startSimulationEngine: () => void;
  pauseSimulationEngine: () => void;
  resumeSimulationEngine: () => void;
  stopSimulationEngine: () => void;
  resetSimulationEngine: () => void;
  runDemoScenario: () => void;
  stopDemoScenario: () => void;

  // Separated Alert Actions
  acknowledgeAlert: (alertId: string, responderName?: string) => void;
  beginIntervention: (alertId: string, responderName?: string) => void;
  recordIntervention: (
    alertId: string,
    interventionType: string,
    notes?: string,
    nurseName?: string,
    appliedActionId?: string
  ) => void;
  verifyAlertResolution: (
    alertId: string,
    nurseName?: string
  ) => { passed: boolean; message: string };
  resolveAlert: (alertId: string, resolutionNotes?: string) => void;
  dismissCallModal: () => void;
  silenceBuzzer: () => void;
  clearEventHistory: (purgeAll?: boolean) => void;

  // Patient / Bed Management
  updateBedPatient: (
    bedId: string,
    patientData: Partial<BedData['patient']>,
    fluidData?: Partial<BedData['fluid']>,
    prescribedRate?: number
  ) => void;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load settings from localStorage
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('dripconnect_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          activeShift: parsed.activeShift || 'DAY',
          simulatedCallVolume: parsed.simulatedCallVolume ?? (parsed.activeShift === 'NIGHT' ? 45 : 80),
          dayShiftResponders: parsed.dayShiftResponders || DEFAULT_DAY_RESPONDERS,
          nightShiftResponders: parsed.nightShiftResponders || DEFAULT_NIGHT_RESPONDERS,
          dayShiftTimeouts: parsed.dayShiftTimeouts || { stage1: 4, stage2: 14, stage3: 28 },
          nightShiftTimeouts: parsed.nightShiftTimeouts || { stage1: 3, stage2: 10, stage3: 20 },
          responders:
            (parsed.activeShift === 'NIGHT' ? parsed.nightShiftResponders : parsed.dayShiftResponders) ||
            DEFAULT_DAY_RESPONDERS,
          dayStaffingLevel: parsed.dayStaffingLevel ?? 100,
          nightStaffingLevel: parsed.nightStaffingLevel ?? 45,
          dayCallResponseTimeSec: parsed.dayCallResponseTimeSec ?? 4,
          nightCallResponseTimeSec: parsed.nightCallResponseTimeSec ?? 10,
          autoNurseResponseEnabled: parsed.autoNurseResponseEnabled ?? true,
          interventionOverdueThresholdSec: parsed.interventionOverdueThresholdSec ?? 60,
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [beds, setBeds] = useState<BedData[]>(() => {
    try {
      const saved = localStorage.getItem('dripconnect_beds_ward_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6 && parsed[0]?.patient?.name === 'Alex Morgan') {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_BEDS;
  });

  const [selectedBedId, setSelectedBedId] = useState<string>('bed-01');
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(true);

  // Load alerts from localStorage with realistic initial seed
  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    try {
      const saved = localStorage.getItem('dripconnect_alerts_ward_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.some(a => a.patientName === 'Daniel Thomas' || a.patientName === 'Sarah Wilson')) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return SEED_ALERTS;
  });

  const [buzzerActive, setBuzzerActive] = useState<boolean>(false);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [activeInterventionAlert, setActiveInterventionAlert] = useState<AlertItem | null>(null);
  const [simulatedTime, setSimulatedTime] = useState<Date>(new Date());

  // Load event history from localStorage with realistic initial seed
  const [eventHistory, setEventHistory] = useState<EventLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('dripconnect_events');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return SEED_EVENTS;
  });

  // Telemetry buffer for charts for each bed
  const [bedTelemetryHistory, setBedTelemetryHistory] = useState<Record<string, TelemetryPoint[]>>(() => {
    const initialMap: Record<string, TelemetryPoint[]> = {};
    const now = Date.now();
    INITIAL_BEDS.forEach(b => {
      const pts: TelemetryPoint[] = [];
      for (let i = 24; i >= 0; i--) {
        const t = new Date(now - i * 1000);
        pts.push({
          timeLabel: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestampMs: now - i * 1000,
          prescribedRate: b.prescribedRate,
          actualRate: b.actualRate,
          remainingVolume: b.remainingVolume,
          initialVolume: b.initialVolume,
          dropsPerMin: b.dropRate,
        });
      }
      initialMap[b.id] = pts;
    });
    return initialMap;
  });

  const getBedTelemetry = useCallback((bedId: string) => {
    return bedTelemetryHistory[bedId] || [];
  }, [bedTelemetryHistory]);

  const telemetryHistory = bedTelemetryHistory[selectedBedId] || [];

  // Demo Scenario State (12-step guided demonstration)
  const [demoScenario, setDemoScenario] = useState<DemoScenarioState>({
    isActive: false,
    currentStep: 0,
    totalSteps: 12,
    stepName: '',
    stepDescription: '',
    secondsRemainingInStep: 0,
  });

  const tickCounterRef = useRef<number>(0);

  // Save settings when changed
  useEffect(() => {
    try {
      localStorage.setItem('dripconnect_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Save event history when changed
  useEffect(() => {
    try {
      localStorage.setItem('dripconnect_events', JSON.stringify(eventHistory.slice(0, 150)));
    } catch {
      // ignore
    }
  }, [eventHistory]);

  // Save beds when changed
  useEffect(() => {
    try {
      localStorage.setItem('dripconnect_beds_ward_v5', JSON.stringify(beds));
    } catch {
      // ignore
    }
  }, [beds]);

  // Save alerts when changed
  useEffect(() => {
    try {
      localStorage.setItem('dripconnect_alerts_ward_v5', JSON.stringify(alerts.slice(0, 50)));
    } catch {
      // ignore
    }
  }, [alerts]);

  const addEvent = useCallback(
    (
      eventType: EventLogEntry['eventType'],
      severity: EventLogEntry['severity'],
      bedNumber: string,
      message: string,
      details?: string,
      alertId?: string,
      responsibleStaff?: string
    ) => {
      const newEntry: EventLogEntry = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        timestampMs: Date.now(),
        bedNumber,
        eventType,
        severity,
        message,
        details,
        alertId,
        responsibleStaff,
      };
      setEventHistory(prev => [newEntry, ...prev]);
    },
    []
  );

  const activeShift = settings.activeShift || 'DAY';
  const activeResponders =
    activeShift === 'DAY'
      ? settings.dayShiftResponders || DEFAULT_DAY_RESPONDERS
      : settings.nightShiftResponders || DEFAULT_NIGHT_RESPONDERS;
  const activeTimeouts =
    activeShift === 'DAY'
      ? settings.dayShiftTimeouts || { stage1: 4, stage2: 14, stage3: 28 }
      : settings.nightShiftTimeouts || { stage1: 3, stage2: 10, stage3: 20 };
  const simulatedCallVolume = settings.simulatedCallVolume ?? (activeShift === 'DAY' ? 80 : 45);
  const activeStaffingLevel =
    activeShift === 'DAY' ? settings.dayStaffingLevel ?? 100 : settings.nightStaffingLevel ?? 45;
  const activeCallResponseTime =
    activeShift === 'DAY' ? settings.dayCallResponseTimeSec ?? 4 : settings.nightCallResponseTimeSec ?? 10;
  const autoNurseResponseEnabled = settings.autoNurseResponseEnabled ?? true;

  const toggleShift = useCallback(() => {
    const nextShift: ShiftType = settings.activeShift === 'DAY' ? 'NIGHT' : 'DAY';
    const nextCallVolume = nextShift === 'NIGHT' ? 45 : 80;
    const nextStaffing =
      nextShift === 'NIGHT' ? settings.nightStaffingLevel ?? 45 : settings.dayStaffingLevel ?? 100;
    const nextResponseTime =
      nextShift === 'NIGHT' ? settings.nightCallResponseTimeSec ?? 10 : settings.dayCallResponseTimeSec ?? 4;

    setSettings(prev => ({
      ...prev,
      activeShift: nextShift,
      simulatedCallVolume: nextCallVolume,
      responders: nextShift === 'DAY' ? prev.dayShiftResponders : prev.nightShiftResponders,
    }));
    addEvent(
      'SHIFT_CHANGED',
      'INFO',
      'Shift Admin',
      `Hospital shift switched to ${nextShift === 'DAY' ? 'Day Shift (07:00 - 19:00)' : 'Night Shift (19:00 - 07:00)'}. Priority escalation list, staffing level (${nextStaffing}%), and response time (${nextResponseTime}s) updated.`,
      nextShift === 'NIGHT'
        ? `Nocturnal protocol: Reduced call acoustic volume (${nextCallVolume}%), lean on-call staffing (${nextStaffing}%), ${nextResponseTime}s response window.`
        : `Daytime protocol: Standard ward call volume (${nextCallVolume}%), full floor staffing (${nextStaffing}%), rapid ${nextResponseTime}s response window.`
    );
  }, [
    settings.activeShift,
    settings.nightStaffingLevel,
    settings.dayStaffingLevel,
    settings.nightCallResponseTimeSec,
    settings.dayCallResponseTimeSec,
    addEvent,
  ]);

  const setActiveShift = useCallback(
    (shift: ShiftType) => {
      if (settings.activeShift === shift) return;
      const nextCallVolume = shift === 'NIGHT' ? 45 : 80;
      const nextStaffing =
        shift === 'NIGHT' ? settings.nightStaffingLevel ?? 45 : settings.dayStaffingLevel ?? 100;
      const nextResponseTime =
        shift === 'NIGHT' ? settings.nightCallResponseTimeSec ?? 10 : settings.dayCallResponseTimeSec ?? 4;

      setSettings(prev => ({
        ...prev,
        activeShift: shift,
        simulatedCallVolume: nextCallVolume,
        responders: shift === 'DAY' ? prev.dayShiftResponders : prev.nightShiftResponders,
      }));
      addEvent(
        'SHIFT_CHANGED',
        'INFO',
        'Shift Admin',
        `Hospital shift set to ${shift === 'DAY' ? 'Day Shift' : 'Night Shift'}. Staffing: ${nextStaffing}%, Response Time: ${nextResponseTime}s.`
      );
    },
    [
      settings.activeShift,
      settings.nightStaffingLevel,
      settings.dayStaffingLevel,
      settings.nightCallResponseTimeSec,
      settings.dayCallResponseTimeSec,
      addEvent,
    ]
  );

  const setSimulatedCallVolume = useCallback((volume: number) => {
    const clamped = Math.max(10, Math.min(100, Math.round(volume)));
    setSettings(prev => ({ ...prev, simulatedCallVolume: clamped }));
  }, []);

  const selectedBed = beds.find(b => b.id === selectedBedId) || beds[0];
  const activeAlerts = alerts.filter(a => !a.isResolved);

  // Sync buzzer audio with state
  useEffect(() => {
    const volScale = (settings.simulatedCallVolume ?? 80) / 100;
    if (buzzerActive && settings.soundNotificationsEnabled) {
      audioService.startBedsideBuzzer(true, volScale);
    } else {
      audioService.stopBedsideBuzzer();
    }
    return () => {
      audioService.stopBedsideBuzzer();
    };
  }, [buzzerActive, settings.soundNotificationsEnabled, settings.simulatedCallVolume]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const bedsRef = useRef(beds);
  bedsRef.current = beds;

  // Helper to raise alert if not duplicate
  const raiseAlert = useCallback(
    (bed: BedData, type: AlertType, severity: AlertSeverity, title: string, description: string) => {
      const existing = alertsRef.current.find(
        a => a.bedId === bed.id && a.type === type && !a.isResolved
      );
      if (existing) return;

      const newAlertId = `ALT-${Date.now().toString().slice(-6)}`;
      const nowIso = new Date().toISOString();
      const nowTime = new Date().toLocaleTimeString();

      const channelUsed = settingsRef.current.internetAvailable ? 'WHATSAPP_VOICE' : 'GSM_VOICE_AND_SMS';

      const newAlert: AlertItem = {
        id: newAlertId,
        bedId: bed.id,
        bedNumber: bed.bedNumber,
        patientName: bed.patient.name,
        patientMrn: bed.patient.mrn,
        type,
        severity,
        title,
        description,
        triggeredAt: nowIso,
        timestampMs: Date.now(),
        workflowStatus: 'ACTIVE_UNACKNOWLEDGED',
        isAcknowledged: false,
        acknowledgedSecondsElapsed: 0,
        isOverdue: false,
        isResolved: false,
        escalationStage: 'BUZZER_ACTIVE',
        escalationSeconds: 0,
        communicationChannelUsed: channelUsed,
        timeline: [
          {
            time: nowTime,
            action: `Alert generated: ${title} (${severity}) - Status: Active Unacknowledged`,
          },
          {
            time: nowTime,
            action: 'Bedside visual alarm and buzzer sounded',
          },
        ],
      };

      setAlerts(prev => [newAlert, ...prev]);
      setBuzzerActive(true);

      const callVol =
        settingsRef.current.simulatedCallVolume ?? (settingsRef.current.activeShift === 'NIGHT' ? 45 : 80);
      const volScale = callVol / 100;
      if (severity === 'CRITICAL') {
        audioService.playCriticalAlarm(settingsRef.current.soundNotificationsEnabled, volScale);
      } else {
        audioService.playWarningChime(settingsRef.current.soundNotificationsEnabled, volScale);
      }

      let specificEventType: EventLogEntry['eventType'] = 'ALERT_GENERATED';
      if (type === 'LOW_FLUID') specificEventType = 'LOW_FLUID_WARNING';
      else if (type === 'EMPTY_BOTTLE') specificEventType = 'EMPTY_BOTTLE_CRITICAL';
      else if (type === 'BLOCKED_LINE') specificEventType = 'BLOCKED_LINE_CRITICAL';
      else if (type === 'HIGH_FLOW') specificEventType = 'HIGH_FLOW_DETECTED';
      else if (type === 'LOW_FLOW') specificEventType = 'LOW_FLOW_DETECTED';

      addEvent(
        specificEventType,
        severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        bed.bedNumber,
        `${title}: ${description}`,
        `Alert ID: ${newAlertId}`,
        newAlertId
      );
    },
    [addEvent]
  );

  // Escalation ticker, call sequence, and overdue response timer
  useEffect(() => {
    if (!isSimulationRunning) return;

    const timer = setInterval(() => {
      setSimulatedTime(new Date());

      setAlerts(prevAlerts => {
        let anyBuzzerActive = false;
        let callToTrigger: ActiveCallState | null = null;

        const currentShift = settingsRef.current.activeShift || 'DAY';
        const currentResponders =
          currentShift === 'DAY'
            ? settingsRef.current.dayShiftResponders || DEFAULT_DAY_RESPONDERS
            : settingsRef.current.nightShiftResponders || DEFAULT_NIGHT_RESPONDERS;
        const timeouts =
          currentShift === 'DAY'
            ? settingsRef.current.dayShiftTimeouts || { stage1: 4, stage2: 14, stage3: 28 }
            : settingsRef.current.nightShiftTimeouts || { stage1: 3, stage2: 10, stage3: 20 };
        const callVol = settingsRef.current.simulatedCallVolume ?? (currentShift === 'NIGHT' ? 45 : 80);
        const volScale = callVol / 100;
        const currentStaffing =
          currentShift === 'NIGHT'
            ? settingsRef.current.nightStaffingLevel ?? 45
            : settingsRef.current.dayStaffingLevel ?? 100;
        const currentResponseTime =
          currentShift === 'NIGHT'
            ? settingsRef.current.nightCallResponseTimeSec ?? 10
            : settingsRef.current.dayCallResponseTimeSec ?? 4;
        const overdueThreshold = settingsRef.current.interventionOverdueThresholdSec ?? 60;

        const updated = prevAlerts.map(alert => {
          if (alert.isResolved) {
            return alert;
          }

          // Keep buzzer sounding for unacknowledged critical alerts
          if (!alert.isAcknowledged) {
            anyBuzzerActive = true;
          }

          const updatedTimeline = [...alert.timeline];

          // 1. If Acknowledged but Unresolved: Track acknowledgedSecondsElapsed & check overdue threshold
          if (alert.isAcknowledged && !alert.isResolved) {
            const newAckSec = (alert.acknowledgedSecondsElapsed || 0) + 1;
            let isOverdue = alert.isOverdue || false;
            let overdueNotified = alert.overdueNotified || false;

            if (newAckSec >= overdueThreshold) {
              isOverdue = true;
              if (!overdueNotified) {
                overdueNotified = true;
                const supervisor = currentResponders[2];
                updatedTimeline.push({
                  time: new Date().toLocaleTimeString(),
                  action: `Overdue Warning (${newAckSec}s): Clinical intervention deadline exceeded. Paging ${supervisor.role} (${supervisor.name}) according to hospital escalation policy.`,
                  staff: supervisor.name,
                });
                addEvent(
                  'INTERVENTION_OVERDUE',
                  'CRITICAL',
                  alert.bedNumber,
                  `Intervention Overdue: Alert ${alert.id} unverified for >${overdueThreshold}s after acknowledgement. Paged ${supervisor.role} (${supervisor.name}).`,
                  `Acknowledged by: ${alert.acknowledgedBy || 'Duty Nurse'}`,
                  alert.id,
                  supervisor.name
                );
              }
            }

            return {
              ...alert,
              acknowledgedSecondsElapsed: newAckSec,
              isOverdue,
              overdueNotified,
              timeline: updatedTimeline,
            };
          }

          // 2. If Unacknowledged: Run Notification Escalation Stages 1, 2, 3
          const newSec = alert.escalationSeconds + 1;
          let newStage = alert.escalationStage;

          // Stage 1 (Duty Nurse)
          if (newSec === timeouts.stage1) {
            newStage = 'CALLING_DUTY_NURSE';
            const responder = currentResponders[0];
            const channel = settingsRef.current.internetAvailable ? 'WHATSAPP_VOICE' : 'GSM_VOICE_AND_SMS';
            const channelName = channel === 'WHATSAPP_VOICE' ? 'WhatsApp Voice Call' : 'GSM Voice Call + SMS';
            updatedTimeline.push({
              time: new Date().toLocaleTimeString(),
              action: `Escalation Stage 1 (${currentShift} Shift · ${currentStaffing}% Staffing): Initiated simulated ${channelName} to ${responder.role} (${responder.name})`,
              staff: responder.name,
            });
            callToTrigger = {
              alertId: alert.id,
              responder,
              stageName: `Stage 1 · ${responder.role} (${currentShift} Shift)`,
              stageNumber: 1,
              secondsElapsed: 0,
              channel,
              isRinging: true,
              alertTitle: alert.title,
              bedNumber: alert.bedNumber,
              patientName: alert.patientName,
              shift: currentShift,
              simulatedCallVolume: callVol,
              staffingLevelPct: currentStaffing,
              targetResponseTimeSec: currentResponseTime,
              callStatus: 'RINGING',
            };
            audioService.playPhoneRing(settingsRef.current.soundNotificationsEnabled, volScale);
            addEvent(
              'NURSE_NOTIFIED',
              'WARNING',
              alert.bedNumber,
              `Nurse notification initiated: Dispatched simulated ${channelName} to ${responder.role} (${responder.name})`,
              `Alert ID: ${alert.id}`,
              alert.id,
              responder.name
            );
          }
          // Stage 2 (Ward Attendant / Nocturnist)
          else if (newSec === timeouts.stage2) {
            newStage = 'CALLING_WARD_ATTENDANT';
            const responder = currentResponders[1];
            const channel = settingsRef.current.internetAvailable ? 'WHATSAPP_VOICE' : 'GSM_VOICE_AND_SMS';
            const channelName = channel === 'WHATSAPP_VOICE' ? 'WhatsApp Voice Call' : 'GSM Voice Call + SMS';
            updatedTimeline.push({
              time: new Date().toLocaleTimeString(),
              action: `Escalation Stage 2 (${currentShift} Shift · ${currentStaffing}% Staffing): Unacknowledged after ${timeouts.stage2}s. Escalating via ${channelName} to ${responder.role} (${responder.name})`,
              staff: responder.name,
            });
            callToTrigger = {
              alertId: alert.id,
              responder,
              stageName: `Stage 2 · ${responder.role} (${currentShift} Shift Fallback)`,
              stageNumber: 2,
              secondsElapsed: 0,
              channel,
              isRinging: true,
              alertTitle: alert.title,
              bedNumber: alert.bedNumber,
              patientName: alert.patientName,
              shift: currentShift,
              simulatedCallVolume: callVol,
              staffingLevelPct: currentStaffing,
              targetResponseTimeSec: currentResponseTime,
              callStatus: 'RINGING',
            };
            audioService.playPhoneRing(settingsRef.current.soundNotificationsEnabled, volScale);
            addEvent(
              'ESCALATION_TRIGGERED',
              'CRITICAL',
              alert.bedNumber,
              `Escalation Stage 2: Alert unacknowledged after ${timeouts.stage2}s. Escalating to ${responder.role} (${responder.name})`,
              `Alert ID: ${alert.id}`,
              alert.id,
              responder.name
            );
          }
          // Stage 3 (Senior Nurse / House Supervisor)
          else if (newSec === timeouts.stage3) {
            newStage = 'CALLING_SENIOR_NURSE';
            const responder = currentResponders[2];
            const channel = settingsRef.current.internetAvailable ? 'WHATSAPP_VOICE' : 'GSM_VOICE_AND_SMS';
            const channelName =
              channel === 'WHATSAPP_VOICE' ? 'WhatsApp Priority Voice' : 'GSM Emergency Call + Priority SMS';
            updatedTimeline.push({
              time: new Date().toLocaleTimeString(),
              action: `Escalation Stage 3 (${currentShift} Shift · ${currentStaffing}% Staffing): Critical timeout after ${timeouts.stage3}s. High-priority dispatch to ${responder.role} (${responder.name})`,
              staff: responder.name,
            });
            callToTrigger = {
              alertId: alert.id,
              responder,
              stageName: `Stage 3 · ${responder.role} (${currentShift} Shift Supervisor)`,
              stageNumber: 3,
              secondsElapsed: 0,
              channel,
              isRinging: true,
              alertTitle: alert.title,
              bedNumber: alert.bedNumber,
              patientName: alert.patientName,
              shift: currentShift,
              simulatedCallVolume: callVol,
              staffingLevelPct: currentStaffing,
              targetResponseTimeSec: currentResponseTime,
              callStatus: 'RINGING',
            };
            audioService.playPhoneRing(settingsRef.current.soundNotificationsEnabled, volScale);
            addEvent(
              'ESCALATION_TRIGGERED',
              'CRITICAL',
              alert.bedNumber,
              `Escalation Stage 3: Maximum escalation reached. Contacting ${responder.role} (${responder.name})`,
              `Alert ID: ${alert.id}`,
              alert.id,
              responder.name
            );
          }

          return {
            ...alert,
            escalationSeconds: newSec,
            escalationStage: newStage,
            timeline: updatedTimeline,
          };
        });

        if (callToTrigger) {
          setActiveCall(callToTrigger);
        }

        setBuzzerActive(anyBuzzerActive);
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSimulationRunning, addEvent]);

  // Update ongoing active call seconds counter and handle automated nurse response
  useEffect(() => {
    if (!activeCall) return;
    const interval = setInterval(() => {
      setActiveCall(prev => {
        if (!prev) return null;
        const nextSec = prev.secondsElapsed + 1;

        if (
          prev.callStatus === 'RINGING' &&
          settingsRef.current.autoNurseResponseEnabled &&
          nextSec >= prev.targetResponseTimeSec
        ) {
          const isNight = prev.shift === 'NIGHT';
          const shiftNotice = isNight
            ? `Overnight on-call clinician answered via nocturnal pager in ${nextSec}s (${prev.staffingLevelPct}% night staffing).`
            : `Day floor clinician answered via ward intercom in ${nextSec}s (${prev.staffingLevelPct}% day staffing).`;

          const voiceSnippet = isNight
            ? `"${prev.responder.name} (${prev.responder.role}): Pager alert received for ${prev.bedNumber}. Notification acknowledged; preparing bedside response."`
            : `"${prev.responder.name} (${prev.responder.role}): Copy ${prev.bedNumber} alarm. Notification acknowledged; dispatching to bedside."`;

          audioService.playAcknowledgeTone(settingsRef.current.soundNotificationsEnabled);

          return {
            ...prev,
            secondsElapsed: nextSec,
            callStatus: 'CONNECTED',
            connectedMessage: `${voiceSnippet} · ${shiftNotice}`,
          };
        }

        return { ...prev, secondsElapsed: nextSec };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  // Main Infusion Physics Simulation loop
  useEffect(() => {
    if (!isSimulationRunning) return;

    const speed = settings.simulationSpeedMultiplier || 1;
    const interval = setInterval(() => {
      tickCounterRef.current += 1;
      const tick = tickCounterRef.current;

      setBeds(prevBeds => {
        return prevBeds.map(bed => {
          if (!bed.isActive || bed.isPaused) {
            return bed;
          }

          const dt = 1 * speed;
          let newActualRate = bed.actualRate;
          let newRemainingVolume = bed.remainingVolume;
          let newInfusedVolume = bed.infusedVolume;
          let newNoDropSec = bed.noDropDurationSec;
          let newAbnormalFlowSec = bed.abnormalFlowDurationSec;

          // Flow calculations
          if (newActualRate > 0 && newRemainingVolume > 0) {
            const volumeDelivered = (newActualRate / 3600) * dt;
            newRemainingVolume = Math.max(0, newRemainingVolume - volumeDelivered);
            newInfusedVolume = bed.initialVolume - newRemainingVolume;
            newNoDropSec = 0;
          } else {
            newNoDropSec += dt;
          }

          const dropsPerMin =
            newActualRate > 0 && newRemainingVolume > 0
              ? Math.round((newActualRate * bed.dropFactor) / 60)
              : 0;

          let timeToEmpty: number | null = null;
          if (newActualRate > 0 && newRemainingVolume > 0) {
            timeToEmpty = Math.round((newRemainingVolume / newActualRate) * 60);
          } else if (newRemainingVolume === 0) {
            timeToEmpty = 0;
          }

          // Flow deviation checks
          const tolerance = settingsRef.current.flowRateDeviationTolerancePct / 100;
          const maxAllowed = bed.prescribedRate * (1 + tolerance);
          const minAllowed = bed.prescribedRate * (1 - tolerance);

          if (newActualRate > 0 && (newActualRate > maxAllowed || newActualRate < minAllowed)) {
            newAbnormalFlowSec += dt;
          } else if (newActualRate === bed.prescribedRate) {
            newAbnormalFlowSec = 0;
          }

          let status: BedData['status'] = 'NORMAL';
          if (newRemainingVolume === 0) {
            status = 'CRITICAL';
          } else if (newNoDropSec >= settingsRef.current.blockedLineDurationThresholdSec) {
            status = 'CRITICAL';
          } else if (
            timeToEmpty !== null &&
            timeToEmpty <= settingsRef.current.lowFluidWarningMinutesThreshold
          ) {
            status = 'WARNING';
          } else if (newAbnormalFlowSec >= settingsRef.current.abnormalFlowDurationThresholdSec) {
            status = 'WARNING';
          }

          const updatedBed: BedData = {
            ...bed,
            remainingVolume: Math.round(newRemainingVolume * 10) / 10,
            infusedVolume: Math.round(newInfusedVolume * 10) / 10,
            dropRate: dropsPerMin,
            timeToEmptyMinutes: timeToEmpty,
            noDropDurationSec: newNoDropSec,
            abnormalFlowDurationSec: newAbnormalFlowSec,
            status,
          };

          // Continuous Abnormality Detection Triggers:
          if (newRemainingVolume === 0) {
            raiseAlert(
              updatedBed,
              'EMPTY_BOTTLE',
              'CRITICAL',
              'Empty Infusion Bottle',
              `Fluid reservoir depleted (0 mL remaining). Infusion stopped automatically to prevent air embolism.`
            );
          } else if (newNoDropSec >= settingsRef.current.blockedLineDurationThresholdSec) {
            raiseAlert(
              updatedBed,
              'BLOCKED_LINE',
              'CRITICAL',
              'Blocked or Kinked IV Line',
              `No drops registered by optical sensor for ${Math.round(newNoDropSec)} seconds. Verify clamp and line patency.`
            );
          } else if (
            timeToEmpty !== null &&
            timeToEmpty <= settingsRef.current.lowFluidWarningMinutesThreshold &&
            timeToEmpty > 0
          ) {
            raiseAlert(
              updatedBed,
              'LOW_FLUID',
              'WARNING',
              'Low Fluid Level Warning',
              `Estimated time to empty is ${timeToEmpty} minutes (${Math.round(newRemainingVolume)} mL left). Prepare replacement bag.`
            );
          } else if (
            newAbnormalFlowSec >= settingsRef.current.abnormalFlowDurationThresholdSec &&
            newActualRate > maxAllowed
          ) {
            raiseAlert(
              updatedBed,
              'HIGH_FLOW',
              'WARNING',
              'High Flow Rate Detected',
              `Actual rate ${newActualRate} mL/h exceeds prescribed ${bed.prescribedRate} mL/h (+${Math.round(((newActualRate - bed.prescribedRate) / bed.prescribedRate) * 100)}%) for over ${Math.round(newAbnormalFlowSec)}s.`
            );
          } else if (
            newAbnormalFlowSec >= settingsRef.current.abnormalFlowDurationThresholdSec &&
            newActualRate < minAllowed &&
            newActualRate > 0
          ) {
            raiseAlert(
              updatedBed,
              'LOW_FLOW',
              'WARNING',
              'Low Flow Rate Detected',
              `Actual rate ${newActualRate} mL/h is below prescribed ${bed.prescribedRate} mL/h (-${Math.round(((bed.prescribedRate - newActualRate) / bed.prescribedRate) * 100)}%) for over ${Math.round(newAbnormalFlowSec)}s.`
            );
          }

          return updatedBed;
        });
      });

      // Periodic flow reading log every 20 seconds of continuous infusion
      if (tick % 20 === 0) {
        const primary = beds.find(b => b.isDemoPrimary) || beds[0];
        if (primary && primary.isActive && !primary.isPaused && primary.actualRate > 0) {
          addEvent(
            'FLOW_READING_RECORDED',
            'INFO',
            primary.bedNumber,
            `Continuous Telemetry Reading: Actual flow ${primary.actualRate} mL/h (${primary.dropRate} gtt/min), ${Math.round(primary.remainingVolume)} mL remaining.`,
            `Status: ${primary.status}`
          );
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulationRunning, settings.simulationSpeedMultiplier, raiseAlert, beds, addEvent]);

  // Update telemetry graph data points for ALL beds independently
  useEffect(() => {
    if (!isSimulationRunning) return;

    const tick = tickCounterRef.current;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nowMs = Date.now();

    setBedTelemetryHistory(prevMap => {
      const updatedMap = { ...prevMap };
      beds.forEach((bed, idx) => {
        const microVar =
          bed.actualRate > 0 && bed.status === 'NORMAL' ? Math.sin(tick * 0.4 + idx) * 0.8 : 0;
        const computedActual = Math.max(0, Math.round((bed.actualRate + microVar) * 10) / 10);
        const pt: TelemetryPoint = {
          timeLabel: nowTime,
          timestampMs: nowMs,
          prescribedRate: bed.prescribedRate,
          actualRate: computedActual,
          remainingVolume: Math.round(bed.remainingVolume * 10) / 10,
          initialVolume: bed.initialVolume,
          dropsPerMin: bed.dropRate,
        };
        const prevPts = updatedMap[bed.id] || [];
        updatedMap[bed.id] = [...prevPts.slice(-34), pt];
      });
      return updatedMap;
    });
  }, [beds, isSimulationRunning]);

  // Bed-level Fault Simulation Control (Normal, Low Fluid, Blocked Line, High Flow, Low Flow, Empty Bottle)
  const setBedFaultCondition = useCallback(
    (bedId: string, condition: BedFaultCondition) => {
      setBeds(prevBeds =>
        prevBeds.map(b => {
          if (b.id !== bedId) return b;

          let actualRate = b.actualRate;
          let remainingVolume = b.remainingVolume;
          let noDropDurationSec = b.noDropDurationSec;
          let abnormalFlowDurationSec = b.abnormalFlowDurationSec;
          let status: BedData['status'] = b.status;
          let timeToEmptyMinutes = b.timeToEmptyMinutes;

          if (condition === 'NORMAL') {
            actualRate = b.prescribedRate;
            remainingVolume = remainingVolume < 60 ? 420 : remainingVolume;
            noDropDurationSec = 0;
            abnormalFlowDurationSec = 0;
            status = 'NORMAL';
            timeToEmptyMinutes = actualRate > 0 ? Math.round((remainingVolume / actualRate) * 60) : null;
          } else if (condition === 'LOW_FLUID') {
            remainingVolume = 20;
            actualRate = b.prescribedRate;
            noDropDurationSec = 0;
            abnormalFlowDurationSec = 0;
            timeToEmptyMinutes = 12;
            status = 'WARNING';
          } else if (condition === 'EMPTY_BOTTLE') {
            remainingVolume = 0;
            actualRate = 0;
            noDropDurationSec = 28;
            abnormalFlowDurationSec = 0;
            timeToEmptyMinutes = 0;
            status = 'CRITICAL';
          } else if (condition === 'BLOCKED_LINE') {
            actualRate = 0;
            noDropDurationSec = 22;
            abnormalFlowDurationSec = 0;
            timeToEmptyMinutes = null;
            status = 'CRITICAL';
          } else if (condition === 'HIGH_FLOW') {
            actualRate = 185;
            abnormalFlowDurationSec = 16;
            noDropDurationSec = 0;
            status = 'WARNING';
            timeToEmptyMinutes = Math.round((remainingVolume / 185) * 60);
          } else if (condition === 'LOW_FLOW') {
            actualRate = 55;
            abnormalFlowDurationSec = 16;
            noDropDurationSec = 0;
            status = 'WARNING';
            timeToEmptyMinutes = Math.round((remainingVolume / 55) * 60);
          }

          const dropRate =
            actualRate > 0 && remainingVolume > 0
              ? Math.round((actualRate * b.dropFactor) / 60)
              : 0;

          return {
            ...b,
            faultCondition: condition,
            activeScenarioId: condition,
            actualRate,
            remainingVolume,
            dropRate,
            noDropDurationSec,
            abnormalFlowDurationSec,
            status,
            timeToEmptyMinutes,
            isActive: true,
            isPaused: false,
          };
        })
      );

      const targetBed = bedsRef.current.find(b => b.id === bedId);
      const bedLabel = targetBed?.bedNumber || bedId;
      const patientLabel = targetBed?.patient.name || '';

      addEvent(
        'FAULT_SIMULATION_UPDATED' as any,
        condition === 'NORMAL'
          ? 'SUCCESS'
          : condition === 'EMPTY_BOTTLE' || condition === 'BLOCKED_LINE'
          ? 'CRITICAL'
          : 'WARNING',
        bedLabel,
        `Ward Fault Condition: Applied ${condition.replace('_', ' ')} on ${bedLabel} (${patientLabel})`,
        `Independent simulation parameters adjusted for unit ${bedLabel}.`
      );
    },
    [addEvent]
  );

  // Trigger Scenario (for backwards compatibility)
  const triggerScenario = useCallback(
    (scenario: ScenarioType, bedId = 'bed-01') => {
      setBedFaultCondition(bedId, scenario as BedFaultCondition);
    },
    [setBedFaultCondition]
  );

  // Bed-level Controls
  const startInfusion = useCallback(
    (bedId = 'bed-01') => {
      setBeds(prev =>
        prev.map(b => {
          if (b.id === bedId) {
            return {
              ...b,
              isActive: true,
              isPaused: false,
              actualRate: b.actualRate === 0 ? b.prescribedRate : b.actualRate,
              status: 'NORMAL',
            };
          }
          return b;
        })
      );
      addEvent('INFUSION_STARTED', 'SUCCESS', bedId === 'bed-01' ? 'Bed 01' : bedId, 'Infusion delivery started.');
    },
    [addEvent]
  );

  const pauseInfusion = useCallback(
    (bedId = 'bed-01') => {
      setBeds(prev => prev.map(b => (b.id === bedId ? { ...b, isPaused: true, status: 'PAUSED' } : b)));
      addEvent(
        'INFUSION_PAUSED',
        'INFO',
        bedId === 'bed-01' ? 'Bed 01' : bedId,
        'Infusion delivery paused by clinician.'
      );
    },
    [addEvent]
  );

  const resumeInfusion = useCallback(
    (bedId = 'bed-01') => {
      setBeds(prev => prev.map(b => (b.id === bedId ? { ...b, isPaused: false, status: 'NORMAL' } : b)));
      addEvent('INFUSION_RESUMED', 'INFO', bedId === 'bed-01' ? 'Bed 01' : bedId, 'Infusion delivery resumed.');
    },
    [addEvent]
  );

  const stopInfusion = useCallback(
    (bedId = 'bed-01') => {
      setBeds(prev =>
        prev.map(b =>
          b.id === bedId ? { ...b, isActive: false, isPaused: false, actualRate: 0, status: 'STOPPED' } : b
        )
      );
      addEvent('INFUSION_STOPPED', 'INFO', bedId === 'bed-01' ? 'Bed 01' : bedId, 'Infusion stopped.');
    },
    [addEvent]
  );

  const resetSimulation = useCallback(
    (bedId = 'bed-01') => {
      setBeds(prev =>
        prev.map(b => {
          if (b.id === bedId) {
            const dropRate = Math.round((b.prescribedRate * b.dropFactor) / 60);
            return {
              ...b,
              prescribedRate: 100,
              actualRate: 100,
              initialVolume: 500,
              remainingVolume: 420,
              infusedVolume: 80,
              dropRate,
              timeToEmptyMinutes: 252,
              status: 'NORMAL',
              isActive: true,
              isPaused: false,
              noDropDurationSec: 0,
              abnormalFlowDurationSec: 0,
              activeScenarioId: 'NORMAL',
              faultCondition: 'NORMAL',
            };
          }
          return b;
        })
      );

      const target = bedsRef.current.find(b => b.id === bedId);
      const bedNum = target?.bedNumber || bedId;

      addEvent(
        'SIMULATION_RESET',
        'INFO',
        bedNum,
        `Unit ${bedNum} parameters reset to normal baseline. Other ward beds unchanged.`
      );
    },
    [addEvent]
  );

  const setFlowRateManual = useCallback((rate: number, bedId = 'bed-06') => {
    setBeds(prev => prev.map(b => (b.id === bedId ? { ...b, actualRate: Math.max(0, rate) } : b)));
  }, []);

  const setRemainingVolumeManual = useCallback((volume: number, bedId = 'bed-06') => {
    setBeds(prev =>
      prev.map(b => {
        if (b.id === bedId) {
          const clamped = Math.max(0, volume);
          return {
            ...b,
            remainingVolume: clamped,
            infusedVolume: Math.max(0, b.initialVolume - clamped),
          };
        }
        return b;
      })
    );
  }, []);

  // ==========================================
  // SEPARATED WORKFLOW IMPLEMENTATION:
  // 1. ACKNOWLEDGE (Does NOT resolve!)
  // 2. BEGIN INTERVENTION
  // 3. RECORD INTERVENTION
  // 4. VERIFY RESOLUTION (Live Telemetry Check)
  // ==========================================

  // Step 1: Acknowledge Alert (Stops notification escalation, changes status to ACKNOWLEDGED_PENDING)
  const acknowledgeAlert = useCallback(
    (alertId: string, responderName?: string) => {
      const responder = responderName || settingsRef.current.responders[0].name;
      const nowTime = new Date().toLocaleTimeString();

      setAlerts(prev =>
        prev.map(a => {
          if (a.id === alertId) {
            return {
              ...a,
              workflowStatus: 'ACKNOWLEDGED_PENDING' as AlertWorkflowStatus,
              isAcknowledged: true,
              acknowledgedAt: new Date().toISOString(),
              acknowledgedBy: responder,
              acknowledgedSecondsElapsed: 0,
              isOverdue: false,
              escalationStage: 'ACKNOWLEDGED',
              timeline: [
                ...a.timeline,
                {
                  time: nowTime,
                  action: `Alert acknowledged by ${responder}. Notification received. IV condition NOT yet verified as resolved (Intervention Pending).`,
                  staff: responder,
                },
              ],
            };
          }
          return a;
        })
      );

      // Stop bedside buzzer and phone ringing for this acknowledged alert
      setBuzzerActive(false);
      audioService.stopBedsideBuzzer();
      audioService.playAcknowledgeTone(settingsRef.current.soundNotificationsEnabled);

      addEvent(
        'ALERT_ACKNOWLEDGED',
        'INFO',
        'Alert Centre',
        `Alert ${alertId} acknowledged by ${responder}. Notification received; bedside intervention pending.`,
        'Condition remains unverified.',
        alertId,
        responder
      );
    },
    [addEvent]
  );

  // Step 2: Begin Intervention (Transitions alert to INTERVENTION_IN_PROGRESS)
  const beginIntervention = useCallback(
    (alertId: string, responderName?: string) => {
      const responder = responderName || settingsRef.current.responders[0].name;
      const nowTime = new Date().toLocaleTimeString();

      setAlerts(prev =>
        prev.map(a => {
          if (a.id === alertId) {
            return {
              ...a,
              workflowStatus: 'INTERVENTION_IN_PROGRESS' as AlertWorkflowStatus,
              intervention: {
                interventionType: a.intervention?.interventionType || 'Bedside attendance initiated',
                startedAt: new Date().toISOString(),
                nurseName: responder,
              },
              timeline: [
                ...a.timeline,
                {
                  time: nowTime,
                  action: `Nurse ${responder} commenced bedside clinical intervention. Status: Intervention in Progress.`,
                  staff: responder,
                },
              ],
            };
          }
          return a;
        })
      );

      addEvent(
        'INTERVENTION_STARTED',
        'INFO',
        'Bedside',
        `Intervention started for alert ${alertId} by ${responder}.`,
        'Bedside evaluation in progress.',
        alertId,
        responder
      );
    },
    [addEvent]
  );

  // Step 3: Record Intervention (Documents action and applies physical simulated corrective actions if selected)
  const recordIntervention = useCallback(
    (
      alertId: string,
      interventionType: string,
      notes?: string,
      nurseName?: string,
      appliedActionId?: string
    ) => {
      const responder = nurseName || settingsRef.current.responders[0].name;
      const nowTime = new Date().toLocaleTimeString();

      let targetBedId = '';

      setAlerts(prev =>
        prev.map(a => {
          if (a.id === alertId) {
            targetBedId = a.bedId;
            return {
              ...a,
              workflowStatus: 'INTERVENTION_IN_PROGRESS' as AlertWorkflowStatus,
              intervention: {
                interventionType,
                notes,
                recordedAt: new Date().toISOString(),
                nurseName: responder,
                appliedActionId,
              },
              timeline: [
                ...a.timeline,
                {
                  time: nowTime,
                  action: `Bedside clinical intervention recorded: "${interventionType}". ${notes ? `Notes: ${notes}` : ''}`,
                  staff: responder,
                },
              ],
            };
          }
          return a;
        })
      );

      // If nurse executed an explicit simulated physical action, update bed physics state
      if (targetBedId && appliedActionId) {
        setBeds(prev =>
          prev.map(b => {
            if (b.id === targetBedId) {
              if (appliedActionId === 'REPLACE_BAG_500') {
                return {
                  ...b,
                  remainingVolume: 500,
                  initialVolume: 500,
                  infusedVolume: 0,
                  actualRate: b.prescribedRate,
                  dropRate: Math.round((b.prescribedRate * b.dropFactor) / 60),
                  status: 'NORMAL',
                  isActive: true,
                  isPaused: false,
                  noDropDurationSec: 0,
                  abnormalFlowDurationSec: 0,
                  activeScenarioId: 'NORMAL',
                };
              } else if (appliedActionId === 'REPLACE_BAG_1000') {
                return {
                  ...b,
                  remainingVolume: 1000,
                  initialVolume: 1000,
                  infusedVolume: 0,
                  actualRate: b.prescribedRate,
                  dropRate: Math.round((b.prescribedRate * b.dropFactor) / 60),
                  status: 'NORMAL',
                  isActive: true,
                  isPaused: false,
                  noDropDurationSec: 0,
                  abnormalFlowDurationSec: 0,
                  activeScenarioId: 'NORMAL',
                };
              } else if (appliedActionId === 'CLEAR_KINK') {
                return {
                  ...b,
                  noDropDurationSec: 0,
                  actualRate: b.prescribedRate,
                  dropRate: Math.round((b.prescribedRate * b.dropFactor) / 60),
                  status: 'NORMAL',
                  isActive: true,
                  isPaused: false,
                  activeScenarioId: 'NORMAL',
                };
              } else if (appliedActionId === 'RECALIBRATE_RATE') {
                return {
                  ...b,
                  actualRate: b.prescribedRate,
                  dropRate: Math.round((b.prescribedRate * b.dropFactor) / 60),
                  abnormalFlowDurationSec: 0,
                  status: 'NORMAL',
                  isActive: true,
                  isPaused: false,
                  activeScenarioId: 'NORMAL',
                };
              }
            }
            return b;
          })
        );
      }

      addEvent(
        'INTERVENTION_RECORDED',
        'SUCCESS',
        'Bedside',
        `Intervention recorded for alert ${alertId}: ${interventionType}. Pending sensor verification.`,
        notes,
        alertId,
        responder
      );
    },
    [addEvent]
  );

  // Step 4: Verify Infusion Status (Reads LIVE telemetry; only resolves if abnormal condition has truly cleared)
  const verifyAlertResolution = useCallback(
    (alertId: string, nurseName?: string) => {
      const responder = nurseName || settingsRef.current.responders[0].name;
      const nowTime = new Date().toLocaleTimeString();

      const targetAlert = alertsRef.current.find(a => a.id === alertId);
      if (!targetAlert) {
        return { passed: false, message: 'Alert record not found.' };
      }

      const targetBed = bedsRef.current.find(b => b.id === targetAlert.bedId) || bedsRef.current[0];

      // Perform strict telemetry checks against the original alert type
      let passed = true;
      let failureReason = '';

      if (targetAlert.type === 'LOW_FLUID') {
        const warningThreshold = settingsRef.current.lowFluidWarningMinutesThreshold;
        if (targetBed.remainingVolume <= 50 || (targetBed.timeToEmptyMinutes !== null && targetBed.timeToEmptyMinutes <= warningThreshold)) {
          passed = false;
          failureReason = `Remaining fluid volume (${Math.round(targetBed.remainingVolume)} mL, ${targetBed.timeToEmptyMinutes ?? 0}m to empty) is still below safe threshold (>${warningThreshold}m required). Replacement bag has not been hung.`;
        }
      } else if (targetAlert.type === 'EMPTY_BOTTLE') {
        if (targetBed.remainingVolume <= 0 || targetBed.actualRate <= 0 || !targetBed.isActive) {
          passed = false;
          failureReason = `Fluid reservoir remains empty (${Math.round(targetBed.remainingVolume)} mL) and delivery is stopped. Fresh IV container must be primed and attached.`;
        }
      } else if (targetAlert.type === 'BLOCKED_LINE') {
        if (targetBed.noDropDurationSec > 0 || targetBed.actualRate <= 0 || targetBed.dropRate <= 0) {
          passed = false;
          failureReason = `Optical drip chamber registers 0 drops/min (occlusion timer at ${Math.round(targetBed.noDropDurationSec)}s). Tubing obstruction or catheter kink has not been cleared.`;
        }
      } else if (targetAlert.type === 'HIGH_FLOW' || targetAlert.type === 'LOW_FLOW') {
        const tolerance = settingsRef.current.flowRateDeviationTolerancePct / 100;
        const maxAllowed = targetBed.prescribedRate * (1 + tolerance);
        const minAllowed = targetBed.prescribedRate * (1 - tolerance);
        if (targetBed.actualRate > maxAllowed || targetBed.actualRate < minAllowed || targetBed.actualRate === 0) {
          passed = false;
          failureReason = `Actual flow rate (${targetBed.actualRate} mL/h) remains outside ±${settingsRef.current.flowRateDeviationTolerancePct}% tolerance of prescribed rate (${targetBed.prescribedRate} mL/h).`;
        }
      }

      // Add VERIFICATION_ATTEMPTED event
      addEvent(
        'VERIFICATION_ATTEMPTED',
        passed ? 'SUCCESS' : 'WARNING',
        targetBed.bedNumber,
        `Verification attempted for alert ${alertId}: ${passed ? 'PASSED' : 'FAILED'}.`,
        failureReason || 'All telemetry parameters verified within acceptable clinical parameters.',
        alertId,
        responder
      );

      if (!passed) {
        // Record failure in alert timeline
        setAlerts(prev =>
          prev.map(a => {
            if (a.id === alertId) {
              return {
                ...a,
                lastVerification: {
                  verifiedAt: nowTime,
                  nurseName: responder,
                  passed: false,
                  message: failureReason,
                },
                timeline: [
                  ...a.timeline,
                  {
                    time: nowTime,
                    action: `Verification Failed: ${failureReason}. Alert remains active.`,
                    staff: responder,
                  },
                ],
              };
            }
            return a;
          })
        );
        addEvent(
          'VERIFICATION_FAILED',
          'WARNING',
          targetBed.bedNumber,
          `Intervention incomplete – abnormal condition still detected: ${failureReason}`,
          'Alert remains active.',
          alertId,
          responder
        );
        return {
          passed: false,
          message: failureReason,
        };
      }

      // If Verification PASSED: Mark as RESOLVED_VERIFIED
      setAlerts(prev =>
        prev.map(a => {
          if (a.id === alertId) {
            return {
              ...a,
              workflowStatus: 'RESOLVED_VERIFIED' as AlertWorkflowStatus,
              isResolved: true,
              resolvedAt: new Date().toISOString(),
              resolvedBy: responder,
              verifiedAt: new Date().toISOString(),
              verifiedBy: responder,
              isOverdue: false,
              escalationStage: 'RESOLVED',
              lastVerification: {
                verifiedAt: nowTime,
                nurseName: responder,
                passed: true,
                message: 'All infusion parameters verified within acceptable clinical tolerances.',
              },
              timeline: [
                ...a.timeline,
                {
                  time: nowTime,
                  action: `Resolution Verified: Bedside intervention verified by ${responder}. Status: Resolved – Verification Passed.`,
                  staff: responder,
                },
              ],
            };
          }
          return a;
        })
      );

      // Return bed to normal state
      setBeds(prev =>
        prev.map(b => {
          if (b.id === targetAlert.bedId) {
            return {
              ...b,
              status: 'NORMAL',
              activeScenarioId: 'NORMAL',
              noDropDurationSec: 0,
              abnormalFlowDurationSec: 0,
            };
          }
          return b;
        })
      );

      setBuzzerActive(false);
      audioService.stopBedsideBuzzer();

      addEvent(
        'VERIFICATION_PASSED',
        'SUCCESS',
        targetBed.bedNumber,
        `Verification passed for alert ${alertId}. Safe baseline infusion verified.`,
        'Status: Resolved – Verification Passed.',
        alertId,
        responder
      );

      addEvent(
        'ALERT_RESOLVED',
        'SUCCESS',
        targetBed.bedNumber,
        `Alert ${alertId} resolved and verified by ${responder}.`,
        'Intervention successfully completed.',
        alertId,
        responder
      );

      return {
        passed: true,
        message: 'Verification passed. Abnormal condition cleared and parameters within safe limits. Alert resolved.',
      };
    },
    [addEvent]
  );

  // Legacy or Direct Resolution fallback
  const resolveAlert = useCallback(
    (alertId: string, resolutionNotes?: string) => {
      // First attempt verification
      const verifyRes = verifyAlertResolution(alertId, 'Duty Nurse');
      if (!verifyRes.passed) {
        // If bed hasn't been physically restored, restore it then pass verification
        const targetAlert = alertsRef.current.find(a => a.id === alertId);
        if (targetAlert) {
          recordIntervention(alertId, 'Clinical line repositioning and fluid verification', resolutionNotes, 'Duty Nurse', 'CLEAR_KINK');
          verifyAlertResolution(alertId, 'Duty Nurse');
        }
      }
    },
    [verifyAlertResolution, recordIntervention]
  );

  const dismissCallModal = useCallback(() => {
    setActiveCall(null);
  }, []);

  const silenceBuzzer = useCallback(() => {
    setBuzzerActive(false);
    audioService.stopBedsideBuzzer();
  }, []);

  const clearEventHistory = useCallback((purgeAll = false) => {
    setEventHistory([]);
    try {
      localStorage.removeItem('dripconnect_events');
      if (purgeAll) {
        setAlerts([]);
        localStorage.removeItem('dripconnect_alerts');
        setTelemetryHistory([]);
        localStorage.removeItem('dripconnect_telemetry');
      }
    } catch {
      // ignore
    }
  }, []);

  const openInterventionModal = useCallback((alert: AlertItem) => {
    setActiveInterventionAlert(alert);
  }, []);

  const closeInterventionModal = useCallback(() => {
    setActiveInterventionAlert(null);
  }, []);

  const updateSettings = useCallback(
    (newSettings: Partial<SystemSettings>) => {
      setSettings(prev => ({ ...prev, ...newSettings }));
      addEvent('SETTINGS_UPDATED', 'INFO', 'System', 'System configuration updated.');
    },
    [addEvent]
  );

  const resetSettingsToDefault = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    addEvent('SETTINGS_UPDATED', 'INFO', 'System', 'System configuration reset to factory defaults.');
  }, [addEvent]);

  const updateBedPatient = useCallback(
    (
      bedId: string,
      patientData: Partial<BedData['patient']>,
      fluidData?: Partial<BedData['fluid']>,
      prescribedRate?: number
    ) => {
      setBeds(prev =>
        prev.map(b => {
          if (b.id === bedId) {
            return {
              ...b,
              patient: { ...b.patient, ...patientData },
              fluid: fluidData ? { ...b.fluid, ...fluidData } : b.fluid,
              prescribedRate: prescribedRate !== undefined ? prescribedRate : b.prescribedRate,
              actualRate: prescribedRate !== undefined ? prescribedRate : b.actualRate,
            };
          }
          return b;
        })
      );
      addEvent(
        'SETTINGS_UPDATED',
        'INFO',
        bedId === 'bed-06' ? 'Bed 06' : bedId,
        'Patient and infusion parameters modified.'
      );
    },
    [addEvent]
  );

  // Global Engine Controls
  const startSimulationEngine = useCallback(() => {
    setIsSimulationRunning(true);
    setBeds(prev => prev.map(b => (b.isDemoPrimary ? { ...b, isActive: true, isPaused: false } : b)));
    addEvent('INFUSION_RESUMED', 'INFO', 'System', 'Simulation engine started. Continuous telemetry stream active.');
  }, [addEvent]);

  const pauseSimulationEngine = useCallback(() => {
    setIsSimulationRunning(false);
    audioService.stopBedsideBuzzer();
    addEvent('INFUSION_PAUSED', 'INFO', 'System', 'Simulation engine paused.');
  }, [addEvent]);

  const resumeSimulationEngine = useCallback(() => {
    setIsSimulationRunning(true);
    addEvent('INFUSION_RESUMED', 'INFO', 'System', 'Simulation engine resumed.');
  }, [addEvent]);

  const stopSimulationEngine = useCallback(() => {
    setIsSimulationRunning(false);
    setBeds(prev =>
      prev.map(b =>
        b.isDemoPrimary ? { ...b, isActive: false, isPaused: false, actualRate: 0, status: 'STOPPED' } : b
      )
    );
    setBuzzerActive(false);
    setActiveCall(null);
    audioService.stopBedsideBuzzer();
    addEvent('INFUSION_STOPPED', 'INFO', 'Bed 06', 'Infusion delivery stopped.');
  }, [addEvent]);

  const resetSimulationEngine = useCallback(() => {
    resetSimulation('bed-06');
    setIsSimulationRunning(true);
  }, [resetSimulation]);

  // 12-Step Guided Automated Demo Scenario Updated for Separated Workflow
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const demoActiveAlertIdRef = useRef<string | null>(null);

  const stopDemoScenario = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setDemoScenario({
      isActive: false,
      currentStep: 0,
      totalSteps: 12,
      stepName: '',
      stepDescription: '',
      secondsRemainingInStep: 0,
    });
    setBuzzerActive(false);
    setActiveCall(null);
    audioService.stopBedsideBuzzer();
    addEvent('DEMO_SCENARIO_STEP', 'INFO', 'Demo Lead', 'Guided 12-step demo scenario stopped by user.');
  }, [addEvent]);

  const runDemoScenario = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    setIsSimulationRunning(true);
    setSelectedBedId('bed-06');

    const steps = [
      {
        step: 1,
        name: 'Start Normal Infusion',
        desc: 'Bed 06 initialized to nominal 100 mL/h baseline with 0.9% Normal Saline.',
        duration: 3,
        action: () => {
          setBeds(prev =>
            prev.map(b =>
              b.id === 'bed-06'
                ? {
                    ...b,
                    prescribedRate: 100,
                    actualRate: 100,
                    remainingVolume: 420,
                    initialVolume: 500,
                    status: 'NORMAL',
                    isActive: true,
                    isPaused: false,
                    noDropDurationSec: 0,
                    abnormalFlowDurationSec: 0,
                  }
                : b
            )
          );
          addEvent('INFUSION_STARTED', 'SUCCESS', 'Bed 06', 'Step 1/12: Normal infusion delivery initiated at 100 mL/h.');
        },
      },
      {
        step: 2,
        name: 'Generate Flow-Rate Readings',
        desc: 'Optical drip sensor recording steady nominal drop rate of 33 gtt/min (100.2 mL/h).',
        duration: 3,
        action: () => {
          addEvent(
            'FLOW_READING_RECORDED',
            'INFO',
            'Bed 06',
            'Step 2/12: Optical sensor telemetry confirms nominal flow: 100.4 mL/h (33 drops/min).'
          );
        },
      },
      {
        step: 3,
        name: 'Gradually Decrease Fluid Volume',
        desc: 'Simulating accelerated fluid delivery; reservoir drops to 120 mL to test depletion tracking.',
        duration: 3,
        action: () => {
          setBeds(prev =>
            prev.map(b => (b.id === 'bed-06' ? { ...b, remainingVolume: 120, infusedVolume: 380 } : b))
          );
          addEvent(
            'FLOW_READING_RECORDED',
            'INFO',
            'Bed 06',
            'Step 3/12: Reservoir volume tracking updated to 120 mL remaining (24% remaining).'
          );
        },
      },
      {
        step: 4,
        name: 'Simulate High-Flow Condition',
        desc: 'Infusion rate surges to 160 mL/h (+60% above prescribed 100 mL/h), breaching safe tolerance.',
        duration: 3,
        action: () => {
          setBeds(prev =>
            prev.map(b =>
              b.id === 'bed-06'
                ? { ...b, actualRate: 160, dropRate: 53, abnormalFlowDurationSec: 16 }
                : b
            )
          );
          addEvent(
            'HIGH_FLOW_DETECTED',
            'WARNING',
            'Bed 06',
            'Step 4/12: High flow condition detected: 160 mL/h (+60% above prescribed limit).'
          );
        },
      },
      {
        step: 5,
        name: 'Generate Flow Warning Alert',
        desc: 'Abnormal flow duration threshold (15s) exceeded. System generates amber Warning alert and chime.',
        duration: 3,
        action: () => {
          const alertId = `ALT-DEMO-${Date.now().toString().slice(-4)}`;
          demoActiveAlertIdRef.current = alertId;
          const newAlert: AlertItem = {
            id: alertId,
            bedId: 'bed-06',
            bedNumber: 'Bed 06',
            patientName: 'Alexander Sterling',
            patientMrn: 'MRN-84920',
            type: 'HIGH_FLOW',
            severity: 'WARNING',
            title: 'High Flow Rate Detected',
            description: 'Actual rate 160 mL/h exceeds prescribed 100 mL/h (+60%) for over 15s.',
            triggeredAt: new Date().toISOString(),
            timestampMs: Date.now(),
            workflowStatus: 'ACTIVE_UNACKNOWLEDGED',
            isAcknowledged: false,
            acknowledgedSecondsElapsed: 0,
            isOverdue: false,
            isResolved: false,
            escalationStage: 'BUZZER_ACTIVE',
            escalationSeconds: 0,
            communicationChannelUsed: 'WHATSAPP_VOICE',
            timeline: [{ time: new Date().toLocaleTimeString(), action: 'Warning alert generated: High Flow Rate' }],
          };
          setAlerts(prev => [newAlert, ...prev]);
          audioService.playWarningChime(true, 0.8);
          addEvent(
            'ALERT_GENERATED',
            'WARNING',
            'Bed 06',
            'Step 5/12: Flow warning alert generated: Over-infusion detected.',
            `Alert ID: ${alertId}`,
            alertId
          );
        },
      },
      {
        step: 6,
        name: 'Simulate Blocked IV Line',
        desc: 'Simulating line occlusion / tube kinking. Optical drop chamber registers 0 drops/min.',
        duration: 3,
        action: () => {
          setBeds(prev =>
            prev.map(b =>
              b.id === 'bed-06'
                ? { ...b, actualRate: 0, dropRate: 0, noDropDurationSec: 22, status: 'CRITICAL' }
                : b
            )
          );
          addEvent(
            'BLOCKED_LINE_CRITICAL',
            'CRITICAL',
            'Bed 06',
            'Step 6/12: Blocked line condition: 0 drops/min for >20 seconds.'
          );
        },
      },
      {
        step: 7,
        name: 'Generate Critical Alert',
        desc: 'No-drop occlusion threshold breached. Red Critical alert & bedside buzzer alarm activated.',
        duration: 3,
        action: () => {
          const alertId = `ALT-DEMO-${Date.now().toString().slice(-4)}`;
          demoActiveAlertIdRef.current = alertId;
          const newAlert: AlertItem = {
            id: alertId,
            bedId: 'bed-06',
            bedNumber: 'Bed 06',
            patientName: 'Alexander Sterling',
            patientMrn: 'MRN-84920',
            type: 'BLOCKED_LINE',
            severity: 'CRITICAL',
            title: 'Blocked or Kinked IV Line',
            description: 'No drops registered by optical sensor for 22 seconds. Verify clamp and line patency.',
            triggeredAt: new Date().toISOString(),
            timestampMs: Date.now(),
            workflowStatus: 'ACTIVE_UNACKNOWLEDGED',
            isAcknowledged: false,
            acknowledgedSecondsElapsed: 0,
            isOverdue: false,
            isResolved: false,
            escalationStage: 'BUZZER_ACTIVE',
            escalationSeconds: 0,
            communicationChannelUsed: 'WHATSAPP_VOICE',
            timeline: [
              { time: new Date().toLocaleTimeString(), action: 'Critical occlusion alert generated' },
              { time: new Date().toLocaleTimeString(), action: 'Bedside visual alarm and buzzer sounded' },
            ],
          };
          setAlerts(prev => [newAlert, ...prev]);
          setBuzzerActive(true);
          audioService.playCriticalAlarm(true, 0.8);
          addEvent(
            'BLOCKED_LINE_CRITICAL',
            'CRITICAL',
            'Bed 06',
            'Step 7/12: Critical alert triggered: Blocked or kinked IV line. Bedside buzzer sounding.',
            `Alert ID: ${alertId}`,
            alertId
          );
        },
      },
      {
        step: 8,
        name: 'Initiate Nurse Notification',
        desc: 'Escalation Stage 1 activated. Automated WhatsApp voice call dispatched to Duty Nurse.',
        duration: 4,
        action: () => {
          const resp = activeResponders[0];
          const callState: ActiveCallState = {
            alertId: demoActiveAlertIdRef.current || 'ALT-DEMO',
            responder: resp,
            stageName: `Stage 1 · ${resp.role}`,
            stageNumber: 1,
            secondsElapsed: 0,
            channel: 'WHATSAPP_VOICE',
            isRinging: true,
            alertTitle: 'Blocked or Kinked IV Line',
            bedNumber: 'Bed 06',
            patientName: 'Alexander Sterling',
            shift: activeShift,
            simulatedCallVolume: 80,
            staffingLevelPct: activeStaffingLevel,
            targetResponseTimeSec: 3,
            callStatus: 'RINGING',
          };
          setActiveCall(callState);
          audioService.playPhoneRing(true, 0.8);
          addEvent(
            'NURSE_NOTIFIED',
            'WARNING',
            'Bed 06',
            `Step 8/12: Escalation Stage 1: Dispatched simulated WhatsApp voice call to ${resp.role} (${resp.name}).`,
            `Alert ID: ${demoActiveAlertIdRef.current}`,
            demoActiveAlertIdRef.current || undefined,
            resp.name
          );
        },
      },
      {
        step: 9,
        name: 'Demonstrate Escalation',
        desc: 'Duty nurse unacknowledged timeout elapsed. Protocol escalates to Stage 2 (Ward Attendant).',
        duration: 4,
        action: () => {
          const resp = activeResponders[1];
          const callState: ActiveCallState = {
            alertId: demoActiveAlertIdRef.current || 'ALT-DEMO',
            responder: resp,
            stageName: `Stage 2 · ${resp.role}`,
            stageNumber: 2,
            secondsElapsed: 0,
            channel: 'WHATSAPP_VOICE',
            isRinging: true,
            alertTitle: 'Blocked or Kinked IV Line (Escalated)',
            bedNumber: 'Bed 06',
            patientName: 'Alexander Sterling',
            shift: activeShift,
            simulatedCallVolume: 80,
            staffingLevelPct: activeStaffingLevel,
            targetResponseTimeSec: 3,
            callStatus: 'RINGING',
          };
          setActiveCall(callState);
          audioService.playPhoneRing(true, 0.8);
          addEvent(
            'ESCALATION_TRIGGERED',
            'CRITICAL',
            'Bed 06',
            `Step 9/12: Escalation Stage 2: Alert unacknowledged; escalating to ${resp.role} (${resp.name}).`,
            `Alert ID: ${demoActiveAlertIdRef.current}`,
            demoActiveAlertIdRef.current || undefined,
            resp.name
          );
        },
      },
      {
        step: 10,
        name: 'Acknowledge Alert (Intervention Pending)',
        desc: 'Nurse acknowledges notification. Alert transitions to "Acknowledged – Intervention Pending". Problem NOT resolved.',
        duration: 4,
        action: () => {
          if (demoActiveAlertIdRef.current) {
            acknowledgeAlert(demoActiveAlertIdRef.current, activeResponders[1].name);
          }
          setActiveCall(null);
          addEvent(
            'ALERT_ACKNOWLEDGED',
            'INFO',
            'Bed 06',
            `Step 10/12: Alert acknowledged by ${activeResponders[1].name}. Notification confirmed. Bedside intervention pending.`,
            `Alert ID: ${demoActiveAlertIdRef.current}`,
            demoActiveAlertIdRef.current || undefined,
            activeResponders[1].name
          );
        },
      },
      {
        step: 11,
        name: 'Intervention & Sensor Verification',
        desc: 'Nurse straightens kinked line, records intervention, and performs mandatory sensor verification.',
        duration: 4,
        action: () => {
          if (demoActiveAlertIdRef.current) {
            beginIntervention(demoActiveAlertIdRef.current, 'Nurse Sarah Chen, RN');
            recordIntervention(
              demoActiveAlertIdRef.current,
              'Inspect IV tubing, straighten kinks, and clear mechanical occlusion',
              'Patient arm repositioned; tubing unkinked and flowing freely.',
              'Nurse Sarah Chen, RN',
              'CLEAR_KINK'
            );
            verifyAlertResolution(demoActiveAlertIdRef.current, 'Nurse Sarah Chen, RN');
          }
          addEvent(
            'VERIFICATION_PASSED',
            'SUCCESS',
            'Bed 06',
            'Step 11/12: Bedside intervention verified: 33 gtt/min resumed. Alert marked Resolved – Verification Passed.',
            `Alert ID: ${demoActiveAlertIdRef.current}`,
            demoActiveAlertIdRef.current || undefined,
            'Nurse Sarah Chen, RN'
          );
        },
      },
      {
        step: 12,
        name: 'Resume Normal Monitoring',
        desc: 'Bed 06 restored to nominal 100 mL/h baseline infusion. Continuous real-time monitoring active.',
        duration: 3,
        action: () => {
          setBeds(prev =>
            prev.map(b =>
              b.id === 'bed-06'
                ? {
                    ...b,
                    actualRate: 100,
                    prescribedRate: 100,
                    remainingVolume: 390,
                    status: 'NORMAL',
                    isActive: true,
                    isPaused: false,
                    noDropDurationSec: 0,
                    abnormalFlowDurationSec: 0,
                    activeScenarioId: 'NORMAL',
                  }
                : b
            )
          );
          addEvent(
            'INFUSION_RESUMED',
            'SUCCESS',
            'Bed 06',
            'Step 12/12: Guided demonstration completed. Bed 06 running smoothly at nominal 100 mL/h.'
          );
        },
      },
    ];

    let currentStepIndex = 0;
    let stepSecRemaining = steps[0].duration;

    steps[0].action();
    setDemoScenario({
      isActive: true,
      currentStep: 1,
      totalSteps: 12,
      stepName: steps[0].name,
      stepDescription: steps[0].desc,
      secondsRemainingInStep: stepSecRemaining,
    });

    demoIntervalRef.current = setInterval(() => {
      stepSecRemaining -= 1;

      if (stepSecRemaining <= 0) {
        currentStepIndex += 1;
        if (currentStepIndex >= steps.length) {
          if (demoIntervalRef.current) {
            clearInterval(demoIntervalRef.current);
            demoIntervalRef.current = null;
          }
          setDemoScenario({
            isActive: false,
            currentStep: 12,
            totalSteps: 12,
            stepName: 'Demo Completed',
            stepDescription: 'All 12 simulation stages executed successfully.',
            secondsRemainingInStep: 0,
          });
          return;
        }

        const nextStep = steps[currentStepIndex];
        stepSecRemaining = nextStep.duration;
        nextStep.action();

        setDemoScenario({
          isActive: true,
          currentStep: nextStep.step,
          totalSteps: 12,
          stepName: nextStep.name,
          stepDescription: nextStep.desc,
          secondsRemainingInStep: stepSecRemaining,
        });
      } else {
        setDemoScenario(prev => ({
          ...prev,
          secondsRemainingInStep: stepSecRemaining,
        }));
      }
    }, 1000);
  }, [
    activeResponders,
    activeShift,
    activeStaffingLevel,
    acknowledgeAlert,
    beginIntervention,
    recordIntervention,
    verifyAlertResolution,
    addEvent,
  ]);

  return (
    <SimulationContext.Provider
      value={{
        beds,
        selectedBedId,
        selectedBed,
        settings,
        activeShift,
        activeResponders,
        activeTimeouts,
        simulatedCallVolume,
        activeStaffingLevel,
        activeCallResponseTime,
        autoNurseResponseEnabled,
        alerts,
        activeAlerts,
        eventHistory,
        telemetryHistory,
        buzzerActive,
        activeCall,
        activeInterventionAlert,
        currentSimulatedTime: simulatedTime,
        isSimulationRunning,
        demoScenario,
        openInterventionModal,
        closeInterventionModal,
        setSelectedBedId,
        updateSettings,
        resetSettingsToDefault,
        toggleShift,
        setActiveShift,
        setSimulatedCallVolume,
        triggerScenario,
        setBedFaultCondition,
        getBedTelemetry,
        bedTelemetryHistory,
        startInfusion,
        pauseInfusion,
        resumeInfusion,
        stopInfusion,
        resetSimulation,
        setFlowRateManual,
        setRemainingVolumeManual,
        startSimulationEngine,
        pauseSimulationEngine,
        resumeSimulationEngine,
        stopSimulationEngine,
        resetSimulationEngine,
        runDemoScenario,
        stopDemoScenario,
        acknowledgeAlert,
        beginIntervention,
        recordIntervention,
        verifyAlertResolution,
        resolveAlert,
        dismissCallModal,
        silenceBuzzer,
        clearEventHistory,
        updateBedPatient,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};
