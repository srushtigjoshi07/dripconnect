import React from 'react';
import { useSimulation } from '../context/SimulationContext';
import {
  PhoneCall,
  Volume2,
  Wifi,
  WifiOff,
  Clock,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Phone,
  MessageSquare,
  AlertTriangle,
  Radio,
  Sliders,
  Sun,
  Moon,
  Volume1,
  Users,
} from 'lucide-react';

interface EscalationPageProps {
  onNavigate: (page: string) => void;
}

export const EscalationPage: React.FC<EscalationPageProps> = ({ onNavigate }) => {
  const {
    settings,
    updateSettings,
    activeAlerts,
    buzzerActive,
    acknowledgeAlert,
    triggerScenario,
    silenceBuzzer,
    openInterventionModal,
    activeShift,
    toggleShift,
    setActiveShift,
    activeResponders,
    activeTimeouts,
    simulatedCallVolume,
    setSimulatedCallVolume,
    activeStaffingLevel,
    activeCallResponseTime,
  } = useSimulation();

  const toggleInternet = () => {
    updateSettings({ internetAvailable: !settings.internetAvailable });
  };

  const currentCritical = activeAlerts.find(a => !a.isResolved);
  const isNight = activeShift === 'NIGHT';

  return (
    <div className="space-y-5">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Nurse Response &amp; Escalation Architecture
            </h1>
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1 border ${
                isNight
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isNight ? <Moon className="w-3 h-3 text-indigo-600" /> : <Sun className="w-3 h-3 text-amber-600" />}
              <span>{isNight ? 'Night Shift Active' : 'Day Shift Active'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Fail-safe tiered notification sequence dynamically calibrated for {isNight ? 'night-time staffing & acoustic protocols' : 'daytime clinical coverage'}
          </p>
        </div>

        {/* Connectivity Mode Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleInternet}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-2 transition-colors ${
              settings.internetAvailable
                ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {settings.internetAvailable ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-teal-600" />
                <span>Internet Available · WhatsApp VoIP</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Internet Offline · GSM &amp; SMS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Shift Management Control Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
              isNight ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              {isNight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hospital Shift Management</h2>
              <p className="text-[11px] text-slate-500">
                Dynamically reconfigures responder personnel, call volume acoustics, and escalation timeout thresholds
              </p>
            </div>
          </div>

          {/* Shift Segmented Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md self-start sm:self-auto border border-slate-200">
            <button
              onClick={() => setActiveShift('DAY')}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                !isNight
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Day Shift (07:00 - 19:00)</span>
            </button>
            <button
              onClick={() => setActiveShift('NIGHT')}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isNight
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Night Shift (19:00 - 07:00)</span>
            </button>
          </div>
        </div>

        {/* Shift Attributes Comparison Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          
          {/* Active Shift Profile */}
          <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
            <div className="flex justify-between items-center text-slate-500 mb-1">
              <span className="font-semibold text-[11px] uppercase tracking-wider">Clinical Coverage &amp; Staffing</span>
              <span className="font-mono text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                {activeStaffingLevel}% Staffing
              </span>
            </div>
            <div className="font-bold text-slate-900 text-xs">
              {isNight ? 'Overnight Graveyard Staffing' : 'Full Daytime Staffing'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {isNight
                ? `Leaner on-site nursing (${activeStaffingLevel}%); response delay ~${activeCallResponseTime}s. Direct escalation to on-call nocturnist physician.`
                : `Full floor nursing (${activeStaffingLevel}%); rapid response ~${activeCallResponseTime}s. Bedside duty nurse and floor charge escalation.`}
            </p>
          </div>

          {/* Simulated Call Volume Slider */}
          <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1">
            <div className="flex justify-between items-center text-slate-500">
              <span className="font-semibold text-[11px] uppercase tracking-wider">Simulated Call Volume</span>
              <span className="font-mono font-bold text-teal-700">{simulatedCallVolume}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={simulatedCallVolume}
              onChange={e => setSimulatedCallVolume(Number(e.target.value))}
              className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>10% (Whisper)</span>
              <span>{isNight ? '45% (Night)' : '80% (Day)'}</span>
              <span>100% (Max)</span>
            </div>
          </div>

          {/* Escalation Speed Cadence */}
          <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
            <div className="flex justify-between items-center text-slate-500 mb-1">
              <span className="font-semibold text-[11px] uppercase tracking-wider">Timeout Cadence</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="font-mono font-bold text-slate-900 text-xs">
              {activeTimeouts.stage1}s &rarr; {activeTimeouts.stage2}s &rarr; {activeTimeouts.stage3}s
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {isNight
                ? 'Accelerated timeout (3s / 10s / 20s) ensures immediate nocturnal response.'
                : 'Standard timeout (4s / 14s / 28s) matches day ward intervention windows.'}
            </p>
          </div>

        </div>
      </div>

      {/* Live Escalation Engine State Card - Clean White Style */}
      <div className={`p-4 rounded-lg border bg-white ${
        currentCritical ? 'border-red-300' : 'border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${currentCritical ? 'text-red-600 animate-pulse' : 'text-slate-400'}`} />
            <h3 className="text-sm font-bold text-slate-900">
              Active Escalation State Engine ({isNight ? 'Night Shift Protocol' : 'Day Shift Protocol'})
            </h3>
          </div>
          <div className="text-xs font-mono">
            {currentCritical ? (
              <span className="text-red-700 font-bold flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                Alert Active: {currentCritical.bedNumber} · {currentCritical.title} ({currentCritical.escalationSeconds}s)
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Standby · No Active Escalations
              </span>
            )}
          </div>
        </div>

        {/* 4-Stage Horizontal Flowchart */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          
          {/* Stage 0: Bedside Buzzer */}
          <div className={`p-3 rounded-md border transition-all ${
            currentCritical && buzzerActive
              ? 'bg-red-50 border-red-400 text-slate-900 ring-1 ring-red-400'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400">0s Instant</span>
              <Volume2 className={`w-3.5 h-3.5 ${buzzerActive ? 'text-red-600 animate-bounce' : 'text-slate-400'}`} />
            </div>
            <div className="font-bold text-xs text-slate-900">Bedside Buzzer</div>
            <p className="text-[11px] mt-1 text-slate-500">
              Immediate physical buzzer at bedside monitor. Volume: {simulatedCallVolume}%.
            </p>
            {buzzerActive && (
              <button
                onClick={silenceBuzzer}
                className="mt-2 w-full py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors"
              >
                Silence Buzzer
              </button>
            )}
          </div>

          {/* Stage 1: Active Shift Duty Nurse */}
          <div className={`p-3 rounded-md border transition-all ${
            currentCritical && currentCritical.escalationStage === 'CALLING_DUTY_NURSE'
              ? 'bg-teal-50 border-teal-500 text-slate-900 ring-1 ring-teal-500'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400">{activeTimeouts.stage1}s Timeout</span>
              <span className="text-[10px] font-mono text-teal-700 font-bold">Tier 1</span>
            </div>
            <div className="font-bold text-xs text-slate-900">{activeResponders[0]?.role}</div>
            <div className="text-[11px] font-semibold text-teal-700 mt-0.5">{activeResponders[0]?.name}</div>
            <p className="text-[11px] mt-1 text-slate-500">
              Dispatches {settings.internetAvailable ? 'WhatsApp VoIP Voice Call' : 'Direct GSM Call + SMS'} at {simulatedCallVolume}% volume.
            </p>
            {currentCritical && !currentCritical.isAcknowledged && (
              <button
                onClick={() => acknowledgeAlert(currentCritical.id, activeResponders[0]?.name)}
                className="mt-2 w-full py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold transition-colors"
              >
                Acknowledge Alert
              </button>
            )}
          </div>

          {/* Stage 2: Active Shift Secondary Responder */}
          <div className={`p-3 rounded-md border transition-all ${
            currentCritical && currentCritical.escalationStage === 'CALLING_WARD_ATTENDANT'
              ? 'bg-blue-50 border-blue-500 text-slate-900 ring-1 ring-blue-500'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400">{activeTimeouts.stage2}s Timeout</span>
              <span className="text-[10px] font-mono text-blue-700 font-bold">Tier 2</span>
            </div>
            <div className="font-bold text-xs text-slate-900">{activeResponders[1]?.role}</div>
            <div className="text-[11px] font-semibold text-blue-700 mt-0.5">{activeResponders[1]?.name}</div>
            <p className="text-[11px] mt-1 text-slate-500">
              Unacknowledged after {activeTimeouts.stage2}s. Dispatches fallback notification.
            </p>
            {currentCritical && !currentCritical.isAcknowledged && currentCritical.escalationSeconds >= activeTimeouts.stage2 && (
              <button
                onClick={() => acknowledgeAlert(currentCritical.id, activeResponders[1]?.name)}
                className="mt-2 w-full py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors"
              >
                Acknowledge (Tier 2)
              </button>
            )}
          </div>

          {/* Stage 3: Active Shift Supervisor */}
          <div className={`p-3 rounded-md border transition-all ${
            currentCritical && currentCritical.escalationStage === 'CALLING_SENIOR_NURSE'
              ? 'bg-indigo-50 border-indigo-500 text-slate-900 ring-1 ring-indigo-500'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400">{activeTimeouts.stage3}s Timeout</span>
              <span className="text-[10px] font-mono text-indigo-700 font-bold">Tier 3</span>
            </div>
            <div className="font-bold text-xs text-slate-900">{activeResponders[2]?.role}</div>
            <div className="text-[11px] font-semibold text-indigo-700 mt-0.5">{activeResponders[2]?.name}</div>
            <p className="text-[11px] mt-1 text-slate-500">
              High-priority clinical supervisor escalation. Triggers supervisory audit alarms.
            </p>
            {currentCritical && !currentCritical.isAcknowledged && currentCritical.escalationSeconds >= activeTimeouts.stage3 && (
              <button
                onClick={() => acknowledgeAlert(currentCritical.id, activeResponders[2]?.name)}
                className="mt-2 w-full py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors"
              >
                Acknowledge (Supervisor)
              </button>
            )}
          </div>

        </div>

        {/* Live Action Strip */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="text-slate-500 font-mono text-[11px]">
            Route: <span className="text-slate-800 font-semibold">{settings.internetAvailable ? 'WhatsApp VoIP Voice Call' : 'GSM Modem Voice Call + Emergency SMS Broadcast'}</span> · Volume: <span className="text-teal-700 font-bold">{simulatedCallVolume}%</span>
          </div>
          <div className="flex items-center gap-2">
            {!currentCritical && (
              <button
                onClick={() => triggerScenario('BLOCKED_LINE')}
                className="px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
              >
                Simulate Occlusion Alert
              </button>
            )}
            {currentCritical && currentCritical.isAcknowledged && !currentCritical.isResolved && (
              <button
                onClick={() => openInterventionModal(currentCritical)}
                className="px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>
                  {currentCritical.workflowStatus === 'INTERVENTION_IN_PROGRESS'
                    ? 'Verify Infusion Status'
                    : 'Begin Bedside Intervention'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Responder Directory & Communication Channels Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Active Shift Responder Hierarchy (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Active Responder Hierarchy ({isNight ? 'Night Shift Priority' : 'Day Shift Priority'})
              </h3>
              <p className="text-[11px] text-slate-500">Tiered escalation roster for current active shift</p>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
            >
              <span>Shift Settings</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {activeResponders.map((resp, idx) => {
              const timeoutSec = idx === 0 ? activeTimeouts.stage1 : idx === 1 ? activeTimeouts.stage2 : activeTimeouts.stage3;
              return (
                <div
                  key={resp.id}
                  className="p-3 rounded-md border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs ${resp.avatarColor}`}
                    >
                      {resp.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{resp.name}</span>
                        <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                          Tier {idx + 1}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {resp.role} · {resp.department}
                      </div>
                      <div className="text-slate-400 font-mono text-[10px]">
                        {resp.phone}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-[11px] text-teal-700 font-semibold block">
                      {timeoutSec}s Trigger
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {settings.internetAvailable ? 'WhatsApp VoIP' : 'GSM & SMS'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Dual Communication Channel Specs (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Multi-Bearer Communication Specs
          </h3>

          {/* Mode 1: WhatsApp VoIP */}
          <div className={`p-3 rounded-md border text-xs ${
            settings.internetAvailable ? 'bg-teal-50/50 border-teal-300' : 'bg-slate-50 border-slate-200 opacity-60'
          }`}>
            <div className="flex items-center gap-2 font-bold text-teal-900 mb-1">
              <Wifi className="w-3.5 h-3.5 text-teal-600" />
              <span>Channel A: Internet / WhatsApp VoIP Gateway</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              When hospital LAN / Wi-Fi is active, automated alerts dispatch via VoIP voice-call with simulated caller ID, bedside room designation, and high-priority push audio alerts.
            </p>
            <div className="mt-1.5 text-[10px] font-mono text-teal-800">
              Protocol: WebRTC VoIP over TLS · Zero latency
            </div>
          </div>

          {/* Mode 2: GSM Direct Cellular */}
          <div className={`p-3 rounded-md border text-xs ${
            !settings.internetAvailable ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-60'
          }`}>
            <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              <span>Channel B: Offline GSM Modem (Voice &amp; SMS)</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              If hospital network connectivity drops, the onboard SIMCOM/Quectel GSM cellular transceiver triggers direct phone calls over 2G/4G voice and dispatches critical SMS messages.
            </p>
            <div className="mt-1.5 text-[10px] font-mono text-amber-800">
              Protocol: AT+CMGS cellular text &amp; ATD voice dial
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-[10px] text-slate-500 leading-tight">
            <strong>Demonstration Prototype Note:</strong> Communication channels are simulated client-side for academic presentation. No live SMS charges or telephony carriers are contacted.
          </div>
        </div>

      </div>

    </div>
  );
};
