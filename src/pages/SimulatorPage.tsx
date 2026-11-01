import React from 'react';
import { useSimulation } from '../context/SimulationContext';
import { BedCard } from '../components/ward/BedCard';
import { SimulationControlPanel } from '../components/simulation/SimulationControlPanel';
import {
  Bed,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  BellRing,
  Activity,
  ArrowRight,
  Sun,
  Moon,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface SimulatorPageProps {
  onNavigate: (page: string) => void;
}

export const SimulatorPage: React.FC<SimulatorPageProps> = ({ onNavigate }) => {
  const {
    beds,
    activeAlerts,
    setSelectedBedId,
    openInterventionModal,
    activeShift,
    toggleShift,
    activeResponders,
    resetSimulation,
  } = useSimulation();

  const isNight = activeShift === 'NIGHT';
  const dutyStaff = activeResponders[0];

  // Ward-Level Summary Metrics calculated strictly from real bed & alert state
  const totalBeds = beds.length;
  const normalBeds = beds.filter(
    b => b.status === 'NORMAL' && !activeAlerts.some(a => a.bedId === b.id && !a.isResolved)
  ).length;

  const bedsWithWarnings = beds.filter(
    b =>
      b.status === 'WARNING' ||
      activeAlerts.some(a => a.bedId === b.id && a.severity === 'WARNING' && !a.isResolved)
  ).length;

  const bedsWithCritical = beds.filter(
    b =>
      b.status === 'CRITICAL' ||
      activeAlerts.some(a => a.bedId === b.id && a.severity === 'CRITICAL' && !a.isResolved)
  ).length;

  const acknowledgedAlerts = activeAlerts.filter(
    a => a.workflowStatus === 'ACKNOWLEDGED_PENDING' || a.workflowStatus === 'INTERVENTION_IN_PROGRESS'
  ).length;

  const unresolvedAlerts = activeAlerts.filter(a => !a.isResolved).length;

  const handleSelectBed = (bedId: string) => {
    setSelectedBedId(bedId);
    onNavigate('live-monitoring');
  };

  return (
    <div className="space-y-5">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Ward Overview – Live Infusion Monitoring
            </h1>
            <button
              onClick={toggleShift}
              className={`px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 border transition-colors ${
                isNight
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Toggle Day/Night hospital shift"
            >
              {isNight ? <Moon className="w-3 h-3 text-indigo-600" /> : <Sun className="w-3 h-3 text-amber-600" />}
              <span>{isNight ? 'Night Shift' : 'Day Shift'} ({dutyStaff?.name})</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hospital-wide multi-bed IV telemetry. Each station operates an independent infusion physics engine and automated nurse response.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-2.5 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => onNavigate('live-monitoring')}
            className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Detailed Live Rig</span>
            <ArrowRight className="w-3.5 h-3.5 text-teal-300" />
          </button>
        </div>
      </div>

      {/* Ward-Level Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Beds */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Total Beds</span>
            <Bed className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {totalBeds}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active Ward 4B Units</div>
        </div>

        {/* 2. Normal Beds */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-700">Normal Beds</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums">
            {normalBeds}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Parameters steady</div>
        </div>

        {/* 3. Beds with Warnings */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-700">Warnings</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 font-mono tabular-nums">
            {bedsWithWarnings}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Low fluid / rate dev</div>
        </div>

        {/* 4. Beds with Critical Alerts */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-red-700">Critical Beds</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-xl font-bold text-red-600 font-mono tabular-nums">
            {bedsWithCritical}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Empty / blocked line</div>
        </div>

        {/* 5. Acknowledged Alerts */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-blue-700">Acknowledged</span>
            <BellRing className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-700 font-mono tabular-nums">
            {acknowledgedAlerts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Intervention pending</div>
        </div>

        {/* 6. Unresolved Alerts */}
        <div className={`p-3 rounded-lg border shadow-xs ${
          unresolvedAlerts > 0 ? 'bg-red-50/60 border-red-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`text-[10px] uppercase font-semibold tracking-wider ${
              unresolvedAlerts > 0 ? 'text-red-700' : 'text-slate-400'
            }`}>
              Unresolved Alerts
            </span>
            <Activity className={`w-3.5 h-3.5 ${unresolvedAlerts > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${
            unresolvedAlerts > 0 ? 'text-red-700' : 'text-slate-900'
          }`}>
            {unresolvedAlerts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Requiring verification</div>
        </div>
      </div>

      {/* Embedded Simulation & Speed Control Panel */}
      <SimulationControlPanel compact />

      {/* Ward Overview – Live Infusion Monitoring Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Ward Overview – Live Infusion Monitoring
            </h2>
            <p className="text-xs text-slate-500">
              Select any bed card to inspect live drip drops, fluid volume trends, and clinical verification
            </p>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            6 Demonstration Beds &bull; Independent Physics Engine
          </span>
        </div>

        {/* Responsive Grid with the Six Demonstration Beds */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {beds.map(bed => {
            const bedAlert = activeAlerts.find(a => a.bedId === bed.id && !a.isResolved);
            return (
              <BedCard
                key={bed.id}
                bed={bed}
                activeAlert={bedAlert}
                onSelectBed={handleSelectBed}
                onOpenIntervention={openInterventionModal}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
