import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "RAMPS CUBE CRM",
  description: "A lightweight CRM PWA for RAMPS CUBE commercial refrigeration operations.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "RC CRM",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
