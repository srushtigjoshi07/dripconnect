import React, { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { BedData } from '../types';
import {
  Users,
  Bed,
  Edit3,
  Check,
  X,
  Droplets,
  Activity,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface PatientsPageProps {
  onNavigate: (page: string) => void;
}

export const PatientsPage: React.FC<PatientsPageProps> = ({ onNavigate }) => {
  const {
    beds,
    selectedBedId,
    setSelectedBedId,
    updateBedPatient,
    activeAlerts,
  } = useSimulation();

  const [editingBed, setEditingBed] = useState<BedData | null>(null);

  // Form states for editing
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState(0);
  const [patientDiagnosis, setPatientDiagnosis] = useState('');
  const [solutionName, setSolutionName] = useState('');
  const [prescribedDrug, setPrescribedDrug] = useState('');
  const [prescribedRate, setPrescribedRate] = useState(100);

  const startEdit = (bed: BedData) => {
    setEditingBed(bed);
    setPatientName(bed.patient.name);
    setPatientAge(bed.patient.age);
    setPatientDiagnosis(bed.patient.diagnosis);
    setSolutionName(bed.fluid.solutionName);
    setPrescribedDrug(bed.fluid.prescribedDrug || '');
    setPrescribedRate(bed.prescribedRate);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBed) return;

    updateBedPatient(
      editingBed.id,
      {
        name: patientName,
        age: patientAge,
        diagnosis: patientDiagnosis,
      },
      {
        solutionName,
        prescribedDrug,
      },
      prescribedRate
    );

    setEditingBed(null);
  };

  const handleInspectBed = (bedId: string) => {
    setSelectedBedId(bedId);
    onNavigate('live-monitoring');
  };

  return (
    <div className="space-y-5">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Patient &amp; Bed Assignment Registry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure clinical diagnoses, IV medication regimens, and patient allocation across ward bays
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Fictional educational demonstration fixtures
          </span>
        </div>
      </div>

      {/* Bed Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {beds.map(bed => {
          const hasActiveAlert = activeAlerts.some(a => a.bedId === bed.id && !a.isResolved);
          const isSelected = selectedBedId === bed.id;

          return (
            <div
              key={bed.id}
              className={`p-4 rounded-lg border flex flex-col justify-between transition-colors ${
                bed.isDemoPrimary
                  ? 'bg-white border-teal-600 ring-1 ring-teal-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-slate-900">{bed.bedNumber}</span>
                    {bed.isDemoPrimary && (
                      <span className="text-[9px] font-mono font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded">
                        PRIMARY DEMO
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      bed.status === 'CRITICAL'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : bed.status === 'WARNING'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {bed.status}
                  </span>
                </div>

                {/* Patient Information */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-xs font-bold text-slate-900">{bed.patient.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      {bed.patient.age}y / {bed.patient.gender}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    MRN: {bed.patient.mrn} · Admitted {bed.patient.admissionDate}
                  </div>
                  <div className="text-xs text-slate-700 font-medium pt-1">
                    <span className="text-slate-400 text-[10px] block uppercase font-mono">Diagnosis</span>
                    {bed.patient.diagnosis}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Physician: {bed.patient.attendingPhysician}
                  </div>
                </div>

                {/* IV Regimen Specifications */}
                <div className="mt-3 p-2.5 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-teal-900">
                    <Droplets className="w-3.5 h-3.5 text-teal-600" />
                    <span className="truncate">{bed.fluid.solutionName}</span>
                  </div>
                  {bed.fluid.prescribedDrug && (
                    <div className="text-[11px] text-rose-700 font-medium">
                      + {bed.fluid.prescribedDrug}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Rate</span>
                      <span className="font-bold text-slate-800">{bed.actualRate} / {bed.prescribedRate} mL/h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Volume</span>
                      <span className="font-bold text-slate-800">{Math.round(bed.remainingVolume)} / {bed.initialVolume} mL</span>
                    </div>
                  </div>
                </div>

                {/* Active alert indicator */}
                {hasActiveAlert && (
                  <div className="mt-2.5 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Unresolved abnormal telemetry alert</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => startEdit(bed)}
                  className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Parameters</span>
                </button>
                <button
                  onClick={() => handleInspectBed(bed.id)}
                  className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>Live Monitor</span>
                  <ExternalLink className="w-3 h-3 text-teal-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Patient Modal */}
      {editingBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden text-slate-900">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Clinical Assignment · {editingBed.bedNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update patient identity and prescribed IV infusion parameters
                </p>
              </div>
              <button
                onClick={() => setEditingBed(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Patient Full Name</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={patientAge}
                    onChange={e => setPatientAge(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Prescribed Rate (mL/h)</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    required
                    value={prescribedRate}
                    onChange={e => setPrescribedRate(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clinical Diagnosis</label>
                <input
                  type="text"
                  required
                  value={patientDiagnosis}
                  onChange={e => setPatientDiagnosis(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">IV Fluid Solution</label>
                <input
                  type="text"
                  required
                  value={solutionName}
                  onChange={e => setSolutionName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medication Additives (Optional)</label>
                <input
                  type="text"
                  value={prescribedDrug}
                  onChange={e => setPrescribedDrug(e.target.value)}
                  placeholder="e.g., Potassium Chloride 20 mEq"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBed(null)}
                  className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 font-semibold transition-colors border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-colors"
                >
                  Save Parameters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
