import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563EB",
};

export const metadata: Metadata = {
  title: "TeamWave | Premium Workplace Messaging",
  description: "Fast, minimal, and premium workplace chat for high-performance teams. Collaborate faster with TeamWave.",
  keywords: ["chat", "teams", "workplace", "messaging", "collaboration", "real-time"],
  authors: [{ name: "TeamWave Inc." }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TeamWave",
  },
  icons: {
    icon: [
      { url: "/favicon.png" },
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [
      { url: "/favicon.png" },
      { url: "/favicon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
