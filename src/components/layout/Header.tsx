import React, { useState } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { 
  Droplets, 
  Bell, 
  Wifi, 
  WifiOff, 
  Volume2, 
  VolumeX, 
  Activity, 
  ShieldAlert, 
  Check, 
  LogOut,
  Sliders,
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react';

interface HeaderProps {
  onNavigate: (page: string) => void;
  currentPage: string;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentPage, onLogout }) => {
  const { 
    currentSimulatedTime, 
    activeAlerts, 
    settings, 
    updateSettings, 
    selectedBed,
    acknowledgeAlert,
    activeShift,
    toggleShift,
    activeResponders,
    simulatedCallVolume,
  } = useSimulation();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unacknowledgedCount = activeAlerts.filter(a => !a.isAcknowledged).length;

  const toggleInternet = () => {
    updateSettings({ internetAvailable: !settings.internetAvailable });
  };

  const toggleSound = () => {
    updateSettings({ soundNotificationsEnabled: !settings.soundNotificationsEnabled });
  };

  const dutyStaff = activeResponders[0];
  const isNight = activeShift === 'NIGHT';

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 select-none w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 text-left group focus:outline-none"
          >
            <div className="w-7 h-7 rounded-md bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 block leading-tight">DripConnect</span>
              <span className="text-[10px] text-slate-500 font-normal leading-tight">Intelligent IV Infusion System</span>
            </div>
          </button>
        </div>

        {/* Center Telemetry & Clock Status */}
        <div className="hidden lg:flex items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-slate-400">Time:</span>
            <span className="font-medium text-slate-700 tabular-nums">
              {currentSimulatedTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {currentSimulatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className="h-3.5 w-px bg-slate-200" />

          {/* Status of Focus Bed */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Bed 06:</span>
            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded border ${
              selectedBed.status === 'CRITICAL'
                ? 'bg-red-50 text-red-700 border-red-200'
                : selectedBed.status === 'WARNING'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              <Activity className="w-3 h-3" />
              <span>{selectedBed.status}</span>
            </span>
          </div>

          <div className="h-3.5 w-px bg-slate-200" />

          {/* Speed Indicator */}
          <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
            <span>Engine:</span>
            <span className="text-teal-700 font-medium">{settings.simulationSpeedMultiplier}x</span>
          </div>
        </div>

        {/* Right Controls & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Shift Management Toggle Button */}
          <button
            onClick={toggleShift}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              isNight
                ? 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
            title={`Shift Management: Currently ${isNight ? 'Night Shift' : 'Day Shift'}. Click to switch.`}
          >
            {isNight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Night Shift</span>
                <span className="hidden xl:inline text-[10px] text-indigo-600 font-mono">({simulatedCallVolume}%)</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span>Day Shift</span>
                <span className="hidden xl:inline text-[10px] text-amber-600 font-mono">({simulatedCallVolume}%)</span>
              </>
            )}
          </button>

          {/* Internet Toggle (WhatsApp VoIP vs GSM Mode) */}
          <button
            onClick={toggleInternet}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              settings.internetAvailable
                ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
            title={`Toggle Internet Mode: ${settings.internetAvailable ? 'Online (WhatsApp VoIP)' : 'Offline (GSM Voice & SMS)'}`}
          >
            {settings.internetAvailable ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">GSM / SMS</span>
              </>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-md text-xs border border-slate-200 transition-colors ${
              settings.soundNotificationsEnabled
                ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
            title={settings.soundNotificationsEnabled ? 'Mute buzzer & alerts' : 'Enable audio alerts'}
          >
            {settings.soundNotificationsEnabled ? (
              <Volume2 className="w-4 h-4 text-teal-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Notification Center Trigger */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unacknowledgedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unacknowledgedCount}
                </span>
              )}
            </button>

            {/* Notification Drawer Dropdown */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 text-slate-800">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Active Alerts ({activeAlerts.length})</span>
                  </div>
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigate('alerts');
                    }}
                    className="text-[11px] text-teal-700 hover:text-teal-800 font-medium"
                  >
                    View All
                  </button>
                </div>

                {activeAlerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No active alerts. All infusions normal.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {activeAlerts.slice(0, 5).map(alert => (
                      <div
                        key={alert.id}
                        className={`p-2.5 rounded-md border text-xs ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-red-50 border-red-200 text-red-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>{alert.bedNumber} · {alert.title}</span>
                          <span className="text-[10px] font-mono px-1 rounded bg-white border border-slate-200">
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Stage: {alert.escalationStage}</span>
                          {!alert.isAcknowledged ? (
                            <button
                              onClick={() => acknowledgeAlert(alert.id, 'Duty Nurse (Quick Ack)')}
                              className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Ack</span>
                            </button>
                          ) : (
                            <span className="text-teal-700 font-medium">Acknowledged</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 border border-transparent transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">
                {dutyStaff?.initials || 'RN'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[110px]">{dutyStaff?.name || 'Duty Nurse'}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{isNight ? 'Night Shift' : 'Day Shift'}</p>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50 text-xs text-slate-800">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-semibold ${
                      isNight ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {isNight ? 'Night Shift' : 'Day Shift'}
                    </span>
                    <span className="text-[10px] text-teal-700 font-mono">Vol: {simulatedCallVolume}%</span>
                  </div>
                  <p className="font-semibold text-slate-900">{dutyStaff?.name}</p>
                  <p className="text-[11px] text-slate-500">{dutyStaff?.role}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      toggleShift();
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                  >
                    {isNight ? <Sun className="w-3.5 h-3.5 text-amber-600" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
                    <span>Switch to {isNight ? 'Day Shift' : 'Night Shift'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate('settings');
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    <span>Shift Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-red-50 text-red-600 flex items-center gap-2 mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out (Demo)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
