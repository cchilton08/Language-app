"use client";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";

const parts = [
  { title: "Part 1 — Vocabulary", prompt: "What does ‘denken’ mean?", content: <div className="grid grid-cols-2 gap-2">{["to drink","to think","to bring","to dance"].map(x=><label key={x} className="touch flex items-center gap-3 rounded-xl border border-slate-200 px-4"><input type="radio" name="vocab"/> {x}</label>)}</div> },
  { title: "Part 2 — Translate to Dutch", prompt: "I give my friend a book every week.", content: <TextAnswer placeholder="Schrijf in het Nederlands…"/> },
  { title: "Part 3 — Translate to English", prompt: "Mijn telefoon ligt nog op de keukentafel.", content: <TextAnswer placeholder="Write in English…"/> },
  { title: "Part 4 — Build the Sentence", prompt: "Build: ‘Tomorrow I am going to the market with my sister.’", content: <WordBuilder/> },
  { title: "Part 5 — Conversation", prompt: "Wat doe je graag in het weekend en waarom?", content: <TextAnswer placeholder="Antwoord natuurlijk in het Nederlands…" textarea/> },
];
function TextAnswer({placeholder, textarea=false}:{placeholder:string;textarea?:boolean}) {
  const classes = "touch w-full resize-none rounded-xl border border-slate-300 bg-white p-4 outline-none focus:border-[#e8672e]";
  return textarea
    ? <textarea aria-label="Your answer" rows={4} className={classes} placeholder={placeholder}/>
    : <input aria-label="Your answer" className={classes} placeholder={placeholder}/>;
}
function WordBuilder() { const words=["morgen","ga","ik","met","mijn","zus","naar","de","markt","gisteren","fiets","ben"]; return <><div className="mb-3 min-h-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-400">Tap words to build your sentence</div><div className="flex flex-wrap gap-2">{words.map((w,i)=><button className="touch rounded-xl border border-slate-200 bg-white px-4 font-bold" key={`${w}${i}`}>{w}</button>)}</div></>; }
export default function QuizPage() { const [submitted,setSubmitted]=useState(false); return <main className="page safe-top"><PageHeader eyebrow="Lesson 7 · Practice quiz" title="Check your Dutch"/><p className="-mt-4 mb-7 text-sm text-slate-500">5 parts · Answers stay hidden until you submit.</p><form onSubmit={e=>{e.preventDefault();setSubmitted(true)}} className="space-y-5">{parts.map((p,i)=><section className="card p-5" key={p.title}><div className="mb-4 flex items-center justify-between"><p className="eyebrow text-[#e8672e]">{p.title}</p><span className="text-xs font-bold text-slate-400">{i+1}/5</span></div><h2 className="mb-4 text-lg font-extrabold leading-snug">{p.prompt}</h2>{p.content}</section>)}<button className="touch w-full rounded-2xl bg-[#e8672e] px-5 font-extrabold text-white">Submit quiz</button>{submitted&&<div role="status" className="card border-emerald-200 p-5 text-center font-bold text-emerald-800">Quiz submitted. Your results will be ready shortly.</div>}</form></main>; }
