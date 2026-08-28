import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dutch Tutor",
  description: "A personal AI Dutch tutor for daily conversation practice.",
  applicationName: "Dutch Tutor",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dutch Tutor",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
