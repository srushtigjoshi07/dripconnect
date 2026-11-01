import React from 'react';
import { BedData, BedFaultCondition } from '../../types';
import { useSimulation } from '../../context/SimulationContext';
import {
  CheckCircle2,
  Droplet,
  AlertOctagon,
  Ban,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';

interface BedFaultSelectorProps {
  bed: BedData;
}

export const BedFaultSelector: React.FC<BedFaultSelectorProps> = ({ bed }) => {
  const { setBedFaultCondition } = useSimulation();

  const currentCondition: BedFaultCondition =
    bed.faultCondition || (bed.activeScenarioId as BedFaultCondition) || 'NORMAL';

  const options: {
    id: BedFaultCondition;
    title: string;
    description: string;
    icon: React.ElementType;
    badgeColor: string;
    expectedEffect: string;
  }[] = [
    {
      id: 'NORMAL',
      title: 'Normal Infusion',
      description: 'Prescribed flow 100 mL/h, steady drop rate, normal volume depletion.',
      icon: CheckCircle2,
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      expectedEffect: 'Continuous healthy delivery; no abnormal alarms.',
    },
    {
      id: 'LOW_FLUID',
      title: 'Low Fluid Level',
      description: 'Remaining volume set to 20 mL (~12 min to empty <= 15 min threshold).',
      icon: Droplet,
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
      expectedEffect: 'Triggers low-fluid warning for nurse bag preparation.',
    },
    {
      id: 'BLOCKED_LINE',
      title: 'Blocked IV Line',
      description: 'Flow drops to 0 mL/h, chamber drop generation stops immediately.',
      icon: Ban,
      badgeColor: 'text-red-700 bg-red-50 border-red-200',
      expectedEffect: 'Triggers critical alarm after 20s occlusion timer.',
    },
    {
      id: 'HIGH_FLOW',
      title: 'High Flow Rate',
      description: 'Actual rate climbs to 185 mL/h (+85% deviation exceeds 20% limit).',
      icon: TrendingUp,
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
      expectedEffect: 'Triggers flow warning after 15s deviation window.',
    },
    {
      id: 'LOW_FLOW',
      title: 'Low Flow Rate',
      description: 'Actual rate drops to 55 mL/h (-45% deviation exceeds 20% limit).',
      icon: TrendingDown,
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
      expectedEffect: 'Triggers flow warning after 15s deviation window.',
    },
    {
      id: 'EMPTY_BOTTLE',
      title: 'Empty Bottle',
      description: 'Remaining volume depleted to 0 mL, rate 0 mL/h, drops stop.',
      icon: AlertOctagon,
      badgeColor: 'text-red-700 bg-red-50 border-red-200',
      expectedEffect: 'Triggers immediate critical alert to prevent air embolism.',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Bed-Level Fault Simulation Control
          </h3>
          <p className="text-[11px] text-slate-500">
            Select a physiological or hardware fault for <strong>{bed.bedNumber}</strong> ({bed.patient.name}). The simulation engine updates physical delivery and normal detector logic triggers alerts.
          </p>
        </div>
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200 shrink-0">
          Unit: {bed.bedNumber}
        </span>
      </div>

      {/* Grid of 6 Fault Conditions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {options.map(opt => {
          const isSelected = currentCondition === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              onClick={() => setBedFaultCondition(bed.id, opt.id)}
              className={`p-3 rounded-md border text-left transition-all duration-150 flex flex-col justify-between ${
                isSelected
                  ? 'border-teal-600 bg-teal-50/30 ring-1 ring-teal-600 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Icon className="w-3.5 h-3.5 text-slate-600" />
                    <span>{opt.title}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-100 px-1.5 py-0.2 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-snug">
                  {opt.description}
                </p>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] font-mono text-slate-400">
                {opt.expectedEffect}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          Fault injection applies strictly to <strong>{bed.bedNumber}</strong>. Other hospital ward beds continue running independently.
        </span>
      </div>
    </div>
  );
};
