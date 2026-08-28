"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "home" | "learn" | "review" | "quiz" | "progress";
type Stage = "review" | "conversation";
type ActiveMode = "learn" | "quiz";
type Correction = { wrong: string; better: string; why: string; clue?: string };
type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  translation?: string;
  hint?: string;
  correction?: Correction;
  retryRequired?: boolean;
};
type VocabularyWord = {
  id: string;
  dutch: string;
  english: string;
  pronunciation: string;
  mastery: number;
  correctRecall: number;
  wrongRecall: number;
  correctUse: number;
  wrongUse: number;
  nextReview: string;
  lastSeen?: string;
};
type CanDo = { label: string; status: "can" | "working" | "later" };
type ProgressState = {
  version: 2;
  wordsLearned: number;
  lastQuiz: number;
  sessions: number;
  vocabulary: VocabularyWord[];
  recentScores: number[];
  commonMistakes: { wrong: string; correct: string; why?: string }[];
  canDo: CanDo[];
};
type QuizQuestion = {
  id: string;
  part: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  dutch?: string;
  english?: string;
  word?: string;
  tokens?: string[];
};
type QuizGrade = {
  score: number;
  items: { id: string; correct: boolean; points: number; correction?: string; explanation?: string }[];
  coachNote?: string;
};

const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const normalize = (s: string) => s.trim().toLocaleLowerCase("nl-NL").replace(/[.!?]/g, "").replace(/\s+/g, " ");
const uid = () => Math.random().toString(36).slice(2, 10);

const STARTER_WORDS: VocabularyWord[] = [
  { id: "denken", dutch: "denken", english: "to think", pronunciation: "DEN-ken", mastery: 42, correctRecall: 3, wrongRecall: 4, correctUse: 1, wrongUse: 2, nextReview: day(0) },
  { id: "geven", dutch: "geven", english: "to give", pronunciation: "GHAY-ven", mastery: 40, correctRecall: 2, wrongRecall: 4, correctUse: 1, wrongUse: 2, nextReview: day(0) },
  { id: "geld", dutch: "geld", english: "money", pronunciation: "khelt", mastery: 38, correctRecall: 2, wrongRecall: 5, correctUse: 0, wrongUse: 2, nextReview: day(0) },
  { id: "telefoon", dutch: "telefoon", english: "phone", pronunciation: "tay-luh-FOHN", mastery: 54, correctRecall: 4, wrongRecall: 3, correctUse: 1, wrongUse: 1, nextReview: day(0) },
  { id: "studeren", dutch: "studeren", english: "to study", pronunciation: "stuu-DAY-ren", mastery: 68, correctRecall: 7, wrongRecall: 2, correctUse: 5, wrongUse: 2, nextReview: day(2) },
  { id: "vandaag", dutch: "vandaag", english: "today", pronunciation: "van-DAAKH", mastery: 72, correctRecall: 8, wrongRecall: 2, correctUse: 5, wrongUse: 1, nextReview: day(3) },
  { id: "wonen", dutch: "wonen", english: "to live", pronunciation: "WOH-nen", mastery: 65, correctRecall: 6, wrongRecall: 2, correctUse: 4, wrongUse: 2, nextReview: day(1) },
  { id: "moe", dutch: "moe", english: "tired", pronunciation: "moo", mastery: 74, correctRecall: 7, wrongRecall: 1, correctUse: 5, wrongUse: 1, nextReview: day(4) },
];

const DEFAULT_PROGRESS: ProgressState = {
  version: 2,
  wordsLearned: 130,
  lastQuiz: 70,
  sessions: 6,
  vocabulary: STARTER_WORDS,
  recentScores: [82, 76, 70],
  commonMistakes: [{ wrong: "Ik ben studeer.", correct: "Ik studeer.", why: "Do not use ben before a conjugated verb here." }],
  canDo: [
    { label: "Introduce yourself", status: "can" },
    { label: "Say how you are doing", status: "can" },
    { label: "Talk about what you are doing today", status: "working" },
    { label: "Talk about tomorrow", status: "working" },
    { label: "Tell a short story in the past", status: "later" },
  ],
};

const starterMessages: ChatMessage[] = [{
  role: "assistant",
  text: "Hoi Calvin! Wat doe je vandaag?",
  translation: "Hi Calvin! What are you doing today?",
  hint: "Start with: Ik ...",
}];

