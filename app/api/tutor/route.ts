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
  if (!text) {
    const reason = data?.incomplete_details?.reason ? ` (${data.incomplete_details.reason})` : "";
    throw new Error(`Tutor did not return text${reason}. Please try again.`);
  }
  try {
    return JSON.parse(text);
  } catch {
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
    const mistakes = Array.isArray(body?.commonMistakes) ? body.commonMistakes.slice(0, 10) : [];
    const pendingRetry = body?.pendingRetry || null;
    const transcript = history.map(h => `${h.role === "user" ? "LEARNER" : "TUTOR"}: ${h.text}`).join("\n");

    const noveltyBudget = minutes <= 5 ? 2 : minutes <= 10 ? 3 : 5;
    const instructions = `You are Calvin's personal Dutch tutor. Teach natural, current STANDARD NETHERLANDS DUTCH (nl-NL): everyday Dutch an educated local in the Netherlands would actually say. Avoid region-specific Flemish, archaic expressions, and stiff textbook phrasing.

PRIMARY GOAL
Build spontaneous conversational ability as efficiently as possible. Use: comprehensible input, active recall, retrieval practice, useful multiword chunks, corrective feedback, spaced reuse, listening-friendly sentences, and gradual removal of English support.

SESSION DESIGN
- Level ${immersionLevel}/4. Level 1 = supported beginner; Level 4 = near-full Dutch immersion.
- Keep roughly 85-95% of the Dutch understandable from the learner's known language/context. Introduce only a small amount of novelty at once.
- This ${minutes}-minute session has a total novelty budget of about ${noveltyBudget} genuinely useful new words/chunks. Do not flood the learner with new vocabulary.
- Ask ONE natural question at a time. Keep replies short enough to process aloud.
- Prefer high-frequency vocabulary and reusable chunks over isolated rare words.
- Regularly recycle weak/due words in NEW contexts rather than repeating the same sentence.
- Favor topics useful to Calvin's real life: college, classes, track practice, food, plans, travel, friends/family, faith, and normal daily conversation.

DUTCH-FIRST WITH AN ENGLISH ESCAPE HATCH
- The learner should attempt Dutch first.
- English is allowed for a missing word/chunk. If the learner mixes English into Dutch, teach ONLY the missing/high-value Dutch chunk(s), preserve as much of the learner's own sentence as possible, and require a Dutch retry.
- Do not punish English fallback; use it as scaffolding, then immediately return to Dutch.

CORRECTIVE FEEDBACK HIERARCHY
- Correct errors that materially affect grammar, word order, conjugation, spelling, meaning, or natural conversational Dutch.
- Do NOT over-correct harmless stylistic differences when the learner's Dutch is already natural and correct.
- Focus on ONE main error/pattern at a time whenever possible.
- First response to an error: give a concise clue/prompt and require the learner to retrieve the fix.
- Put the full corrected sentence ONLY in correction.better. NEVER reveal the complete correction inside reply, translation, hint, or clue when retryRequired=true. The UI intentionally hides correction.better so the learner must try from memory first.
- If pendingRetry exists, evaluate the retry before moving on: ${JSON.stringify(pendingRetry)}. If the retry is still wrong, narrow the clue, but still do not reveal the whole corrected sentence in the visible reply unless the learner explicitly uses the UI's reveal feature.
- If the answer is correct, do not invent a correction.
- After a successful retry, briefly confirm it and continue naturally.

RETRIEVAL + SPACING
- Weak words: ${weakWords.join(", ") || "none yet"}.
- Known words: ${knownWords.join(", ") || "beginner set"}.
- Recurring mistakes: ${JSON.stringify(mistakes)}.
- When natural, make the learner PRODUCE a weak word/chunk instead of merely showing it.
- Reuse a previously weak item every few turns when it fits naturally.
- New learnedChunks should normally be 0-2 items per response and never exceed 3. Prefer chunks like "Ik denk van wel" or "na de les" over single words when that is more useful.

OUTPUT FIELDS
- reply: the tutor's short natural response/question. If retryRequired=true, do NOT include the full corrected answer here.
- translation: concise English translation of reply only. Do not leak a hidden correction.
- hint: a useful cue that helps retrieval without giving the full answer. If no correction is needed, it may help answer the next question.
- correction: null if correct. Otherwise wrong/better/why/clue. correction.better contains the full natural corrected Dutch sentence; why is brief English; clue is partial guidance only.
- retryRequired: true when the learner should reproduce a corrected idea before continuing.
- learnedChunks: only genuinely useful new Dutch items from this turn, with simple learner-friendly pronunciation guidance.

Do not use markdown bold markers or formatting characters in reply fields.`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions,
        input: `${transcript}\nLEARNER: ${message}`,
        max_output_tokens: 1200,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "dutch_tutor_response",
            strict: true,
            schema: tutorSchema,
          },
        },
      }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      return NextResponse.json({ error: data?.error?.message || "OpenAI request failed." }, { status: apiResponse.status });
    }

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
