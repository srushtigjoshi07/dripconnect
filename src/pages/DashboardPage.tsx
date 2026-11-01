import React from 'react';
import { useSimulation } from '../context/SimulationContext';
import { SimulationControlPanel } from '../components/simulation/SimulationControlPanel';
import {
  Bed,
  Activity,
  AlertTriangle,
  ShieldAlert,
  BellRing,
  Clock,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Sliders,
  Sun,
  Moon,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const {
    beds,
    activeAlerts,
    setSelectedBedId,
    eventHistory,
    acknowledgeAlert,
    resolveAlert,
    triggerScenario,
    activeShift,
    toggleShift,
    activeResponders,
    simulatedCallVolume,
    openInterventionModal,
  } = useSimulation();

  const isNight = activeShift === 'NIGHT';
  const dutyStaff = activeResponders[0];

  // Summary Metrics derived directly from live state
  const totalBeds = beds.length;
  const activeInfusions = beds.filter(b => b.isActive && !b.isPaused).length;
  const normalInfusions = beds.filter(b => b.status === 'NORMAL' && b.isActive).length;
  const activeWarnings = activeAlerts.filter(a => a.severity === 'WARNING').length;
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
  const unacknowledgedAlerts = activeAlerts.filter(a => !a.isAcknowledged).length;

  const handleBedClick = (bedId: string) => {
    setSelectedBedId(bedId);
    onNavigate('live-monitoring');
  };

  return (
    <div className="space-y-5">
      
      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Hospital Infusion Monitoring
            </h1>
            <button
              onClick={toggleShift}
              className={`px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 border transition-colors ${
                isNight
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Toggle Day/Night shift"
            >
              {isNight ? <Moon className="w-3 h-3 text-indigo-600" /> : <Sun className="w-3 h-3 text-amber-600" />}
              <span>{isNight ? 'Night Shift' : 'Day Shift'} ({dutyStaff?.name})</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ward 4B real-time IV telemetry, drop-rate detection, and automated nurse escalation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('simulator')}
            className="px-2.5 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Ward Overview</span>
          </button>
          <button
            onClick={() => onNavigate('live-monitoring')}
            className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <span>Live Monitoring</span>
            <ArrowRight className="w-3.5 h-3.5 text-teal-300" />
          </button>
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Monitored Beds */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Total Beds</span>
            <Bed className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">{totalBeds}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Monitored units</div>
        </div>

        {/* Active Infusions */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Active</span>
            <Activity className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-xl font-bold text-teal-700 font-mono tabular-nums">{activeInfusions}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Delivering fluid</div>
        </div>

        {/* Normal */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Normal</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums">{normalInfusions}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">On prescribed rate</div>
        </div>

        {/* Warnings */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Warnings</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 font-mono tabular-nums">{activeWarnings}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Low fluid / rate dev</div>
        </div>

        {/* Critical Alerts */}
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Critical</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-xl font-bold text-red-600 font-mono tabular-nums">{criticalAlerts}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Empty / blocked line</div>
        </div>

        {/* Unacknowledged */}
        <div className={`p-3 rounded-lg border ${
          unacknowledgedAlerts > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`text-[10px] uppercase font-semibold tracking-wider ${
              unacknowledgedAlerts > 0 ? 'text-red-700' : 'text-slate-400'
            }`}>
              Pending Ack
            </span>
            <BellRing className={`w-3.5 h-3.5 ${unacknowledgedAlerts > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${
            unacknowledgedAlerts > 0 ? 'text-red-700' : 'text-slate-900'
          }`}>
            {unacknowledgedAlerts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Awaiting clinician</div>
        </div>
      </div>

      {/* Interactive Simulation & Guided Demo Controls */}
      <SimulationControlPanel />

      {/* Main Monitoring Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Infusion Monitoring Overview
            </h2>
            <p className="text-[11px] text-slate-500">
              Click any row to open the live visualizer and detailed telemetry for that bed
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            Bed 06 Primary Target
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold tracking-wider">
                <th className="py-2.5 px-3">Bed</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3 text-right">Flow Rate</th>
                <th className="py-2.5 px-3 text-right">Remaining Fluid</th>
                <th className="py-2.5 px-3 text-right">Time to Empty</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {beds.map(bed => {
                const isSelected = bed.isDemoPrimary;
                const statusBadge =
                  bed.status === 'CRITICAL'
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : bed.status === 'WARNING'
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : bed.status === 'PAUSED'
                    ? 'text-slate-600 bg-slate-100 border-slate-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200';

                return (
                  <tr
                    key={bed.id}
                    onClick={() => handleBedClick(bed.id)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{bed.bedNumber}</span>
                        {bed.isDemoPrimary && (
                          <span className="text-[9px] font-mono bg-teal-600 text-white font-medium px-1 rounded">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{bed.ward}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{bed.patient.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {bed.patient.mrn} · {bed.fluid.solutionName}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{bed.actualRate}</span>{' '}
                      <span className="text-[10px] text-slate-500">mL/h</span>
                      <div className="text-[10px] text-slate-400">Prescribed: {bed.prescribedRate} mL/h</div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{Math.round(bed.remainingVolume)}</span>{' '}
                      <span className="text-[10px] text-slate-500">mL</span>
                      <div className="text-[10px] text-slate-400">
                        {Math.round((bed.remainingVolume / bed.initialVolume) * 100)}% of {bed.initialVolume}mL
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {bed.timeToEmptyMinutes !== null ? (
                        <span className="font-semibold text-slate-800">{bed.timeToEmptyMinutes} min</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">0 flow</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge}`}>
                        {bed.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleBedClick(bed.id)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column Split: Active Alert Response Queue & Event Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Active Alerts Panel */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Active Alerts Queue</span>
            </div>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs text-teal-700 hover:underline font-medium"
            >
              All Alerts
            </button>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
              <p className="font-medium text-slate-700">All Infusions Normal</p>
              <p className="text-[11px] text-slate-400">No active warnings or occlusions detected.</p>
              <button
                onClick={() => triggerScenario('LOW_FLUID')}
                className="mt-2.5 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
              >
                Simulate Low Fluid Warning
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded border text-xs ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{alert.bedNumber} · {alert.title}</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-white border border-slate-200">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-1">{alert.description}</p>
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-500">Stage: {alert.escalationStage}</span>
                      {alert.workflowStatus === 'ACKNOWLEDGED_PENDING' && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold font-mono text-[9px]">
                          Intervention Pending
                        </span>
                      )}
                      {alert.workflowStatus === 'INTERVENTION_IN_PROGRESS' && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-semibold font-mono text-[9px]">
                          In Progress
                        </span>
                      )}
                      {alert.isOverdue && (
                        <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-800 font-semibold font-mono text-[9px] animate-pulse">
                          Overdue ({alert.acknowledgedSecondsElapsed}s)
                        </span>
                      )}
                    </div>
                    <div>
                      {alert.workflowStatus === 'ACTIVE_UNACKNOWLEDGED' || (!alert.isAcknowledged && !alert.isResolved) ? (
                        <button
                          onClick={() => acknowledgeAlert(alert.id, 'Duty Nurse S. Chen')}
                          className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold text-[11px] shadow-xs"
                        >
                          Acknowledge
                        </button>
                      ) : alert.workflowStatus === 'ACKNOWLEDGED_PENDING' ? (
                        <button
                          onClick={() => openInterventionModal(alert)}
                          className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs"
                        >
                          <span>Begin Intervention</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openInterventionModal(alert)}
                          className="px-2 py-0.5 rounded bg-purple-700 hover:bg-purple-600 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs"
                        >
                          <span>Verify Infusion</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Log */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Recent Activity</span>
            </div>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs text-teal-700 hover:underline font-medium"
            >
              Full Log
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {eventHistory.slice(0, 6).map(event => (
              <div key={event.id} className="flex items-start gap-2 text-xs">
                <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                  {event.timestamp}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-800">{event.bedNumber}:</span>{' '}
                  <span className="text-slate-600 text-[11px]">{event.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
