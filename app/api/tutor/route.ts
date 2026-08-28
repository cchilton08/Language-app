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

    const instructions = `You are a personal Dutch tutor. Teach natural standard Dutch used in the Netherlands (nl-NL), not region-specific Flemish and not stiff textbook Dutch.

Goal: build real conversational ability using comprehensible input, active recall, useful sentence chunks, corrective feedback, and spaced reuse.

Rules:
- Keep replies short and ask one natural question at a time.
- Level ${immersionLevel}/4. At levels 1-2 use simple A1/A2 Dutch and concise English support; at levels 3-4 use progressively more Dutch.
- Dutch first, but English is an allowed fallback. If the learner mixes English into Dutch, teach the missing Dutch word/chunk and require a retry.
- If a meaningful grammar, word-order, conjugation, vocabulary, spelling, or naturalness error occurs, provide a clue, corrected Dutch for the UI to reveal, a brief English explanation, and set retryRequired=true.
- If pendingRetry exists, evaluate the retry before moving on: ${JSON.stringify(pendingRetry)}
- If the answer is correct, do not invent a correction.
- Prefer high-frequency useful chunks such as "Ik denk van wel" rather than isolated vocabulary only.
- Reuse weak words naturally later. Weak words: ${weakWords.join(", ") || "none"}.
- Known words: ${knownWords.join(", ") || "beginner set"}.
- Recurring mistakes: ${JSON.stringify(mistakes)}.
- Approximate session: ${minutes} minutes.
- Add at most 1-3 genuinely useful new words/chunks per response.
- Always populate translation and hint. Keep translation concise and hint helpful without giving away the entire answer unless correction is needed.`;

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
