import React from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { Volume2, VolumeX, AlertTriangle } from 'lucide-react';

export const BedsideBuzzerIndicator: React.FC = () => {
  const { buzzerActive, silenceBuzzer, activeAlerts } = useSimulation();

  if (!buzzerActive) return null;

  const topAlert = activeAlerts[0];

  return (
    <div className="bg-red-600 text-white px-4 sm:px-6 lg:px-8 py-2.5 shadow-md flex items-center justify-between transition-all animate-pulse w-full">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-red-700 rounded-full animate-bounce">
          <Volume2 className="w-4 h-4 text-white" />
        </div>
        <div className="text-xs">
          <span className="font-bold uppercase tracking-wider mr-2 text-red-100">
            [Bedside Buzzer Active]
          </span>
          <span className="font-medium">
            {topAlert ? `${topAlert.bedNumber}: ${topAlert.title}` : 'Abnormal infusion alert sounding'}
          </span>
        </div>
      </div>
      <button
        onClick={silenceBuzzer}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-md border border-white/30 transition-colors flex items-center gap-1.5"
      >
        <VolumeX className="w-3.5 h-3.5" />
        <span>Silence Buzzer</span>
      </button>
    </div>
  );
};
