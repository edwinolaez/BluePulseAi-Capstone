/**
 * SuperadminConfirmModal.tsx — Second-step confirmation for superadmin login.
 *
 * When a superadmin signs in, they are NOT immediately logged in.  Instead,
 * AuthContext puts the account into a "pendingSuperadmin" state and the login
 * page calls onSuperadminPending() to show this modal.
 *
 * The modal shows the user's name, email, and role badge, and asks them to
 * confirm they are an authorised administrator before completing the login.
 * Cancelling clears the pending state and returns the user to the login screen.
 *
 * Why the extra step?  Superadmins can delete accounts — the confirmation
 * makes accidental logins much less likely.
 */
"use client";

import { useAuth } from "../../contexts/AuthContext";

interface Props {
  /** Called after the user clicks "Confirm & Sign In" and the session is saved. */
  onConfirmed: () => void;
}

/**
 * SuperadminConfirmModal
 * Overlay modal that appears as the second step of the superadmin login flow.
 * Renders nothing (returns null) until a superadmin account is pending confirmation.
 *
 * @param onConfirmed - callback invoked once the superadmin session is established
 */
export function SuperadminConfirmModal({ onConfirmed }: Props) {
  const { pendingSuperadmin, confirmSuperadmin, cancelSuperadmin } = useAuth();

  // Don't render anything until a superadmin account is waiting for confirmation
  if (!pendingSuperadmin) return null;

  function handleConfirm() {
    // Finalise the session in AuthContext, then notify the parent page
    confirmSuperadmin();
    onConfirmed();
  }

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-sm rounded-2xl bg-gray-900 border border-amber-500/40 shadow-2xl p-8 text-center">
        {/* Warning icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/15 border-2 border-amber-500/40 mx-auto mb-5">
          <svg viewBox="0 0 24 24" className="w-7 h-7 stroke-amber-400 fill-none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m10.29 3.86-8 14A1 1 0 0 0 3 19h18a1 1 0 0 0 .85-1.53l-8-14a1 1 0 0 0-1.7 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-white mb-1">Super Administrator Access</h2>
        <p className="text-sm text-gray-400 mb-5">
          You are signing in with elevated privileges. Please confirm your identity before proceeding.
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Signing in as</p>
          <p className="text-base font-semibold text-white">{pendingSuperadmin.name}</p>
          <p className="text-sm text-sait-sky">{pendingSuperadmin.email}</p>
          <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Superadmin
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-6">
          This account can manage all users and system settings. Only continue if you are an authorised administrator.
        </p>

        <div className="flex gap-3">
          <button
            onClick={cancelSuperadmin}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
          >
            Confirm & Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
