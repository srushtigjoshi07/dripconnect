import React from 'react';
import { BedData, AlertItem, BedFaultCondition } from '../../types';
import { useSimulation } from '../../context/SimulationContext';
import {
  Droplets,
  AlertTriangle,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  User,
  Clock,
  Gauge,
  CheckCircle2,
  PhoneCall,
  Stethoscope,
} from 'lucide-react';

interface BedCardProps {
  bed: BedData;
  activeAlert?: AlertItem;
  onSelectBed: (bedId: string) => void;
  onOpenIntervention?: (alert: AlertItem) => void;
}

export const BedCard: React.FC<BedCardProps> = ({
  bed,
  activeAlert,
  onSelectBed,
  onOpenIntervention,
}) => {
  const {
    startInfusion,
    pauseInfusion,
    resumeInfusion,
    resetSimulation,
    setBedFaultCondition,
    acknowledgeAlert,
  } = useSimulation();

  const percentRemaining = Math.max(
    0,
    Math.min(100, Math.round((bed.remainingVolume / bed.initialVolume) * 100))
  );

  // Status Color Logic strictly adhering to requirements:
  // - Green: Normal.
  // - Amber: Warning.
  // - Red: Critical.
  // - Blue: Acknowledged.
  // - Purple: Intervention in progress.
  const isInterventionInProgress = activeAlert?.workflowStatus === 'INTERVENTION_IN_PROGRESS';
  const isAcknowledged = activeAlert?.workflowStatus === 'ACKNOWLEDGED_PENDING';
  const isCritical = bed.status === 'CRITICAL' || activeAlert?.severity === 'CRITICAL';
  const isWarning = bed.status === 'WARNING' || activeAlert?.severity === 'WARNING';

  let statusBadgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  let cardBorderClasses = 'border-slate-200 hover:border-slate-300';
  let statusText = 'Normal';

  if (isInterventionInProgress) {
    statusBadgeClasses = 'bg-purple-100 text-purple-900 border-purple-300';
    cardBorderClasses = 'border-purple-300 ring-1 ring-purple-200';
    statusText = 'Intervention In Progress';
  } else if (isAcknowledged) {
    statusBadgeClasses = 'bg-blue-100 text-blue-900 border-blue-300';
    cardBorderClasses = 'border-blue-300 ring-1 ring-blue-200';
    statusText = 'Acknowledged';
  } else if (isCritical) {
    statusBadgeClasses = 'bg-red-100 text-red-900 border-red-300';
    cardBorderClasses = 'border-red-300 ring-1 ring-red-200';
    statusText = 'Critical';
  } else if (isWarning) {
    statusBadgeClasses = 'bg-amber-100 text-amber-900 border-amber-300';
    cardBorderClasses = 'border-amber-300 ring-1 ring-amber-200';
    statusText = 'Warning';
  } else if (bed.isPaused) {
    statusBadgeClasses = 'bg-slate-100 text-slate-700 border-slate-300';
    statusText = 'Paused';
  } else if (!bed.isActive) {
    statusBadgeClasses = 'bg-slate-100 text-slate-500 border-slate-200';
    statusText = 'Stopped';
  }

  // Drop generation status
  let dropStatusText = 'Active';
  let dropStatusBadge = 'bg-teal-50 text-teal-700 border-teal-200';
  if (!bed.isActive || bed.isPaused) {
    dropStatusText = 'Paused / Idle';
    dropStatusBadge = 'bg-slate-100 text-slate-600 border-slate-200';
  } else if (bed.actualRate === 0 || bed.remainingVolume === 0) {
    dropStatusText = 'Stopped (0 gtt/min)';
    dropStatusBadge = 'bg-red-50 text-red-700 border-red-200';
  } else if (bed.actualRate > 120) {
    dropStatusText = `Surge (${bed.dropRate} gtt/min)`;
    dropStatusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (bed.actualRate < 80) {
    dropStatusText = `Low (${bed.dropRate} gtt/min)`;
    dropStatusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    dropStatusText = `Normal (${bed.dropRate} gtt/min)`;
    dropStatusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  // Fault condition options
  const faultConditions: { id: BedFaultCondition; label: string }[] = [
    { id: 'NORMAL', label: 'Normal' },
    { id: 'LOW_FLUID', label: 'Low Fluid' },
    { id: 'BLOCKED_LINE', label: 'Blocked Line' },
    { id: 'HIGH_FLOW', label: 'High Flow' },
    { id: 'LOW_FLOW', label: 'Low Flow' },
    { id: 'EMPTY_BOTTLE', label: 'Empty Bottle' },
  ];

  const currentFault = bed.faultCondition || (bed.activeScenarioId as BedFaultCondition) || 'NORMAL';

  return (
    <div
      className={`bg-white rounded-lg border p-4 flex flex-col justify-between transition-all duration-200 shadow-xs ${cardBorderClasses}`}
    >
      <div>
        {/* Top Header: Bed Number, Patient Name, Status Badge */}
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-900 tracking-tight font-mono">
                {bed.bedNumber}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">· {bed.ward}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-xs text-slate-800">
                {bed.patient.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({bed.patient.age}y, {bed.patient.mrn})
              </span>
            </div>
          </div>

          {/* Status Badge with Color Discipline */}
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wide border shrink-0 ${statusBadgeClasses}`}
          >
            {statusText}
          </span>
        </div>

        {/* Fluid Info & Prescription */}
        <div className="mt-2.5 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="truncate max-w-[200px]" title={bed.fluid.solutionName}>
            {bed.fluid.solutionName}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {bed.fluid.lotNumber}
          </span>
        </div>

        {/* Parameters Grid */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {/* Flow Rates */}
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] text-slate-400 block font-medium">Flow Rate (mL/h)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`font-mono text-sm font-bold tabular-nums ${
                  bed.actualRate !== bed.prescribedRate ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {bed.actualRate}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                / {bed.prescribedRate} rx
              </span>
            </div>
          </div>

          {/* Remaining Volume */}
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] text-slate-400 block font-medium">Remaining Fluid</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`font-mono text-sm font-bold tabular-nums ${
                  bed.remainingVolume <= 25 ? 'text-red-700' : 'text-teal-700'
                }`}
              >
                {Math.round(bed.remainingVolume)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                mL ({percentRemaining}%)
              </span>
            </div>
          </div>

          {/* Estimated Time to Empty */}
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Clock className="w-3 h-3" />
              <span>Time to Empty</span>
            </div>
            <div className="font-mono text-xs font-bold text-slate-800 mt-1 tabular-nums">
              {bed.timeToEmptyMinutes !== null ? (
                `${bed.timeToEmptyMinutes} min`
              ) : (
                <span className="text-slate-400 font-normal">0 mL/h (Stopped)</span>
              )}
            </div>
          </div>

          {/* Drop Generation Status */}
          <div className="p-2 bg-slate-50 rounded border border-slate-100">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Droplets className="w-3 h-3 text-teal-600" />
              <span>Drop Telemetry</span>
            </div>
            <div className="mt-1">
              <span
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border inline-block ${dropStatusBadge}`}
              >
                {dropStatusText}
              </span>
            </div>
          </div>
        </div>

        {/* Fluid Remaining Mini Progress Bar */}
        <div className="mt-2.5">
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                percentRemaining <= 10
                  ? 'bg-red-600'
                  : percentRemaining <= 25
                  ? 'bg-amber-500'
                  : 'bg-teal-600'
              }`}
              style={{ width: `${percentRemaining}%` }}
            />
          </div>
        </div>

        {/* Active Alert Banner & Nurse Acknowledgement Status */}
        {activeAlert ? (
          <div
            className={`mt-3 p-2.5 rounded-md border text-xs space-y-1.5 ${
              isInterventionInProgress
                ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                : isAcknowledged
                ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                : isCritical
                ? 'bg-red-50/80 border-red-200 text-red-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-[11px]">
              <div className="flex items-center gap-1.5">
                {isCritical ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                )}
                <span>{activeAlert.title}</span>
              </div>
              <span className="font-mono text-[9px] uppercase px-1 py-0.2 rounded bg-white/80 border border-slate-200">
                {activeAlert.severity}
              </span>
            </div>

            <p className="text-[11px] leading-tight text-slate-700">
              {activeAlert.description}
            </p>

            {/* Nurse Acknowledgement Status Indicator */}
            <div className="pt-1.5 border-t border-slate-200/50 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">Nurse Response:</span>
                <span
                  className={`font-semibold ${
                    isInterventionInProgress
                      ? 'text-purple-700'
                      : isAcknowledged
                      ? 'text-blue-700'
                      : 'text-red-700'
                  }`}
                >
                  {isInterventionInProgress
                    ? 'Intervention In Progress'
                    : isAcknowledged
                    ? `Acknowledged (${activeAlert.acknowledgedBy || 'Duty Nurse'})`
                    : 'Unacknowledged (Escalating)'}
                </span>
              </div>

              {/* Action Button inside Alert */}
              {!activeAlert.isAcknowledged ? (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    acknowledgeAlert(activeAlert.id);
                  }}
                  className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium text-[10px]"
                >
                  Acknowledge
                </button>
              ) : onOpenIntervention ? (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onOpenIntervention(activeAlert);
                  }}
                  className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-medium text-[10px]"
                >
                  {isInterventionInProgress ? 'Verify Safe' : 'Intervene'}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-3 p-2 rounded-md bg-emerald-50/60 border border-emerald-200/70 text-[11px] text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Infusion steady on prescribed rate</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-600 font-medium">All Clear</span>
          </div>
        )}

        {/* Bed-Level Fault Condition Simulator Control */}
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Simulate Unit Condition:
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Active: {currentFault.replace('_', ' ')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {faultConditions.map(f => {
              const isSelected = currentFault === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setBedFaultCondition(bed.id, f.id)}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-colors truncate ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  title={`Apply ${f.label} to ${bed.bedNumber}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card Footer: Bed Controls & Detailed View Link */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        {/* Play/Pause & Reset for THIS bed only */}
        <div className="flex items-center gap-1">
          {bed.isPaused ? (
            <button
              onClick={() => resumeInfusion(bed.id)}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              title={`Resume ${bed.bedNumber}`}
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => pauseInfusion(bed.id)}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              title={`Pause ${bed.bedNumber}`}
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => resetSimulation(bed.id)}
            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
            title={`Reset ${bed.bedNumber} to normal (other beds unaffected)`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Detailed Bed Monitoring Page CTA */}
        <button
          onClick={() => onSelectBed(bed.id)}
          className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          <span>Inspect Bed</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
