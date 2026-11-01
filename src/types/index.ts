export type InfusionStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'STOPPED' | 'PAUSED' | 'COMPLETED';

export type AlertSeverity = 'WARNING' | 'CRITICAL' | 'INFO';

export type AlertType = 
  | 'LOW_FLUID'
  | 'EMPTY_BOTTLE'
  | 'BLOCKED_LINE'
  | 'HIGH_FLOW'
  | 'LOW_FLOW'
  | 'SENSOR_DISCONNECT';

export interface IVFluidDetails {
  solutionName: string;
  bagCapacityMl: number;
  lotNumber: string;
  prescribedDrug?: string;
  osmolarity?: string;
}

export interface PatientInfo {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  mrn: string; // Medical Record Number
  admissionDate: string;
  attendingPhysician: string;
  diagnosis: string;
}

export type BedFaultCondition = 
  | 'NORMAL'
  | 'LOW_FLUID'
  | 'BLOCKED_LINE'
  | 'HIGH_FLOW'
  | 'LOW_FLOW'
  | 'EMPTY_BOTTLE';

export interface BedData {
  id: string;
  bedNumber: string;
  ward: string;
  isDemoPrimary: boolean;
  patient: PatientInfo;
  fluid: IVFluidDetails;
  prescribedRate: number; // mL/h
  actualRate: number; // mL/h
  dropFactor: number; // drops per mL (e.g. 20 gtt/mL)
  dropRate: number; // drops per minute
  initialVolume: number; // mL
  remainingVolume: number; // mL
  infusedVolume: number; // mL
  timeToEmptyMinutes: number | null; // null if 0 flow
  status: InfusionStatus;
  isActive: boolean;
  isPaused: boolean;
  noDropDurationSec: number;
  abnormalFlowDurationSec: number;
  activeScenarioId?: string;
  faultCondition?: BedFaultCondition;
}

export type EscalationStage = 
  | 'IDLE'
  | 'BUZZER_ACTIVE'
  | 'CALLING_DUTY_NURSE'
  | 'CALLING_WARD_ATTENDANT'
  | 'CALLING_SENIOR_NURSE'
  | 'ACKNOWLEDGED'
  | 'RESOLVED';

export interface EscalationResponder {
  id: string;
  role: 'Duty Nurse' | 'Ward Attendant' | 'Senior Nurse';
  name: string;
  phone: string;
  department: string;
  avatarColor: string;
  initials: string;
}

export type AlertWorkflowStatus = 
  | 'ACTIVE_UNACKNOWLEDGED'
  | 'ACKNOWLEDGED_PENDING'
  | 'INTERVENTION_IN_PROGRESS'
  | 'RESOLVED_VERIFIED';

export interface AlertInterventionRecord {
  interventionType: string;
  notes?: string;
  startedAt?: string;
  recordedAt?: string;
  nurseName?: string;
  appliedActionId?: string; // e.g. 'REPLACE_BAG', 'CLEAR_KINK', 'RECALIBRATE_RATE'
}

export interface AlertVerificationResult {
  verifiedAt: string;
  nurseName: string;
  passed: boolean;
  message: string;
  checkedParameters?: {
    actualRate: number;
    prescribedRate: number;
    remainingVolume: number;
    dropRate: number;
    noDropDurationSec: number;
  };
}

export interface AlertItem {
  id: string;
  bedId: string;
  bedNumber: string;
  patientName: string;
  patientMrn: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  triggeredAt: string; // ISO string
  timestampMs: number;
  workflowStatus: AlertWorkflowStatus;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgedSecondsElapsed: number; // tracks time since acknowledgment
  isOverdue: boolean; // if acknowledgedSecondsElapsed > threshold without resolution
  overdueNotified?: boolean;
  intervention?: AlertInterventionRecord;
  lastVerification?: AlertVerificationResult;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  escalationStage: EscalationStage;
  escalationSeconds: number;
  communicationChannelUsed: 'WHATSAPP_VOICE' | 'GSM_VOICE_AND_SMS';
  timeline: {
    time: string;
    action: string;
    staff?: string;
  }[];
}

export type ShiftType = 'DAY' | 'NIGHT';

export interface EscalationTimeouts {
  stage1: number; // seconds to Duty Nurse
  stage2: number; // seconds to Ward Attendant / Nocturnist
  stage3: number; // seconds to Senior Nurse / Supervisor
}

export interface EventLogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  bedNumber: string;
  eventType: 
    | 'INFUSION_STARTED'
    | 'INFUSION_PAUSED'
    | 'INFUSION_STOPPED'
    | 'INFUSION_RESUMED'
    | 'FLOW_READING_RECORDED'
    | 'LOW_FLOW_DETECTED'
    | 'HIGH_FLOW_DETECTED'
    | 'LOW_FLUID_WARNING'
    | 'EMPTY_BOTTLE_CRITICAL'
    | 'BLOCKED_LINE_CRITICAL'
    | 'ALERT_GENERATED'
    | 'NURSE_NOTIFIED'
    | 'ESCALATION_TRIGGERED'
    | 'ALERT_ACKNOWLEDGED'
    | 'INTERVENTION_STARTED'
    | 'INTERVENTION_RECORDED'
    | 'VERIFICATION_ATTEMPTED'
    | 'VERIFICATION_FAILED'
    | 'VERIFICATION_PASSED'
    | 'INTERVENTION_OVERDUE'
    | 'ALERT_RESOLVED'
    | 'SIMULATION_RESET'
    | 'SCENARIO_TRIGGERED'
    | 'DEMO_SCENARIO_STEP'
    | 'SHIFT_CHANGED'
    | 'SETTINGS_UPDATED';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  message: string;
  details?: string;
  alertId?: string;
  responsibleStaff?: string;
}

