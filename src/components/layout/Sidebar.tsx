import React from 'react';
import { useSimulation } from '../../context/SimulationContext';
import {
  LayoutDashboard,
  Activity,
  LayoutGrid,
  SlidersHorizontal,
  BellRing,
  PhoneCall,
  Users,
  LineChart,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}) => {
  const { beds, selectedBedId, setSelectedBedId, activeAlerts } = useSimulation();

  const unackCount = activeAlerts.filter(a => !a.isAcknowledged).length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Main Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'simulator',
      label: 'Ward Overview',
      icon: LayoutGrid,
      badge: null,
    },
    {
      id: 'live-monitoring',
      label: 'Live IV Monitoring',
      icon: Activity,
      badge: null,
    },
    {
      id: 'alerts',
      label: 'Alerts & Notifications',
      icon: BellRing,
      badge: unackCount > 0 ? `${unackCount}` : null,
      badgeColor: 'bg-red-100 text-red-700 font-semibold',
    },
    {
      id: 'escalation',
      label: 'Nurse Response',
      icon: PhoneCall,
      badge: null,
    },
    {
      id: 'patients',
      label: 'Bed Management',
      icon: Users,
      badge: null,
    },
    {
      id: 'analytics',
      label: 'Event History',
      icon: LineChart,
      badge: null,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-14 left-0 z-30 w-56 h-[calc(100vh-3.5rem)] bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 overflow-y-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3">
          {/* Quick Bed Selector */}
          <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded-md">
            <label htmlFor="telemetry-bed-focus" className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Active Focus Bed
            </label>
            <select
              id="telemetry-bed-focus"
              value={selectedBedId}
              onChange={e => setSelectedBedId(e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              {beds.map(b => (
                <option key={b.id} value={b.id}>
                  {b.bedNumber} ({b.status})
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links */}
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">
            Navigation
          </div>
          <nav className="space-y-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold border-l-2 border-teal-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        item.badgeColor || 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Minimal Bottom Prototype Tag */}
        <div className="p-3 border-t border-slate-100 text-[10px] text-slate-400">
          <span>DripConnect Prototype</span>
        </div>
      </aside>
    </>
  );
};
