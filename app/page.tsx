"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "home" | "learn" | "review" | "progress";
type ChatMessage = { role: "assistant" | "user"; text: string; correction?: { better: string; why: string } };
type WeakWord = { dutch: string; english: string; pronunciation: string; mastery: number; correct: number; wrong: number };
type ProgressState = {
  wordsLearned: number;
  lastQuiz: number;
  sessions: number;
  weakWords: WeakWord[];
  recentScores: number[];
  commonMistakes: { wrong: string; correct: string }[];
};

const DEFAULT_PROGRESS: ProgressState = {
  wordsLearned: 130,
  lastQuiz: 70,
  sessions: 6,
  weakWords: [
    { dutch: "denken", english: "to think", pronunciation: "DEN-ken", mastery: 46, correct: 3, wrong: 4 },
    { dutch: "geven", english: "to give", pronunciation: "GHAY-ven", mastery: 42, correct: 2, wrong: 4 },
    { dutch: "geld", english: "money", pronunciation: "khelt", mastery: 40, correct: 2, wrong: 5 },
    { dutch: "telefoon", english: "phone", pronunciation: "tay-luh-FOHN", mastery: 55, correct: 4, wrong: 3 },
  ],
  recentScores: [82, 76, 70],
  commonMistakes: [{ wrong: "Ik ben studeer.", correct: "Ik studeer." }],
};

