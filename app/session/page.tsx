"use client";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";

export default function SessionPage() {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  function send() { if (draft.trim()) { setNotice("Nice — your answer is ready for tutor feedback."); setDraft(""); } }
  return <main className="page safe-top"><PageHeader eyebrow="10 minute session · 3 of 8" title="Let’s talk" action={{ label: "End", href: "/" }} />
    <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-[38%] rounded-full bg-[#e8672e]" /></div>
    <section aria-label="Conversation" className="space-y-5">
      <div className="max-w-[88%]"><p className="mb-2 text-xs font-bold text-slate-500">Tutor</p><div className="rounded-3xl rounded-tl-md bg-white p-5 text-lg font-bold shadow-sm">Wat doe je vandaag?</div><div className="mt-2 flex gap-1 text-xs font-bold text-slate-500">{["Listen", "Translate", "Hint"].map(x => <button className="touch px-3" key={x}>{x}</button>)}</div></div>
      <div className="ml-auto max-w-[88%]"><p className="mb-2 text-right text-xs font-bold text-slate-500">You</p><div className="rounded-3xl rounded-tr-md bg-[#162640] p-5 text-white">Ik ben studeer vandaag.</div></div>
      <div className="card border-l-4 border-l-[#e8672e] p-5"><p className="mb-4 text-xl font-extrabold text-[#e8672e]">Almost!</p><dl className="space-y-4 text-sm"><div><dt className="mb-1 font-bold text-slate-500">You said</dt><dd className="line-through decoration-red-400">Ik ben studeer vandaag.</dd></div><div><dt className="mb-1 font-bold text-slate-500">Better</dt><dd className="text-lg font-extrabold">Ik studeer vandaag.</dd></div><div><dt className="mb-1 font-bold text-slate-500">Why</dt><dd className="leading-relaxed">Dutch doesn’t use “ben” before “studeer” here.</dd></div></dl></div>
      <div><label htmlFor="retry" className="mb-2 block font-extrabold">Try again</label><input id="retry" className="touch w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-[#e8672e]" placeholder="Type the corrected sentence…" /></div>
    </section>
    {notice && <p className="mt-4 text-center text-sm font-semibold text-emerald-700" role="status">{notice}</p>}
    <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] -mx-1 mt-8 flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"><label className="sr-only" htmlFor="message">Your answer</label><input id="message" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} className="min-w-0 flex-1 px-3 outline-none" placeholder="Answer in Dutch…"/><button aria-label="Microphone (coming soon)" className="grid h-12 w-12 place-items-center rounded-xl text-slate-500"><Icon name="mic" /></button><button onClick={send} aria-label="Send message" className="grid h-12 w-12 place-items-center rounded-xl bg-[#e8672e] text-white"><Icon name="send" /></button></div>
  </main>;
}
