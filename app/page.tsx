import Link from "next/link";
import { Icon } from "@/components/icons";

const stats = [["Words learned", "130"], ["Weak words", "7"], ["Current level", "Beginner"], ["Last quiz", "70%"]];
export default function Home() {
  return <main className="page safe-top"><header className="mb-10 flex items-center justify-between"><div><p className="eyebrow mb-2">Personal Dutch practice</p><h1 className="text-2xl font-extrabold tracking-tight">Dutch Tutor <span aria-hidden>🇳🇱</span></h1></div><div className="grid h-11 w-11 place-items-center rounded-full bg-[#162640] font-bold text-white">C</div></header>
    <section><p className="mb-2 text-lg font-medium text-slate-600">Goedemorgen, Calvin</p><h2 className="max-w-xs text-3xl font-extrabold leading-tight tracking-[-.035em]">How much time do you have?</h2>
      <div className="mt-6 grid grid-cols-3 gap-3">{[5,10,20].map((minutes, i) => <Link href={`/session?minutes=${minutes}`} key={minutes} className={`touch flex flex-col items-center justify-center rounded-2xl border px-2 py-4 font-extrabold ${i === 1 ? "border-[#162640] bg-[#162640] text-white" : "border-slate-200 bg-white"}`}><Icon name="clock" className="mb-2 h-5 w-5"/><span>{minutes}</span><span className={`text-xs font-semibold ${i === 1 ? "text-slate-300" : "text-slate-500"}`}>minutes</span></Link>)}</div>
    </section>
    <section className="card mt-8 p-5"><div className="mb-4 flex justify-between"><h2 className="font-extrabold">Your progress</h2><Link href="/progress" className="text-sm font-bold text-[#e8672e]">View all</Link></div><div className="grid grid-cols-2 gap-x-5 gap-y-5">{stats.map(([label,value]) => <div key={label}><p className="text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{label}</p></div>)}</div></section>
    <section className="mt-8"><h2 className="mb-4 text-xl font-extrabold">Continue Learning</h2><Link href="/session" className="card flex items-center justify-between p-5"><div><p className="eyebrow mb-2 text-[#e8672e]">Everyday conversation</p><h3 className="font-extrabold">Talk about your day</h3><p className="mt-1 text-sm text-slate-500">Practice present-tense verbs</p></div><span className="grid h-11 w-11 place-items-center rounded-full bg-orange-50 text-xl text-[#e8672e]">→</span></Link></section>
  </main>;
}
