import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: { default: "Dutch Tutor", template: "%s · Dutch Tutor" },
  description: "A personal, conversation-first Dutch learning companion.",
  applicationName: "Dutch Tutor",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Dutch Tutor" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f8f7f3" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="app-shell">{children}</div><BottomNav /></body></html>;
}