const QUIZ: QuizQuestion[] = [
  { id: "v1", part: 1, prompt: "to think", word: "denken" },
  { id: "v2", part: 1, prompt: "money", word: "geld" },
  { id: "v3", part: 1, prompt: "to give", word: "geven" },
  { id: "v4", part: 1, prompt: "phone", word: "telefoon" },
  { id: "d1", part: 2, prompt: "I study Dutch today." },
  { id: "d2", part: 2, prompt: "I live in Lynchburg." },
  { id: "d3", part: 2, prompt: "I think so." },
  { id: "e1", part: 3, prompt: "Mijn telefoon ligt op de tafel." },
  { id: "e2", part: 3, prompt: "Morgen ga ik vroeg trainen." },
  { id: "e3", part: 3, prompt: "Ik ben moe, maar ik ben blij." },
  { id: "b1", part: 4, prompt: "Build: I am going to practice after class today.", tokens: ["ik", "ga", "vandaag", "na", "de", "les", "trainen", "ben", "huis", "mooi"] },
  { id: "b2", part: 4, prompt: "Build: Tomorrow I am studying Dutch with my friend.", tokens: ["morgen", "studeer", "ik", "Nederlands", "met", "mijn", "vriend", "naar", "geld", "ben"] },
  { id: "c1", part: 5, prompt: "Wat doe je vandaag? Answer naturally in Dutch." },
  { id: "c2", part: 5, prompt: "Waarom leer je Nederlands? Answer naturally in Dutch." },
];

