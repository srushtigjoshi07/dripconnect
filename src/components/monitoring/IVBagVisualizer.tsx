import React from 'react';
import { BedData } from '../../types';
import { Activity, AlertTriangle, ShieldAlert, CheckCircle2, PauseCircle } from 'lucide-react';

interface IVBagVisualizerProps {
  bed: BedData;
}

export const IVBagVisualizer: React.FC<IVBagVisualizerProps> = ({ bed }) => {
  const percentage = Math.min(100, Math.max(0, (bed.remainingVolume / bed.initialVolume) * 100));
  
  // Calculate drop animation speed in seconds per drop:
  const dropIntervalSec = bed.dropRate > 0 ? Math.max(0.2, Math.min(3, 60 / bed.dropRate)) : 0;
  const isDripping = bed.dropRate > 0 && bed.actualRate > 0 && bed.remainingVolume > 0 && !bed.isPaused;

  const isCritical = bed.status === 'CRITICAL' || bed.remainingVolume === 0;
  const isWarning = bed.status === 'WARNING';

  // Dynamic fluid color - clean and minimal
  const fluidColor = isCritical
    ? 'bg-red-500/25 border-t-2 border-red-500'
    : isWarning
    ? 'bg-amber-500/25 border-t-2 border-amber-500'
    : 'bg-teal-500/25 border-t-2 border-teal-500';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 select-none">
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-mono text-teal-700 font-bold uppercase tracking-wider block">
            {bed.bedNumber} · Bedside Infusion Stand
          </span>
          <h4 className="text-sm font-bold text-slate-900">{bed.fluid.solutionName}</h4>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-slate-800">{bed.patient.name}</div>
          <div className="text-[10px] text-slate-400 font-mono">MRN: {bed.patient.mrn}</div>
        </div>
      </div>

      {/* Physical IV Rig Graphic */}
      <div className="my-5 flex flex-col items-center">
        
        {/* Metal Pole Hook */}
        <div className="w-1 h-4 bg-slate-300 rounded-t" />
        <div className="w-10 h-1 bg-slate-400 rounded-full" />
        <div className="w-0.5 h-2 bg-slate-300" />

        {/* IV Fluid Bag */}
        <div className="relative w-40 h-52 rounded-2xl bg-slate-50 border-2 border-slate-300 overflow-hidden flex flex-col justify-end">
          
          {/* Solution & Medication Label */}
          <div className="absolute top-3 left-2.5 right-2.5 bg-white border border-slate-200 p-1.5 rounded text-center z-10 pointer-events-none shadow-2xs">
            <div className="text-[10px] font-bold text-slate-800 truncate">
              {bed.fluid.solutionName}
            </div>
            {bed.fluid.prescribedDrug && (
              <div className="text-[9px] font-medium text-rose-600 truncate">
                {bed.fluid.prescribedDrug}
              </div>
            )}
            <div className="flex items-center justify-between text-[8px] text-slate-400 mt-0.5 font-mono">
              <span>{bed.initialVolume} mL total</span>
              <span>{bed.dropFactor} gtt/mL</span>
            </div>
          </div>

          {/* Calibrated Volume Measurement Graduations */}
          <div className="absolute right-1.5 top-16 bottom-3 flex flex-col justify-between text-[8px] font-mono text-slate-400 pointer-events-none z-10">
            <span>500mL -</span>
            <span>400mL -</span>
            <span>300mL -</span>
            <span>200mL -</span>
            <span>100mL -</span>
            <span>0mL -</span>
          </div>

          {/* Liquid Container Filling */}
          <div
            className={`w-full ${fluidColor} transition-all duration-500 ease-out relative`}
            style={{ height: `${percentage}%` }}
          />

          {/* Volume overlay */}
          <div className="absolute bottom-2 left-2.5 font-mono text-xs font-bold text-slate-800 z-10">
            {Math.round(bed.remainingVolume)} mL <span className="text-[10px] text-slate-500 font-normal">({Math.round(percentage)}%)</span>
          </div>
        </div>

        {/* Bag Spoke */}
        <div className="w-2 h-2 bg-slate-300 rounded-b" />

        {/* Drop Chamber Assembly */}
        <div className="relative flex flex-col items-center">
          
          {/* Optical Drop Sensor Tag */}
          <div className="absolute -left-12 top-4 bg-slate-100 border border-slate-300 rounded px-1 py-0.5 text-[8px] font-mono text-slate-600 flex items-center gap-1 z-20">
            <span className={`w-1.5 h-1.5 rounded-full ${isDripping ? 'bg-teal-500' : 'bg-slate-400'}`} />
            <span>IR SENSOR</span>
          </div>

          {/* Drop Chamber */}
          <div className="w-7 h-16 rounded-b-md border-2 border-slate-300 bg-slate-50 relative overflow-hidden flex flex-col items-center justify-between py-1">
            
            {/* Dripper Nozzle */}
            <div className="w-1 h-2 bg-slate-400 rounded-b" />

            {/* Falling Droplet Animation */}
            {isDripping ? (
              <div
                className="w-2 h-2.5 rounded-full bg-teal-600 animate-drop-fall"
                style={{ '--drop-speed': `${dropIntervalSec}s` } as React.CSSProperties}
              />
            ) : (
              <span className="text-[7px] font-mono text-slate-400 uppercase">
                {bed.isPaused ? 'Pause' : bed.remainingVolume === 0 ? 'Empty' : 'No Flow'}
              </span>
            )}

            {/* Chamber bottom meniscus */}
            <div className="w-full h-1 bg-teal-500/20" />
          </div>
        </div>

        {/* Tubing */}
        <div className="w-1 h-6 bg-slate-300" />
        
        {/* Patient Connection Port */}
        <div className="p-1.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono text-slate-600 flex items-center gap-1 mt-0.5">
          <Activity className="w-3 h-3 text-teal-600" />
          <span>Patient IV Cannula (Patent)</span>
        </div>
      </div>

      {/* Essential Parameters Table */}
      <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-slate-50 rounded border border-slate-100">
          <span className="text-[10px] text-slate-400 block font-medium">Actual Flow Rate</span>
          <span className="font-mono font-bold text-slate-900">{bed.actualRate} mL/h</span>
        </div>
        <div className="p-2 bg-slate-50 rounded border border-slate-100">
          <span className="text-[10px] text-slate-400 block font-medium">Drop Rate</span>
          <span className="font-mono font-bold text-slate-900">{bed.dropRate} gtt/min</span>
        </div>
        <div className="p-2 bg-slate-50 rounded border border-slate-100">
          <span className="text-[10px] text-slate-400 block font-medium">Remaining Volume</span>
          <span className="font-mono font-bold text-slate-900">{Math.round(bed.remainingVolume)} mL</span>
        </div>
        <div className="p-2 bg-slate-50 rounded border border-slate-100">
          <span className="text-[10px] text-slate-400 block font-medium">Est. Time to Empty</span>
          <span className="font-mono font-bold text-slate-900">
            {bed.timeToEmptyMinutes !== null ? `${bed.timeToEmptyMinutes} min` : 'N/A'}
          </span>
        </div>
      </div>

    </div>
  );
};
