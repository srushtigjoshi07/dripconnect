import React, { useState, useMemo } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { SimulationControlPanel } from '../components/simulation/SimulationControlPanel';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  History,
  Download,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Search,
  Activity,
  Layers,
  ArrowUpRight,
  PhoneCall,
  Stethoscope,
  RefreshCw,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

interface AnalyticsPageProps {
  onNavigate: (page: string) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onNavigate }) => {
  const {
    telemetryHistory,
    eventHistory,
    clearEventHistory,
    alerts,
    selectedBed,
  } = useSimulation();

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS'>('ALL');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [purgeAllData, setPurgeAllData] = useState(false);

  // Dynamic Metrics derived directly from recorded alerts & events
  const totalAlertsCount = alerts.length;
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length;
  const ackPendingCount = alerts.filter(a => a.workflowStatus === 'ACKNOWLEDGED_PENDING').length;
  const inProgressCount = alerts.filter(a => a.workflowStatus === 'INTERVENTION_IN_PROGRESS').length;
  const resolvedCount = alerts.filter(a => a.workflowStatus === 'RESOLVED_VERIFIED' || a.isResolved).length;
  const overdueCount = alerts.filter(a => a.isOverdue && !a.isResolved).length;

  // Filtered log
  const filteredEvents = useMemo(() => {
    return eventHistory.filter(evt => {
      if (severityFilter !== 'ALL' && evt.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          evt.message.toLowerCase().includes(q) ||
          evt.bedNumber.toLowerCase().includes(q) ||
          evt.eventType.toLowerCase().includes(q) ||
          (evt.alertId && evt.alertId.toLowerCase().includes(q)) ||
          (evt.details && evt.details.toLowerCase().includes(q)) ||
          (evt.responsibleStaff && evt.responsibleStaff.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [eventHistory, severityFilter, searchQuery]);

  // Alert Severity & Lifecycle Distribution data for Chart C
  const alertStatsData = useMemo(() => [
    { name: 'Total Alerts', count: totalAlertsCount, fill: '#0f172a' },
    { name: 'Warnings', count: warningCount, fill: '#f59e0b' },
    { name: 'Critical Alerts', count: criticalCount, fill: '#ef4444' },
    { name: 'Ack (Pending)', count: ackPendingCount, fill: '#3b82f6' },
    { name: 'In Progress', count: inProgressCount, fill: '#8b5cf6' },
    { name: 'Verified Safe', count: resolvedCount, fill: '#10b981' },
  ], [totalAlertsCount, warningCount, criticalCount, ackPendingCount, inProgressCount, resolvedCount]);

  // Event category breakdown for Chart D
  const eventCategoriesData = useMemo(() => {
    const counts = {
      Infusion: 0,
      FlowReadings: 0,
      Abnormalities: 0,
      Acknowledgements: 0,
      Interventions: 0,
      Verifications: 0,
      Resolutions: 0,
    };

    eventHistory.forEach(evt => {
      if (evt.eventType.startsWith('INFUSION_')) counts.Infusion += 1;
      else if (evt.eventType === 'FLOW_READING_RECORDED') counts.FlowReadings += 1;
      else if (
        evt.eventType.includes('DETECTED') ||
        evt.eventType.includes('WARNING') ||
        evt.eventType.includes('CRITICAL') ||
        evt.eventType === 'ALERT_GENERATED'
      ) {
        counts.Abnormalities += 1;
      } else if (evt.eventType === 'ALERT_ACKNOWLEDGED') {
        counts.Acknowledgements += 1;
      } else if (evt.eventType === 'INTERVENTION_STARTED' || evt.eventType === 'INTERVENTION_RECORDED') {
        counts.Interventions += 1;
      } else if (evt.eventType.startsWith('VERIFICATION_')) {
        counts.Verifications += 1;
      } else if (evt.eventType === 'ALERT_RESOLVED') {
        counts.Resolutions += 1;
      }
    });

    return [
      { category: 'Telemetry Stream', events: counts.FlowReadings, fill: '#0284c7' },
      { category: 'Detected Abnormalities', events: counts.Abnormalities, fill: '#f59e0b' },
      { category: 'Nurse Acknowledgements', events: counts.Acknowledgements, fill: '#3b82f6' },
      { category: 'Bedside Interventions', events: counts.Interventions, fill: '#8b5cf6' },
      { category: 'Telemetry Verifications', events: counts.Verifications, fill: '#14b8a6' },
      { category: 'Verified Resolutions', events: counts.Resolutions, fill: '#10b981' },
    ];
  }, [eventHistory]);

  // CSV Exporter with Alert ID and full telemetry metadata
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Bed', 'Severity', 'EventType', 'AlertID', 'ResponsibleStaff', 'Message', 'Details'];
    const rows = eventHistory.map(evt => [
      `"${evt.timestamp}"`,
      `"${evt.bedNumber}"`,
      `"${evt.severity}"`,
      `"${evt.eventType}"`,
      `"${evt.alertId || ''}"`,
      `"${evt.responsibleStaff || ''}"`,
      `"${evt.message.replace(/"/g, '""')}"`,
      `"${(evt.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dripconnect_event_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Infusion Telemetry &amp; Response Audit Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous rate stability trends, fluid volume consumption tracking, and clinical intervention verification ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setConfirmClearOpen(true)}
            className="px-3 py-1.5 rounded-md bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Event Log</span>
          </button>
        </div>
      </div>

      {/* Embedded Simulation Control Panel: Run, Pause, Reset, 12-Step Demo */}
      <SimulationControlPanel />

      {/* Dynamic Aggregate Metrics Grid Reflecting Separated Lifecycle */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Alerts</span>
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
            {totalAlertsCount}
          </div>
          <div className="text-[10px] text-slate-400">Total session events</div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Ack (Pending)</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5 tabular-nums">
            {ackPendingCount}
          </div>
          <div className="text-[10px] text-slate-400">Response confirmed</div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">In Progress</span>
            <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-700 mt-0.5 tabular-nums">
            {inProgressCount}
          </div>
          <div className="text-[10px] text-slate-400">Bedside care active</div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Verified Safe</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5 tabular-nums">
            {resolvedCount}
          </div>
          <div className="text-[10px] text-slate-400">Verification passed</div>
        </div>

        <div className={`p-3 rounded-lg border transition-colors ${
          overdueCount > 0 ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${
              overdueCount > 0 ? 'text-red-700' : 'text-slate-500'
            }`}>
              Overdue Alerts
            </span>
            <AlertCircle className={`w-3.5 h-3.5 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-bold font-mono mt-0.5 tabular-nums ${
            overdueCount > 0 ? 'text-red-700 font-extrabold' : 'text-slate-900'
          }`}>
            {overdueCount}
          </div>
          <div className="text-[10px] text-slate-400">&gt;60s response delay</div>
        </div>
      </div>

      {/* Primary Telemetry Charts: Flow Rate Deviation & Fluid Volume Depletion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Chart A: Flow Rate Deviation Trend */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900">
                Flow Rate Deviation Trend ({selectedBed.bedNumber})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Live {telemetryHistory.length}-sample window
            </span>
          </div>

          <div className="h-56 w-full">
            {telemetryHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Simulation paused. Start simulation to stream rate telemetry.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    domain={[0, (dataMax: number) => Math.max(160, Math.ceil(dataMax * 1.15))]}
                    unit=" mL/h"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontSize: '11px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Line
                    type="monotone"
                    dataKey="prescribedRate"
                    name="Prescribed Rate (mL/h)"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualRate"
                    name="Actual Flow Rate (mL/h)"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart B: Fluid Volume Consumption */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900">
                Fluid Volume Consumption &amp; Depletion (mL)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Capacity: {selectedBed.initialVolume} mL
            </span>
          </div>

          <div className="h-56 w-full">
            {telemetryHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No reservoir telemetry recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fluidFillGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    domain={[0, selectedBed.initialVolume || 500]}
                    unit=" mL"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontSize: '11px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Area
                    type="monotone"
                    dataKey="remainingVolume"
                    name="Fluid Remaining (mL)"
                    stroke="#0d9488"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#fluidFillGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Secondary Analytics Charts: Alert Distribution & Event Category Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Chart C: Alert & Intervention Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">
              Session Alert &amp; Lifecycle Distribution
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Dynamic Ledger</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertStatsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="count" name="Total Count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart D: Event Category Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">
              Recorded Clinical Protocol Events Breakdown
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Total: {eventHistory.length} events</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventCategoriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 8, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="events" name="Recorded Events" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Chronological Audit Event Log */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-2.5">
          <div>
            <h3 className="text-xs font-bold text-slate-900">Chronological System &amp; Clinical Audit Log</h3>
            <p className="text-[11px] text-slate-500">
              Immutable ledger of alerts, acknowledgements, bedside interventions, sensor verifications, and resolutions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search events, alert IDs, staff..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value as typeof severityFilter)}
              className="py-1 px-2.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="SUCCESS">Success</option>
              <option value="INFO">Info</option>
            </select>
          </div>
        </div>

        {/* Table of Events */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
          {filteredEvents.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No matching events found in audit history. Run a simulation scenario to stream events.
            </div>
          ) : (
            filteredEvents.map(evt => (
              <div key={evt.id} className="py-2.5 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                <span className="font-mono text-[10px] text-slate-400 shrink-0 w-20 pt-0.5">
                  {evt.timestamp}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 w-16 text-center border ${
                    evt.severity === 'CRITICAL'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : evt.severity === 'WARNING'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : evt.severity === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {evt.severity}
                </span>

                <span className="font-mono font-bold text-slate-800 shrink-0 w-14 pt-0.5 text-xs">
                  {evt.bedNumber}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-800 leading-snug font-medium text-xs">
                      {evt.message}
                    </p>
                    {evt.alertId && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px] font-semibold">
                        {evt.alertId}
                      </span>
                    )}
                    {evt.responsibleStaff && (
                      <span className="px-1.5 py-0.2 rounded bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[10px] font-semibold flex items-center gap-1">
                        <UserCheck className="w-2.5 h-2.5 text-teal-600" />
                        <span>{evt.responsibleStaff}</span>
                      </span>
                    )}
                  </div>
                  {evt.details && (
                    <p className="text-slate-500 text-[10px] mt-0.5 font-mono">
                      {evt.details}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal to Clear Log */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-5 text-center text-slate-900 border border-slate-200">
            <Trash2 className="w-8 h-8 text-rose-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900">Clear Event History?</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              This will clear the event ledger for this prototype session.
            </p>

            <div className="my-3 text-left bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={purgeAllData}
                  onChange={e => setPurgeAllData(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Also reset alerts and telemetry buffer</span>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearEventHistory(purgeAllData);
                  setConfirmClearOpen(false);
                }}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
