import React, { useState } from 'react';
import { Droplets, Mail, Lock, Hospital, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: { name: string; role: string; email: string }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('nurse.chen@hospital.dripconnect.org');
  const [password, setPassword] = useState('clinical-demo-2026');
  const [role, setRole] = useState<'Duty Nurse' | 'Ward Attendant' | 'Senior Nurse'>('Duty Nurse');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess({
      name: role === 'Duty Nurse' ? 'Nurse Sarah Chen, RN' : role === 'Ward Attendant' ? 'Marcus Vance' : 'Sister Elena Rostova',
      role,
      email,
    });
  };

  const handleDemoQuickLogin = (selectedRole: 'Duty Nurse' | 'Ward Attendant' | 'Senior Nurse') => {
    setRole(selectedRole);
    const selectedEmail = selectedRole === 'Duty Nurse' 
      ? 'nurse.chen@hospital.dripconnect.org' 
      : selectedRole === 'Ward Attendant' 
      ? 'attendant.vance@hospital.dripconnect.org' 
      : 'sister.rostova@hospital.dripconnect.org';
    
    setEmail(selectedEmail);
    setPassword('clinical-demo-2026');
    onLoginSuccess({
      name: selectedRole === 'Duty Nurse' ? 'Nurse Sarah Chen, RN' : selectedRole === 'Ward Attendant' ? 'Marcus Vance' : 'Sister Elena Rostova',
      role: selectedRole,
      email: selectedEmail,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800">
      
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-teal-600 text-white flex items-center justify-center">
            <Droplets className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-sm">DripConnect</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Hospital className="w-3.5 h-3.5 text-slate-400" />
          <span>Clinical Prototype Portal</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-900">Sign In to DripConnect</h1>
            <p className="text-xs text-slate-500 mt-1">
              Intelligent IV Infusion Monitoring System
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Clinical Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                  placeholder="clinician@hospital.org"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded text-xs transition-colors"
            >
              Sign In
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-3 border-t border-slate-100">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block text-center mb-2">
              Fast Demo Sign In
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => handleDemoQuickLogin('Duty Nurse')}
                className="w-full p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900 text-xs">Nurse Sarah Chen, RN</div>
                  <div className="text-[10px] text-slate-500">Duty Nurse · Ward 4B Day Lead</div>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoQuickLogin('Ward Attendant')}
                className="w-full p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900 text-xs">Marcus Vance</div>
                  <div className="text-[10px] text-slate-500">Floor Support &amp; Transport</div>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoQuickLogin('Senior Nurse')}
                className="w-full p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900 text-xs">Sister Elena Rostova, MSN</div>
                  <div className="text-[10px] text-slate-500">Clinical Nursing Supervisor</div>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 text-center text-[10px] text-slate-400 border-t border-slate-200">
        DripConnect Prototype · Educational Demonstration Environment
      </div>

    </div>
  );
};
