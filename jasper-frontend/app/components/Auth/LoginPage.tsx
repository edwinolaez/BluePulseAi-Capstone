"use client";

import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    setError("");
    setLoading(true);

    // Small artificial delay so it feels like a real network call
    await new Promise((r) => setTimeout(r, 600));

    const result = login(email, password);
    setLoading(false);

    if (!result.ok) { setError(result.error ?? "Sign-in failed."); return; }
    if (result.requiresConfirm) { onSuperadminPending(); return; }
    onLoginSuccess();
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-gray-950 px-4 transition-colors duration-300">
      {/* Subtle background grid — gray in light mode, white in dark mode */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(#64748b 1px,transparent 1px),linear-gradient(90deg,#64748b 1px,transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-cyan-500 dark:stroke-cyan-400 fill-none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Jasper Environmental Twin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to access the monitoring dashboard</p>
        </div>

        {/* Card */}
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
                className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
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
                  className="w-full px-4 py-2.5 pr-11 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
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
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
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

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          For access to this system, contact your administrator.
        </p>

        {/* Demo hint — remove for production */}
        <details className="mt-4 text-center">
          <summary className="text-xs text-gray-400 dark:text-gray-700 cursor-pointer hover:text-gray-600 dark:hover:text-gray-500 transition-colors">
            Demo credentials ▸
          </summary>
          <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-600 space-y-1 font-mono">
            <p>researcher@jasper.ca / Research@2024 (Researcher)</p>
            <p>admin@jasper.ca / Admin@2024 (Admin)</p>
            <p>superadmin@jasper.ca / Super@2024 (Superadmin)</p>
          </div>
        </details>
      </div>
    </div>
  );
}
