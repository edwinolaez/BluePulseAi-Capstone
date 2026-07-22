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
  render() { return this.state.hasError ? null : this.props.children; }
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
