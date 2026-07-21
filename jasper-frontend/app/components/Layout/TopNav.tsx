// TopNav is the navigation bar that runs across the top of the app.
// It holds the tab links (Dashboard, Map View, AI Overview, etc.),
// the notification bell, the dark/light theme toggle, the settings icon,
// and the user avatar button that opens the profile dropdown.

"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ThemeToggle } from "../Controls/ThemeToggle";
import { AppUser, UserRole } from "../../contexts/AuthContext";
import { BellIcon, MenuIcon, SettingsIcon } from "./icons";

// All the possible tabs in the app — this type is shared with page.tsx
export type AppTab = "dashboard" | "map" | "ai" | "reports" | "archives" | "admin";

// Human-readable labels for each user role shown in the dropdown and badge
const ROLE_LABELS: Record<UserRole, string> = {
  researcher: "Researcher",
  admin:      "Admin",
  superadmin: "Superadmin",
};

// Colour coding for each role badge — makes it easy to tell roles apart at a glance
const ROLE_COLORS: Record<UserRole, string> = {
  researcher: "bg-sait-sky/15 text-sait-sky",
  admin:      "bg-sait-purple/15 text-sait-purple",
  superadmin: "bg-sait-red/15 text-sait-red",
};

// The base set of tabs shown to all users
const TABS_BASE: { id: AppTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "map",       label: "Map View" },
  { id: "ai",        label: "AI Overview" },
  { id: "reports",   label: "Reports" },
  { id: "archives",  label: "Archives" },
];

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenLogs: () => void;
  hasUnread: boolean;
  onToggleSidebar: () => void;
  onOpenSupport: () => void;
  currentUser: AppUser;
  onLogout: () => void;
}

export function TopNav({
  activeTab, onTabChange, onOpenLogs, hasUnread,
  onToggleSidebar, onOpenSupport, currentUser, onLogout,
}: Props) {
  // Controls whether the profile dropdown is visible
  const [profileOpen, setProfileOpen] = useState(false);
  // Stores the pixel position of the dropdown so it lines up under the avatar button
  const [dropPos, setDropPos] = useState({ top: 64, right: 16 });
  // Reference to the avatar button — used to calculate where to place the dropdown
  const avatarRef = useRef<HTMLButtonElement>(null);

  // When the avatar is clicked, measure where the button is on screen
  // and position the dropdown right below it — this works at any screen width.
  function openDropdown() {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setProfileOpen((v) => !v);
  }

  // Superadmin gets an extra "User Management" tab that other roles don't see
  const tabs = currentUser.role === "superadmin"
    ? [...TABS_BASE, { id: "admin" as AppTab, label: "User Management" }]
    : TABS_BASE;

  // The dropdown is rendered directly on document.body using createPortal.
  // This avoids the dropdown being cut off by any parent container's overflow rules.
  const dropdown = profileOpen ? createPortal(
    <>
      {/* Invisible backdrop — clicking anywhere outside closes the dropdown */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setProfileOpen(false)}
      />
      {/* The dropdown card itself — positioned dynamically below the avatar button */}
      <div
        className="fixed w-60 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden z-[9999]"
        style={{ top: dropPos.top, right: dropPos.right }}
      >
        {/* User info header — shows avatar initial, name, email, and role badge */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sait-plum to-sait-purple flex items-center justify-center text-white text-sm font-bold shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{currentUser.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser.email}</p>
              <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full mt-0.5 ${ROLE_COLORS[currentUser.role]}`}>
                {ROLE_LABELS[currentUser.role]}
              </span>
            </div>
          </div>
        </div>

        {/* Dropdown action items */}
        <div className="py-1">
          {/* Opens the support request form */}
          <button
            onClick={() => { setProfileOpen(false); onOpenSupport(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Support Request
          </button>
          {/* Opens the live GIS diagnostic logs panel */}
          <button
            onClick={() => { setProfileOpen(false); onOpenLogs(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            View Diagnostic Logs
          </button>
          {/* User Management is only shown to superadmins */}
          {currentUser.role === "superadmin" && (
            <button
              onClick={() => { setProfileOpen(false); onTabChange("admin"); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              User Management
            </button>
          )}
        </div>

        {/* Sign out — styled in red to make it stand out */}
        <div className="border-t border-gray-100 dark:border-gray-800 py-1">
          <button
            onClick={() => { setProfileOpen(false); onLogout(); }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      {/* Portal dropdown renders outside the header so it never gets clipped */}
      {dropdown}

      <header className="h-14 md:h-16 shrink-0 flex items-center justify-between px-4 md:px-6 bg-surface border-b border-gray-200/60 dark:border-gray-800/60 relative z-50">

        {/* Left side: hamburger (mobile only), app title, and tab links */}
        <div className="flex items-center gap-3 md:gap-8 min-w-0">

          {/* Hamburger icon — only visible on mobile, opens the sidebar drawer */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-surface-alt transition-colors shrink-0"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* App name / branding */}
          <h1 className="text-base md:text-lg font-bold text-sait-sky tracking-tight whitespace-nowrap shrink-0">
            Jasper Environmental Twin
          </h1>

          {/* Tab navigation — hidden on mobile (uses sidebar drawer instead) */}
          <nav className="hidden md:flex items-center gap-4 md:gap-6 overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`text-sm font-medium pb-1 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "text-sait-red border-sait-red"
                    : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
                } ${tab.id === "admin" ? "text-sait-red border-sait-red/0 hover:border-sait-red" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right side: bell, theme toggle, settings, and user avatar */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Bell icon — shows a red dot when there are unread notifications */}
          <button
            onClick={onOpenLogs}
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-surface-alt transition-colors"
          >
            <BellIcon className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-surface" />
            )}
          </button>

          {/* Dark / light mode toggle */}
          <ThemeToggle />

          {/* Settings icon — goes to User Management for superadmin, Support modal for everyone else */}
          <button
            onClick={() => currentUser.role === "superadmin" ? onTabChange("admin") : onOpenSupport()}
            title={currentUser.role === "superadmin" ? "User Management" : "Support & Settings"}
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-surface-alt hover:text-sait-sky transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>

          {/* Avatar button — clicking this opens the profile dropdown */}
          <div className="flex items-center ml-2 pl-2 border-l border-gray-200/60 dark:border-gray-700/40">
            <button
              ref={avatarRef}
              onClick={openDropdown}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-alt transition-colors"
            >
              {/* Shows first name and role badge on wider screens */}
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                  {currentUser.name.split(" ")[0]}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${ROLE_COLORS[currentUser.role]}`}>
                  {ROLE_LABELS[currentUser.role]}
                </span>
              </div>
              {/* Circular avatar with the user's initial */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sait-plum to-sait-purple flex items-center justify-center text-white text-xs font-bold shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
