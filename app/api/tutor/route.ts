import { NextResponse } from "next/server";

export const runtime = "nodejs";

type HistoryItem = { role: "assistant" | "user"; text: string };

function collectOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  const pieces: string[] = [];
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") pieces.push(content.text);
    }
  }
  return pieces.join("\n");
}

function parseStructuredOutput(data: any) {
  const text = collectOutputText(data).trim();
  if (!text) throw new Error("Tutor did not return text. Please try again.");
  try { return JSON.parse(text); }
  catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
    throw new Error("Tutor response could not be parsed. Please try again.");
  }
}

const tutorSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    translation: { type: "string" },
    hint: { type: "string" },
    correction: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            wrong: { type: "string" },
            better: { type: "string" },
            why: { type: "string" },
            clue: { type: "string" },
          },
          required: ["wrong", "better", "why", "clue"],
          additionalProperties: false,
        },
      ],
    },
    retryRequired: { type: "boolean" },
    learnedChunks: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          dutch: { type: "string" },
          english: { type: "string" },
          pronunciation: { type: "string" },
        },
        required: ["dutch", "english", "pronunciation"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "translation", "hint", "correction", "retryRequired", "learnedChunks"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });

  try {
    const body = await request.json();
    const message = String(body?.message ?? "").slice(0, 1400);
    const history: HistoryItem[] = Array.isArray(body?.history) ? body.history.slice(-14) : [];
    const minutes = Number(body?.minutes || 10);
    const immersionLevel = Math.max(1, Math.min(4, Number(body?.immersionLevel || 1)));
    const knownWords = Array.isArray(body?.knownWords) ? body.knownWords.slice(0, 120) : [];
    const weakWords = Array.isArray(body?.weakWords) ? body.weakWords.slice(0, 20) : [];
    const focusWords = Array.isArray(body?.focusWords) ? body.focusWords.slice(0, 8) : [];
    const mistakes = Array.isArray(body?.commonMistakes) ? body.commonMistakes.slice(0, 10) : [];
    const pendingRetry = body?.pendingRetry || null;
    const transcript = history.map(h => `${h.role === "user" ? "LEARNER" : "TUTOR"}: ${h.text}`).join("\n");

    const instructions = `You are Calvin's personal Dutch tutor. Teach natural, current STANDARD NETHERLANDS DUTCH (nl-NL): everyday Dutch a local in the Netherlands would actually say.

GOAL
Build practical speaking AND listening/understanding as efficiently as possible from a true beginner level. The learner has about ${minutes} minutes today, so every turn must be high-value.

LEVEL ${immersionLevel}/4
- Level 1 is vocabulary-first supported immersion. Keep sentences short and concrete. Do not act like the learner already knows Dutch.
- At Level 1, most conversation should deliberately reuse today's taught chunks and previously weak material.
- Gradually increase spontaneous Dutch only when recall and quiz performance improve.

TODAY'S FOCUS CHUNKS
${focusWords.join(", ") || "none supplied"}
Use these naturally in the conversation. Prefer asking questions that let the learner PRODUCE one of them.

COMPREHENSIBLE INPUT
- Keep roughly 85-95% of each Dutch reply understandable from context/known language.
- Ask ONE question at a time.
- Keep replies short enough to hear, repeat, and process aloud.
- Prefer common verbs, question words, connectors, and everyday chunks over obscure nouns.
- Do not repeatedly ask the same generic opener. Continue naturally from the existing conversation.

ENGLISH FALLBACK
- The learner should try Dutch first, but English is explicitly allowed when a word is missing.
- If the learner mixes English into Dutch, teach the missing Dutch chunk and require a Dutch retry.
- If the learner types a garbled or unrecognizable word and intent is unclear, ask briefly what they meant IN ENGLISH rather than guessing a strange Dutch word.
- Do not punish English fallback; convert it into a small Dutch lesson and return to Dutch immediately.

CORRECTIVE FEEDBACK
- Correct errors that materially affect grammar, word order, conjugation, spelling, meaning, or naturalness.
- Focus on ONE main error at a time whenever possible.
- First give a clue and require retrieval.
- Put the full corrected sentence ONLY in correction.better. NEVER leak it in reply, translation, hint, or clue when retryRequired=true.
- If pendingRetry exists, evaluate the retry before moving on: ${JSON.stringify(pendingRetry)}.
- If the answer is correct, do not invent a correction.

SPACED REUSE
Weak words: ${weakWords.join(", ") || "none yet"}.
Known words: ${knownWords.join(", ") || "beginner set"}.
Recurring mistakes: ${JSON.stringify(mistakes)}.
Revisit weak material in NEW contexts rather than repeating the exact same sentence.

NEW MATERIAL
The app already teaches vocabulary before conversation. During chat, introduce at most ONE extra high-value chunk in a response, and often zero. Do not flood the learner.

OUTPUT
- reply: short natural tutor response/question. No markdown.
- translation: concise English translation of reply only.
- hint: partial cue, not the full answer.
- correction: null when correct; otherwise wrong/better/why/clue.
- retryRequired: true when the learner should reproduce the corrected idea.
- learnedChunks: 0-1 genuinely useful new item most turns, never more than 3.`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions,
        input: `${transcript}\nLEARNER: ${message}`,
        max_output_tokens: 1000,
        text: {
          verbosity: "low",
          format: { type: "json_schema", name: "dutch_tutor_response", strict: true, schema: tutorSchema },
        },
      }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) return NextResponse.json({ error: data?.error?.message || "OpenAI request failed." }, { status: apiResponse.status });

    const parsed = parseStructuredOutput(data);
    return NextResponse.json({
      reply: parsed.reply,
      translation: parsed.translation,
      hint: parsed.hint,
      correction: parsed.correction,
      retryRequired: Boolean(parsed.retryRequired),
      learnedChunks: Array.isArray(parsed.learnedChunks) ? parsed.learnedChunks.slice(0, 3) : [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected tutor error." }, { status: 500 });
  }
}
