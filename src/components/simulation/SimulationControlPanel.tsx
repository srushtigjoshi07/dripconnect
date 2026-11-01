import React from 'react';
import { useSimulation } from '../../context/SimulationContext';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Sparkles,
  StopCircle,
  Activity,
  Layers,
  FastForward,
  Clock,
  Info,
} from 'lucide-react';

interface SimulationControlPanelProps {
  compact?: boolean;
}

export const SimulationControlPanel: React.FC<SimulationControlPanelProps> = ({ compact = false }) => {
  const {
    isSimulationRunning,
    startSimulationEngine,
    pauseSimulationEngine,
    resumeSimulationEngine,
    stopSimulationEngine,
    resetSimulationEngine,
    runDemoScenario,
    stopDemoScenario,
    demoScenario,
    settings,
    updateSettings,
    activeShift,
    selectedBed,
  } = useSimulation();

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

        {/* 12-Step Guided Demo Scenario Button */}
        <div>
          {demoScenario.isActive ? (
            <button
              onClick={stopDemoScenario}
              className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs animate-pulse"
              title="Stop guided demo scenario"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Stop Demo Scenario</span>
            </button>
          ) : (
            <button
              onClick={runDemoScenario}
              className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Run 12-step guided demonstration sequence"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>Run 12-Step Demo Scenario</span>
            </button>
          )}
        </div>
      </div>

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
