import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("jasper-theme");if(t?t==="dark":true){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${hankenGrotesk.variable} ${jetBrainsMono.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
