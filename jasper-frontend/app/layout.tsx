// Root layout — wraps every page in the app.
// Sets up fonts, dark mode, Leaflet CSS, auth context, and Convex real-time provider.

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
