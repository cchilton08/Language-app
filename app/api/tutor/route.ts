import { NextResponse } from "next/server";

export const runtime = "nodejs";
type HistoryItem = { role: "assistant" | "user"; text: string };

function collectOutputText(data:any){
  if(typeof data?.output_text==="string"&&data.output_text)return data.output_text;
  const pieces:string[]=[];
  for(const item of data?.output??[])for(const content of item?.content??[])if(content?.type==="output_text"&&typeof content?.text==="string")pieces.push(content.text);
  return pieces.join("\n");
}
function parseStructuredOutput(data:any){
  const text=collectOutputText(data).trim();
  if(!text)throw new Error("Tutor did not return text. Please try again.");
  try{return JSON.parse(text)}catch{const a=text.indexOf("{");const b=text.lastIndexOf("}");if(a>=0&&b>a)return JSON.parse(text.slice(a,b+1));throw new Error("Tutor response could not be parsed. Please try again.")}
}

const tutorSchema={
  type:"object",
  properties:{
    reply:{type:"string"},translation:{type:"string"},hint:{type:"string"},
    correction:{anyOf:[{type:"null"},{type:"object",properties:{wrong:{type:"string"},better:{type:"string"},why:{type:"string"},clue:{type:"string"}},required:["wrong","better","why","clue"],additionalProperties:false}]},
    retryRequired:{type:"boolean"},
    learnedChunks:{type:"array",maxItems:2,items:{type:"object",properties:{dutch:{type:"string"},english:{type:"string"},pronunciation:{type:"string"},memoryHook:{type:"string"}},required:["dutch","english","pronunciation","memoryHook"],additionalProperties:false}}
  },
  required:["reply","translation","hint","correction","retryRequired","learnedChunks"],additionalProperties:false
};

export async function POST(request:Request){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({error:"OPENAI_API_KEY is not configured on the server."},{status:503});
  try{
    const body=await request.json();
    const message=String(body?.message??"").slice(0,1400);
    const history:HistoryItem[]=Array.isArray(body?.history)?body.history.slice(-14):[];
    const minutes=Number(body?.minutes||10);
    const level=Math.max(1,Math.min(4,Number(body?.immersionLevel||1)));
    const knownWords=Array.isArray(body?.knownWords)?body.knownWords.slice(0,120):[];
    const weakWords=Array.isArray(body?.weakWords)?body.weakWords.slice(0,20):[];
    const focusWords=Array.isArray(body?.focusWords)?body.focusWords.slice(0,8):[];
    const mistakes=Array.isArray(body?.commonMistakes)?body.commonMistakes.slice(0,10):[];
    const pendingRetry=body?.pendingRetry||null;
    const transcript=history.map(h=>`${h.role==="user"?"LEARNER":"TUTOR"}: ${h.text}`).join("\n");

    const instructions=`You are Calvin's personal Dutch tutor. Teach natural, current STANDARD NETHERLANDS DUTCH (nl-NL), the everyday Dutch a local in the Netherlands would actually say.

GOAL
Build practical speaking and understanding efficiently for a true beginner in about ${minutes} minutes today.

LEVEL ${level}/4
- Level 1 is vocabulary-first supported immersion. Keep Dutch short and concrete.
- Reuse today's taught chunks heavily instead of assuming broad vocabulary.
- Increase spontaneous Dutch only as recall and quiz performance improve.

TODAY'S FOCUS
${focusWords.join(", ")||"none supplied"}
Ask questions that let the learner PRODUCE these items naturally.

COMPREHENSIBLE INPUT
- Keep roughly 85-95% understandable from known language/context.
- Ask one question at a time.
- Keep replies short enough to hear and repeat.
- Avoid repetitive generic openers; continue naturally from the transcript.

ENGLISH FALLBACK
- Dutch first, but English is allowed when a word is missing.
- If English is mixed into Dutch, teach only the missing/high-value Dutch chunk and require a Dutch retry.
- If a word is garbled and intent is unclear, ask briefly what was meant in English rather than guessing.

CORRECTIONS
- Correct one important error at a time.
- First give a clue and require retrieval.
- Put the complete correction ONLY in correction.better. Never leak it in reply, translation, hint, or clue when retryRequired=true.
- If pendingRetry exists, evaluate it before moving on: ${JSON.stringify(pendingRetry)}.
- If correct, do not invent a correction.

SPACED REUSE
Weak words: ${weakWords.join(", ")||"none yet"}.
Known words: ${knownWords.join(", ")||"beginner set"}.
Recurring mistakes: ${JSON.stringify(mistakes)}.
Reuse weak material in new contexts.

NEW MATERIAL + MEMORY HOOKS
- The app already teaches vocabulary before conversation, so introduce at most ONE extra high-value chunk in most replies, and often zero.
- For EVERY learnedChunk, include a short memorable memoryHook that links the Dutch sound/spelling to the English meaning. Example: nee = no, pronounced 'nay' → imagine a horse saying 'neigh' to mean no.
- Prefer vivid, simple hooks. Do not distort the actual pronunciation or meaning just to force a mnemonic.
- The hook is an encoding aid; the learner should still retrieve the Dutch without seeing the answer.

OUTPUT
- reply: short natural Dutch tutor response/question. No markdown.
- translation: concise English translation of reply only.
- hint: partial cue, never the full hidden answer.
- correction: null if correct; otherwise wrong/better/why/clue.
- retryRequired: true when the learner should retry.
- learnedChunks: 0-1 genuinely useful item most turns; each must include dutch, english, learner-friendly pronunciation, and memoryHook.`;

    const apiResponse=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",instructions,input:`${transcript}\nLEARNER: ${message}`,max_output_tokens:1100,text:{verbosity:"low",format:{type:"json_schema",name:"dutch_tutor_response",strict:true,schema:tutorSchema}}})});
    const data=await apiResponse.json();
    if(!apiResponse.ok)return NextResponse.json({error:data?.error?.message||"OpenAI request failed."},{status:apiResponse.status});
    const parsed=parseStructuredOutput(data);
    return NextResponse.json({reply:parsed.reply,translation:parsed.translation,hint:parsed.hint,correction:parsed.correction,retryRequired:Boolean(parsed.retryRequired),learnedChunks:Array.isArray(parsed.learnedChunks)?parsed.learnedChunks.slice(0,2):[]});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unexpected tutor error."},{status:500})}
}
