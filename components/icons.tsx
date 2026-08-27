type IconProps = { className?: string };
export function Icon({ name, className = "h-5 w-5" }: IconProps & { name: "home" | "learn" | "review" | "progress" | "send" | "mic" | "clock" }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/></>,
    learn: <><path d="M4 19.5V5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0 0 4h12"/><path d="M8 7h5"/></>,
    review: <><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></>,
    progress: <><path d="M5 20V10M12 20V4M19 20v-7"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
