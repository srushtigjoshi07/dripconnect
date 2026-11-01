import React, { useMemo, useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { History, Download, Trash2, Search, CheckCircle2 } from 'lucide-react';

interface EventHistoryPageProps {
  onNavigate: (page: string) => void;
}

const SEVERITY_BADGE: Record<string, string> = {
  INFO: 'bg-slate-100 text-slate-700 border-slate-200',
  WARNING: 'bg-amber-50 text-amber-800 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-800 border-red-200',
  SUCCESS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export const EventHistoryPage: React.FC<EventHistoryPageProps> = ({ onNavigate }) => {
  const { eventHistory, clearEventHistory, beds } = useSimulation();

  const [search, setSearch] = useState('');
  const [bedFilter, setBedFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [confirmClear, setConfirmClear] = useState(false);

  const eventTypes = useMemo(
    () => Array.from(new Set(eventHistory.map(e => e.eventType))).sort(),
    [eventHistory]
  );

  const filtered = useMemo(
    () =>
      eventHistory.filter(e => {
        if (bedFilter !== 'ALL' && e.bedNumber !== bedFilter) return false;
        if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
        if (typeFilter !== 'ALL' && e.eventType !== typeFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${e.message} ${e.details || ''} ${e.alertId || ''} ${e.responsibleStaff || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [eventHistory, bedFilter, severityFilter, typeFilter, search]
  );

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Bed', 'Severity', 'EventType', 'AlertID', 'ResponsibleStaff', 'Message', 'Details'];
    const esc = (v: string | undefined) => `"${(v || '').replace(/"/g, '""')}"`;
    const rows = filtered.map(e => [
      esc(e.timestamp),
      esc(e.bedNumber),
      esc(e.severity),
      esc(e.eventType),
      esc(e.alertId),
      esc(e.responsibleStaff),
      esc(e.message),
      esc(e.details),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dripconnect-event-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearEventHistory(false);
    setConfirmClear(false);
  };

  const selectCls =
    'px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 focus:outline-none';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-teal-700" />
            Event History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete central event log from the simulation engine — detections, notifications, escalations,
            acknowledgements, interventions, verifications and resolutions. History is preserved across
            refreshes and is never silently deleted.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleClear}
            disabled={eventHistory.length === 0}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 border disabled:opacity-40 ${
              confirmClear
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                : 'bg-white hover:bg-red-50 text-red-700 border-red-200'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmClear ? 'Confirm: Clear Event Log?' : 'Clear Event Log'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events, alert IDs, staff…"
            className="pl-7 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus:outline-none w-56"
          />
        </div>
        <select value={bedFilter} onChange={e => setBedFilter(e.target.value)} className={selectCls}>
          <option value="ALL">All Beds</option>
          {beds.map(b => (
            <option key={b.id} value={b.bedNumber}>
              {b.bedNumber}
            </option>
          ))}
          <option value="Ward">Ward</option>
          <option value="System">System</option>
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className={selectCls}>
          <option value="ALL">All Severities</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="CRITICAL">Critical</option>
          <option value="SUCCESS">Success</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
          <option value="ALL">All Event Types</option>
          {eventTypes.map(t => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <span className="text-slate-400 font-mono text-[11px]">
          Showing {filtered.length} of {eventHistory.length} records
        </span>
      </div>

      {/* Event list */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-800 text-xs">No event records</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {eventHistory.length === 0
                ? 'The ward is running normally. Events will appear here as the simulation runs and conditions change.'
                : 'No events match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(e => (
              <div key={e.id} className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 hover:bg-slate-50">
                <div className="sm:w-24 shrink-0">
                  <div className="font-mono text-[11px] text-slate-500">{e.timestamp}</div>
                  <div className="font-mono text-[11px] font-semibold text-slate-700">{e.bedNumber}</div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-bold font-mono uppercase shrink-0 self-start ${
                    SEVERITY_BADGE[e.severity] || SEVERITY_BADGE.INFO
                  }`}
                >
                  {e.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-800 font-medium leading-snug">{e.message}</div>
                  {e.details && <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{e.details}</div>}
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {e.eventType.replace(/_/g, ' ')}
                    {e.alertId ? ` · ${e.alertId}` : ''}
                    {e.responsibleStaff ? ` · ${e.responsibleStaff}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Looking for trends instead? Open{' '}
        <button onClick={() => onNavigate('analytics')} className="underline hover:text-slate-600">
          Analytics
        </button>{' '}
        for charts computed from this same event and telemetry data.
      </p>
    </div>
  );
};
