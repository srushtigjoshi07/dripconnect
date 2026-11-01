import React, { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { AlertItem, AlertSeverity, AlertWorkflowStatus } from '../types';
import { InterventionModal } from '../components/alerts/InterventionModal';
import {
  BellRing,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Clock,
  UserCheck,
  PhoneCall,
  Search,
  X,
  History,
  Stethoscope,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface AlertsPageProps {
  onNavigate: (page: string) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ onNavigate }) => {
  const {
    alerts,
    acknowledgeAlert,
    beginIntervention,
    triggerScenario,
    activeResponders,
  } = useSimulation();

  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');
  const [workflowFilter, setWorkflowFilter] = useState<'ALL' | AlertWorkflowStatus>('ALL');
  const [bedFilter, setBedFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedAlertForIntervention, setSelectedAlertForIntervention] = useState<AlertItem | null>(null);

  // Filtered alerts
  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== 'ALL' && alert.severity !== severityFilter) return false;
    if (bedFilter !== 'ALL' && alert.bedNumber !== bedFilter) return false;
    if (workflowFilter !== 'ALL' && alert.workflowStatus !== workflowFilter) return false;
    if (typeFilter !== 'ALL' && alert.type !== typeFilter) return false;
    if (dateFilter) {
      const alertDate = new Date(alert.timestampMs).toISOString().slice(0, 10);
      if (alertDate !== dateFilter) return false;
    }
    return true;
  });

  // Calculate separate workflow counts
  const unackCount = alerts.filter(a => a.workflowStatus === 'ACTIVE_UNACKNOWLEDGED' || (!a.isAcknowledged && !a.isResolved)).length;
  const ackPendingCount = alerts.filter(a => a.workflowStatus === 'ACKNOWLEDGED_PENDING').length;
  const inProgressCount = alerts.filter(a => a.workflowStatus === 'INTERVENTION_IN_PROGRESS').length;
  const verifiedResolvedCount = alerts.filter(a => a.workflowStatus === 'RESOLVED_VERIFIED' || a.isResolved).length;
  const overdueCount = alerts.filter(a => a.isOverdue && !a.isResolved).length;

  const currentNurseName = activeResponders[0]?.name || 'Nurse Sarah Chen, RN';

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Clinical Alert &amp; Intervention Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict 4-stage clinical response protocol: Acknowledged &rarr; Bedside Intervention &rarr; Telemetry Verification &rarr; Resolution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('escalation')}
            className="px-3 py-1.5 rounded-md bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5 text-teal-600" />
            <span>Escalation Hierarchy</span>
          </button>
          <button
            onClick={() => triggerScenario('BLOCKED_LINE')}
            className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Trigger Test Alert</span>
          </button>
        </div>
      </div>

      {/* Overdue Alert Banner if any */}
      {overdueCount > 0 && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-lg flex items-center justify-between gap-3 text-xs text-red-900 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 animate-bounce" />
            <div>
              <strong className="font-bold">Intervention Deadline Overdue ({overdueCount} Alert):</strong>{' '}
              <span>
                Clinician confirmed response but patient care has not been verified within the deadline. Senior Supervisor has been notified.
              </span>
            </div>
          </div>
          <button
            onClick={() => setWorkflowFilter('ACKNOWLEDGED_PENDING')}
            className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-[11px] font-semibold shrink-0"
          >
            View Pending ({overdueCount})
          </button>
        </div>
      )}

      {/* KPI Stat Cards Reflecting Separated Workflow States */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* State 1: Active Unacknowledged */}
        <div
          onClick={() => setWorkflowFilter('ACTIVE_UNACKNOWLEDGED')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            workflowFilter === 'ACTIVE_UNACKNOWLEDGED'
              ? 'bg-red-50/50 border-red-300 ring-1 ring-red-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">1. Active Unack</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${unackCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {unackCount}
          </div>
          <div className="text-[10px] text-slate-400">Escalation active</div>
        </div>

        {/* State 2: Acknowledged – Intervention Pending */}
        <div
          onClick={() => setWorkflowFilter('ACKNOWLEDGED_PENDING')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            workflowFilter === 'ACKNOWLEDGED_PENDING'
              ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">2. Ack Pending</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${ackPendingCount > 0 ? 'text-blue-700' : 'text-slate-900'}`}>
            {ackPendingCount}
          </div>
          <div className="text-[10px] text-slate-400">Response confirmed</div>
        </div>

        {/* State 3: Intervention in Progress */}
        <div
          onClick={() => setWorkflowFilter('INTERVENTION_IN_PROGRESS')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            workflowFilter === 'INTERVENTION_IN_PROGRESS'
              ? 'bg-purple-50/50 border-purple-300 ring-1 ring-purple-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">3. In Progress</span>
            <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${inProgressCount > 0 ? 'text-purple-700' : 'text-slate-900'}`}>
            {inProgressCount}
          </div>
          <div className="text-[10px] text-slate-400">Bedside attending</div>
        </div>

        {/* State 4: Resolved – Verification Passed */}
        <div
          onClick={() => setWorkflowFilter('RESOLVED_VERIFIED')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            workflowFilter === 'RESOLVED_VERIFIED'
              ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">4. Verified Safe</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
            {verifiedResolvedCount}
          </div>
          <div className="text-[10px] text-slate-400">Verification passed</div>
        </div>

        {/* Overdue Alerts Card */}
        <div
          className={`p-3 rounded-lg border transition-colors ${
            overdueCount > 0 ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${overdueCount > 0 ? 'text-red-700' : 'text-slate-400'}`}>
              Overdue Alerts
            </span>
            <AlertCircle className={`w-3.5 h-3.5 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${overdueCount > 0 ? 'text-red-700 font-extrabold' : 'text-slate-900'}`}>
            {overdueCount}
          </div>
          <div className="text-[10px] text-slate-400">&gt;60s response delay</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Workflow Filter:</span>
          </div>

          {/* Workflow Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE_UNACKNOWLEDGED', label: '1. Unack' },
              { id: 'ACKNOWLEDGED_PENDING', label: '2. Ack Pending' },
              { id: 'INTERVENTION_IN_PROGRESS', label: '3. In Progress' },
              { id: 'RESOLVED_VERIFIED', label: '4. Verified Safe' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setWorkflowFilter(tab.id as typeof workflowFilter)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                  workflowFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
            {(['ALL', 'CRITICAL', 'WARNING'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                  severityFilter === sev
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sev === 'ALL' ? 'All Severity' : sev}
              </button>
            ))}
          </div>

          {/* Bed filter dropdown */}
          <select
            value={bedFilter}
            onChange={e => setBedFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Beds</option>
            <option value="Bed 06">Bed 06 (Demo Primary)</option>
            <option value="Bed 01">Bed 01</option>
            <option value="Bed 02">Bed 02</option>
            <option value="Bed 03">Bed 03</option>
            <option value="Bed 04">Bed 04</option>
            <option value="Bed 05">Bed 05</option>
          </select>

          {/* Alert type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="LOW_FLUID">Low Fluid</option>
            <option value="EMPTY_BOTTLE">Empty Bottle</option>
            <option value="BLOCKED_LINE">Blocked Line</option>
            <option value="HIGH_FLOW">High Flow</option>
            <option value="LOW_FLOW">Low Flow</option>
            <option value="SENSOR_DISCONNECT">Sensor Disconnect</option>
          </select>

          {/* Date filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 focus:outline-none"
            title="Filter alerts by date"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-[11px] text-slate-500 hover:text-slate-800 underline"
            >
              Clear date
            </button>
          )}
        </div>

        <div className="text-slate-400 font-mono text-[11px]">
          Showing {filteredAlerts.length} of {alerts.length} records
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {filteredAlerts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-800 text-xs">No alerts matching filter criteria</p>
            <p className="text-[11px] text-slate-400 mt-0.5">All monitored patients are operating within safe baseline parameters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAlerts.map(alert => {
              const isCrit = alert.severity === 'CRITICAL';
              const isUnack = alert.workflowStatus === 'ACTIVE_UNACKNOWLEDGED';
              const isAckPending = alert.workflowStatus === 'ACKNOWLEDGED_PENDING';
              const isInProgress = alert.workflowStatus === 'INTERVENTION_IN_PROGRESS';
              const isResolved = alert.workflowStatus === 'RESOLVED_VERIFIED' || alert.isResolved;

              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlertForIntervention(alert)}
                  className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    alert.isOverdue && !isResolved
                      ? 'bg-red-50/30'
                      : isUnack
                      ? isCrit
                        ? 'bg-red-50/20'
                        : 'bg-amber-50/20'
                      : isAckPending
                      ? 'bg-blue-50/20'
                      : isInProgress
                      ? 'bg-purple-50/20'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Status Icon */}
                    <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                      isResolved
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : isInProgress
                        ? 'bg-purple-50 text-purple-600 border border-purple-200'
                        : isAckPending
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : isCrit
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      {isResolved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isInProgress ? (
                        <Stethoscope className="w-4 h-4 text-purple-600" />
                      ) : isAckPending ? (
                        <Clock className="w-4 h-4 text-blue-600" />
                      ) : isCrit ? (
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {alert.bedNumber}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900">{alert.title}</h3>

                        {/* Severity Badge */}
                        <span
                          className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.2 rounded border ${
                            isCrit
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {alert.severity}
                        </span>

                        {/* Workflow Status Badge: Red, Amber, Blue, Purple, Green */}
                        {isResolved ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Resolved &bull; Verification Passed</span>
                          </span>
                        ) : isInProgress ? (
                          <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.2 rounded flex items-center gap-1 animate-pulse">
                            <Stethoscope className="w-3 h-3 text-purple-600" />
                            <span>Intervention in Progress ({alert.intervention?.nurseName || 'Nurse'})</span>
                          </span>
                        ) : isAckPending ? (
                          <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.2 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Acknowledged &bull; Intervention Pending ({alert.acknowledgedBy})</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.2 rounded animate-pulse">
                            Active &bull; Unacknowledged ({alert.escalationSeconds}s)
                          </span>
                        )}

                        {/* Overdue Badge */}
                        {alert.isOverdue && !isResolved && (
                          <span className="text-[10px] font-bold text-red-800 bg-red-100 border border-red-300 px-1.5 py-0.2 rounded animate-pulse">
                            Overdue ({alert.acknowledgedSecondsElapsed}s)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-snug max-w-3xl">
                        {alert.description}
                      </p>

                      {/* Post-Ack Warning Line if unverified */}
                      {isAckPending && (
                        <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1 pt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Alert acknowledged. IV condition has NOT yet been verified as resolved.</span>
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono pt-0.5">
                        <span>Patient: {alert.patientName} ({alert.patientMrn})</span>
                        <span>&bull;</span>
                        <span>Triggered: {new Date(alert.triggeredAt).toLocaleTimeString()}</span>
                        {alert.acknowledgedAt && (
                          <>
                            <span>&bull;</span>
                            <span>Ack: {new Date(alert.acknowledgedAt).toLocaleTimeString()}</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span>ID: {alert.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Current State */}
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* State 1: Active Unacknowledged -> Acknowledge */}
                    {isUnack && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id, currentNurseName)}
                        className="px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors shadow-xs"
                      >
                        Acknowledge
                      </button>
                    )}

                    {/* State 2: Acknowledged Pending -> Begin Intervention */}
                    {isAckPending && (
                      <button
                        onClick={() => {
                          beginIntervention(alert.id, currentNurseName);
                          setSelectedAlertForIntervention(alert);
                        }}
                        className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>Begin Intervention</span>
                      </button>
                    )}

                    {/* State 3: In Progress -> Verify & Complete */}
                    {isInProgress && (
                      <button
                        onClick={() => setSelectedAlertForIntervention(alert)}
                        className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Intervention &amp; Verify</span>
                      </button>
                    )}

                    {/* State 4: Resolved -> Audit Details */}
                    {isResolved && (
                      <button
                        onClick={() => setSelectedAlertForIntervention(alert)}
                        className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                      >
                        Audit Timeline
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Intervention & Verification Workflow Modal */}
      {selectedAlertForIntervention && (
        <InterventionModal
          alert={selectedAlertForIntervention}
          onClose={() => setSelectedAlertForIntervention(null)}
        />
      )}
    </div>
  );
};
