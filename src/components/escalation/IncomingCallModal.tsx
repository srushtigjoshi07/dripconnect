import React, { useState } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import {
  PhoneOff,
  CheckCircle2,
  ShieldAlert,
  Wifi,
  MessageSquare,
  Volume2,
  UserCheck,
  Sun,
  Moon,
  AlertTriangle,
  Stethoscope,
  X,
} from 'lucide-react';

export const IncomingCallModal: React.FC = () => {
  const {
    activeCall,
    acknowledgeAlert,
    dismissCallModal,
    openInterventionModal,
    alerts,
    settings,
  } = useSimulation();

  const [acknowledgedInScreen, setAcknowledgedInScreen] = useState(false);

  if (!activeCall) return null;

  const targetAlert = alerts.find(a => a.id === activeCall.alertId);
  const isWhatsApp = activeCall.channel === 'WHATSAPP_VOICE';
  const isNight = activeCall.shift === 'NIGHT';

  const handleAcknowledge = () => {
    acknowledgeAlert(activeCall.alertId, activeCall.responder.name);
    setAcknowledgedInScreen(true);
  };

  const handleBeginIntervention = () => {
    if (targetAlert) {
      openInterventionModal(targetAlert);
    }
    dismissCallModal();
  };

  const isConnected = activeCall.callStatus === 'CONNECTED';
  const staffingLevel = activeCall.staffingLevelPct ?? (isNight ? 45 : 100);
  const targetResponse = activeCall.targetResponseTimeSec ?? (isNight ? 10 : 4);
  const progressPct = Math.min(100, Math.round((activeCall.secondsElapsed / targetResponse) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200 bg-white text-slate-900">
        
        {/* Top Header Banner */}
        <div className="px-5 py-3 text-xs font-semibold flex items-center justify-between border-b border-slate-200 bg-slate-50 text-slate-800">
          <div className="flex items-center gap-2">
            {acknowledgedInScreen ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-900">Response Acknowledged &bull; Intervention Pending</span>
              </>
            ) : isConnected ? (
              <>
                <UserCheck className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span className="font-semibold text-emerald-800">Call Connected &bull; Responding</span>
              </>
            ) : isWhatsApp ? (
              <>
                <Wifi className="w-4 h-4 text-teal-600" />
                <span>Simulated WhatsApp VoIP &bull; Online</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <span>Simulated GSM Voice &amp; SMS &bull; Offline</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded font-semibold border ${
              isNight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {isNight ? <Moon className="w-3 h-3 text-indigo-600" /> : <Sun className="w-3 h-3 text-amber-600" />}
              <span>{isNight ? 'Night Shift' : 'Day Shift'}</span>
            </span>
            <span className="font-mono text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
              Stage {activeCall.stageNumber}/3
            </span>
          </div>
        </div>

        {/* Call Content */}
        <div className="p-5 text-center">
          
          {/* Shift Staffing & Escalation Level Banner */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{activeCall.stageName}</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <span>Staffing: {staffingLevel}%</span>
            </div>
          </div>

          {/* Responder Avatar */}
          <div className="relative mx-auto w-16 h-16 mb-2">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold tracking-wider text-white ${activeCall.responder.avatarColor} ring-2 ${
                acknowledgedInScreen ? 'ring-blue-500' : isConnected ? 'ring-emerald-500' : 'ring-slate-200'
              }`}
            >
              {activeCall.responder.initials}
            </div>
            <div className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white ${
              acknowledgedInScreen ? 'bg-blue-600' : isConnected ? 'bg-emerald-600' : 'bg-red-600'
            }`}>
              {acknowledgedInScreen ? <CheckCircle2 className="w-3 h-3" /> : isConnected ? <CheckCircle2 className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </div>
          </div>

          <h3 className="text-base font-bold text-slate-900">{activeCall.responder.name}</h3>
          <p className="text-xs text-slate-600 font-medium">{activeCall.responder.role} &bull; {activeCall.responder.department}</p>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{activeCall.responder.phone}</p>

          {/* Connected Voice Transcript when Call Answered */}
          {isConnected && !acknowledgedInScreen && activeCall.connectedMessage && (
            <div className="mt-3.5 text-left p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Clinician Audio Transcript:</span>
              </div>
              <p className="text-emerald-900 italic text-[11px] leading-relaxed">
                {activeCall.connectedMessage}
              </p>
            </div>
          )}

          {/* Clinical Alert Card */}
          <div className="mt-3 text-left p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between items-center text-slate-700 font-medium">
              <span className="font-bold text-slate-900">{activeCall.bedNumber}</span>
              <span className="text-slate-500">Patient: {activeCall.patientName}</span>
            </div>
            <div className="text-red-700 font-semibold text-xs flex items-center gap-1">
              <span>Alert: {activeCall.alertTitle}</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-snug">
              Simulated audio dispatch: &ldquo;High priority clinical notification for {activeCall.bedNumber}. Immediate nursing attention required.&rdquo;
            </p>
          </div>

          {/* Simulated Staff Response Window Meter (Before Ack) */}
          {!isConnected && !acknowledgedInScreen && (
            <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-left">
              <div className="flex justify-between items-center text-[11px] text-slate-600 mb-1">
                <span>Shift Call Response Delay:</span>
                <span className="font-mono font-semibold text-teal-700">
                  {activeCall.secondsElapsed}s / {targetResponse}s target
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    progressPct > 80 ? 'bg-amber-500' : 'bg-teal-600'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* CRITICAL POST-ACKNOWLEDGEMENT MANDATORY WARNING */}
          {acknowledgedInScreen && (
            <div className="mt-3.5 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-md text-left text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Alert acknowledged. IV condition has NOT yet been verified as resolved.</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Notification escalation halted. As {activeCall.responder.name}, you have accepted clinical responsibility. Please proceed immediately to {activeCall.bedNumber} to examine the patient, execute the required corrective procedure, and verify the infusion status.
              </p>
            </div>
          )}

          {/* Action Buttons: Condition-dependent */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
            {!acknowledgedInScreen ? (
              <>
                <button
                  onClick={dismissCallModal}
                  className="w-full sm:flex-1 py-2 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-300 transition-colors"
                >
                  <PhoneOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Dismiss Call</span>
                </button>
                <button
                  onClick={handleAcknowledge}
                  className={`w-full sm:flex-1 py-2 px-3 rounded-md text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs ${
                    isConnected
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isConnected ? 'Confirm Response (Ack)' : 'Acknowledge Alert'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={dismissCallModal}
                  className="w-full sm:flex-1 py-2 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                  <span>Close Call Screen</span>
                </button>
                <button
                  onClick={handleBeginIntervention}
                  className="w-full sm:flex-1 py-2 px-3 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Begin Intervention</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>Route: {isWhatsApp ? 'WhatsApp VoIP' : 'GSM Direct + SMS'}</span>
          <span className="font-mono text-[10px] text-slate-600">
            Volume: {activeCall.simulatedCallVolume}% ({isNight ? 'Quiet Night Protocol' : 'Day Floor Level'})
          </span>
          <span>Audio: {settings.soundNotificationsEnabled ? 'Active' : 'Muted'}</span>
        </div>
      </div>
    </div>
  );
};
