import Link from "next/link";
export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { label: string; href: string } }) {
  return <header className="mb-7 flex items-end justify-between"><div>{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h1 className="text-3xl font-extrabold tracking-[-.035em]">{title}</h1></div>{action && <Link className="font-bold text-[#e8672e]" href={action.href}>{action.label}</Link>}</header>;
}
