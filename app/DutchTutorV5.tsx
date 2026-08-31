"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "home" | "learn" | "quiz" | "review" | "progress";
type Stage = "cold" | "teach" | "conversation";
type Correction = { wrong: string; better: string; why: string; clue?: string };
type LearnedChunk = { dutch: string; english: string; pronunciation: string; memoryHook?: string };
type ChatMessage = { role: "assistant" | "user"; text: string; translation?: string; hint?: string; correction?: Correction; retryRequired?: boolean };
type VocabularyWord = LearnedChunk & {
  id: string;
  mastery: number;
  correctRecall: number;
  wrongRecall: number;
  correctUse: number;
  wrongUse: number;
  nextReview: string;
  lastSeen?: string;
  lastIndependentRecall?: string;
};
type CurriculumItem = LearnedChunk & { id: string; exampleDutch: string; exampleEnglish: string; topic: string };
type QuizQuestion = { id: string; part: 1 | 2 | 3 | 4 | 5; prompt: string; word?: string; tokens?: string[] };
type QuizGrade = { score: number; items: { id: string; correct: boolean; points: number; correction?: string; explanation?: string }[]; coachNote?: string };
type ProgressState = {
  version: 5;
  wordsLearned: number;
  lastQuiz: number;
  sessions: number;
  vocabulary: VocabularyWord[];
  recentScores: number[];
  commonMistakes: { wrong: string; correct: string; why?: string }[];
  notebookDue: { dutch: string; english: string }[];
};
type SavedSession = {
  savedAt: number;
  minutes: number;
  stage: Stage;
  lessonItems: CurriculumItem[];
  teachIndex: number;
  teachMode: "study" | "recall" | "repair";
  teachInput: string;
  teachAttempts: number;
  teachHook: boolean;
  teachReveal: boolean;
  teachRepairRep: number;
  teachNotebook: boolean;
  teachNotebookDeferred: boolean;
  reviewQueue: VocabularyWord[];
  reviewIndex: number;
  reviewInput: string;
  reviewAttempts: number;
  reviewHook: boolean;
  reviewReveal: boolean;
  reviewRepairing: boolean;
  reviewRepairRep: number;
  reviewNotebook: boolean;
  reviewNotebookDeferred: boolean;
  messages: ChatMessage[];
  turns: number;
  pendingRetry: Correction | null;
  shownTranslations: Record<number, boolean>;
  shownAnswers: Record<number, boolean>;
  quizQuestions: QuizQuestion[];
  quizAnswers: Record<string, string>;
  quizGrade: QuizGrade | null;
  quizRepairing: boolean;
  quizRepairIndex: number;
  quizRepairInput: string;
  quizRepairReveal: boolean;
  sessionLearned: LearnedChunk[];
};

