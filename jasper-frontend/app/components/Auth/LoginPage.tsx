"use client";

import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const DEMO_ACCOUNTS = [
  { role: "Researcher", email: "researcher@jasper.ca", password: "Research@2024" },
  { role: "Admin",      email: "admin@jasper.ca",      password: "Admin@2024"    },
  { role: "Superadmin", email: "superadmin@jasper.ca", password: "Super@2024"   },
];

interface Props {
  onLoginSuccess: () => void;
  onSuperadminPending: () => void;
}

export function LoginPage({ onLoginSuccess, onSuperadminPending }: Props) {
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  function fillDemo(acc: typeof DEMO_ACCOUNTS[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    setError("");
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (!result.ok) { setError(result.error ?? "Sign-in failed."); return; }
    if (result.requiresConfirm) { onSuperadminPending(); return; }
    onLoginSuccess();
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-gray-950 px-4 transition-colors duration-300">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(#64748b 1px,transparent 1px),linear-gradient(90deg,#64748b 1px,transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sait-sky/15 border border-sait-sky/30 mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-sait-sky fill-none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Jasper Environmental Twin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to access the monitoring dashboard</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-xl dark:shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@jasper.ca"
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-11 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-xs"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-sait-red hover:bg-sait-red-deep disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>
        </div>

        {/* Demo accounts collapsible */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="6" cy="6" r="5" />
              <line x1="6" y1="4" x2="6" y2="6.5" />
              <circle cx="6" cy="8.5" r="0.5" fill="currentColor" stroke="none" />
            </svg>
            Demo accounts
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`transition-transform ${demoOpen ? "rotate-180" : ""}`}>
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </button>

          {demoOpen && (
            <div className="mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex flex-col gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-sait-sky/10 dark:hover:bg-gray-700 transition-colors text-left w-full"
                >
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{acc.role}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{acc.email}</span>
                </button>
              ))}
              <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-1">Click a row to fill credentials</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          For access to this system, contact your administrator.
        </p>
      </div>
    </div>
  );
}