const starterMessages: ChatMessage[] = [
  { role: "assistant", text: "Hoi Calvin! 👋 We gaan Nederlands oefenen. Wat doe je vandaag?" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [minutes, setMinutes] = useState(10);
  const [progress, setProgress] = useState<ProgressState>(DEFAULT_PROGRESS);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dutch-tutor-progress-v1");
      if (saved) setProgress(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("dutch-tutor-progress-v1", JSON.stringify(progress)); } catch {}
  }, [progress]);

  const weakCount = progress.weakWords.length;
  const avgScore = useMemo(() => Math.round(progress.recentScores.reduce((a,b) => a+b,0) / Math.max(progress.recentScores.length, 1)), [progress.recentScores]);

  function startSession(m: number) {
    setMinutes(m);
    setMessages(starterMessages);
    setTab("learn");
    setApiError("");
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setLoading(true);
    setApiError("");

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: next.slice(-10),
          minutes,
          weakWords: progress.weakWords.map(w => w.dutch),
          commonMistakes: progress.commonMistakes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Tutor request failed");

      setMessages(prev => [...prev, {
        role: "assistant",
        text: data.reply || "Goed! Vertel me meer.",
        correction: data.correction?.better ? data.correction : undefined,
      }]);

      if (data.correction?.wrong && data.correction?.better) {
        setProgress(prev => ({
          ...prev,
          commonMistakes: [{ wrong: data.correction.wrong, correct: data.correction.better }, ...prev.commonMistakes].slice(0, 12),
        }));
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Could not reach the tutor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <div>
          <div className="brand">Dutch Tutor 🇳🇱</div>
          <div className="subtle">Personal immersion, one short session at a time</div>
        </div>
        <span className="badge">Beginner</span>
      </header>

      {tab === "home" && (
        <div className="stack">
          <section className="card">
            <div className="subtle">Goedemorgen, Calvin</div>
            <h1 style={{margin:"7px 0 15px", fontSize:28}}>How much time do you have?</h1>
            <div className="grid3">
              {[5,10,20].map(m => <button className="timeButton" key={m} onClick={() => startSession(m)}>{m}<br/><span className="small subtle">minutes</span></button>)}
            </div>
          </section>

          <div className="sectionTitle">Your progress</div>
          <section className="stats">
            <div className="stat"><strong>{progress.wordsLearned}</strong><span className="subtle">words learned</span></div>
            <div className="stat"><strong>{weakCount}</strong><span className="subtle">weak words</span></div>
            <div className="stat"><strong>{progress.lastQuiz}%</strong><span className="subtle">last quiz</span></div>
            <div className="stat"><strong>{avgScore}%</strong><span className="subtle">quiz average</span></div>
          </section>

          <div className="sectionTitle">Continue learning</div>
          <section className="card">
            <strong>Conversation practice</strong>
            <p className="subtle">Work on turning vocabulary into natural sentences. Today we’ll recycle words you’ve missed before.</p>
            <button className="primary" onClick={() => startSession(10)}>Start 10-minute session</button>
          </section>
        </div>
      )}

      {tab === "learn" && (
        <div className="stack">
          <section className="card">
            <div style={{display:"flex", justifyContent:"space-between", gap:10, alignItems:"center"}}>
              <div><strong>{minutes}-minute Dutch session</strong><div className="subtle">Answer in Dutch. Mistakes are part of the lesson.</div></div>
              <span className="badge">Immersion</span>
            </div>
          </section>

          <section className="chat">
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`bubble ${m.role === "assistant" ? "tutor" : "user"}`}>{m.text}</div>
                {m.correction && (
                  <div className="correction" style={{marginTop:8}}>
                    <strong>Almost — better Dutch:</strong>
                    <div style={{fontSize:18, fontWeight:800, margin:"6px 0"}}>{m.correction.better}</div>
                    <div className="small">Why: {m.correction.why}</div>
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="bubble tutor">Even denken…</div>}
            {apiError && <div className="error"><strong>Tutor is not connected yet.</strong><br/>{apiError}<br/><span className="small">Add OPENAI_API_KEY in Vercel Environment Variables, then redeploy.</span></div>}
          </section>

          <form className="composer" onSubmit={sendMessage}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type your Dutch response…" autoComplete="off" />
            <button type="button" className="secondary" title="Voice is coming next">🎤</button>
            <button className="iconButton" type="submit" aria-label="Send">↑</button>
          </form>
        </div>
      )}

      {tab === "review" && (
        <div className="stack">
          <section className="card">
            <h2 style={{marginTop:0}}>Weak words</h2>
            <p className="subtle">These are the words the tutor should deliberately bring back into future conversations.</p>
          </section>
          <div className="list">
            {progress.weakWords.map(word => (
              <div className="wordRow" key={word.dutch}>
                <div>
                  <div style={{fontSize:20,fontWeight:800}}>{word.dutch}</div>
                  <div className="subtle">{word.pronunciation} · {word.english}</div>
                  <div className="progressBar"><span style={{width:`${word.mastery}%`}} /></div>
                </div>
                <div style={{textAlign:"right"}}><strong>{word.mastery}%</strong><div className="small subtle">✓ {word.correct} · ✕ {word.wrong}</div></div>
              </div>
            ))}
          </div>
          <section className="card">
            <strong>Quick review</strong>
            <p className="subtle">Before your next session, say each weak word and use it in one sentence out loud.</p>
          </section>
        </div>
      )}

      {tab === "progress" && (
        <div className="stack">
          <section className="stats">
            <div className="stat"><strong>{progress.wordsLearned}</strong><span className="subtle">words learned</span></div>
            <div className="stat"><strong>{progress.sessions}</strong><span className="subtle">sessions</span></div>
          </section>
          <section className="card">
            <h2 style={{marginTop:0}}>Recent quiz scores</h2>
            {progress.recentScores.map((s,i) => <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:i < progress.recentScores.length-1 ? "1px solid var(--border)" : "none"}}><span>Lesson {4+i}</span><strong>{s}%</strong></div>)}
          </section>
          <section className="card">
            <h2 style={{marginTop:0}}>Common mistakes</h2>
            {progress.commonMistakes.map((m,i) => <div key={i} style={{marginBottom:14}}><div className="small subtle">You said</div><div style={{textDecoration:"line-through"}}>{m.wrong}</div><div className="small subtle" style={{marginTop:4}}>Better</div><strong>{m.correct}</strong></div>)}
          </section>
          <button className="secondary" onClick={() => { localStorage.removeItem("dutch-tutor-progress-v1"); setProgress(DEFAULT_PROGRESS); }}>Reset demo progress</button>
        </div>
      )}

      <nav className="nav">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>⌂<br/>Home</button>
        <button className={tab === "learn" ? "active" : ""} onClick={() => setTab("learn")}>◉<br/>Learn</button>
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>↻<br/>Review</button>
        <button className={tab === "progress" ? "active" : ""} onClick={() => setTab("progress")}>▥<br/>Progress</button>
      </nav>
    </main>
  );
}