export interface DemoScenarioState {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  stepDescription: string;
  secondsRemainingInStep: number;
}

export interface TelemetryPoint {
  timeLabel: string;
  timestampMs: number;
  prescribedRate: number;
  actualRate: number;
  remainingVolume: number;
  initialVolume: number;
  dropsPerMin: number;
}

export interface SystemSettings {
  defaultPrescribedRate: number; // mL/h
  defaultInitialVolume: number; // mL
  dropFactor: number; // gtt/mL (20)
  flowRateDeviationTolerancePct: number; // 20%
  abnormalFlowDurationThresholdSec: number; // 15 sec
  blockedLineDurationThresholdSec: number; // 20 sec
  lowFluidWarningMinutesThreshold: number; // 15 minutes
  simulationSpeedMultiplier: number; // 1x, 2x, 5x, 10x
  internetAvailable: boolean; // true = WhatsApp voice call, false = GSM + SMS
  soundNotificationsEnabled: boolean;
  activeShift: ShiftType;
  simulatedCallVolume: number; // 10 to 100%
  dayShiftResponders: EscalationResponder[];
  nightShiftResponders: EscalationResponder[];
  dayShiftTimeouts: EscalationTimeouts;
  nightShiftTimeouts: EscalationTimeouts;
  responders: EscalationResponder[]; // active computed or legacy
  // Shift Management & Staffing Level configurations
  dayStaffingLevel: number; // 10 to 100% (default 100%)
  nightStaffingLevel: number; // 10 to 100% (default 45%)
  dayCallResponseTimeSec: number; // simulated nurse pickup time in seconds (default 4s)
  nightCallResponseTimeSec: number; // simulated nurse pickup time in seconds (default 10s)
  autoNurseResponseEnabled: boolean; // whether simulated nurse auto-answers call after response window
  interventionOverdueThresholdSec: number; // seconds after ack before alert is marked overdue (e.g. 60s)
}

export interface ActiveCallState {
  alertId: string;
  responder: EscalationResponder;
  stageName: string;
  stageNumber: number; // 1 = Duty Nurse, 2 = Ward Attendant / Nocturnist, 3 = Senior Nurse / Supervisor
  secondsElapsed: number;
  channel: 'WHATSAPP_VOICE' | 'GSM_VOICE_AND_SMS';
  isRinging: boolean;
  alertTitle: string;
  bedNumber: string;
  patientName: string;
  shift: ShiftType;
  simulatedCallVolume: number;
  staffingLevelPct: number;
  targetResponseTimeSec: number;
  callStatus: 'RINGING' | 'CONNECTED' | 'ACKNOWLEDGED';
  connectedMessage?: string;
}

export type ScenarioType = 
  | 'NORMAL'
  | 'LOW_FLUID'
  | 'EMPTY_BOTTLE'
  | 'BLOCKED_LINE'
  | 'HIGH_FLOW'
  | 'LOW_FLOW';

export interface SimulationScenarioConfig {
  id: ScenarioType;
  name: string;
  badge: string;
  severity: AlertSeverity | 'NORMAL';
  description: string;
  expectedBehavior: string;
  applyScenario: (bed: BedData) => Partial<BedData>;
}

// ---------------------------------------------------------------------------
// Configurable Demonstration Presets
// A preset is a named, editable sequence of steps executed by the demo
// runner against one or more beds. Steps are data (not code) so evaluators
// can build their own demonstrations without touching the engine.
// ---------------------------------------------------------------------------

export type DemoStepAction =
  | 'NONE'
  | 'RAISE_ALERT'
  | 'CALL_STAGE'
  | 'ACKNOWLEDGE'
  | 'INTERVENE_VERIFY';

export interface DemoPresetStep {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  /** Bed this step acts on. Defaults to the preset's targetBedId. */
  bedId?: string;
  /** Apply one of the built-in scenario configs (services/scenarios) to the bed. */
  scenario?: ScenarioType;
  /** Direct bed setpoints applied after the scenario (if any). */
  setpoints?: Partial<
    Pick<
      BedData,
      | 'prescribedRate'
      | 'actualRate'
      | 'dropRate'
      | 'remainingVolume'
      | 'initialVolume'
      | 'infusedVolume'
      | 'status'
      | 'noDropDurationSec'
      | 'abnormalFlowDurationSec'
      | 'isActive'
      | 'isPaused'
      | 'activeScenarioId'
    >
  >;
  action?: DemoStepAction;
  /** For RAISE_ALERT steps. */
  alertType?: AlertType;
  /** For CALL_STAGE steps: 1 = Duty Nurse, 2 = Ward Attendant, 3 = Senior Nurse. */
  callStage?: 1 | 2 | 3;
  /** For INTERVENE_VERIFY steps: corrective action applied by recordIntervention. */
  interventionActionId?: string;
  interventionType?: string;
  interventionNotes?: string;
  /** Optional event-log narration emitted when the step runs. */
  eventType?: EventLogEntry['eventType'];
  eventSeverity?: EventLogEntry['severity'];
}

export interface DemoPreset {
  id: string;
  name: string;
  description: string;
  targetBedId: string;
  steps: DemoPresetStep[];
}
