import React from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { InterventionModal } from './InterventionModal';

export const GlobalInterventionModal: React.FC = () => {
  const { activeInterventionAlert, closeInterventionModal } = useSimulation();

  if (!activeInterventionAlert) return null;

  return (
    <InterventionModal
      alert={activeInterventionAlert}
      onClose={closeInterventionModal}
    />
  );
};
