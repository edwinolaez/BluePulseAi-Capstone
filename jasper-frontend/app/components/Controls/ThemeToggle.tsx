/**
 * ThemeToggle.tsx — Light / dark mode toggle button.
 *
 * Reads the user's last preference from localStorage on mount and applies it
 * immediately by toggling the "dark" class on the HTML root element
 * (Tailwind's dark mode class strategy).
 *
 * Clicking the button flips the mode, saves the new preference to localStorage,
 * and shows a sun icon (switch to light) or moon icon (switch to dark).
 *
 * Default mode is dark — matches the Jasper dashboard's intended aesthetic.
 */
"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "../Layout/icons";

/**
 * ThemeToggle
 * Renders a circular icon button that switches between dark and light mode.
 * Persists the choice to localStorage under the key "jasper-theme" so the
 * setting survives page refreshes and sign-out / sign-in cycles.
 */
export function ThemeToggle() {
  // Default to dark — the initial value is corrected in the useEffect below
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Restore the user's previous preference, or default to dark if not set
    const stored = localStorage.getItem("jasper-theme");
    const dark = stored ? stored === "dark" : true;
    setIsDark(dark);
    // Apply immediately so there's no flash of the wrong theme on load
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    // Update the HTML class so Tailwind dark: variants take effect immediately
    document.documentElement.classList.toggle("dark", next);
    // Persist for next session
    localStorage.setItem("jasper-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light / dark mode"
      className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-300 hover:bg-surface-alt transition-colors"
    >
      {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
    </button>
  );
}
