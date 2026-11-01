import React, { useState } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { AlertItem, AlertWorkflowStatus } from '../../types';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Stethoscope,
  X,
  History,
  AlertCircle,
  HelpCircle,
  Activity,
  ArrowRight,
  RefreshCw,
  Droplets,
  RotateCcw,
} from 'lucide-react';

interface InterventionModalProps {
  alert: AlertItem | null;
  onClose: () => void;
}

export const InterventionModal: React.FC<InterventionModalProps> = ({ alert, onClose }) => {
  const {
    selectedBed,
    beds,
    beginIntervention,
    recordIntervention,
    verifyAlertResolution,
    activeResponders,
    settings,
  } = useSimulation();

  if (!alert) return null;

  const associatedBed = beds.find(b => b.id === alert.bedId) || selectedBed;
  const nurseName = activeResponders[0]?.name || 'Nurse Sarah Chen, RN';

  // Local state for intervention options
  const [selectedInterventionType, setSelectedInterventionType] = useState<string>('');
  const [interventionNotes, setInterventionNotes] = useState<string>('');
  const [appliedActionMessage, setAppliedActionMessage] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    attempted: boolean;
    passed: boolean;
    message: string;
  } | null>(null);

  // Intervention options based on alert type
  const getInterventionOptions = () => {
    switch (alert.type) {
      case 'LOW_FLUID':
        return [
          {
            id: 'REPLACE_BAG_500',
            label: 'Replace IV fluid bottle (Hang new 500 mL 0.9% Normal Saline bag)',
            actionDescription: 'Hang replacement 500 mL container, spike bag, and prime drip chamber.',
            fixActionId: 'REPLACE_BAG_500',
          },
          {
            id: 'REPLACE_BAG_1000',
            label: 'Replace IV fluid bottle (Hang new 1000 mL Lactated Ringer bag)',
            actionDescription: 'Hang 1000 mL bag for extended hydration protocol.',
            fixActionId: 'REPLACE_BAG_1000',
          },
          {
            id: 'CHECK_LINE',
            label: 'Check IV line and drip chamber (Inspect without bag replacement)',
            actionDescription: 'Visual inspection only; does not replenish volume.',
            fixActionId: 'NONE',
          },
          {
            id: 'OTHER',
            label: 'Other clinical intervention (Document in notes)',
            actionDescription: 'Custom nursing note.',
            fixActionId: 'NONE',
          },
        ];
      case 'EMPTY_BOTTLE':
        return [
          {
            id: 'REPLACE_BAG_500',
            label: 'Replace IV fluid bottle & restart delivery (Hang 500 mL Saline bag)',
            actionDescription: 'Aspirate line to purge air, hang 500 mL bag, restart flow.',
            fixActionId: 'REPLACE_BAG_500',
          },
          {
            id: 'CHECK_LINE',
            label: 'Check IV cannula and vascular access patency',
            actionDescription: 'Inspect access site; does not refill reservoir.',
            fixActionId: 'NONE',
          },
          {
            id: 'OTHER',
            label: 'Other clinical intervention',
            actionDescription: 'Custom nursing note.',
            fixActionId: 'NONE',
          },
        ];
      case 'BLOCKED_LINE':
        return [
          {
            id: 'CLEAR_KINK',
            label: 'Inspect IV tubing, straighten kinks, and clear mechanical occlusion',
            actionDescription: 'Straighten pinched tubing and reposition patient arm.',
            fixActionId: 'CLEAR_KINK',
          },
          {
            id: 'FLUSH_LINE',
            label: 'Flush peripheral cannula with 5 mL sterile saline flush',
            actionDescription: 'Flush catheter to clear micro-fibrin clot.',
            fixActionId: 'CLEAR_KINK',
          },
          {
            id: 'CHECK_LINE',
            label: 'Visual inspection without tubing repositioning',
            actionDescription: 'Visual inspection only; leaves kink intact.',
            fixActionId: 'NONE',
          },
          {
            id: 'OTHER',
            label: 'Other clinical intervention',
            actionDescription: 'Custom nursing note.',
            fixActionId: 'NONE',
          },
        ];
      case 'HIGH_FLOW':
      case 'LOW_FLOW':
        return [
          {
            id: 'RECALIBRATE_RATE',
            label: `Inspect line and recalibrate flow rate to prescribed ${associatedBed.prescribedRate} mL/h`,
            actionDescription: `Adjust precision roller clamp to match prescribed ${associatedBed.prescribedRate} mL/h rate.`,
            fixActionId: 'RECALIBRATE_RATE',
          },
          {
            id: 'INSPECT_LINE',
            label: 'Inspect infusion set and check IV pole gravity height',
            actionDescription: 'Adjust pole height and inspect chamber.',
            fixActionId: 'RECALIBRATE_RATE',
          },
          {
            id: 'OTHER',
            label: 'Other clinical intervention',
            actionDescription: 'Custom nursing note.',
            fixActionId: 'NONE',
          },
        ];
      default:
        return [
          {
            id: 'STANDARD_INSPECT',
            label: 'Inspect infusion apparatus and verify line integrity',
            actionDescription: 'Standard bedside nursing assessment.',
            fixActionId: 'STANDARD',
          },
        ];
    }
  };

  const options = getInterventionOptions();

  const handleStartIntervention = () => {
    beginIntervention(alert.id, nurseName);
  };

  const handleApplySimulatedAction = (opt: typeof options[0]) => {
    setSelectedInterventionType(opt.label);
    recordIntervention(
      alert.id,
      opt.label,
      interventionNotes || opt.actionDescription,
      nurseName,
      opt.fixActionId
    );
    setAppliedActionMessage(`Simulated action performed: "${opt.label}". Telemetry updated.`);
    setVerificationFeedback(null);
  };

  const handleVerify = () => {
    const result = verifyAlertResolution(alert.id, nurseName);
    setVerificationFeedback({
      attempted: true,
      passed: result.passed,
      message: result.message,
    });
  };

  // Determine stage colors
  const isUnack = alert.workflowStatus === 'ACTIVE_UNACKNOWLEDGED';
  const isAckPending = alert.workflowStatus === 'ACKNOWLEDGED_PENDING';
  const isInProgress = alert.workflowStatus === 'INTERVENTION_IN_PROGRESS';
  const isResolved = alert.workflowStatus === 'RESOLVED_VERIFIED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden text-slate-900 max-h-[92vh] flex flex-col">
        
        {/* Top Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                {alert.bedNumber}
              </span>
              <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>
              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                alert.severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {alert.severity}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Alert ID: <strong className="font-mono text-slate-700">{alert.id}</strong> &bull; Patient: {alert.patientName} ({alert.patientMrn})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4-Step Clinical Lifecycle Progress Tracker */}
        <div className="bg-slate-100/70 border-b border-slate-200 px-5 py-2.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Mandatory Clinical Workflow: Response &rarr; Intervention &rarr; Verification</span>
            {alert.isOverdue && !isResolved && (
              <span className="text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded animate-pulse">
                Overdue ({alert.acknowledgedSecondsElapsed}s elapsed)
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs">
            {/* Step 1: Active Unacknowledged */}
            <div className={`p-2 rounded border transition-colors ${
              isUnack
                ? 'bg-red-50 border-red-300 text-red-900 font-bold'
                : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${isUnack ? 'bg-red-600 animate-ping' : 'bg-slate-400'}`} />
                <span>1. Active Alert</span>
              </div>
              <p className="text-[10px] font-normal text-slate-500 mt-0.5">Unacknowledged</p>
            </div>

            {/* Step 2: Acknowledged – Intervention Pending */}
            <div className={`p-2 rounded border transition-colors ${
              isAckPending
                ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                : alert.isAcknowledged
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${isAckPending ? 'bg-blue-600 animate-pulse' : alert.isAcknowledged ? 'bg-blue-500' : 'bg-slate-300'}`} />
                <span>2. Acknowledged</span>
              </div>
              <p className="text-[10px] font-normal text-slate-500 mt-0.5">Intervention Pending</p>
            </div>

            {/* Step 3: Intervention in Progress */}
            <div className={`p-2 rounded border transition-colors ${
              isInProgress
                ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                : alert.intervention
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${isInProgress ? 'bg-purple-600 animate-pulse' : alert.intervention ? 'bg-purple-500' : 'bg-slate-300'}`} />
                <span>3. Intervention</span>
              </div>
              <p className="text-[10px] font-normal text-slate-500 mt-0.5">Bedside In-Progress</p>
            </div>

            {/* Step 4: Resolved – Verification Passed */}
            <div className={`p-2 rounded border transition-colors ${
              isResolved
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                : 'bg-white border-slate-200 text-slate-400 opacity-60'
            }`}>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-2 h-2 rounded-full ${isResolved ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                <span>4. Verified</span>
              </div>
              <p className="text-[10px] font-normal text-slate-500 mt-0.5">Resolved &amp; Safe</p>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">

          {/* CRITICAL WARNING BANNER FOR ACKNOWLEDGED PENDING */}
          {isAckPending && (
            <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-md text-amber-950 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Alert Acknowledged &bull; IV Condition Has NOT Yet Been Verified as Resolved</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed pl-6">
                Acknowledging this alert only confirms that the notification was received by {alert.acknowledgedBy || 'the on-duty nurse'}.
                It does not prove that bedside intervention was completed. The underlying abnormal condition remains active until an intervention is performed and verified.
              </p>
            </div>
          )}

          {/* OVERDUE INTERVENTION WARNING IF APPLICABLE */}
          {alert.isOverdue && !isResolved && (
            <div className="p-3 bg-red-50 border-l-4 border-red-600 rounded-r-md text-red-950 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-red-900">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Intervention Overdue ({alert.acknowledgedSecondsElapsed}s elapsed since acknowledgement)</span>
              </div>
              <p className="text-red-800 text-[11px] leading-relaxed pl-6">
                Clinical care deadline ({settings.interventionOverdueThresholdSec ?? 60}s) exceeded. Notification has been escalated to the Nursing House Supervisor. Immediate bedside attendance is required.
              </p>
            </div>
          )}

          {/* Live Telemetry Sensor Panel */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Activity className="w-3.5 h-3.5 text-teal-600" />
                <span>Live Infusion Sensor Status ({associatedBed.bedNumber})</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                associatedBed.status === 'CRITICAL'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : associatedBed.status === 'WARNING'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                Sensor Status: {associatedBed.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Actual Flow</span>
                <span className="text-slate-900 font-bold">{associatedBed.actualRate} mL/h</span>
                <span className="text-slate-400 block text-[9px]">Prescribed: {associatedBed.prescribedRate} mL/h</span>
              </div>

              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Remaining Vol</span>
                <span className="text-slate-900 font-bold">{Math.round(associatedBed.remainingVolume)} mL</span>
                <span className="text-slate-400 block text-[9px]">Capacity: {associatedBed.initialVolume} mL</span>
              </div>

              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Drop Rate</span>
                <span className="text-slate-900 font-bold">{associatedBed.dropRate} gtt/min</span>
                <span className="text-slate-400 block text-[9px]">Factor: {associatedBed.dropFactor} gtt/mL</span>
              </div>

              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Occlusion / No-Drop</span>
                <span className={`font-bold ${associatedBed.noDropDurationSec > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {Math.round(associatedBed.noDropDurationSec)}s
                </span>
                <span className="text-slate-400 block text-[9px]">Threshold: {settings.blockedLineDurationThresholdSec}s</span>
              </div>
            </div>
          </div>

          {/* Alert Description Card */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
            <h4 className="font-semibold text-slate-800">Clinical Alert Details</h4>
            <p className="text-slate-600 leading-relaxed text-xs">
              {alert.description}
            </p>
            <div className="pt-2 border-t border-slate-200 flex flex-wrap justify-between text-slate-400 font-mono text-[10px]">
              <span>Triggered: {new Date(alert.triggeredAt).toLocaleTimeString()}</span>
              {alert.acknowledgedAt && (
                <span>Acknowledged by: {alert.acknowledgedBy} ({new Date(alert.acknowledgedAt).toLocaleTimeString()})</span>
              )}
            </div>
          </div>

          {/* WORKFLOW PHASE 1: ACTIVE UNACKNOWLEDGED -> Prompt Nurse to Acknowledge */}
          {isUnack && (
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <h4 className="font-bold text-slate-800">Nurse Response Action</h4>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                This alert is actively escalating. Acknowledge the notification to accept responsibility and proceed to bedside attendance.
              </p>
            </div>
          )}

          {/* WORKFLOW PHASE 2: ACKNOWLEDGED PENDING -> Prompt Nurse to Begin Intervention */}
          {isAckPending && (
            <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-200 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-blue-950">Bedside Clinical Attendance</h4>
                  <p className="text-blue-800 text-[11px] mt-0.5">
                    Click below when physically attending {alert.bedNumber} to initiate bedside intervention protocol.
                  </p>
                </div>
                <button
                  onClick={handleStartIntervention}
                  className="px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Begin Intervention</span>
                </button>
              </div>
            </div>
          )}

          {/* WORKFLOW PHASE 3: INTERVENTION IN PROGRESS -> Select Action, Apply, and Verify */}
          {isInProgress && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50/60 rounded-lg border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-purple-700" />
                    <h4 className="font-bold text-purple-950 text-xs">
                      Simulated Clinical Intervention Options
                    </h4>
                  </div>
                  <span className="text-[10px] text-purple-700 font-mono font-medium bg-purple-100 px-2 py-0.5 rounded">
                    Protocols for {alert.type.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-purple-900 text-[11px] leading-relaxed">
                  Select and execute the appropriate simulated bedside corrective procedure. Patient care follows hospital guidelines.
                </p>

                {/* Intervention Action Choices */}
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-md border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-purple-400 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-slate-800 block">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans block">
                          {opt.actionDescription}
                        </span>
                      </div>

                      <button
                        onClick={() => handleApplySimulatedAction(opt)}
                        className="px-2.5 py-1 rounded bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shrink-0 transition-colors shadow-xs"
                      >
                        Execute Action
                      </button>
                    </div>
                  ))}
                </div>

                {/* Optional Nurse Notes */}
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-purple-950 mb-1">
                    Nurse Clinical Notes (Optional):
                  </label>
                  <textarea
                    rows={2}
                    value={interventionNotes}
                    onChange={e => setInterventionNotes(e.target.value)}
                    placeholder="Enter observation notes (e.g. tubing unkinked, arm repositioned, bag verified with double-check)..."
                    className="w-full text-xs p-2 bg-white border border-purple-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800"
                  />
                </div>

                {appliedActionMessage && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{appliedActionMessage}</span>
                  </div>
                )}
              </div>

              {/* MANDATORY VERIFICATION SECTION */}
              <div className="p-4 bg-slate-900 text-white rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-teal-400" />
                    <h4 className="text-xs font-bold text-white tracking-wide">
                      Mandatory Infusion Verification Before Resolution
                    </h4>
                  </div>
                  <button
                    onClick={handleVerify}
                    className="px-3.5 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors shadow-xs"
                  >
                    Verify Infusion Status
                  </button>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  The system will inspect live optical drip sensor readings, delivered rate, and volume. Resolution will only be approved if telemetry parameters confirm safe clinical conditions.
                </p>

                {/* Verification Feedback Banner */}
                {verificationFeedback && (
                  <div className={`p-3 rounded-md border text-xs ${
                    verificationFeedback.passed
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-500 text-rose-200'
                  }`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {verificationFeedback.passed ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Verification Passed &bull; Safe Infusion Restored</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>Intervention Incomplete &bull; Abnormal Condition Still Detected</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {verificationFeedback.message}
                    </p>
                    {!verificationFeedback.passed && (
                      <p className="text-[10px] text-rose-300/80 mt-1 italic">
                        Please perform the required physical correction above (e.g. clear line kink or hang replacement bag) and re-verify.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WORKFLOW PHASE 4: RESOLVED VERIFIED */}
          {isResolved && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Resolved &bull; Verification Passed</span>
              </div>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                Bedside intervention was verified by {alert.verifiedBy || alert.resolvedBy || 'Duty Nurse'}. All sensor telemetry confirms normal delivery within prescribed tolerances.
              </p>
              {alert.intervention && (
                <div className="bg-white/80 p-2.5 rounded border border-emerald-200 font-mono text-[11px] text-emerald-900 space-y-0.5">
                  <div><strong>Intervention:</strong> {alert.intervention.interventionType}</div>
                  {alert.intervention.notes && <div><strong>Notes:</strong> {alert.intervention.notes}</div>}
                  <div><strong>Resolved Timestamp:</strong> {new Date(alert.resolvedAt || alert.verifiedAt || '').toLocaleString()}</div>
                </div>
              )}
            </div>
          )}

          {/* Audit Event Timeline */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Chronological Response &amp; Intervention Timeline
              </h4>
            </div>

            <div className="space-y-2 relative before:absolute before:inset-0 before:left-2.5 before:w-0.5 before:bg-slate-200">
              {alert.timeline.map((item, idx) => (
                <div key={idx} className="relative flex items-start gap-3 text-xs pl-6">
                  <div className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-slate-600 ring-2 ring-white" />
                  <div className="flex-1 bg-white p-2 rounded border border-slate-200">
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                      <span>{item.time}</span>
                      {item.staff && <span className="text-slate-700 font-semibold">{item.staff}</span>}
                    </div>
                    <p className="text-slate-800 text-xs mt-0.5 font-medium leading-snug">
                      {item.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded transition-colors"
          >
            Close Window
          </button>

          <div className="flex items-center gap-2">
            {isUnack && (
              <span className="text-[11px] text-slate-500 italic">
                Acknowledge via incoming call modal or Alert Centre
              </span>
            )}
            {isAckPending && (
              <button
                onClick={handleStartIntervention}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded transition-colors"
              >
                Begin Intervention
              </button>
            )}
            {isInProgress && (
              <button
                onClick={handleVerify}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded transition-colors"
              >
                Verify Infusion Status
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
