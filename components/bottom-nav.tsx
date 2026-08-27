"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

const links = [
  { href: "/", label: "Home", icon: "home" as const }, { href: "/session", label: "Learn", icon: "learn" as const },
  { href: "/review", label: "Review", icon: "review" as const }, { href: "/progress", label: "Progress", icon: "progress" as const },
];
export function BottomNav() {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
    <div className="mx-auto grid h-[4.6rem] max-w-2xl grid-cols-4 px-2">{links.map((link) => { const active = pathname === link.href; return <Link key={link.href} href={link.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold ${active ? "text-[#e8672e]" : "text-slate-500"}`}><Icon name={link.icon} className="h-6 w-6"/><span>{link.label}</span></Link>; })}</div>
  </nav>;
}
