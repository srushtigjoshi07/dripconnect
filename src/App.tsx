import React, { useState } from 'react';
import { SimulationProvider } from './context/SimulationContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DisclaimerBanner } from './components/layout/DisclaimerBanner';
import { BedsideBuzzerIndicator } from './components/escalation/BedsideBuzzerIndicator';
import { IncomingCallModal } from './components/escalation/IncomingCallModal';
import { GlobalInterventionModal } from './components/alerts/GlobalInterventionModal';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { AlertsPage } from './pages/AlertsPage';
import { EscalationPage } from './pages/EscalationPage';
import { PatientsPage } from './pages/PatientsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { EventHistoryPage } from './pages/EventHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { Menu } from 'lucide-react';

interface AuthUser {
  name: string;
  role: string;
  email: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>({
    name: 'Nurse Sarah Chen, RN',
    role: 'Duty Nurse',
    email: 'nurse.chen@hospital.dripconnect.org',
  });

  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // If user is logged out, render LoginPage
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <SimulationProvider>
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col font-sans">
        
        {/* Safety Medical Disclaimer Banner */}
        <DisclaimerBanner />

        {/* Global Bedside Buzzer Alarm Indicator */}
        <BedsideBuzzerIndicator />

        {/* Top Header */}
        <Header
          currentPage={currentPage}
          onNavigate={page => setCurrentPage(page)}
          onLogout={handleLogout}
        />

        {/* Sub-header for Mobile Navigation Hamburger */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs w-full">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
          >
            <Menu className="w-4 h-4" />
            <span>Navigation Menu</span>
          </button>
          <span className="font-mono text-slate-500 font-semibold uppercase text-[11px]">
            {currentPage.replace('-', ' ')}
          </span>
        </div>

        {/* Main Content Area: Sidebar + Page Viewport */}
        <div className="flex-1 w-full flex min-h-0">
          <Sidebar
            currentPage={currentPage}
            onNavigate={page => setCurrentPage(page)}
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 w-full overflow-x-hidden">
            {currentPage === 'dashboard' && <DashboardPage onNavigate={setCurrentPage} />}
            {currentPage === 'live-monitoring' && <LiveMonitoringPage onNavigate={setCurrentPage} />}
            {currentPage === 'simulator' && <SimulatorPage onNavigate={setCurrentPage} />}
            {currentPage === 'alerts' && <AlertsPage onNavigate={setCurrentPage} />}
            {currentPage === 'escalation' && <EscalationPage onNavigate={setCurrentPage} />}
            {currentPage === 'patients' && <PatientsPage onNavigate={setCurrentPage} />}
            {currentPage === 'analytics' && <AnalyticsPage onNavigate={setCurrentPage} />}
            {currentPage === 'event-history' && <EventHistoryPage onNavigate={setCurrentPage} />}
            {currentPage === 'settings' && <SettingsPage onNavigate={setCurrentPage} />}
          </main>
        </div>

        {/* Incoming Call / Nurse Escalation Modal */}
        <IncomingCallModal />

        {/* Global Clinical Intervention & Verification Workflow Modal */}
        <GlobalInterventionModal />

        {/* Clean Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 w-full">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="font-medium text-slate-700">
              DripConnect &bull; Intelligent IV Infusion Monitoring and Automated Nurse Response System
            </p>
            <p className="text-[11px] text-slate-400">
              Healthcare Software Engineering Prototype &bull; Simulated Environment
            </p>
          </div>
        </footer>

      </div>
    </SimulationProvider>
  );
}