const PROGRESS_KEY = "dutch-tutor-progress-v5";
const ACTIVE_KEY = "dutch-tutor-active-v5";
const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const normalize = (s: string) => s.trim().toLocaleLowerCase("nl-NL").replace(/[.!?,:'’\"“”]/g, "").replace(/\s+/g, " ");
const uid = () => Math.random().toString(36).slice(2, 10);
const clean = (s: string) => s.replace(/\*\*/g, "");

const CURRICULUM: CurriculumItem[] = [
  { id:"hallo", dutch:"hallo", english:"hello", pronunciation:"HAH-loh", memoryHook:"Hallo and hello are almost twins.", exampleDutch:"Hallo! Hoe gaat het?", exampleEnglish:"Hello! How are you?", topic:"survival" },
  { id:"ja", dutch:"ja", english:"yes", pronunciation:"yah", memoryHook:"Think 'ya!' = yes.", exampleDutch:"Ja, ik heb les.", exampleEnglish:"Yes, I have class.", topic:"survival" },
  { id:"nee", dutch:"nee", english:"no", pronunciation:"nay", memoryHook:"A horse says 'neigh' — hear 'nay' and think NO.", exampleDutch:"Nee, niet vandaag.", exampleEnglish:"No, not today.", topic:"survival" },
  { id:"dank-je", dutch:"dank je", english:"thank you", pronunciation:"dahnk yuh", memoryHook:"Dank je sounds a little like 'thank ya.'", exampleDutch:"Goed, dank je.", exampleEnglish:"Good, thank you.", topic:"survival" },
  { id:"ik-ben", dutch:"ik ben", english:"I am", pronunciation:"ik ben", memoryHook:"Picture Ben saying: 'Ik BEN = I AM Ben.'", exampleDutch:"Ik ben student.", exampleEnglish:"I am a student.", topic:"core" },
  { id:"ik-heb", dutch:"ik heb", english:"I have", pronunciation:"ik hep", memoryHook:"HEB = HAVE: 'I HEB it.'", exampleDutch:"Ik heb vandaag les.", exampleEnglish:"I have class today.", topic:"core" },
  { id:"ik-ga", dutch:"ik ga", english:"I go / I am going", pronunciation:"ik kha", memoryHook:"GA = GO — same G, same movement.", exampleDutch:"Ik ga naar de les.", exampleEnglish:"I am going to class.", topic:"core" },
  { id:"ik-doe", dutch:"ik doe", english:"I do", pronunciation:"ik doo", memoryHook:"DOE looks and sounds like DO.", exampleDutch:"Ik doe mijn huiswerk.", exampleEnglish:"I do my homework.", topic:"core" },
  { id:"ik-wil", dutch:"ik wil", english:"I want", pronunciation:"ik vil", memoryHook:"If you WILL something, you WANT it.", exampleDutch:"Ik wil Nederlands leren.", exampleEnglish:"I want to learn Dutch.", topic:"core" },
  { id:"ik-kan", dutch:"ik kan", english:"I can", pronunciation:"ik kan", memoryHook:"KAN = CAN. Nearly identical.", exampleDutch:"Ik kan een beetje Nederlands spreken.", exampleEnglish:"I can speak a little Dutch.", topic:"core" },
  { id:"ik-moet", dutch:"ik moet", english:"I have to / must", pronunciation:"ik moot", memoryHook:"MOET and MUST both start with M and mean obligation.", exampleDutch:"Ik moet straks trainen.", exampleEnglish:"I have to train later.", topic:"core" },
  { id:"ik-weet", dutch:"ik weet", english:"I know", pronunciation:"ik vayt", memoryHook:"Use your WIT to KNOW something → weet.", exampleDutch:"Ik weet het niet.", exampleEnglish:"I don't know.", topic:"core" },
  { id:"ik-denk", dutch:"ik denk", english:"I think", pronunciation:"ik denk", memoryHook:"Denk is your thinking word.", exampleDutch:"Ik denk van wel.", exampleEnglish:"I think so.", topic:"opinions" },
  { id:"begrijp", dutch:"ik begrijp het niet", english:"I don't understand", pronunciation:"ik buh-KHRIPE ut neet", memoryHook:"Niet = NOT. If you don't grasp it: begrijp het niet.", exampleDutch:"Sorry, ik begrijp het niet.", exampleEnglish:"Sorry, I don't understand.", topic:"survival" },
  { id:"hoe-gaat", dutch:"hoe gaat het?", english:"how are you?", pronunciation:"hoo khaat ut", memoryHook:"Think literally: 'how goes it?'", exampleDutch:"Hoi! Hoe gaat het?", exampleEnglish:"Hi! How are you?", topic:"conversation" },
  { id:"gaat-goed", dutch:"het gaat goed", english:"I'm doing well", pronunciation:"ut khaat khoot", memoryHook:"Goed = good. 'It goes good' → I'm doing well.", exampleDutch:"Het gaat goed, dank je.", exampleEnglish:"I'm doing well, thank you.", topic:"conversation" },
  { id:"waar", dutch:"waar", english:"where", pronunciation:"vaar", memoryHook:"WAAR sounds like 'where' with a V.", exampleDutch:"Waar ben je?", exampleEnglish:"Where are you?", topic:"questions" },
  { id:"wat", dutch:"wat", english:"what", pronunciation:"vat", memoryHook:"WAT = WHAT without the H.", exampleDutch:"Wat doe je?", exampleEnglish:"What are you doing?", topic:"questions" },
  { id:"wanneer", dutch:"wanneer", english:"when", pronunciation:"vah-NAIR", memoryHook:"WANNEER starts like WHEN.", exampleDutch:"Wanneer ga je trainen?", exampleEnglish:"When are you going to train?", topic:"questions" },
  { id:"waarom", dutch:"waarom", english:"why", pronunciation:"VAH-rom", memoryHook:"WHY? waarom. Pair it with omdat = because.", exampleDutch:"Waarom leer je Nederlands?", exampleEnglish:"Why are you learning Dutch?", topic:"questions" },
  { id:"omdat", dutch:"omdat", english:"because", pronunciation:"om-DAT", memoryHook:"WHY? waarom. BECAUSE? omdat.", exampleDutch:"Ik leer Nederlands omdat ik het leuk vind.", exampleEnglish:"I learn Dutch because I like it.", topic:"connectors" },
  { id:"en", dutch:"en", english:"and", pronunciation:"en", memoryHook:"EN sounds like the start of AND.", exampleDutch:"Ik studeer en ik train.", exampleEnglish:"I study and I train.", topic:"connectors" },
  { id:"maar", dutch:"maar", english:"but", pronunciation:"mahr", memoryHook:"Think: 'I want MORE, BUT...' → maar.", exampleDutch:"Ik ben moe, maar het gaat goed.", exampleEnglish:"I am tired, but I'm doing well.", topic:"connectors" },
  { id:"ook", dutch:"ook", english:"also", pronunciation:"ohk", memoryHook:"OOK adds one more thing: also.", exampleDutch:"Ik leer ook Nederlands.", exampleEnglish:"I also learn Dutch.", topic:"connectors" },
  { id:"nu", dutch:"nu", english:"now", pronunciation:"new", memoryHook:"NU = NOW. Both are tiny N time words.", exampleDutch:"Ik ben nu thuis.", exampleEnglish:"I am home now.", topic:"time" },
  { id:"straks", dutch:"straks", english:"later / in a little while", pronunciation:"strahks", memoryHook:"Think 'straight after this' → straks.", exampleDutch:"Ik ga straks trainen.", exampleEnglish:"I am going to train later.", topic:"time" },
  { id:"morgen", dutch:"morgen", english:"tomorrow", pronunciation:"MOR-khen", memoryHook:"Tomorrow comes after the MORNING → morgen.", exampleDutch:"Morgen heb ik les.", exampleEnglish:"Tomorrow I have class.", topic:"time" },
  { id:"gisteren", dutch:"gisteren", english:"yesterday", pronunciation:"KHIS-ter-en", memoryHook:"Gisteren = yesterday: think HISTORY happened yesterday.", exampleDutch:"Gisteren had ik training.", exampleEnglish:"Yesterday I had practice.", topic:"time" },
  { id:"les", dutch:"de les", english:"class / lesson", pronunciation:"duh les", memoryHook:"LES = LESson.", exampleDutch:"Ik ga naar de les.", exampleEnglish:"I am going to class.", topic:"college" },
  { id:"huiswerk", dutch:"huiswerk", english:"homework", pronunciation:"HOWS-vairk", memoryHook:"Huis = house + werk = work → house-work.", exampleDutch:"Ik doe mijn huiswerk.", exampleEnglish:"I do my homework.", topic:"college" },
  { id:"trainen", dutch:"trainen", english:"to train / practice", pronunciation:"TRAY-nen", memoryHook:"Train → trainen. Same root.", exampleDutch:"Ik ga straks trainen.", exampleEnglish:"I am going to practice later.", topic:"track" },
  { id:"eten", dutch:"eten", english:"to eat", pronunciation:"AY-ten", memoryHook:"ETEN starts with E like EAT.", exampleDutch:"Ik ga nu eten.", exampleEnglish:"I am going to eat now.", topic:"daily" },
  { id:"drinken", dutch:"drinken", english:"to drink", pronunciation:"DRING-ken", memoryHook:"DRINK is sitting inside drinken.", exampleDutch:"Ik drink water.", exampleEnglish:"I drink water.", topic:"daily" },
  { id:"slapen", dutch:"slapen", english:"to sleep", pronunciation:"SLAH-pen", memoryHook:"SLAP the pillow and go to sleep → slapen.", exampleDutch:"Ik wil slapen.", exampleEnglish:"I want to sleep.", topic:"daily" },
  { id:"goed", dutch:"goed", english:"good / well", pronunciation:"khoot", memoryHook:"GOED = GOOD with Dutch pronunciation.", exampleDutch:"Dat klinkt goed.", exampleEnglish:"That sounds good.", topic:"descriptions" },
  { id:"blij", dutch:"blij", english:"happy", pronunciation:"bligh", memoryHook:"BLij → picture a BLISSFUL smile.", exampleDutch:"Ik ben blij.", exampleEnglish:"I am happy.", topic:"feelings" },
  { id:"druk", dutch:"druk", english:"busy", pronunciation:"druk", memoryHook:"A busy day puts you under pressure — druk.", exampleDutch:"Ik ben vandaag druk.", exampleEnglish:"I am busy today.", topic:"feelings" },
  { id:"honger", dutch:"ik heb honger", english:"I am hungry", pronunciation:"ik hep HONG-er", memoryHook:"HONGER looks like HUNGER.", exampleDutch:"Ik heb honger na de training.", exampleEnglish:"I am hungry after practice.", topic:"daily" }
];

const OPENERS = [
  { text:"Hoi! Hoe gaat het vandaag?", translation:"Hi! How are you today?" },
  { text:"Waar ben je nu?", translation:"Where are you now?" },
  { text:"Wat ga je straks doen?", translation:"What are you going to do later?" },
  { text:"Heb je vandaag les?", translation:"Do you have class today?" },
  { text:"Wat wil je vanavond doen?", translation:"What do you want to do tonight?" },
  { text:"Wanneer ga je trainen?", translation:"When are you going to train?" },
  { text:"Ben je vandaag druk?", translation:"Are you busy today?" }
];
const starterFor = (n:number): ChatMessage[] => [{ role:"assistant", ...OPENERS[n % OPENERS.length] }];

const FALLBACK_QUIZ: QuizQuestion[] = [
  { id:"v1", part:1, prompt:"I have", word:"ik heb" },
  { id:"v2", part:1, prompt:"tomorrow", word:"morgen" },
  { id:"d1", part:2, prompt:"I am going to class." },
  { id:"d2", part:2, prompt:"I want to sleep." },
  { id:"e1", part:3, prompt:"Ik heb vandaag les." },
  { id:"b1", part:4, prompt:"Build: I have to train later.", tokens:["ik","moet","straks","trainen","ben","huis"] },
  { id:"c1", part:5, prompt:"Wat ga je straks doen? Answer naturally in Dutch." }
];

function memoryFor(dutch:string){ return CURRICULUM.find(x=>normalize(x.dutch)===normalize(dutch))?.memoryHook || "Connect the sound of the Dutch word to a vivid image or English sound-alike."; }
function migrateProgress():ProgressState{
  if(typeof window==="undefined") return {version:5,wordsLearned:0,lastQuiz:0,sessions:0,vocabulary:[],recentScores:[],commonMistakes:[],notebookDue:[]};
  try{
    const v5=localStorage.getItem(PROGRESS_KEY); if(v5)return JSON.parse(v5);
    const v4=localStorage.getItem("dutch-tutor-progress-v4");
    if(v4){const old=JSON.parse(v4);return{version:5,wordsLearned:old.wordsLearned||0,lastQuiz:old.lastQuiz||0,sessions:old.sessions||0,recentScores:old.recentScores||[],commonMistakes:old.commonMistakes||[],notebookDue:[],vocabulary:(old.vocabulary||[]).map((w:any)=>({...w,memoryHook:w.memoryHook||memoryFor(w.dutch)}))};}
    const v3=localStorage.getItem("dutch-tutor-progress-v3");
    if(v3){const old=JSON.parse(v3);return{version:5,wordsLearned:old.wordsLearned||0,lastQuiz:old.lastQuiz||0,sessions:old.sessions||0,recentScores:old.recentScores||[],commonMistakes:old.commonMistakes||[],notebookDue:[],vocabulary:(old.vocabulary||[]).map((w:any)=>({...w,memoryHook:memoryFor(w.dutch)}))};}
  }catch{}
  return {version:5,wordsLearned:0,lastQuiz:0,sessions:0,vocabulary:[],recentScores:[],commonMistakes:[],notebookDue:[]};
}

export default function DutchTutorV5(){
  const [tab,setTab]=useState<Tab>("home");
  const [progress,setProgress]=useState<ProgressState>({version:5,wordsLearned:0,lastQuiz:0,sessions:0,vocabulary:[],recentScores:[],commonMistakes:[],notebookDue:[]});
  const [loaded,setLoaded]=useState(false);
  const [minutes,setMinutes]=useState(10);
  const [stage,setStage]=useState<Stage>("cold");
  const [lessonItems,setLessonItems]=useState<CurriculumItem[]>([]);
  const [teachIndex,setTeachIndex]=useState(0);
  const [teachMode,setTeachMode]=useState<"study"|"recall"|"repair">("study");
  const [teachInput,setTeachInput]=useState("");
  const [teachAttempts,setTeachAttempts]=useState(0);
  const [teachHook,setTeachHook]=useState(false);
  const [teachReveal,setTeachReveal]=useState(false);
  const [teachRepairRep,setTeachRepairRep]=useState(0);
  const [teachNotebook,setTeachNotebook]=useState(false);
  const [teachNotebookDeferred,setTeachNotebookDeferred]=useState(false);
  const [reviewQueue,setReviewQueue]=useState<VocabularyWord[]>([]);
  const [reviewIndex,setReviewIndex]=useState(0);
  const [reviewInput,setReviewInput]=useState("");
  const [reviewAttempts,setReviewAttempts]=useState(0);
  const [reviewHook,setReviewHook]=useState(false);
  const [reviewReveal,setReviewReveal]=useState(false);
  const [reviewRepairing,setReviewRepairing]=useState(false);
  const [reviewRepairRep,setReviewRepairRep]=useState(0);
  const [reviewNotebook,setReviewNotebook]=useState(false);
  const [reviewNotebookDeferred,setReviewNotebookDeferred]=useState(false);
  const [messages,setMessages]=useState<ChatMessage[]>(starterFor(0));
  const [turns,setTurns]=useState(0);
  const [pendingRetry,setPendingRetry]=useState<Correction|null>(null);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [apiError,setApiError]=useState("");
  const [shownTranslations,setShownTranslations]=useState<Record<number,boolean>>({});
  const [shownAnswers,setShownAnswers]=useState<Record<number,boolean>>({});
  const [quizQuestions,setQuizQuestions]=useState<QuizQuestion[]>(FALLBACK_QUIZ);
  const [quizAnswers,setQuizAnswers]=useState<Record<string,string>>({});
  const [quizGrade,setQuizGrade]=useState<QuizGrade|null>(null);
  const [quizLoading,setQuizLoading]=useState(false);
  const [grading,setGrading]=useState(false);
  const [quizRepairing,setQuizRepairing]=useState(false);
  const [quizRepairIndex,setQuizRepairIndex]=useState(0);
  const [quizRepairInput,setQuizRepairInput]=useState("");
  const [quizRepairReveal,setQuizRepairReveal]=useState(false);
  const [sessionLearned,setSessionLearned]=useState<LearnedChunk[]>([]);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    setProgress(migrateProgress());
    try{const raw=localStorage.getItem(ACTIVE_KEY);if(raw){const s=JSON.parse(raw) as SavedSession;if(Date.now()-s.savedAt<7*86400000){setMinutes(s.minutes);setStage(s.stage);setLessonItems(s.lessonItems||[]);setTeachIndex(s.teachIndex||0);setTeachMode(s.teachMode||"study");setTeachInput(s.teachInput||"");setTeachAttempts(s.teachAttempts||0);setTeachHook(Boolean(s.teachHook));setTeachReveal(Boolean(s.teachReveal));setTeachRepairRep(s.teachRepairRep||0);setTeachNotebook(Boolean(s.teachNotebook));setTeachNotebookDeferred(Boolean(s.teachNotebookDeferred));setReviewQueue(s.reviewQueue||[]);setReviewIndex(s.reviewIndex||0);setReviewInput(s.reviewInput||"");setReviewAttempts(s.reviewAttempts||0);setReviewHook(Boolean(s.reviewHook));setReviewReveal(Boolean(s.reviewReveal));setReviewRepairing(Boolean(s.reviewRepairing));setReviewRepairRep(s.reviewRepairRep||0);setReviewNotebook(Boolean(s.reviewNotebook));setReviewNotebookDeferred(Boolean(s.reviewNotebookDeferred));setMessages(s.messages?.length?s.messages:starterFor(0));setTurns(s.turns||0);setPendingRetry(s.pendingRetry||null);setShownTranslations(s.shownTranslations||{});setShownAnswers(s.shownAnswers||{});setQuizQuestions(s.quizQuestions?.length?s.quizQuestions:FALLBACK_QUIZ);setQuizAnswers(s.quizAnswers||{});setQuizGrade(s.quizGrade||null);setQuizRepairing(Boolean(s.quizRepairing));setQuizRepairIndex(s.quizRepairIndex||0);setQuizRepairInput(s.quizRepairInput||"");setQuizRepairReveal(Boolean(s.quizRepairReveal));setSessionLearned(s.sessionLearned||[]);setTab(s.quizGrade||s.quizQuestions?.some(q=>s.quizAnswers?.[q.id])?"quiz":"learn");}}}catch{}
    setLoaded(true);
  },[]);

  useEffect(()=>{if(loaded)try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress))}catch{}},[progress,loaded]);
  useEffect(()=>{if(!loaded)return;const active=tab==="learn"||tab==="quiz";if(!active){try{localStorage.removeItem(ACTIVE_KEY)}catch{};return;}const s:SavedSession={savedAt:Date.now(),minutes,stage,lessonItems,teachIndex,teachMode,teachInput,teachAttempts,teachHook,teachReveal,teachRepairRep,teachNotebook,teachNotebookDeferred,reviewQueue,reviewIndex,reviewInput,reviewAttempts,reviewHook,reviewReveal,reviewRepairing,reviewRepairRep,reviewNotebook,reviewNotebookDeferred,messages,turns,pendingRetry,shownTranslations,shownAnswers,quizQuestions,quizAnswers,quizGrade,quizRepairing,quizRepairIndex,quizRepairInput,quizRepairReveal,sessionLearned};try{localStorage.setItem(ACTIVE_KEY,JSON.stringify(s))}catch{}},[loaded,tab,minutes,stage,lessonItems,teachIndex,teachMode,teachInput,teachAttempts,teachHook,teachReveal,teachRepairRep,teachNotebook,teachNotebookDeferred,reviewQueue,reviewIndex,reviewInput,reviewAttempts,reviewHook,reviewReveal,reviewRepairing,reviewRepairRep,reviewNotebook,reviewNotebookDeferred,messages,turns,pendingRetry,shownTranslations,shownAnswers,quizQuestions,quizAnswers,quizGrade,quizRepairing,quizRepairIndex,quizRepairInput,quizRepairReveal,sessionLearned]);

  const avgScore=useMemo(()=>progress.recentScores.length?Math.round(progress.recentScores.reduce((a,b)=>a+b,0)/progress.recentScores.length):0,[progress.recentScores]);
  const dueWords=useMemo(()=>progress.vocabulary.filter(w=>w.nextReview<=day(0)).sort((a,b)=>a.mastery-b.mastery),[progress.vocabulary]);
  const level=avgScore>=88&&progress.sessions>=20?3:avgScore>=75&&progress.sessions>=10?2:1;
  const targetTurns=minutes===5?1:minutes===10?2:4;
  const currentTeach=lessonItems[teachIndex];
  const currentReview=reviewQueue[reviewIndex];

  function patchWord(dutch:string, patch:Partial<VocabularyWord>){setProgress(p=>({...p,vocabulary:p.vocabulary.map(w=>normalize(w.dutch)===normalize(dutch)?{...w,...patch}:w)}));}
  function queueNotebook(dutch:string,english:string){setProgress(p=>p.notebookDue.some(x=>normalize(x.dutch)===normalize(dutch))?p:{...p,notebookDue:[...p.notebookDue,{dutch,english}].slice(-30)});}
  function clearNotebook(dutch:string){setProgress(p=>({...p,notebookDue:p.notebookDue.filter(x=>normalize(x.dutch)!==normalize(dutch))}));}
  function addNewItems(items:CurriculumItem[]){setProgress(p=>{const v=[...p.vocabulary];let added=0;for(const x of items){if(v.some(w=>normalize(w.dutch)===normalize(x.dutch)))continue;v.push({id:x.id,dutch:x.dutch,english:x.english,pronunciation:x.pronunciation,memoryHook:x.memoryHook,mastery:10,correctRecall:0,wrongRecall:0,correctUse:0,wrongUse:0,nextReview:day(0),lastSeen:day(0)});added++;}return{...p,vocabulary:v,wordsLearned:p.wordsLearned+added};});}
  function addLearnedChunks(items:LearnedChunk[]){if(!items?.length)return;setSessionLearned(prev=>{const out=[...prev];for(const x of items)if(x?.dutch&&!out.some(y=>normalize(y.dutch)===normalize(x.dutch)))out.push(x);return out.slice(-20)});setProgress(p=>{const v=[...p.vocabulary];let added=0;for(const x of items){if(!x?.dutch||v.some(w=>normalize(w.dutch)===normalize(x.dutch)))continue;v.push({id:uid(),dutch:x.dutch,english:x.english||"",pronunciation:x.pronunciation||"",memoryHook:x.memoryHook||memoryFor(x.dutch),mastery:10,correctRecall:0,wrongRecall:0,correctUse:0,wrongUse:0,nextReview:day(0),lastSeen:day(0)});added++;}return{...p,vocabulary:v,wordsLearned:p.wordsLearned+added};});}

  function resetTeachForNext(){setTeachMode("study");setTeachInput("");setTeachAttempts(0);setTeachHook(false);setTeachReveal(false);setTeachRepairRep(0);setTeachNotebook(false);setTeachNotebookDeferred(false);}
  function resetReviewForNext(){setReviewInput("");setReviewAttempts(0);setReviewHook(false);setReviewReveal(false);setReviewRepairing(false);setReviewRepairRep(0);setReviewNotebook(false);setReviewNotebookDeferred(false);}

  function startSession(m:number){
    const coldCount=m===5?2:m===10?3:5;
    const cold=dueWords.slice(0,coldCount);
    const known=new Set(progress.vocabulary.map(w=>normalize(w.dutch)));
    const unseen=CURRICULUM.filter(x=>!known.has(normalize(x.dutch)));
    let newCount=m===5?1:m===10?3:4;
    if(progress.lastQuiz>0&&progress.lastQuiz<60)newCount=Math.max(1,newCount-1);
    if(dueWords.length>8)newCount=Math.max(1,newCount-1);
    const fresh=unseen.slice(0,newCount);
    addNewItems(fresh);
    setMinutes(m);setStage(cold.length?"cold":"teach");setReviewQueue(cold);setReviewIndex(0);resetReviewForNext();setLessonItems(fresh);setTeachIndex(0);resetTeachForNext();setMessages(starterFor(progress.sessions+1));setTurns(0);setPendingRetry(null);setShownTranslations({});setShownAnswers({});setQuizQuestions(FALLBACK_QUIZ);setQuizAnswers({});setQuizGrade(null);setQuizRepairing(false);setQuizRepairIndex(0);setQuizRepairInput("");setQuizRepairReveal(false);setSessionLearned(fresh.map(x=>({dutch:x.dutch,english:x.english,pronunciation:x.pronunciation,memoryHook:x.memoryHook})));setApiError("");setTab("learn");
  }

  function advanceReview(){
    if(reviewIndex+1<reviewQueue.length){setReviewIndex(i=>i+1);resetReviewForNext();return;}
    resetReviewForNext();setStage(lessonItems.length?"teach":"conversation");setTimeout(()=>inputRef.current?.focus(),60);
  }
  function submitReview(e:FormEvent){e.preventDefault();if(!currentReview)return;if(reviewRepairing){const ok=normalize(reviewInput)===normalize(currentReview.dutch);if(ok){const next=reviewRepairRep+1;setReviewRepairRep(next);setReviewInput("");if(next>=3){patchWord(currentReview.dutch,{mastery:Math.max(5,currentReview.mastery-2),wrongRecall:currentReview.wrongRecall+1,nextReview:day(1),lastSeen:day(0)});advanceReview();}}else{setReviewRepairRep(0);setReviewInput("");}return;}
    const ok=normalize(reviewInput)===normalize(currentReview.dutch);
    if(ok){const independent=reviewAttempts===0&&!reviewHook&&!reviewReveal;patchWord(currentReview.dutch,{mastery:Math.min(100,currentReview.mastery+(independent?9:4)),correctRecall:currentReview.correctRecall+1,nextReview:day(independent?(currentReview.mastery>=70?7:3):1),lastSeen:day(0),lastIndependentRecall:independent?day(0):currentReview.lastIndependentRecall});advanceReview();return;}
    setReviewAttempts(a=>a+1);setReviewInput("");if(reviewAttempts>=1){setReviewHook(true);}else setReviewHook(true);
  }
  function startReviewStudy(){setReviewReveal(true);setReviewRepairing(false);queueNotebook(currentReview.dutch,currentReview.english);}
  function hideReviewForRepair(){if(!reviewNotebook&&!reviewNotebookDeferred)return;setReviewReveal(false);setReviewRepairing(true);setReviewRepairRep(0);setReviewInput("");}

  function advanceTeach(){
    if(teachIndex+1<lessonItems.length){setTeachIndex(i=>i+1);resetTeachForNext();return;}
    resetTeachForNext();setStage("conversation");setTimeout(()=>inputRef.current?.focus(),60);
  }
  function submitTeach(e:FormEvent){e.preventDefault();if(!currentTeach)return;if(teachMode==="repair"){const ok=normalize(teachInput)===normalize(currentTeach.dutch);if(ok){const next=teachRepairRep+1;setTeachRepairRep(next);setTeachInput("");if(next>=3){const w=progress.vocabulary.find(x=>normalize(x.dutch)===normalize(currentTeach.dutch));if(w)patchWord(w.dutch,{mastery:Math.max(8,w.mastery),wrongRecall:w.wrongRecall+1,nextReview:day(1),lastSeen:day(0)});advanceTeach();}}else{setTeachRepairRep(0);setTeachInput("");}return;}
    if(teachMode==="study"){setTeachMode("recall");setTeachInput("");return;}
    const ok=normalize(teachInput)===normalize(currentTeach.dutch);const w=progress.vocabulary.find(x=>normalize(x.dutch)===normalize(currentTeach.dutch));
    if(ok){const independent=teachAttempts===0&&!teachHook&&!teachReveal;if(w)patchWord(w.dutch,{mastery:Math.min(100,w.mastery+(independent?10:4)),correctRecall:w.correctRecall+1,nextReview:day(independent?2:1),lastSeen:day(0),lastIndependentRecall:independent?day(0):w.lastIndependentRecall});advanceTeach();return;}
    setTeachAttempts(a=>a+1);setTeachInput("");setTeachHook(true);
  }
  function startTeachStudy(){setTeachReveal(true);queueNotebook(currentTeach.dutch,currentTeach.english);}
  function hideTeachForRepair(){if(!teachNotebook&&!teachNotebookDeferred)return;setTeachReveal(false);setTeachMode("repair");setTeachRepairRep(0);setTeachInput("");}

  async function sendText(text:string){if(!text.trim()||loading)return;const userText=text.trim();setInput("");const next=[...messages,{role:"user" as const,text:userText}];setMessages(next);setLoading(true);setApiError("");try{const res=await fetch("/api/tutor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:userText,history:next.slice(-14),minutes,immersionLevel:level,knownWords:progress.vocabulary.filter(w=>w.mastery>=55).map(w=>w.dutch).slice(0,120),weakWords:dueWords.map(w=>w.dutch).slice(0,15),focusWords:lessonItems.map(x=>x.dutch),commonMistakes:progress.commonMistakes.slice(0,10),pendingRetry})});const data=await res.json();if(!res.ok)throw new Error(data?.error||"Tutor request failed");const correction=data.correction?.better?data.correction as Correction:undefined;setMessages(p=>[...p,{role:"assistant",text:clean(typeof data.reply==="string"?data.reply:"Goed. Probeer nog eens."),translation:data.translation,hint:data.hint,correction,retryRequired:Boolean(data.retryRequired)}]);setTurns(t=>t+1);setPendingRetry(data.retryRequired&&correction?correction:null);addLearnedChunks(data.learnedChunks||[]);if(correction)setProgress(p=>({...p,commonMistakes:[{wrong:correction.wrong,correct:correction.better,why:correction.why},...p.commonMistakes.filter(m=>m.wrong!==correction.wrong)].slice(0,20)}));else{const used=progress.vocabulary.filter(w=>normalize(userText).includes(normalize(w.dutch))&&w.mastery<90);if(used.length)setProgress(p=>({...p,vocabulary:p.vocabulary.map(w=>used.some(u=>u.dutch===w.dutch)?{...w,correctUse:w.correctUse+1,mastery:Math.min(100,w.mastery+2),lastSeen:day(0)}:w)}));}}catch(err){setApiError(err instanceof Error?err.message:"Could not reach the tutor.")}finally{setLoading(false)}}
  function sendMessage(e:FormEvent){e.preventDefault();void sendText(input)}
  function userRetriesAfter(i:number){return messages.slice(i+1).filter(m=>m.role==="user").length;}
  function revealCorrection(i:number,m:ChatMessage){setShownAnswers(x=>({...x,[i]:true}));if(m.correction)queueNotebook(m.correction.better,m.correction.why||"correction");}
  function speak(text:string){if(typeof window==="undefined"||!("speechSynthesis"in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(clean(text));u.lang="nl-NL";u.rate=.88;const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang.toLowerCase().startsWith("nl-nl"))||voices.find(v=>v.lang.toLowerCase().startsWith("nl"))||null;window.speechSynthesis.speak(u);}
  function startVoice(){if(typeof window==="undefined")return;const w=window as any;const R=w.SpeechRecognition||w.webkitSpeechRecognition;if(!R){setApiError("Voice input is not supported here yet. Type instead.");return;}const r=new R();r.lang="nl-NL";r.interimResults=false;r.maxAlternatives=1;r.onresult=(e:any)=>setInput(e.results?.[0]?.[0]?.transcript||"");r.onerror=()=>setApiError("I couldn't hear that clearly. Try again or type it.");r.start();}

  async function beginQuiz(){setTab("quiz");setQuizAnswers({});setQuizGrade(null);setQuizRepairing(false);setQuizRepairIndex(0);setQuizRepairInput("");setQuizRepairReveal(false);setQuizLoading(true);setApiError("");try{const res=await fetch("/api/quiz/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({level,minutes,transcript:messages.slice(-14),weakWords:dueWords.slice(0,12).map(w=>({dutch:w.dutch,english:w.english})),learnedChunks:sessionLearned.slice(-10),focusWords:lessonItems.map(x=>({dutch:x.dutch,english:x.english})),commonMistakes:progress.commonMistakes.slice(0,8)})});const data=await res.json();if(!res.ok||!Array.isArray(data.questions)||data.questions.length<5)throw new Error(data?.error||"Could not build adaptive quiz");setQuizQuestions(data.questions);}catch(err){setQuizQuestions(FALLBACK_QUIZ);setApiError(`${err instanceof Error?err.message:"Adaptive quiz unavailable."} Using the built-in quiz.`)}finally{setQuizLoading(false)}}
  async function gradeQuiz(e:FormEvent){e.preventDefault();setGrading(true);setApiError("");try{const res=await fetch("/api/quiz",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({questions:quizQuestions,answers:quizAnswers,level})});const data=await res.json();if(!res.ok)throw new Error(data?.error||"Could not grade quiz");const grade=data as QuizGrade;setQuizGrade(grade);setProgress(p=>({...p,lastQuiz:grade.score,sessions:p.sessions+1,recentScores:[...p.recentScores,grade.score].slice(-10)}));for(const item of grade.items.filter(x=>!x.correct&&x.correction)){const q=quizQuestions.find(q=>q.id===item.id);if(q?.word){const w=progress.vocabulary.find(x=>normalize(x.dutch)===normalize(q.word||""));if(w)patchWord(w.dutch,{mastery:Math.max(5,w.mastery-8),wrongRecall:w.wrongRecall+1,nextReview:day(1)});}queueNotebook(item.correction||"",q?.prompt||"");}}catch(err){setApiError(err instanceof Error?err.message:"Quiz grading failed.")}finally{setGrading(false)}}
  const missedQuiz=quizGrade?quizGrade.items.filter(x=>!x.correct&&x.correction):[];
  const currentQuizMiss=missedQuiz[quizRepairIndex];
  const currentQuizQuestion=currentQuizMiss?quizQuestions.find(q=>q.id===currentQuizMiss.id):undefined;
  function startQuizRepair(){setQuizRepairing(true);setQuizRepairIndex(0);setQuizRepairInput("");setQuizRepairReveal(false);}
  function submitQuizRepair(e:FormEvent){e.preventDefault();if(!currentQuizMiss?.correction)return;const ok=normalize(quizRepairInput)===normalize(currentQuizMiss.correction);if(ok){if(quizRepairIndex+1<missedQuiz.length){setQuizRepairIndex(i=>i+1);setQuizRepairInput("");setQuizRepairReveal(false);}else{setQuizRepairing(false);setQuizRepairIndex(missedQuiz.length);setQuizRepairInput("");}}else{setQuizRepairInput("");setQuizRepairReveal(false);}}
  function finishSession(){try{localStorage.removeItem(ACTIVE_KEY)}catch{};setTab("home");setQuizGrade(null);setQuizAnswers({});setQuizRepairing(false);setApiError("");}

  const sectionTitle=(n:number)=>["","Vocabulary recall","English → Dutch","Dutch → English","Build the sentence","Conversation"][n];

  return <main className="shell">
    <header className="header"><div><div className="brand">Dutch Tutor 🇳🇱</div><div className="subtle">Recall first · hints second · real use last</div></div><span className="badge">Level {level}</span></header>

    {tab==="home"&&<div className="stack">
      <section className="hero card"><div className="kicker">DAILY LEARNING LOOP</div><h1>10 minutes that actually stick.</h1><p className="subtle">Cold recall first. Then a few new chunks. If you miss one, the app makes you repair it instead of letting you stare at the answer.</p><div className="grid3">{[5,10,20].map(m=><button className="timeButton" key={m} onClick={()=>startSession(m)}><strong>{m}</strong><span>min</span></button>)}</div></section>
      <section className="card"><div className="kicker">WHY THIS IS DIFFERENT</div><strong>No-answer-first learning</strong><p className="subtle">A first miss unlocks only a memory hook. A second miss lets you study the answer once. Then the answer disappears and you must recall it correctly 3 times. Repeated misses are also flagged for your notebook and tomorrow's review.</p></section>
      <section className="stats"><div className="stat"><strong>{dueWords.length}</strong><span>cold recalls due</span></div><div className="stat"><strong>{progress.vocabulary.length}</strong><span>tracked chunks</span></div><div className="stat"><strong>{progress.lastQuiz||"—"}{progress.lastQuiz?"%":""}</strong><span>last quiz</span></div><div className="stat"><strong>{progress.notebookDue.length}</strong><span>notebook repairs</span></div></section>
      {progress.notebookDue.length>0&&<section className="card"><div className="sectionTitle noTop">Notebook queue</div><p className="subtle">These were answers you had to reveal or corrections you struggled with. Write each once from the correction, then cover it and say/type it from memory.</p>{progress.notebookDue.slice(0,6).map(x=><div className="wordRow" key={x.dutch}><div><div className="word">{x.dutch}</div><div className="subtle">{x.english}</div></div><button className="secondary" onClick={()=>clearNotebook(x.dutch)}>Done</button></div>)}</section>}
    </div>}

    {tab==="learn"&&<div className="stack">
      <section className="card sessionHeader"><div><div className="kicker">{minutes}-MINUTE SESSION</div><strong>{stage==="cold"?`Cold recall · ${Math.min(reviewIndex+1,reviewQueue.length)}/${reviewQueue.length}`:stage==="teach"?`New chunk · ${Math.min(teachIndex+1,lessonItems.length)}/${lessonItems.length}`:`Guided conversation · ${Math.min(turns,targetTurns)}/${targetTurns}`}</strong></div><button className="textButton" onClick={beginQuiz}>Finish & quiz</button></section>

      {stage==="cold"&&currentReview&&<section className="card recallCard"><div className="kicker">COLD RECALL — NO HINT FIRST</div><h2>{currentReview.english}</h2><p className="subtle">Produce the Dutch from memory. Looking at an answer does not count as knowing it.</p>{reviewReveal?<><div className="success"><div className="kicker">STUDY ONCE</div><div className="word">{currentReview.dutch}</div><div className="subtle">{currentReview.pronunciation}</div><p>🧠 {currentReview.memoryHook||memoryFor(currentReview.dutch)}</p></div><label style={{display:"flex",gap:8,alignItems:"center",marginTop:12}}><input type="checkbox" checked={reviewNotebook} onChange={e=>setReviewNotebook(e.target.checked)}/> I wrote it once in my Dutch notebook.</label><button className="textButton" onClick={()=>setReviewNotebookDeferred(true)}>No notebook with me — queue it for later</button><button className="primary" disabled={!reviewNotebook&&!reviewNotebookDeferred} onClick={hideReviewForRepair}>Hide answer & start 3-recall repair</button></>:<form onSubmit={submitReview}>{reviewRepairing&&<><div className="kicker">ERROR REPAIR</div><p className="subtle">Answer hidden. Get 3 correct recalls in a row. If you peek, the count resets.</p><div className="badge">{reviewRepairRep}/3 clean recalls</div></>}<input className="bigInput" value={reviewInput} onChange={e=>setReviewInput(e.target.value)} autoFocus placeholder="Dutch..."/>{reviewAttempts>0&&!reviewRepairing&&<div className="error" style={{marginTop:12}}>Not yet. The answer is still hidden. Try again.</div>}{reviewHook&&!reviewRepairing&&<div className="helper">🧠 {currentReview.memoryHook||memoryFor(currentReview.dutch)}</div>}<button className="primary">{reviewRepairing?"Recall":"Check"}</button>{reviewAttempts>=2&&!reviewRepairing&&<button type="button" className="secondary" style={{marginTop:8}} onClick={startReviewStudy}>Study answer once → then repair it</button>}{reviewRepairing&&<button type="button" className="textButton" onClick={()=>{setReviewReveal(true);setReviewRepairing(false);setReviewRepairRep(0);}}>I need to peek again</button>}</form>}</section>}

      {stage==="teach"&&currentTeach&&<section className="card recallCard">{teachMode==="study"?<><div className="kicker">ENCODE THE NEW CHUNK</div><h2>{currentTeach.dutch}</h2><div style={{fontSize:18,fontWeight:800}}>{currentTeach.english}</div><p className="subtle">Pronunciation: {currentTeach.pronunciation}</p><div className="success"><strong>🧠 Memory hook:</strong> {currentTeach.memoryHook}</div><div className="helper"><strong>{currentTeach.exampleDutch}</strong><br/>{currentTeach.exampleEnglish}</div><div style={{display:"flex",gap:8,marginTop:12}}><button className="secondary" onClick={()=>speak(currentTeach.dutch)}>🔊 Listen</button><button className="primary compact" style={{marginTop:0}} onClick={()=>{setTeachMode("recall");setTeachInput("");}}>Cover it & recall</button></div></>:teachReveal?<><div className="kicker">STUDY ONCE AFTER A MISS</div><h2>{currentTeach.dutch}</h2><div className="subtle">{currentTeach.english} · {currentTeach.pronunciation}</div><div className="success">🧠 {currentTeach.memoryHook}</div><label style={{display:"flex",gap:8,alignItems:"center",marginTop:12}}><input type="checkbox" checked={teachNotebook} onChange={e=>setTeachNotebook(e.target.checked)}/> I wrote it once in my Dutch notebook.</label><button className="textButton" onClick={()=>setTeachNotebookDeferred(true)}>No notebook with me — queue it for later</button><button className="primary" disabled={!teachNotebook&&!teachNotebookDeferred} onClick={hideTeachForRepair}>Hide answer & start 3-recall repair</button></>:<form onSubmit={submitTeach}><div className="kicker">{teachMode==="repair"?"ERROR REPAIR":"ACTIVE RECALL"}</div><h2>{currentTeach.english}</h2>{teachMode==="repair"&&<><p className="subtle">Answer hidden. Get 3 correct recalls in a row.</p><div className="badge">{teachRepairRep}/3 clean recalls</div></>}<input className="bigInput" value={teachInput} onChange={e=>setTeachInput(e.target.value)} autoFocus placeholder="Dutch answer..."/>{teachAttempts>0&&teachMode!=="repair"&&<div className="error" style={{marginTop:12}}>Not yet. I am not showing you the answer.</div>}{teachHook&&teachMode!=="repair"&&<div className="helper">🧠 {currentTeach.memoryHook}</div>}<button className="primary">{teachMode==="repair"?"Recall":"Check"}</button>{teachAttempts>=2&&teachMode!=="repair"&&<button type="button" className="secondary" style={{marginTop:8}} onClick={startTeachStudy}>Study answer once → then repair it</button>}{teachMode==="repair"&&<button type="button" className="textButton" onClick={()=>{setTeachReveal(true);setTeachMode("recall");setTeachRepairRep(0);}}>I need to peek again</button>}</form>}</section>}

      {stage==="conversation"&&<><section className="card"><div className="kicker">GUIDED USE</div><strong>Now use today's chunks without an answer bank.</strong><p className="subtle">Translation helps you understand the question. It does not tell you what to say. There is no free answer-hint button anymore — try Dutch, type English for a missing word, or use “I'm stuck.”</p></section><div className="chat">{messages.map((m,i)=><div key={i}><div className={`bubble ${m.role==="assistant"?"tutor":"user"}`}>{m.text}</div>{m.role==="assistant"&&<><div className="messageTools"><button onClick={()=>speak(m.text)}>🔊 Listen</button><button onClick={()=>setShownTranslations(x=>({...x,[i]:!x[i]}))}>🇺🇸 Translate question</button></div>{shownTranslations[i]&&m.translation&&<div className="helper">{m.translation}</div>}{m.correction&&<div className="correction"><div className="kicker">RETRY REQUIRED</div><div className="strike">{m.correction.wrong}</div><p><strong>Clue:</strong> {m.correction.clue||m.hint}</p>{shownAnswers[i]?<><div className="better">{m.correction.better}</div><div className="subtle">{m.correction.why}</div></>:userRetriesAfter(i)>=1?<button className="secondary" onClick={()=>revealCorrection(i,m)}>Still stuck? Show correction once</button>:<div className="retryFlag">↻ Try the idea again before the correction can be revealed.</div>}</div>}</>}</div>)}</div>{apiError&&<div className="error">{apiError}</div>}<form className="composer" onSubmit={sendMessage}><input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder="Try Dutch — English only for missing words..."/><button type="button" className="secondary mic" onClick={startVoice}>🎙️</button><button className="iconButton" disabled={loading}>{loading?"…":"↑"}</button></form><button className="secondary" onClick={()=>void sendText("I am stuck. Teach me only the smallest Dutch chunk I need, then make me produce the sentence myself.")}>I’m stuck — teach one chunk</button>{turns>=targetTurns&&<button className="primary" onClick={beginQuiz}>Take the retrieval quiz</button>}</>}
    </div>}

    {tab==="quiz"&&<div className="stack">{quizLoading?<section className="card">Building your retrieval quiz…</section>:quizRepairing&&currentQuizMiss?.correction?<section className="card recallCard"><div className="kicker">QUIZ ERROR REPAIR · {quizRepairIndex+1}/{missedQuiz.length}</div><p className="subtle">You saw the correction already. Now retrieve it again without looking.</p><h2>{currentQuizQuestion?.prompt}</h2>{quizRepairReveal?<><div className="success"><strong>{currentQuizMiss.correction}</strong></div><button className="primary" onClick={()=>{setQuizRepairReveal(false);setQuizRepairInput("");}}>Hide it & recall</button></>:<form onSubmit={submitQuizRepair}><input className="bigInput" value={quizRepairInput} onChange={e=>setQuizRepairInput(e.target.value)} autoFocus placeholder="Correct Dutch from memory..."/><button className="primary">Check repair</button><button type="button" className="textButton" onClick={()=>setQuizRepairReveal(true)}>I need one quick look</button></form>}</section>:<form onSubmit={gradeQuiz} className="stack"><section className="card"><div className="kicker">RETRIEVAL QUIZ</div><strong>No hints. No answer bank except sentence-building tokens.</strong><p className="subtle">A lower score is useful if it honestly shows what is not in memory yet.</p></section>{[1,2,3,4,5].map(part=>{const qs=quizQuestions.filter(q=>q.part===part);if(!qs.length)return null;return <section className="card" key={part}><div className="sectionTitle noTop">{sectionTitle(part)}</div>{qs.map(q=><div className="quizItem" key={q.id}><strong>{q.prompt}</strong>{q.tokens&&<div className="tokens">{q.tokens.map((t,j)=><span key={j}>{t}</span>)}</div>}<input value={quizAnswers[q.id]||""} onChange={e=>setQuizAnswers(a=>({...a,[q.id]:e.target.value}))} disabled={Boolean(quizGrade)} placeholder="Your answer..."/>{quizGrade&&(()=>{const item=quizGrade.items.find(x=>x.id===q.id);return item?<div className={`gradeLine ${item.correct?"good":"bad"}`}>{item.correct?"✓ Correct":`✗ ${item.correction||"Incorrect"}`}<small>{item.explanation}</small></div>:null})()}</div>)}</section>})}{!quizGrade?<button className="primary" disabled={grading}>{grading?"Grading…":"Grade honestly"}</button>:<section className="card scoreCard"><div className="score">{quizGrade.score}%</div><p className="subtle">{quizGrade.coachNote}</p>{missedQuiz.length>0&&quizRepairIndex<missedQuiz.length?<button type="button" className="primary" onClick={startQuizRepair}>Repair {missedQuiz.length} missed answer{missedQuiz.length===1?"":"s"} before finishing</button>:<button type="button" className="primary" onClick={finishSession}>Finish session</button>}</section>}</form>}{apiError&&<div className="error">{apiError}</div>}</div>}

    {tab==="review"&&<div className="stack"><section className="card"><div className="kicker">SPACED REVIEW</div><strong>{dueWords.length} chunks due now</strong><p className="subtle">Do these inside your next session so the app can record a true cold recall before showing anything.</p><button className="primary compact" onClick={()=>startSession(10)}>Start 10-minute review + lesson</button></section>{dueWords.slice(0,12).map(w=><div className="wordRow" key={w.id}><div><div className="word">{w.english}</div><div className="subtle">Dutch hidden here on purpose.</div></div><span className="badge">{w.mastery}%</span></div>)}</div>}

    {tab==="progress"&&<div className="stack"><section className="stats"><div className="stat"><strong>{progress.sessions}</strong><span>sessions</span></div><div className="stat"><strong>{avgScore||"—"}{avgScore?"%":""}</strong><span>quiz average</span></div><div className="stat"><strong>{progress.vocabulary.filter(w=>w.mastery>=70).length}</strong><span>strong chunks</span></div><div className="stat"><strong>{progress.vocabulary.filter(w=>w.mastery<40).length}</strong><span>still fragile</span></div></section><section className="card"><div className="sectionTitle noTop">What counts as learning?</div><p className="subtle">Seeing a word does not raise mastery much. Independent retrieval does. Revealing an answer triggers repair and next-day review. The app is intentionally harder now because it is measuring memory instead of familiarity.</p></section><section className="card"><div className="sectionTitle noTop">Recurring corrections</div>{progress.commonMistakes.slice(0,8).map((m,i)=><div className="mistake" key={i}><div className="strike">{m.wrong}</div><div className="better">{m.correct}</div><small>{m.why}</small></div>)}</section></div>}

    <nav className="nav"><button className={tab==="home"?"active":""} onClick={()=>setTab("home")}>⌂<br/>Home</button><button className={tab==="learn"||tab==="quiz"?"active":""} onClick={()=>setTab(tab==="quiz"?"quiz":"learn")}>◉<br/>Resume</button><button className={tab==="review"?"active":""} onClick={()=>setTab("review")}>↻<br/>Review</button><button className={tab==="progress"?"active":""} onClick={()=>setTab("progress")}>▥<br/>Progress</button></nav>
  </main>;
}
