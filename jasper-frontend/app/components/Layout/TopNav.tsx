"use client";

import { ThemeToggle } from "../Controls/ThemeToggle";
import { BellIcon, SettingsIcon } from "./icons";

export type AppTab = "dashboard" | "map" | "reports" | "archives";

const TABS: { id: AppTab; label: string }[] = [
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
}

export function TopNav({ activeTab, onTabChange, onOpenLogs, hasUnread }: Props) {
  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-surface border-b border-gray-200/60 dark:border-gray-800/60">
      <div className="flex items-center gap-10">
        <h1 className="text-lg font-bold text-cyan-500 tracking-tight">
          Athabasca Watershed GIS
        </h1>
        <nav className="flex items-center gap-7">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "text-cyan-500 border-cyan-500"
                  : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenLogs}
          className="relative w-9 h-9 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-300 hover:bg-surface-alt transition-colors"
        >
          <BellIcon className="w-5 h-5" />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-surface" />
          )}
        </button>
        <ThemeToggle />
        <button className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-300 hover:bg-surface-alt transition-colors">
          <SettingsIcon className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 ml-1.5" />
      </div>
    </header>
  );
}
