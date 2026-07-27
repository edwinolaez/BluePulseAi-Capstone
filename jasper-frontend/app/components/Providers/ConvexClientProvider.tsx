"use client";

// ConvexClientProvider wraps the app in Convex's real-time context.
// The 3 live widgets (Water Quality, Pipeline Status, Model Performance)
// use this to subscribe to Rahil's database and get automatic updates.
// If NEXT_PUBLIC_CONVEX_URL is not set yet, it skips the provider
// so the app still works with the animated fallback data.

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, createContext, Component } from "react";

export class ConvexErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/15 text-xs text-amber-700 dark:text-amber-400">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Live data service temporarily unavailable — showing last known values
        </div>
      );
    }
    return this.props.children;
  }
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

// Only create the client if a real URL is configured
const convex = convexUrl.startsWith("https://") ? new ConvexReactClient(convexUrl) : null;

// Widgets read this context to know whether it's safe to call useQuery.
// If false, they show animated mock data instead of calling Convex.
export const ConvexAvailableContext = createContext(false);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    // No URL configured yet — tell widgets to stay in mock-data mode
    return (
      <ConvexAvailableContext.Provider value={false}>
        {children}
      </ConvexAvailableContext.Provider>
    );
  }

  return (
    <ConvexAvailableContext.Provider value={true}>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </ConvexAvailableContext.Provider>
  );
}
