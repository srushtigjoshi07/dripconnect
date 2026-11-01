import React, { useEffect, useState } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { SIMULATION_SCENARIOS } from '../../services/scenarios';
import { DemoPreset, DemoPresetStep } from '../../types';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Sparkles,
  StopCircle,
  FastForward,
  Clock,
  Settings2,
  Plus,
  Trash2,
  Save,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface SimulationControlPanelProps {
  compact?: boolean;
}

const ALERT_TYPE_OPTIONS = ['LOW_FLUID', 'EMPTY_BOTTLE', 'BLOCKED_LINE', 'HIGH_FLOW', 'LOW_FLOW', 'SENSOR_DISCONNECT'];
const ACTION_OPTIONS = ['NONE', 'RAISE_ALERT', 'CALL_STAGE', 'ACKNOWLEDGE', 'INTERVENE_VERIFY'];
const INTERVENTION_ACTIONS = ['CLEAR_KINK', 'REPLACE_BAG_500', 'REPLACE_BAG_1000', 'RECALIBRATE_RATE'];

export const SimulationControlPanel: React.FC<SimulationControlPanelProps> = ({ compact = false }) => {
  const {
    isSimulationRunning,
    startSimulationEngine,
    pauseSimulationEngine,
    stopSimulationEngine,
    resetSimulationEngine,
    runDemoScenario,
    stopDemoScenario,
    demoScenario,
    settings,
    updateSettings,
    activeShift,
    selectedBed,
    beds,
    demoPresets,
    activeDemoPresetId,
    activeDemoPreset,
    setActiveDemoPresetId,
    saveDemoPreset,
    deleteDemoPreset,
    resetDemoPresets,
  } = useSimulation();

  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [draft, setDraft] = useState<DemoPreset | null>(null);

  useEffect(() => {
    if (editorOpen) {
      setDraft(JSON.parse(JSON.stringify(activeDemoPreset)) as DemoPreset);
    } else {
      setDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, activeDemoPresetId]);

  const updateStep = (index: number, patch: Partial<DemoPresetStep>) => {
    setDraft(prev => {
      if (!prev) return prev;
      const steps = prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, steps };
    });
  };

  const addStep = () => {
    setDraft(prev => {
      if (!prev) return prev;
      const step: DemoPresetStep = {
        id: `step-${Date.now()}`,
        name: 'New Step',
        description: '',
        durationSec: 3,
        action: 'NONE',
      };
      return { ...prev, steps: [...prev.steps, step] };
    });
  };

  const removeStep = (index: number) => {
    setDraft(prev => (prev ? { ...prev, steps: prev.steps.filter((_, i) => i !== index) } : prev));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setDraft(prev => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      const target = index + dir;
      if (target < 0 || target >= steps.length) return prev;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...prev, steps };
    });
  };

  const createNewPreset = () => {
    const preset: DemoPreset = {
      id: `preset-${Date.now()}`,
      name: 'Custom Demonstration',
      description: 'Evaluator-defined demonstration preset.',
      targetBedId: beds[0]?.id || 'bed-01',
      steps: [
        {
          id: `step-${Date.now()}`,
          name: 'Start Normal Infusion',
          description: 'Baseline infusion on the target bed.',
          durationSec: 3,
          scenario: 'NORMAL',
          action: 'NONE',
        },
      ],
    };
    saveDemoPreset(preset);
    setDraft(JSON.parse(JSON.stringify(preset)) as DemoPreset);
  };

  const inputCls =
    'px-1.5 py-1 rounded border border-slate-200 text-[11px] text-slate-700 bg-white focus:outline-none focus:border-teal-400 w-full';
  const labelCls = 'block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-3">
      {/* Top row: Status indicators & Quick stats */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                demoScenario.isActive
                  ? 'bg-indigo-500 animate-pulse'
                  : isSimulationRunning
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span className="font-mono uppercase text-[11px]">
              {demoScenario.isActive
                ? 'GUIDED DEMO RUNNING'
                : isSimulationRunning
                ? 'ENGINE: ACTIVE'
                : 'ENGINE: PAUSED'}
            </span>
          </div>

          <span className="text-xs text-slate-500">
            Target: <strong className="text-slate-800">{selectedBed.bedNumber}</strong> ({selectedBed.patient.name})
          </span>

          <span className="text-xs text-slate-400">&bull;</span>

          <span className="text-xs text-slate-500">
            Shift: <span className="font-medium text-slate-700">{activeShift === 'DAY' ? 'Day Shift' : 'Night Shift'}</span>
          </span>
        </div>

        {/* Speed multiplier selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <FastForward className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-medium">Speed:</span>
          {[1, 2, 5].map(multiplier => (
            <button
              key={multiplier}
              onClick={() => updateSettings({ simulationSpeedMultiplier: multiplier })}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors border ${
                settings.simulationSpeedMultiplier === multiplier
                  ? 'bg-teal-50 border-teal-300 text-teal-800 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {multiplier}x
            </button>
          ))}
        </div>
      </div>

      {/* Main Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Start / Resume */}
          {!isSimulationRunning ? (
            <button
              onClick={startSimulationEngine}
              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Start simulation engine ticker"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Simulation</span>
            </button>
          ) : (
            <button
              onClick={pauseSimulationEngine}
              className="px-3 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Pause telemetry physics and escalation timer"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause Simulation</span>
            </button>
          )}

          {/* Stop */}
          <button
            onClick={stopSimulationEngine}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Stop delivery on selected bed"
          >
            <Square className="w-3.5 h-3.5 text-slate-500 fill-current" />
            <span>Stop Infusion</span>
          </button>

          {/* Reset */}
          <button
            onClick={resetSimulationEngine}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Reset telemetry and bed parameters to clinical baseline"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Baseline</span>
          </button>
        </div>

        {/* Demonstration Preset Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={activeDemoPresetId}
            onChange={e => setActiveDemoPresetId(e.target.value)}
            disabled={demoScenario.isActive}
            className="px-2 py-1.5 rounded-md border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:border-teal-400 max-w-[220px]"
            title="Select a demonstration preset"
          >
            {demoPresets.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.steps.length} steps)
              </option>
            ))}
          </select>

          <button
            onClick={() => setEditorOpen(v => !v)}
            className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Configure demonstration presets"
          >
            {editorOpen ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5 text-slate-500" />}
            <span>{editorOpen ? 'Close' : 'Configure'}</span>
          </button>

          {demoScenario.isActive ? (
            <button
              onClick={stopDemoScenario}
              className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs animate-pulse"
              title="Stop guided demo scenario"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Stop Demo</span>
            </button>
          ) : (
            <button
              onClick={() => runDemoScenario()}
              className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              title={`Run demonstration preset: ${activeDemoPreset.name}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>Run Demo Preset</span>
            </button>
          )}
        </div>
      </div>

      {/* Demonstration Preset Editor */}
      {editorOpen && draft && (
        <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className={labelCls}>Preset name</label>
              <input
                className={inputCls}
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="w-36">
              <label className={labelCls}>Target bed</label>
              <select
                className={inputCls}
                value={draft.targetBedId}
                onChange={e => setDraft({ ...draft, targetBedId: e.target.value })}
              >
                {beds.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bedNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 pb-0.5">
              <button
                onClick={() => draft && saveDemoPreset(draft)}
                className="px-2.5 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold flex items-center gap-1"
              >
                <Save className="w-3 h-3" /> Save Preset
              </button>
              <button
                onClick={createNewPreset}
                className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New
              </button>
              <button
                onClick={() => draft && deleteDemoPreset(draft.id)}
                disabled={demoPresets.length <= 1}
                className="px-2.5 py-1.5 rounded-md bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
              <button
                onClick={resetDemoPresets}
                className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium"
              >
                Reset Defaults
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Preset description</label>
            <input
              className={inputCls}
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            {draft.steps.map((step, i) => (
              <div key={step.id} className="bg-white border border-slate-200 rounded-md p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-slate-400">#{i + 1}</span>
                  <input
                    className={`${inputCls} font-semibold`}
                    value={step.name}
                    onChange={e => updateStep(i, { name: e.target.value })}
                    placeholder="Step name"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => moveStep(i, -1)} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Move step up">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveStep(i, 1)} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Move step down">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeStep(i)} className="p-1 rounded hover:bg-rose-50 text-rose-500" title="Remove step">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  className={inputCls}
                  value={step.description}
                  onChange={e => updateStep(i, { description: e.target.value })}
                  placeholder="Step description"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className={labelCls}>Bed</label>
                    <select
                      className={inputCls}
                      value={step.bedId || ''}
                      onChange={e => updateStep(i, { bedId: e.target.value || undefined })}
                    >
                      <option value="">Preset target</option>
                      {beds.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bedNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Scenario</label>
                    <select
                      className={inputCls}
                      value={step.scenario || ''}
                      onChange={e =>
                        updateStep(i, { scenario: (e.target.value || undefined) as DemoPresetStep['scenario'] })
                      }
                    >
                      <option value="">None</option>
                      {Object.values(SIMULATION_SCENARIOS).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.id.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Action</label>
                    <select
                      className={inputCls}
                      value={step.action || 'NONE'}
                      onChange={e =>
                        updateStep(i, { action: e.target.value as DemoPresetStep['action'] })
                      }
                    >
                      {ACTION_OPTIONS.map(a => (
                        <option key={a} value={a}>
                          {a.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Duration (sec)</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      className={inputCls}
                      value={step.durationSec}
                      onChange={e => updateStep(i, { durationSec: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className={labelCls}>Set volume (mL)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={step.setpoints?.remainingVolume ?? ''}
                      onChange={e =>
                        updateStep(i, {
                          setpoints: {
                            ...step.setpoints,
                            remainingVolume: e.target.value === '' ? undefined : Number(e.target.value),
                          },
                        })
                      }
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Set actual rate</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={step.setpoints?.actualRate ?? ''}
                      onChange={e =>
                        updateStep(i, {
                          setpoints: {
                            ...step.setpoints,
                            actualRate: e.target.value === '' ? undefined : Number(e.target.value),
                          },
                        })
                      }
                      placeholder="—"
                    />
                  </div>
                  {step.action === 'RAISE_ALERT' && (
                    <div>
                      <label className={labelCls}>Alert type</label>
                      <select
                        className={inputCls}
                        value={step.alertType || 'HIGH_FLOW'}
                        onChange={e =>
                          updateStep(i, { alertType: e.target.value as DemoPresetStep['alertType'] })
                        }
                      >
                        {ALERT_TYPE_OPTIONS.map(t => (
                          <option key={t} value={t}>
                            {t.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {step.action === 'CALL_STAGE' && (
                    <div>
                      <label className={labelCls}>Call stage</label>
                      <select
                        className={inputCls}
                        value={step.callStage || 1}
                        onChange={e =>
                          updateStep(i, { callStage: Number(e.target.value) as DemoPresetStep['callStage'] })
                        }
                      >
                        <option value={1}>1 · Duty Nurse</option>
                        <option value={2}>2 · Ward Attendant</option>
                        <option value={3}>3 · Senior Nurse</option>
                      </select>
                    </div>
                  )}
                  {step.action === 'INTERVENE_VERIFY' && (
                    <div>
                      <label className={labelCls}>Corrective action</label>
                      <select
                        className={inputCls}
                        value={step.interventionActionId || 'CLEAR_KINK'}
                        onChange={e => updateStep(i, { interventionActionId: e.target.value })}
                      >
                        {INTERVENTION_ACTIONS.map(a => (
                          <option key={a} value={a}>
                            {a.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={addStep}
              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-dashed border-slate-300 text-[11px] font-medium flex items-center gap-1 w-full justify-center"
            >
              <Plus className="w-3 h-3" /> Add Step
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Presets are stored locally in your browser. Steps apply a built-in scenario and/or setpoints to a bed, then
            optionally raise an alert, place an escalation call, acknowledge the demo alert, or record an intervention
            and run sensor verification against live telemetry.
          </p>
        </div>
      )}

      {/* Demo Scenario Progress Banner when Active */}
      {demoScenario.isActive && (
        <div className="bg-slate-900 text-white rounded-lg p-3 space-y-2 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono text-[11px] font-bold">
                Step {demoScenario.currentStep} of {demoScenario.totalSteps}
              </span>
              <h4 className="text-xs font-bold text-white tracking-wide">
                {demoScenario.stepName}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-teal-400" />
                Next: {demoScenario.secondsRemainingInStep}s
              </span>
              <button
                onClick={stopDemoScenario}
                className="text-[11px] text-rose-300 hover:text-rose-200 underline font-medium ml-2"
              >
                Halt Demo
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-teal-400 h-full transition-all duration-300"
              style={{
                width: `${Math.round((demoScenario.currentStep / demoScenario.totalSteps) * 100)}%`,
              }}
            />
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
            {demoScenario.stepDescription}
          </p>
        </div>
      )}
    </div>
  );
};
