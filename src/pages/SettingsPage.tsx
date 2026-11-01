import React, { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import {
  Settings,
  RotateCcw,
  Save,
  Sliders,
  Volume2,
  Wifi,
  Users,
  Cpu,
  ShieldCheck,
  Check,
  Server,
  Zap,
  Sun,
  Moon,
  Clock,
  Volume1,
  PhoneCall,
  Activity,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

interface SettingsPageProps {
  onNavigate: (page: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const {
    settings,
    updateSettings,
    resetSettingsToDefault,
  } = useSimulation();

  const [formState, setFormState] = useState({ ...settings });
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [activeTabShift, setActiveTabShift] = useState<'DAY' | 'NIGHT'>(formState.activeShift || 'DAY');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      ...formState,
      responders: formState.activeShift === 'NIGHT' ? formState.nightShiftResponders : formState.dayShiftResponders,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleReset = () => {
    resetSettingsToDefault();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const isNight = formState.activeShift === 'NIGHT';

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Configuration &amp; Telemetry Thresholds
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure shift management rosters, call volumes, clinical detection timers, drop factor calibration, and hardware endpoints
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Reset Clinical Defaults</span>
          </button>
        </div>
      </div>

      {savedFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Configuration saved and persisted to local browser storage successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        
        {/* Section 0: Shift Management & Escalation Staffing Module (Core Feature) */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                isNight ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {isNight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Hospital Shift Management &amp; Staffing
                  </h3>
                  <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-bold px-1.5 py-0.2 rounded uppercase tracking-wider">
                    Core Module
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configure shift rotation, staffing ratios, simulated call response delays, and on-call hierarchy
                </p>
              </div>
            </div>

            <span className={`self-start sm:self-auto text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
              isNight
                ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              {isNight ? '🌙 Night Shift Active' : '☀️ Day Shift Active'}
            </span>
          </div>

          {/* Shift Toggle Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Active Hospital Shift
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Day Shift Button */}
              <button
                type="button"
                onClick={() => {
                  setFormState(prev => ({
                    ...prev,
                    activeShift: 'DAY',
                    simulatedCallVolume: 80,
                  }));
                  setActiveTabShift('DAY');
                }}
                className={`p-3.5 rounded-lg border text-left transition-colors relative ${
                  formState.activeShift === 'DAY'
                    ? 'bg-amber-50/50 border-amber-400 text-amber-950 ring-1 ring-amber-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className={`w-4 h-4 ${formState.activeShift === 'DAY' ? 'text-amber-600' : 'text-slate-400'}`} />
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Day Shift</h4>
                      <p className="text-[11px] text-slate-500">07:00 – 19:00 · Daytime Floor Coverage</p>
                    </div>
                  </div>
                  {formState.activeShift === 'DAY' && (
                    <span className="bg-amber-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.2 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-amber-200/50 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Staffing Level</span>
                    <span className="font-semibold text-slate-800">{formState.dayStaffingLevel}% (1:4)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Call Response</span>
                    <span className="font-semibold text-slate-800">~{formState.dayCallResponseTimeSec}s Rapid</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Acoustics</span>
                    <span className="font-semibold text-slate-800">80% Floor</span>
                  </div>
                </div>
              </button>

              {/* Night Shift Button */}
              <button
                type="button"
                onClick={() => {
                  setFormState(prev => ({
                    ...prev,
                    activeShift: 'NIGHT',
                    simulatedCallVolume: 45,
                  }));
                  setActiveTabShift('NIGHT');
                }}
                className={`p-3.5 rounded-lg border text-left transition-colors relative ${
                  formState.activeShift === 'NIGHT'
                    ? 'bg-indigo-50/50 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className={`w-4 h-4 ${formState.activeShift === 'NIGHT' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Night Shift</h4>
                      <p className="text-[11px] text-slate-500">19:00 – 07:00 · Graveyard &amp; Nocturnist Coverage</p>
                    </div>
                  </div>
                  {formState.activeShift === 'NIGHT' && (
                    <span className="bg-indigo-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.2 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-indigo-200/50 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Staffing Level</span>
                    <span className="font-semibold text-slate-800">{formState.nightStaffingLevel}% (1:8)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Call Response</span>
                    <span className="font-semibold text-slate-800">~{formState.nightCallResponseTimeSec}s On-Call</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Acoustics</span>
                    <span className="font-semibold text-slate-800">45% Hushed</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Shift-Specific Staffing Level & Simulated Response Times Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            
            {/* Day Shift Parameters */}
            <div className={`p-3.5 rounded-lg border space-y-2.5 ${
              formState.activeShift === 'DAY' ? 'bg-amber-50/30 border-amber-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <Sun className="w-4 h-4 text-amber-600" />
                  <span>Day Shift Staffing &amp; Call Response Protocol</span>
                </div>
                <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                  07:00 - 19:00
                </span>
              </div>

              {/* Day Staffing Level Slider */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-600 font-medium">Day Floor Staffing Ratio:</span>
                  <span className="font-mono font-bold text-amber-900">
                    {formState.dayStaffingLevel}% ({formState.dayStaffingLevel >= 80 ? '1:4 Standard' : formState.dayStaffingLevel >= 50 ? '1:6 Moderate' : '1:8 Understaffed'})
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={formState.dayStaffingLevel}
                  onChange={e => {
                    const level = Number(e.target.value);
                    const recommendedTime = Math.max(3, Math.round(4 * (100 / level)));
                    setFormState(prev => ({
                      ...prev,
                      dayStaffingLevel: level,
                      dayCallResponseTimeSec: recommendedTime,
                    }));
                  }}
                  className="w-full accent-amber-600"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  High daytime staffing enables swift bedside response within ward rooms.
                </span>
              </div>

              {/* Day Simulated Call Response Time */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-600 font-medium">Simulated Call Response Time:</span>
                  <span className="font-mono font-bold text-amber-900">
                    {formState.dayCallResponseTimeSec} seconds
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="2"
                    max="15"
                    step="1"
                    value={formState.dayCallResponseTimeSec}
                    onChange={e => setFormState(prev => ({ ...prev, dayCallResponseTimeSec: Number(e.target.value) }))}
                    className="w-full accent-amber-600"
                  />
                  <input
                    type="number"
                    min="2"
                    max="15"
                    value={formState.dayCallResponseTimeSec}
                    onChange={e => setFormState(prev => ({ ...prev, dayCallResponseTimeSec: Number(e.target.value) }))}
                    className="w-16 p-1 bg-white border border-slate-300 rounded font-mono text-xs text-center"
                  />
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, dayCallResponseTimeSec: 3 }))}
                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] rounded font-medium"
                  >
                    Rapid (3s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, dayCallResponseTimeSec: 4 }))}
                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] rounded font-medium"
                  >
                    Standard (4s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, dayCallResponseTimeSec: 6 }))}
                    className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] rounded font-medium"
                  >
                    Busy Ward (6s)
                  </button>
                </div>
              </div>
            </div>

            {/* Night Shift Parameters */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              formState.activeShift === 'NIGHT' ? 'bg-indigo-50/40 border-indigo-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span>Night Shift Staffing &amp; On-Call Nocturnist Protocol</span>
                </div>
                <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded font-semibold">
                  19:00 - 07:00
                </span>
              </div>

              {/* Night Staffing Level Slider */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-600 font-medium">Overnight Staffing Level:</span>
                  <span className="font-mono font-bold text-indigo-900">
                    {formState.nightStaffingLevel}% ({formState.nightStaffingLevel >= 60 ? '1:6 Moderate' : formState.nightStaffingLevel >= 35 ? '1:8 Lean On-Call' : '1:12 Critical Lean'})
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="100"
                  step="5"
                  value={formState.nightStaffingLevel}
                  onChange={e => {
                    const level = Number(e.target.value);
                    const recommendedTime = Math.max(6, Math.round(5 * (100 / level)));
                    setFormState(prev => ({
                      ...prev,
                      nightStaffingLevel: level,
                      nightCallResponseTimeSec: recommendedTime,
                    }));
                  }}
                  className="w-full accent-indigo-600"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Lean nocturnal staffing relies on on-call paging for the nocturnist and house supervisor.
                </span>
              </div>

              {/* Night Simulated Call Response Time */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-600 font-medium">Simulated Call Response Time:</span>
                  <span className="font-mono font-bold text-indigo-900">
                    {formState.nightCallResponseTimeSec} seconds
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={formState.nightCallResponseTimeSec}
                    onChange={e => setFormState(prev => ({ ...prev, nightCallResponseTimeSec: Number(e.target.value) }))}
                    className="w-full accent-indigo-600"
                  />
                  <input
                    type="number"
                    min="5"
                    max="30"
                    value={formState.nightCallResponseTimeSec}
                    onChange={e => setFormState(prev => ({ ...prev, nightCallResponseTimeSec: Number(e.target.value) }))}
                    className="w-16 p-1 bg-white border border-slate-300 rounded font-mono text-xs text-center"
                  />
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, nightCallResponseTimeSec: 8 }))}
                    className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] rounded font-medium"
                  >
                    Urgent (8s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, nightCallResponseTimeSec: 10 }))}
                    className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] rounded font-medium"
                  >
                    Nocturnist Standard (10s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, nightCallResponseTimeSec: 15 }))}
                    className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] rounded font-medium"
                  >
                    Extended Triage (15s)
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Automated Response Simulation & Call Acoustic Volume Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Auto-response toggle */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  <span>Simulated Clinician Call Answering</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  When enabled, duty nurses and on-call nocturnists automatically answer the simulated VoIP/GSM call when the shift response delay expires.
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer pt-2 border-t border-slate-200">
                <input
                  type="checkbox"
                  checked={formState.autoNurseResponseEnabled}
                  onChange={e => setFormState(prev => ({ ...prev, autoNurseResponseEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-teal-600 accent-teal-600 cursor-pointer"
                />
                <span className="font-semibold text-slate-800 text-xs">
                  Enable Automated Clinician Call Pick-up &amp; Transcript
                </span>
              </label>
            </div>

            {/* Simulated Call Volume Control */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Volume2 className="w-4 h-4 text-teal-600" />
                  <span>Acoustic Call &amp; Alarm Volume</span>
                </div>
                <span className="font-mono font-bold text-base text-teal-700">
                  {formState.simulatedCallVolume}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={formState.simulatedCallVolume}
                onChange={e =>
                  setFormState(prev => ({
                    ...prev,
                    simulatedCallVolume: Number(e.target.value),
                  }))
                }
                className="w-full accent-teal-600"
              />
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 font-mono">10% (Whisper)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, simulatedCallVolume: 45 }))}
                    className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-semibold"
                  >
                    Night Quiet (45%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, simulatedCallVolume: 80 }))}
                    className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-semibold"
                  >
                    Day Standard (80%)
                  </button>
                </div>
                <span className="text-slate-400 font-mono">100% (Audible Max)</span>
              </div>
            </div>

          </div>
        </div>

        {/* Section 1: Shift-Specific Escalation Rosters and Timeouts */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900">
                Shift Escalation Priority Rosters &amp; Timeouts
              </h3>
            </div>

            {/* Sub-tabs to edit Day vs Night lists */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTabShift('DAY')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTabShift === 'DAY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Day Roster (3 Tiers)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabShift('NIGHT')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTabShift === 'NIGHT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Night Roster (3 Tiers)</span>
              </button>
            </div>
          </div>

          {/* Timeouts for the selected shift tab */}
          <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
              {activeTabShift} Shift Escalation Timeout Cadence (Seconds)
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-500 mb-1">
                  Tier 1 Timeout (Duty Nurse)
                </label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={
                    activeTabShift === 'DAY'
                      ? formState.dayShiftTimeouts.stage1
                      : formState.nightShiftTimeouts.stage1
                  }
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (activeTabShift === 'DAY') {
                      setFormState(prev => ({
                        ...prev,
                        dayShiftTimeouts: { ...prev.dayShiftTimeouts, stage1: val },
                      }));
                    } else {
                      setFormState(prev => ({
                        ...prev,
                        nightShiftTimeouts: { ...prev.nightShiftTimeouts, stage1: val },
                      }));
                    }
                  }}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-500 mb-1">
                  Tier 2 Timeout (Attendant / Nocturnist)
                </label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={
                    activeTabShift === 'DAY'
                      ? formState.dayShiftTimeouts.stage2
                      : formState.nightShiftTimeouts.stage2
                  }
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (activeTabShift === 'DAY') {
                      setFormState(prev => ({
                        ...prev,
                        dayShiftTimeouts: { ...prev.dayShiftTimeouts, stage2: val },
                      }));
                    } else {
                      setFormState(prev => ({
                        ...prev,
                        nightShiftTimeouts: { ...prev.nightShiftTimeouts, stage2: val },
                      }));
                    }
                  }}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-500 mb-1">
                  Tier 3 Timeout (Supervisor)
                </label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={
                    activeTabShift === 'DAY'
                      ? formState.dayShiftTimeouts.stage3
                      : formState.nightShiftTimeouts.stage3
                  }
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (activeTabShift === 'DAY') {
                      setFormState(prev => ({
                        ...prev,
                        dayShiftTimeouts: { ...prev.dayShiftTimeouts, stage3: val },
                      }));
                    } else {
                      setFormState(prev => ({
                        ...prev,
                        nightShiftTimeouts: { ...prev.nightShiftTimeouts, stage3: val },
                      }));
                    }
                  }}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Responder Cards for Active Shift Tab */}
          <div className="space-y-2">
            {(activeTabShift === 'DAY' ? formState.dayShiftResponders : formState.nightShiftResponders).map(
              (resp, idx) => (
                <div
                  key={resp.id}
                  className="p-3 bg-slate-50 rounded-md border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs"
                >
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-500">
                      Tier {idx + 1} Role
                    </label>
                    <span className="font-bold text-slate-900 block mt-0.5">{resp.role}</span>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-500">
                      Staff Member Name
                    </label>
                    <input
                      type="text"
                      value={resp.name}
                      onChange={e => {
                        const targetList =
                          activeTabShift === 'DAY'
                            ? [...formState.dayShiftResponders]
                            : [...formState.nightShiftResponders];
                        targetList[idx].name = e.target.value;
                        if (activeTabShift === 'DAY') {
                          setFormState(prev => ({ ...prev, dayShiftResponders: targetList }));
                        } else {
                          setFormState(prev => ({ ...prev, nightShiftResponders: targetList }));
                        }
                      }}
                      className="w-full mt-0.5 p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-500">
                      Department / Shift Assignment
                    </label>
                    <input
                      type="text"
                      value={resp.department}
                      onChange={e => {
                        const targetList =
                          activeTabShift === 'DAY'
                            ? [...formState.dayShiftResponders]
                            : [...formState.nightShiftResponders];
                        targetList[idx].department = e.target.value;
                        if (activeTabShift === 'DAY') {
                          setFormState(prev => ({ ...prev, dayShiftResponders: targetList }));
                        } else {
                          setFormState(prev => ({ ...prev, nightShiftResponders: targetList }));
                        }
                      }}
                      className="w-full mt-0.5 p-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-500">
                      Dispatch Phone (Simulated)
                    </label>
                    <input
                      type="text"
                      value={resp.phone}
                      onChange={e => {
                        const targetList =
                          activeTabShift === 'DAY'
                            ? [...formState.dayShiftResponders]
                            : [...formState.nightShiftResponders];
                        targetList[idx].phone = e.target.value;
                        if (activeTabShift === 'DAY') {
                          setFormState(prev => ({ ...prev, dayShiftResponders: targetList }));
                        } else {
                          setFormState(prev => ({ ...prev, nightShiftResponders: targetList }));
                        }
                      }}
                      className="w-full mt-0.5 p-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Section 2: Clinical Abnormality Thresholds */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900">
              Clinical Abnormality Detection Timers &amp; Tolerances
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Deviation Tolerance */}
            <div>
              <label htmlFor="flow-dev-tol" className="block font-semibold text-slate-700 mb-1">
                Flow Deviation Tolerance (±%)
              </label>
              <input
                id="flow-dev-tol"
                type="number"
                min="5"
                max="50"
                value={formState.flowRateDeviationTolerancePct}
                onChange={e =>
                  setFormState(prev => ({
                    ...prev,
                    flowRateDeviationTolerancePct: Number(e.target.value),
                  }))
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Default 20% (80 - 120 mL/h on 100 mL/h base)</p>
            </div>

            {/* Abnormal Flow Duration */}
            <div>
              <label htmlFor="abnormal-flow-dur" className="block font-semibold text-slate-700 mb-1">
                Abnormal Flow Duration (Seconds)
              </label>
              <input
                id="abnormal-flow-dur"
                type="number"
                min="5"
                max="60"
                value={formState.abnormalFlowDurationThresholdSec}
                onChange={e =>
                  setFormState(prev => ({
                    ...prev,
                    abnormalFlowDurationThresholdSec: Number(e.target.value),
                  }))
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Default 15s continuously abnormal before warning</p>
            </div>

            {/* Blocked Line Duration */}
            <div>
              <label htmlFor="blocked-line-dur" className="block font-semibold text-slate-700 mb-1">
                Blocked Line / Zero Drop (Seconds)
              </label>
              <input
                id="blocked-line-dur"
                type="number"
                min="5"
                max="60"
                value={formState.blockedLineDurationThresholdSec}
                onChange={e =>
                  setFormState(prev => ({
                    ...prev,
                    blockedLineDurationThresholdSec: Number(e.target.value),
                  }))
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Default 20s without drops triggers critical occlusion</p>
            </div>

            {/* Low Fluid Warning Threshold */}
            <div>
              <label htmlFor="low-fluid-thresh" className="block font-semibold text-slate-700 mb-1">
                Low-Fluid Threshold (Minutes)
              </label>
              <input
                id="low-fluid-thresh"
                type="number"
                min="5"
                max="60"
                value={formState.lowFluidWarningMinutesThreshold}
                onChange={e =>
                  setFormState(prev => ({
                    ...prev,
                    lowFluidWarningMinutesThreshold: Number(e.target.value),
                  }))
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Default &le; 15 minutes estimated time to empty</p>
            </div>

            {/* Drop Factor */}
            <div>
              <label htmlFor="drop-factor-calib" className="block font-semibold text-slate-700 mb-1">
                Drop Factor (drops/mL)
              </label>
              <input
                id="drop-factor-calib"
                type="number"
                min="10"
                max="60"
                value={formState.dropFactor}
                onChange={e =>
                  setFormState(prev => ({
                    ...prev,
                    dropFactor: Number(e.target.value),
                  }))
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Standard adult IV tubing calibrated to 20 gtt/mL</p>
            </div>

            {/* Simulation Speed Multiplier */}
            <div>
              <label htmlFor="sim-speed-mult" className="block font-semibold text-slate-700 mb-1">
                Simulation Clock Multiplier
              </label>
              <select
                id="sim-speed-mult"
                value={formState.simulationSpeedMultiplier}
                onChange={e =>
                  setFormState(prev => ({
                    ...prev,
                    simulationSpeedMultiplier: Number(e.target.value),
                  }))
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              >
                <option value={1}>1x (Real-time clinical clock)</option>
                <option value={2}>2x (Accelerated demonstration)</option>
                <option value={5}>5x (Fast fluid drainage)</option>
                <option value={10}>10x (Ultra-rapid faculty demo)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-0.5">Accelerates fluid volume depletion</p>
            </div>
          </div>
        </div>

        {/* Section 3: Communication & Audio Toggles */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Wifi className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900">
              Communication Gateway &amp; Sound Configuration
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Internet Connectivity Toggle */}
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Simulate Internet Connectivity</span>
                <span className="text-[11px] text-slate-500">
                  {formState.internetAvailable
                    ? 'Active: WhatsApp VoIP audio call simulation'
                    : 'Offline: Fallback to direct GSM phone dialer & SMS broadcast'}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormState(prev => ({ ...prev, internetAvailable: !prev.internetAvailable }))
                }
                className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                  formState.internetAvailable ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
              </button>
            </div>

            {/* Sound Notifications Toggle */}
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Bedside Buzzer &amp; Audio Alerts</span>
                <span className="text-[11px] text-slate-500">
                  Synthesized Web Audio API medical buzzer, warning chimes, and phone rings
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormState(prev => ({
                    ...prev,
                    soundNotificationsEnabled: !prev.soundNotificationsEnabled,
                  }))
                }
                className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                  formState.soundNotificationsEnabled ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Hardware Integration Specifications */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Cpu className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900">
              Physical Microcontroller &amp; Sensor Telemetry Architecture (ESP32 Integration)
            </h3>
          </div>

          <div className="text-xs text-slate-600 leading-relaxed space-y-2.5">
            <p>
              DripConnect is architected with a decoupled telemetry layer ready to interface with physical IoT hardware nodes (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">/src/services/hardwareInterface.ts</code>):
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Optical Drop Sensor</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Infrared photodiode beam (TCRT5000 / LM393) attached to drip chamber to register drop interrupts with microsecond timing.
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-teal-600" />
                  <span>Load Cell Fluid Scale</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  HX711 24-bit ADC amplifier coupled to a strain gauge suspension hook measuring weight loss of the IV fluid reservoir.
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  <span>GSM/GPRS Cellular Transceiver</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  SIM800L / Quectel EC25 modem running standard Hayes AT commands (<code className="font-mono text-[10px]">ATD</code>, <code className="font-mono text-[10px]">AT+CMGS</code>) for direct carrier failover.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save All Configurations &amp; Shift Rosters</span>
          </button>
        </div>

      </form>

    </div>
  );
};
