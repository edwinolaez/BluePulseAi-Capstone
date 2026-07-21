"use client";

import { useState } from "react";
import { AppUser, UserRole, useAuth } from "../../contexts/AuthContext";
import { TrashIcon, DownloadIcon } from "../Layout/icons";

const ROLE_LABELS: Record<UserRole, string> = {
  researcher: "Researcher / Staff",
  admin:      "Administrator",
  superadmin: "Super Administrator",
};

const ROLE_BADGE: Record<UserRole, string> = {
  researcher: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  admin:      "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  superadmin: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
};

export function AdminPage() {
  const { users, currentUser, addUser, removeUser } = useAuth();
  const [newName, setNewName]         = useState("");
  const [newEmail, setNewEmail]       = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole]         = useState<UserRole>("researcher");
  const [formError, setFormError]     = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [removeError, setRemoveError] = useState<Record<string, string>>({});

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError("All fields are required."); return;
    }
    if (newPassword.length < 8) {
      setFormError("Password must be at least 8 characters."); return;
    }
    const result = addUser({ name: newName, email: newEmail, password: newPassword, role: newRole });
    if (!result.ok) { setFormError(result.error ?? "Failed to add user."); return; }
    setFormSuccess(`Account created for ${newName}.`);
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("researcher");
    setTimeout(() => setFormSuccess(""), 3000);
  }

  function handleRemove(user: AppUser) {
    setRemoveError({});
    const result = removeUser(user.id);
    if (!result.ok) setRemoveError({ [user.id]: result.error ?? "Could not remove user." });
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">User Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create, view, and remove user accounts. Only visible to super administrators.
          </p>
        </div>

        {/* ── User list ── */}
        <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/40 bg-surface overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/40">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              All Accounts <span className="ml-2 text-xs font-normal text-gray-500">({users.length} total)</span>
            </h2>
          </div>

          <div className="divide-y divide-gray-200/60 dark:divide-gray-700/40">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-6 py-4 flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sait-plum to-sait-purple flex items-center justify-center shrink-0 text-white text-sm font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                      {user.name}
                      {user.id === currentUser?.id && (
                        <span className="text-[10px] text-sait-sky font-normal">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline text-xs font-medium text-gray-400">Since {user.createdAt}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${ROLE_BADGE[user.role]}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                  {user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleRemove(user)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                {removeError[user.id] && (
                  <p className="w-full text-xs text-red-400 pl-12">{removeError[user.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Add user form ── */}
        <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-6">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-5">Add New Account</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Full Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Email Address</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jane@jasper.ca"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
              >
                <option value="researcher">Researcher / Staff</option>
                <option value="admin">Administrator</option>
                <option value="superadmin">Super Administrator</option>
              </select>
            </div>

            {formError && (
              <p className="sm:col-span-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}
            {formSuccess && (
              <p className="sm:col-span-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg px-3 py-2">
                {formSuccess}
              </p>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sait-red hover:bg-sait-red-deep text-white text-sm font-semibold transition-colors"
              >
                <DownloadIcon className="w-4 h-4 rotate-180" />
                Create Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
