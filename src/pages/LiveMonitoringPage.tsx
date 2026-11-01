import React from 'react';
import { useSimulation } from '../context/SimulationContext';
import { IVBagVisualizer } from '../components/monitoring/IVBagVisualizer';
import { BedFaultSelector } from '../components/monitoring/BedFaultSelector';
import { SimulationControlPanel } from '../components/simulation/SimulationControlPanel';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  LayoutGrid,
  Clock,
  CheckCircle2,
  PhoneCall,
  History,
  UserCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface LiveMonitoringPageProps {
  onNavigate: (page: string) => void;
}

export const LiveMonitoringPage: React.FC<LiveMonitoringPageProps> = ({ onNavigate }) => {
  const {
    selectedBed,
    selectedBedId,
    setSelectedBedId,
    beds,
    telemetryHistory,
    startInfusion,
    pauseInfusion,
    resumeInfusion,
    stopInfusion,
    resetSimulation,
    alerts,
    activeAlerts,
    acknowledgeAlert,
    openInterventionModal,
  } = useSimulation();

  const bedAlerts = activeAlerts.filter(a => a.bedId === selectedBed.id);
  const bedAlertHistory = alerts.filter(a => a.bedId === selectedBed.id);
  const percentRemaining = Math.max(0, Math.min(100, Math.round((selectedBed.remainingVolume / selectedBed.initialVolume) * 100)));

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Live IV Infusion Monitoring
            </h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
              {selectedBed.bedNumber}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual bedside unit monitoring: animated drop telemetry, fluid level tracking, and flow verification
          </p>
        </div>

        {/* Bed Switcher & Navigation to Ward Overview */}
        <div className="flex items-center gap-2">
          <label htmlFor="bed-select" className="text-xs font-medium text-slate-600">Bed:</label>
          <select
            id="bed-select"
            value={selectedBedId}
            onChange={e => setSelectedBedId(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-800"
          >
            {beds.map(b => (
              <option key={b.id} value={b.id}>
                {b.bedNumber} - {b.patient.name} ({b.status})
              </option>
            ))}
          </select>

          <button
            onClick={() => onNavigate('simulator')}
            className="px-2.5 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
            <span>Ward Overview</span>
          </button>
        </div>
      </div>

      {/* Embedded Simulation Speed Control Panel */}
      <SimulationControlPanel compact />

      {/* Main Grid: Left Visualizer, Right Telemetry & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: IV Apparatus Visualizer */}
        <div className="lg:col-span-5 space-y-4">
          <IVBagVisualizer bed={selectedBed} />

          {/* Active Bed Alerts Card if any */}
          {bedAlerts.length > 0 && (
            <div
              className={`p-3 rounded-lg border space-y-2 ${
                bedAlerts[0].workflowStatus === 'INTERVENTION_IN_PROGRESS'
                  ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                  : bedAlerts[0].workflowStatus === 'ACKNOWLEDGED_PENDING'
                  ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                  : 'bg-red-50/80 border-red-200 text-red-950'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <span>Abnormal Infusion Condition</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[9px] bg-white border border-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">
                    {bedAlerts[0].severity}
                  </span>
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      bedAlerts[0].workflowStatus === 'INTERVENTION_IN_PROGRESS'
                        ? 'bg-purple-200 text-purple-900'
                        : bedAlerts[0].workflowStatus === 'ACKNOWLEDGED_PENDING'
                        ? 'bg-blue-200 text-blue-900'
                        : 'bg-red-200 text-red-900'
                    }`}
                  >
                    {bedAlerts[0].workflowStatus === 'INTERVENTION_IN_PROGRESS'
                      ? 'IN PROGRESS'
                      : bedAlerts[0].workflowStatus === 'ACKNOWLEDGED_PENDING'
                      ? 'ACKNOWLEDGED'
                      : 'ACTIVE'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-snug">
                {bedAlerts[0].description}
              </p>

              {bedAlerts[0].workflowStatus === 'ACKNOWLEDGED_PENDING' && (
                <div className="p-2 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 leading-tight">
                  <strong>Warning:</strong> Alert acknowledged. IV condition has NOT yet been verified as resolved.
                </div>
              )}

              {bedAlerts[0].isOverdue && (
                <div className="p-2 bg-red-100 border border-red-300 rounded text-[11px] text-red-900 font-bold animate-pulse">
                  Intervention Overdue: {bedAlerts[0].acknowledgedSecondsElapsed}s elapsed without verified resolution.
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-200/60">
                <span className="text-[10px] font-mono text-slate-500">
                  ID: {bedAlerts[0].id}
                </span>
                <div>
                  {bedAlerts[0].workflowStatus === 'ACTIVE_UNACKNOWLEDGED' || (!bedAlerts[0].isAcknowledged && !bedAlerts[0].isResolved) ? (
                    <button
                      onClick={() => acknowledgeAlert(bedAlerts[0].id, 'Nurse Sarah Chen, RN')}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded shadow-xs"
                    >
                      Acknowledge Alert
                    </button>
                  ) : bedAlerts[0].workflowStatus === 'ACKNOWLEDGED_PENDING' ? (
                    <button
                      onClick={() => openInterventionModal(bedAlerts[0])}
                      className="px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded shadow-xs"
                    >
                      Begin Intervention
                    </button>
                  ) : (
                    <button
                      onClick={() => openInterventionModal(bedAlerts[0])}
                      className="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold rounded shadow-xs"
                    >
                      Verify Infusion Status
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bed-Level Fault Simulation Controls */}
          <BedFaultSelector bed={selectedBed} />
        </div>

        {/* Right Column: Parameters, Live Controls & Real-Time Graph */}
        <div className="lg:col-span-7 space-y-4">
          {/* Infusion Control Panel */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Pump Delivery Operations
                </h3>
                <p className="text-[11px] text-slate-500">
                  Independent pump controls for <strong>{selectedBed.bedNumber}</strong> ({selectedBed.patient.name})
                </p>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  selectedBed.status === 'CRITICAL'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : selectedBed.status === 'WARNING'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : selectedBed.isPaused
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {selectedBed.status}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Start / Resume / Pause */}
              {selectedBed.isPaused ? (
                <button
                  onClick={() => resumeInfusion(selectedBed.id)}
                  className="py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              ) : !selectedBed.isActive ? (
                <button
                  onClick={() => startInfusion(selectedBed.id)}
                  className="py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start</span>
                </button>
              ) : (
                <button
                  onClick={() => pauseInfusion(selectedBed.id)}
                  className="py-1.5 px-3 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              {/* Stop Pump */}
              <button
                onClick={() => stopInfusion(selectedBed.id)}
                disabled={!selectedBed.isActive}
                className="py-1.5 px-3 rounded bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-300 transition-colors"
              >
                <Square className="w-3.5 h-3.5 text-slate-500" />
                <span>Stop</span>
              </button>

              {/* Reset Defaults for THIS bed */}
              <button
                onClick={() => resetSimulation(selectedBed.id)}
                className="py-1.5 px-3 rounded bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-300 transition-colors"
                title={`Reset ${selectedBed.bedNumber} only. Other beds remain intact.`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset This Bed</span>
              </button>

              {/* View Ward Overview */}
              <button
                onClick={() => onNavigate('simulator')}
                className="py-1.5 px-3 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-teal-600" />
                <span>All 6 Beds</span>
              </button>
            </div>
          </div>

          {/* Clinical Monitoring Parameters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 mb-3 border-b border-slate-100">
              Clinical Monitoring Parameters
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {/* Prescribed Rate */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Prescribed Rate</span>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                  {selectedBed.prescribedRate} <span className="text-[10px] font-normal text-slate-500">mL/h</span>
                </div>
              </div>

              {/* Actual Rate */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Actual Flow Rate</span>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 tabular-nums ${
                    selectedBed.actualRate !== selectedBed.prescribedRate ? 'text-amber-700' : 'text-slate-900'
                  }`}
                >
                  {selectedBed.actualRate} <span className="text-[10px] font-normal text-slate-500">mL/h</span>
                </div>
              </div>

              {/* Drop Rate */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Drop Telemetry</span>
                <div className="text-sm font-bold font-mono text-teal-700 mt-0.5 tabular-nums">
                  {selectedBed.dropRate} <span className="text-[10px] font-normal text-slate-500">gtt/min</span>
                </div>
              </div>

              {/* Cumulative Drop Count */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Drop Count (Total)</span>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                  {Math.floor(selectedBed.dropCount || 0)} <span className="text-[10px] font-normal text-slate-500">drops</span>
                </div>
              </div>

              {/* Drop Generation Status */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Drop Generation</span>
                <div
                  className={`text-xs font-bold font-mono uppercase mt-1 ${
                    selectedBed.isActive && !selectedBed.isPaused && selectedBed.dropRate > 0
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}
                >
                  {selectedBed.isActive && !selectedBed.isPaused && selectedBed.dropRate > 0
                    ? 'Active'
                    : 'Stopped'}
                </div>
              </div>

              {/* Initial Volume */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Initial Capacity</span>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                  {selectedBed.initialVolume} <span className="text-[10px] font-normal text-slate-500">mL</span>
                </div>
              </div>

              {/* Remaining Volume */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Remaining Volume</span>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 tabular-nums ${
                    selectedBed.remainingVolume <= 25 ? 'text-red-700' : 'text-teal-700'
                  }`}
                >
                  {Math.round(selectedBed.remainingVolume)} <span className="text-[10px] font-normal text-slate-500">mL</span>
                </div>
              </div>

              {/* Fluid Percentage */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Fluid Available</span>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                  {percentRemaining}%
                </div>
              </div>

              {/* Time to Empty */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Time to Empty</span>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                  {selectedBed.timeToEmptyMinutes !== null ? (
                    `${selectedBed.timeToEmptyMinutes} min`
                  ) : (
                    <span className="text-slate-400 font-normal text-xs">Stopped / 0 mL/h</span>
                  )}
                </div>
              </div>

              {/* Infusion Status */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-400 block">Infusion Status</span>
                <div
                  className={`text-xs font-bold font-mono uppercase mt-1 ${
                    selectedBed.status === 'CRITICAL'
                      ? 'text-red-700'
                      : selectedBed.status === 'WARNING'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {selectedBed.status}
                </div>
              </div>
            </div>
          </div>

          {/* Live Flow Rate Chart for THIS Bed */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Live Flow Telemetry vs. Prescribed ({selectedBed.bedNumber})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Independent Buffer (1s)</span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={[0, 220]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '6px',
                      color: '#0f172a',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Line
                    type="monotone"
                    dataKey="prescribedRate"
                    name="Prescribed Rate"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualRate"
                    name={`Actual Rate (${selectedBed.bedNumber})`}
                    stroke={
                      selectedBed.actualRate > 120
                        ? '#d97706'
                        : selectedBed.actualRate === 0
                        ? '#dc2626'
                        : '#0d9488'
                    }
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fluid Volume Chart for THIS Bed */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Fluid Volume Over Time ({selectedBed.bedNumber})
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {Math.round(selectedBed.remainingVolume)} mL remaining of {selectedBed.initialVolume} mL
              </span>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={[0, selectedBed.initialVolume]} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="remainingVolume"
                    name="Remaining Volume (mL)"
                    stroke="#0f766e"
                    fill="#99f6e4"
                    fillOpacity={0.45}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alert and Clinical Response History for THIS Bed */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Alert &amp; Nurse Response History ({selectedBed.bedNumber})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {bedAlertHistory.length} incident records
              </span>
            </div>

            {bedAlertHistory.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                <p className="font-medium text-slate-600">No alert incidents recorded for {selectedBed.bedNumber}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Parameters have remained within normal clinical tolerance.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {bedAlertHistory.slice(0, 4).map(alertItem => (
                  <div
                    key={alertItem.id}
                    className="p-2.5 rounded-md border border-slate-100 bg-slate-50/70 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            alertItem.isResolved
                              ? 'bg-emerald-500'
                              : alertItem.severity === 'CRITICAL'
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        <span className="font-semibold text-slate-900 text-xs">
                          {alertItem.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(alertItem.timestampMs).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600">{alertItem.description}</p>

                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-slate-200/50">
                      <span>Status: {alertItem.workflowStatus.replace('_', ' ')}</span>
                      {alertItem.acknowledgedBy && (
                        <span>Ack: {alertItem.acknowledgedBy}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