function migrateProgress(): ProgressState {
  try {
    const v2 = localStorage.getItem("dutch-tutor-progress-v2");
    if (v2) return JSON.parse(v2);
    const old = localStorage.getItem("dutch-tutor-progress-v1");
    if (old) {
      const parsed = JSON.parse(old);
      const imported = (parsed.weakWords || []).map((w: any): VocabularyWord => ({
        id: w.dutch || uid(), dutch: w.dutch, english: w.english, pronunciation: w.pronunciation || "", mastery: w.mastery || 40,
        correctRecall: w.correct || 0, wrongRecall: w.wrong || 0, correctUse: 0, wrongUse: 0, nextReview: day(0),
      }));
      return {
        ...DEFAULT_PROGRESS,
        wordsLearned: parsed.wordsLearned || 130,
        lastQuiz: parsed.lastQuiz || 70,
        sessions: parsed.sessions || 6,
        recentScores: parsed.recentScores || DEFAULT_PROGRESS.recentScores,
        commonMistakes: parsed.commonMistakes || DEFAULT_PROGRESS.commonMistakes,
        vocabulary: imported.length ? [...imported, ...STARTER_WORDS.filter(w => !imported.some((x: VocabularyWord) => x.dutch === w.dutch))] : STARTER_WORDS,
      };
    }
  } catch {}
  return DEFAULT_PROGRESS;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [minutes, setMinutes] = useState(10);
  const [stage, setStage] = useState<Stage>("review");
  const [progress, setProgress] = useState<ProgressState>(DEFAULT_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [turns, setTurns] = useState(0);
  const [pendingRetry, setPendingRetry] = useState<Correction | null>(null);
  const [reviewQueue, setReviewQueue] = useState<VocabularyWord[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewInput, setReviewInput] = useState("");
  const [reviewResult, setReviewResult] = useState<"correct" | "wrong" | null>(null);
  const [shownTranslations, setShownTranslations] = useState<Record<number, boolean>>({});
  const [shownHints, setShownHints] = useState<Record<number, boolean>>({});
  const [shownAnswers, setShownAnswers] = useState<Record<number, boolean>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizGrade, setQuizGrade] = useState<QuizGrade | null>(null);
  const [grading, setGrading] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setProgress(migrateProgress()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) { try { localStorage.setItem("dutch-tutor-progress-v2", JSON.stringify(progress)); } catch {} } }, [progress, loaded]);

  const dueWords = useMemo(() => progress.vocabulary.filter(w => w.nextReview <= day(0)).sort((a,b) => a.mastery - b.mastery), [progress.vocabulary]);
  const avgScore = useMemo(() => Math.round(progress.recentScores.reduce((a,b) => a+b,0) / Math.max(progress.recentScores.length, 1)), [progress.recentScores]);
  const immersionLevel = avgScore >= 90 && progress.sessions >= 20 ? 4 : avgScore >= 84 && progress.sessions >= 12 ? 3 : avgScore >= 77 && progress.sessions >= 8 ? 2 : 1;
  const targetTurns = minutes === 5 ? 2 : minutes === 10 ? 4 : 7;

  function patchWord(dutch: string, patch: Partial<VocabularyWord>) {
    setProgress(prev => ({ ...prev, vocabulary: prev.vocabulary.map(w => w.dutch === dutch ? { ...w, ...patch } : w) }));
  }

  function startSession(m: number) {
    const reviewCount = m === 5 ? 3 : m === 10 ? 5 : 8;
    const queue = dueWords.slice(0, reviewCount);
    setMinutes(m); setTurns(0); setPendingRetry(null); setMessages(starterMessages); setApiError("");
    setReviewQueue(queue); setReviewIndex(0); setReviewInput(""); setReviewResult(null);
    setStage(queue.length ? "review" : "conversation"); setActiveMode("learn"); setTab("learn");
    setShownTranslations({}); setShownHints({}); setShownAnswers({});
  }

  function resumeActive() {
    if (activeMode) setTab(activeMode);
    else startSession(10);
  }

  function finishSession() {
    setActiveMode(null);
    setTab("home");
  }

  function submitReview(e: FormEvent) {
    e.preventDefault();
    const word = reviewQueue[reviewIndex];
    if (!word || reviewResult) return;
    const correct = normalize(reviewInput) === normalize(word.dutch);
    setReviewResult(correct ? "correct" : "wrong");
    patchWord(word.dutch, {
      mastery: Math.max(5, Math.min(100, word.mastery + (correct ? 6 : -9))),
      correctRecall: word.correctRecall + (correct ? 1 : 0),
      wrongRecall: word.wrongRecall + (correct ? 0 : 1),
      lastSeen: day(0),
      nextReview: day(correct ? (word.mastery >= 75 ? 7 : 3) : 1),
    });
  }

  function nextReview() {
    if (reviewIndex + 1 >= reviewQueue.length) {
      setStage("conversation"); setReviewResult(null); setReviewInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setReviewIndex(i => i + 1); setReviewResult(null); setReviewInput("");
    }
  }

  function addLearnedWords(items: any[]) {
    if (!Array.isArray(items) || !items.length) return;
    setProgress(prev => {
      const vocab = [...prev.vocabulary];
      let added = 0;
      for (const item of items) {
        if (!item?.dutch || vocab.some(w => normalize(w.dutch) === normalize(item.dutch))) continue;
        vocab.push({ id: uid(), dutch: item.dutch, english: item.english || "", pronunciation: item.pronunciation || "", mastery: 25, correctRecall: 0, wrongRecall: 0, correctUse: 0, wrongUse: 0, nextReview: day(1), lastSeen: day(0) });
        added++;
      }
      return { ...prev, vocabulary: vocab, wordsLearned: prev.wordsLearned + added };
    });
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next); setLoading(true); setApiError("");
    try {
      const res = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text, history: next.slice(-14), minutes, immersionLevel, turn: turns + 1,
          knownWords: progress.vocabulary.filter(w => w.mastery >= 60).slice(0, 100).map(w => w.dutch),
          weakWords: dueWords.slice(0, 15).map(w => w.dutch), commonMistakes: progress.commonMistakes.slice(0, 10), pendingRetry,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Tutor request failed");
      const correction = data.correction?.better ? data.correction as Correction : undefined;
      setMessages(prev => [...prev, {
        role: "assistant", text: data.reply || "Goed! Vertel me meer.", translation: data.translation, hint: data.hint,
        correction, retryRequired: Boolean(data.retryRequired),
      }]);
      setTurns(t => t + 1);
      setPendingRetry(data.retryRequired && correction ? correction : null);
      addLearnedWords(data.learnedChunks || []);
      if (correction) {
        setProgress(prev => ({ ...prev, commonMistakes: [{ wrong: correction.wrong, correct: correction.better, why: correction.why }, ...prev.commonMistakes.filter(m => m.wrong !== correction.wrong)].slice(0, 15) }));
      }
    } catch (err) { setApiError(err instanceof Error ? err.message : "Could not reach the tutor."); }
    finally { setLoading(false); }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nl-NL"; utterance.rate = 0.92;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase().startsWith("nl-nl")) || voices.find(v => v.lang.toLowerCase().startsWith("nl"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function startVoice() {
    if (typeof window === "undefined") return;
    const w = window as any;
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) { setApiError("Voice input is not supported in this browser yet. You can still type your Dutch response."); return; }
    const rec = new Recognition(); rec.lang = "nl-NL"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (event: any) => setInput(event.results?.[0]?.[0]?.transcript || "");
    rec.onerror = () => setApiError("I couldn't hear that clearly. Try again or type your answer.");
    rec.start();
  }

  function beginQuiz() { setQuizAnswers({}); setQuizGrade(null); setActiveMode("quiz"); setTab("quiz"); }

  async function gradeQuiz(e: FormEvent) {
    e.preventDefault(); setGrading(true); setQuizGrade(null);
    try {
      const res = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions: QUIZ, answers: quizAnswers, level: immersionLevel }) });
      const data = await res.json(); if (!res.ok) throw new Error(data?.error || "Could not grade quiz");
      const grade = data as QuizGrade; setQuizGrade(grade);
      setProgress(prev => ({ ...prev, lastQuiz: grade.score, sessions: prev.sessions + 1, recentScores: [...prev.recentScores, grade.score].slice(-8) }));
      for (const q of QUIZ.filter(q => q.word)) {
        const item = grade.items.find(i => i.id === q.id); const w = progress.vocabulary.find(x => x.dutch === q.word);
        if (item && w) patchWord(w.dutch, { mastery: Math.max(5, Math.min(100, w.mastery + (item.correct ? 6 : -8))), correctRecall: w.correctRecall + (item.correct ? 1 : 0), wrongRecall: w.wrongRecall + (item.correct ? 0 : 1), nextReview: day(item.correct ? 3 : 1) });
      }
    } catch (err) { setApiError(err instanceof Error ? err.message : "Quiz grading failed."); }
    finally { setGrading(false); }
  }

  const partTitle = (n: number) => ["", "Vocabulary recall", "English → Dutch", "Dutch → English", "Build the sentence", "Conversation"][n];

  return (
    <main className="shell">
      <header className="header">
        <div><div className="brand">Dutch Tutor 🇳🇱</div><div className="subtle">Natural Netherlands Dutch · adaptive immersion</div></div>
        <span className="badge">Level {immersionLevel}</span>
      </header>

      {tab === "home" && <div className="stack">
        <section className="hero card">
          <div><div className="kicker">TODAY</div><h1>Learn Dutch by actually using it.</h1><p className="subtle">Short sessions combine spaced recall, conversation, corrections, and a quiz.</p></div>
          <div className="grid3">{[5,10,20].map(m => <button className="timeButton" key={m} onClick={() => startSession(m)}><strong>{m}</strong><span>min</span></button>)}</div>
        </section>
        {activeMode && <section className="card"><div className="row"><div><div className="kicker">IN PROGRESS</div><strong>{activeMode === "quiz" ? "Your quiz is still waiting" : `${minutes}-minute session · ${stage === "review" ? "review" : `conversation ${Math.min(turns,targetTurns)}/${targetTurns}`}`}</strong><p className="subtle">You can move around the app without losing your place.</p></div><button className="primary compact" onClick={resumeActive}>Resume</button></div></section>}
        <section className="stats">
          <div className="stat"><strong>{dueWords.length}</strong><span>due today</span></div><div className="stat"><strong>{progress.wordsLearned}</strong><span>words seen</span></div><div className="stat"><strong>{progress.lastQuiz}%</strong><span>last quiz</span></div><div className="stat"><strong>{avgScore}%</strong><span>quiz avg</span></div>
        </section>
        <section className="card"><div className="row"><div><strong>How immersion works</strong><p className="subtle">Dutch first. If you get stuck, mix in English. The tutor teaches the missing word or chunk, then makes you retry it in Dutch.</p></div><span className="badge">Supported</span></div></section>
        <section className="card"><div className="sectionTitle noTop">Your current abilities</div>{progress.canDo.slice(0,4).map(item => <div className="canDo" key={item.label}><span>{item.status === "can" ? "✓" : item.status === "working" ? "◐" : "○"}</span><span>{item.label}</span><small>{item.status}</small></div>)}</section>
      </div>}

      {tab === "learn" && <div className="stack">
        <section className="sessionHeader card"><div><div className="kicker">{minutes}-MINUTE SESSION</div><strong>{stage === "review" ? "Warm-up recall" : `Conversation · ${Math.min(turns,targetTurns)}/${targetTurns}`}</strong></div><button className="textButton" onClick={beginQuiz}>Finish & quiz</button></section>

        {stage === "review" && reviewQueue[reviewIndex] && <section className="card recallCard">
          <div className="kicker">REVIEW {reviewIndex + 1}/{reviewQueue.length}</div><h2>{reviewQueue[reviewIndex].english}</h2><p className="subtle">Type the Dutch word from memory. No multiple choice.</p>
          <form onSubmit={submitReview}><input className="bigInput" value={reviewInput} onChange={e => setReviewInput(e.target.value)} placeholder="Dutch word…" autoFocus disabled={Boolean(reviewResult)} />{!reviewResult && <button className="primary" type="submit">Check</button>}</form>
          {reviewResult && <div className={reviewResult === "correct" ? "success" : "error"}>{reviewResult === "correct" ? <><strong>Correct.</strong> Say it out loud once.</> : <><strong>Not quite.</strong> Correct answer: <b>{reviewQueue[reviewIndex].dutch}</b> · {reviewQueue[reviewIndex].pronunciation}</>}<button className="primary compact" onClick={nextReview}>{reviewIndex + 1 === reviewQueue.length ? "Start conversation" : "Next"}</button></div>}
        </section>}

        {stage === "conversation" && <>
          <section className="coachStrip"><span>🇳🇱 Try Dutch first</span><span>🇺🇸 English fallback is allowed</span><span>↻ Corrections require a retry</span></section>
          <section className="chat">{messages.map((m, i) => <div key={i}>
            <div className={`bubble ${m.role === "assistant" ? "tutor" : "user"}`}>{m.text}</div>
            {m.role === "assistant" && <div className="messageTools"><button onClick={() => speak(m.text)}>🔊 Listen</button>{m.translation && <button onClick={() => setShownTranslations(s => ({...s,[i]:!s[i]}))}>🇺🇸 Translate</button>}{m.hint && <button onClick={() => setShownHints(s => ({...s,[i]:!s[i]}))}>💡 Hint</button>}</div>}
            {shownTranslations[i] && m.translation && <div className="helper">{m.translation}</div>}{shownHints[i] && m.hint && <div className="helper">Hint: {m.hint}</div>}
            {m.correction && <div className="correction"><div className="kicker">CORRECTION</div><div><span className="strike">{m.correction.wrong}</span></div><p><b>Hint:</b> {m.correction.clue || m.correction.why}</p>{shownAnswers[i] ? <><div className="better">{m.correction.better}</div><small>{m.correction.why}</small></> : <button className="secondary" onClick={() => setShownAnswers(s => ({...s,[i]:true}))}>Show corrected sentence</button>}{m.retryRequired && <div className="retryFlag">↻ Try the idea again in Dutch before moving on.</div>}</div>}
          </div>)}{loading && <div className="bubble tutor">Even denken…</div>}{apiError && <div className="error">{apiError}</div>}</section>
          <form className="composer" onSubmit={sendMessage}><input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Dutch first — English if stuck…" autoComplete="off"/><button type="button" className="secondary mic" onClick={startVoice}>🎤</button><button className="iconButton" type="submit">↑</button></form>
          {turns >= targetTurns && <button className="primary" onClick={beginQuiz}>Conversation complete — take quiz</button>}
        </>}
      </div>}

      {tab === "review" && <div className="stack">
        <section className="card"><h2 className="noTop">Spaced review</h2><p className="subtle">A word comes back just before you are likely to forget it. Production matters more than recognition.</p><button className="primary" onClick={() => startSession(5)}>{dueWords.length ? `Review ${Math.min(3,dueWords.length)} due words` : "Start 5-minute session"}</button></section>
        <div className="sectionTitle">Needs attention</div><div className="list">{[...progress.vocabulary].sort((a,b)=>a.mastery-b.mastery).slice(0,12).map(word => <div className="wordRow" key={word.id}><div><div className="word">{word.dutch}</div><div className="subtle">{word.pronunciation} · {word.english}</div><div className="progressBar"><span style={{width:`${word.mastery}%`}} /></div><div className="skillGrid"><span>Recall {word.correctRecall}/{word.correctRecall+word.wrongRecall || 0}</span><span>Use {word.correctUse}/{word.correctUse+word.wrongUse || 0}</span><span>Next {word.nextReview <= day(0) ? "today" : word.nextReview}</span></div></div><strong>{word.mastery}%</strong></div>)}</div>
      </div>}

      {tab === "quiz" && <div className="stack"><section className="card"><div className="kicker">SESSION QUIZ</div><h2 className="noTopish">Retrieval, not recognition.</h2><p className="subtle">Parts 2 and 3 use different sentences. Sentence building includes distractor words. Blank answers receive no credit.</p></section>
        <form onSubmit={gradeQuiz} className="stack">{[1,2,3,4,5].map(part => <section className="card" key={part}><div className="kicker">PART {part}</div><h3>{partTitle(part)}</h3>{QUIZ.filter(q=>q.part===part).map((q,idx) => <div className="quizItem" key={q.id}><label><b>{idx+1}. {q.prompt}</b></label>{q.tokens && <div className="tokens">{q.tokens.map((t,i)=><span key={`${t}-${i}`}>{t}</span>)}</div>}<input value={quizAnswers[q.id] || ""} onChange={e=>setQuizAnswers(a=>({...a,[q.id]:e.target.value}))} placeholder={part===1 ? "Dutch word…" : part===3 ? "English…" : "Your answer…"}/>{quizGrade && (()=>{const item=quizGrade.items.find(i=>i.id===q.id);return item ? <div className={item.correct ? "gradeLine good" : "gradeLine bad"}>{item.correct ? "✓ Correct" : `✕ ${item.correction || "Incorrect"}`}{item.explanation && <small>{item.explanation}</small>}</div> : null})()}</div>)}</section>)}
          {!quizGrade ? <button className="primary" disabled={grading}>{grading ? "Grading strictly…" : "Submit quiz"}</button> : <section className="scoreCard card"><div className="score">{quizGrade.score}%</div><strong>{quizGrade.score >= 90 ? "Excellent" : quizGrade.score >= 80 ? "Strong work" : quizGrade.score >= 70 ? "Good learning data" : "Review the corrections"}</strong><p className="subtle">{quizGrade.coachNote}</p><button type="button" className="primary" onClick={finishSession}>Finish session</button></section>}
        </form></div>}

      {tab === "progress" && <div className="stack"><section className="stats"><div className="stat"><strong>{progress.wordsLearned}</strong><span>words seen</span></div><div className="stat"><strong>{progress.sessions}</strong><span>sessions</span></div><div className="stat"><strong>{avgScore}%</strong><span>quiz average</span></div><div className="stat"><strong>{immersionLevel}/4</strong><span>immersion level</span></div></section>
        <section className="card"><h2 className="noTop">Can-do progress</h2>{progress.canDo.map(item => <div className="canDo" key={item.label}><span>{item.status === "can" ? "✓" : item.status === "working" ? "◐" : "○"}</span><span>{item.label}</span><small>{item.status}</small></div>)}</section>
        <section className="card"><h2 className="noTop">Recent quiz scores</h2>{progress.recentScores.map((s,i)=><div className="scoreRow" key={i}><span>Quiz {i+1}</span><strong>{s}%</strong></div>)}</section>
        <section className="card"><h2 className="noTop">Recurring corrections</h2>{progress.commonMistakes.slice(0,8).map((m,i)=><div className="mistake" key={i}><div className="strike">{m.wrong}</div><div className="better">{m.correct}</div>{m.why && <small>{m.why}</small>}</div>)}</section>
      </div>}

      <nav className="nav"><button className={tab === "home" ? "active" : ""} onClick={()=>setTab("home")}>⌂<br/>Home</button><button className={tab === "learn" || tab === "quiz" ? "active" : ""} onClick={resumeActive}>◉<br/>{activeMode ? "Resume" : "Learn"}</button><button className={tab === "review" ? "active" : ""} onClick={()=>setTab("review")}>↻<br/>Review</button><button className={tab === "progress" ? "active" : ""} onClick={()=>setTab("progress")}>▥<br/>Progress</button></nav>
    </main>
  );
}