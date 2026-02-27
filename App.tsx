import React, { useState } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/dashboard/Sidebar';
import { TopNav } from './components/dashboard/TopNav';
import { TasksPage } from './components/dashboard/TasksPage';
import { AnalyticsPage } from './components/dashboard/AnalyticsPage';
import { OverviewPage } from './components/dashboard/OverviewPage';
import { TeamsPage } from './components/dashboard/TeamsPage';
import { ChatPage } from './components/dashboard/ChatPage';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';

type AuthMode = 'login' | 'signup';

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

const AuthPage: React.FC = () => {
  const { login } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: 'Daniel Ahmadi',
    username: '',
    email: 'founder@boardlyx.app',
    password: 'password',
    confirmPassword: 'password',
  });
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameTimer = React.useRef<ReturnType<typeof setTimeout>>();

  const checkUsername = (val: string) => {
    setFormData((prev) => ({ ...prev, username: val }));
    setUsernameStatus('idle');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (val.length < 3) return;
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/check-username?username=${encodeURIComponent(val)}`);
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch { setUsernameStatus('idle'); }
    }, 400);
  };

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSignup && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = isSignup ? '/auth/email/signup' : '/auth/email/login';
      const body = isSignup
        ? {
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }
        : {
          email: formData.email,
          password: formData.password,
        };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      const { token, user } = data;
      if (!token || !user) {
        throw new Error('Unexpected response from server.');
      }

      login(
        {
          id: user.id,
          name: user.name || 'boardlyX User',
          email: user.email,
          username: user.username || '',
          avatar: user.email?.[0]?.toUpperCase() || 'A',
          telegram_username: user.telegram_username,
        },
        token,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to authenticate.';
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#EEF2FF] relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 w-[420px] h-[420px] bg-gradient-to-br from-indigo-500/40 to-purple-500/40 rounded-[48px] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[520px] h-[520px] bg-gradient-to-tl from-indigo-500/40 to-purple-500/40 rounded-[72px] blur-3xl" />

      {/* Left: form, full height */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8 sm:mb-10">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="boardlyX logo" className="w-12 h-12 object-contain" />
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400 font-display">boardlyX</p>
                <p className="text-xs text-slate-400">AI-powered task management</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
              <span>{mode === 'signup' ? 'Already member?' : "Don’t have an account?"}</span>
              <button
                type="button"
                onClick={() => setMode(isSignup ? 'login' : 'signup')}
                className="text-indigo-500 font-semibold hover:underline"
              >
                {mode === 'signup' ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </div>

          <div className="mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-[32px] font-semibold text-slate-900 mb-1">
              {isSignup ? 'Sign Up' : 'Welcome Back'}
            </h1>
            <p className="text-slate-400 text-sm">
              {isSignup ? 'Secure your workspace with boardlyX.' : 'Sign in to manage your boardlyX workspace.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    Full name
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-300"
                    placeholder="Daniel Ahmadi"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                    <input
                      required
                      type="text"
                      className={`w-full border rounded-2xl pl-8 pr-10 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-300 ${usernameStatus === 'taken' ? 'border-red-300 focus:border-red-400' :
                        usernameStatus === 'available' ? 'border-emerald-300 focus:border-emerald-400' : 'border-slate-200 focus:border-indigo-400'
                        }`}
                      placeholder="danielahmadi"
                      value={formData.username}
                      onChange={(e) => checkUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs">
                      {usernameStatus === 'checking' && <span className="text-slate-400">...</span>}
                      {usernameStatus === 'available' && <span className="text-emerald-500">&#10003;</span>}
                      {usernameStatus === 'taken' && <span className="text-red-500">taken</span>}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">3-30 characters. Letters, numbers, underscores only.</p>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                Email address
              </label>
              <input
                required
                type="email"
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-300"
                placeholder="founder@boardlyx.app"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                Password
              </label>
              <input
                required
                type="password"
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-300"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    Re-type password
                  </label>
                  <input
                    required
                    type="password"
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-300"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>

                <div className="text-xs text-slate-400 space-y-1.5">
                  <p className="font-medium text-slate-500">Password must contain:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-emerald-400 flex items-center justify-center text-[10px] text-emerald-500">
                        ✓
                      </span>
                      <span>At least 8 characters</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-emerald-400 flex items-center justify-center text-[10px] text-emerald-500">
                        ✓
                      </span>
                      <span>One number (0–9) or symbol</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-emerald-400 flex items-center justify-center text-[10px] text-emerald-500">
                        ✓
                      </span>
                      <span>Lowercase & uppercase letters</span>
                    </li>
                  </ul>
                </div>
              </>
            )}

            {!isSignup && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-500" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="text-indigo-500 font-medium hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-sm font-semibold shadow-lg shadow-indigo-500/25"
              size="lg"
              isLoading={isLoading}
            >
              {isSignup ? 'Sign Up' : 'Sign In'}
            </Button>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>or continue with</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </form>

          <div className="flex sm:hidden items-center justify-center mt-6 text-xs text-slate-500">
            <span>{mode === 'signup' ? 'Already member?' : "Don’t have an account?"}</span>
            <button
              type="button"
              onClick={() => setMode(isSignup ? 'login' : 'signup')}
              className="ml-1 text-indigo-500 font-semibold hover:underline"
            >
              {mode === 'signup' ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex w-[45%] relative">
        <img
          src={isSignup ? '/signup.png' : '/signin.png'}
          alt={isSignup ? 'Sign up illustration' : 'Sign in illustration'}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tl from-black/50 via-black/40 to-transparent" />
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { isSidebarOpen, currentPage } = useStore();

  return (
    <div className="flex min-h-screen bg-[#0F1117]">
      <Sidebar />
      <main className={`flex-1 w-full transition-all duration-300 pl-0 ${isSidebarOpen ? 'md:pl-64' : 'md:pl-20'}`}>
        <TopNav />
        {currentPage === 'overview' && <OverviewPage />}
        {currentPage === 'tasks' && <TasksPage />}
        {currentPage === 'teams' && <TeamsPage />}
        {currentPage === 'chat' && <ChatPage />}
        {currentPage === 'analytics' && <AnalyticsPage />}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const { auth } = useStore();

  return (
    <div className="text-white">
      {auth.isAuthenticated ? <Dashboard /> : <AuthPage />}
    </div>
  );
};

export default App;
