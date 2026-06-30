"use client";

import { ThemeToggle } from "../Controls/ThemeToggle";
import { AppUser, UserRole } from "../../contexts/AuthContext";
import { BellIcon, MenuIcon, SettingsIcon } from "./icons";

export type AppTab = "dashboard" | "map" | "reports" | "archives" | "admin";

const ROLE_LABELS: Record<UserRole, string> = {
  researcher: "Researcher",
  admin:      "Admin",
  superadmin: "Superadmin",
};

const ROLE_COLORS: Record<UserRole, string> = {
  researcher: "bg-blue-500/15 text-blue-500",
  admin:      "bg-purple-500/15 text-purple-500",
  superadmin: "bg-amber-500/15 text-amber-500",
};

const TABS_BASE: { id: AppTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "map",       label: "Map View" },
  { id: "reports",   label: "Reports" },
  { id: "archives",  label: "Archives" },
];

interface Props {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenLogs: () => void;
  hasUnread: boolean;
  onToggleSidebar: () => void;
  currentUser: AppUser;
  onLogout: () => void;
}

export function TopNav({
  activeTab, onTabChange, onOpenLogs, hasUnread,
  onToggleSidebar, currentUser, onLogout,
}: Props) {
  const tabs = currentUser.role === "superadmin"
    ? [...TABS_BASE, { id: "admin" as AppTab, label: "User Management" }]
    : TABS_BASE;

  return (
    <header className="h-14 md:h-16 shrink-0 flex items-center justify-between px-4 md:px-6 bg-surface border-b border-gray-200/60 dark:border-gray-800/60">
      <div className="flex items-center gap-3 md:gap-8 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-surface-alt transition-colors shrink-0"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <h1 className="text-base md:text-lg font-bold text-cyan-500 tracking-tight whitespace-nowrap shrink-0">
          Jasper Environmental Twin
        </h1>

        {/* Tabs — hidden on mobile, scroll on sm */}
        <nav className="hidden sm:flex items-center gap-4 md:gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`text-sm font-medium pb-1 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "text-cyan-500 border-cyan-500"
                  : "text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200"
              } ${tab.id === "admin" ? "text-amber-500 border-amber-500/0 hover:border-amber-500" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onOpenLogs}
          className="relative w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-surface-alt transition-colors"
        >
          <BellIcon className="w-5 h-5" />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-surface" />
          )}
        </button>

        <ThemeToggle />

        <button className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-surface-alt transition-colors">
          <SettingsIcon className="w-5 h-5" />
        </button>

        {/* User badge + logout */}
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200/60 dark:border-gray-700/40">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">
              {currentUser.name.split(" ")[0]}
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${ROLE_COLORS[currentUser.role]}`}>
              {ROLE_LABELS[currentUser.role]}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={onLogout}
            className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
