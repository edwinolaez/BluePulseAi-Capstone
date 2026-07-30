/**
 * layout.tsx — Root HTML layout for Project Jasper.
 *
 * This is the outermost shell that Next.js wraps every page in.  It:
 *   - Sets the <html> lang attribute and page metadata (title, description)
 *   - Loads the two custom fonts: Hanken Grotesk (display) and JetBrains Mono (code)
 *   - Injects theme-init.js before the page renders to prevent a flash of the wrong theme
 *   - Imports global Tailwind CSS and Leaflet's default marker/tile styles
 *   - Wraps every page in ConvexClientProvider (real-time data) and AuthProvider (user sessions)
 */

import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ConvexClientProvider } from "./components/Providers/ConvexClientProvider";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Project Jasper",
  description: "Post-wildfire environmental monitoring dashboard for the Athabasca watershed",
};

/**
 * RootLayout — the single HTML shell that wraps every page in the app.
 *
 * Applies font CSS variables to <body>, sets antialiasing, and nests the
 * Convex and Auth providers so all child pages have access to live data
 * and user session state.
 *
 * @param children — the active page component rendered by Next.js routing
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${hankenGrotesk.variable} ${jetBrainsMono.variable} antialiased font-sans`}
      >
        {/* ConvexClientProvider enables real-time data in the 3 live widgets.
            It only activates when NEXT_PUBLIC_CONVEX_URL is set in .env.local. */}
        <ConvexClientProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
