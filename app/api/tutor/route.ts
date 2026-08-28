import { NextResponse } from "next/server";

export const runtime = "nodejs";

type HistoryItem = { role: "assistant" | "user"; text: string };

function collectOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  const pieces: string[] = [];
  for (const item of data?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content?.text === "string") pieces.push(content.text);
  return pieces.join("\n");
}

function extractJson(text: string) {
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
  throw new Error("Tutor returned an unreadable response.");
}

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
- If a meaningful grammar, word-order, conjugation, vocabulary, or naturalness error occurs, provide a clue, a corrected version for the UI to reveal, a brief English explanation, and set retryRequired=true.
- If pendingRetry exists, evaluate the retry before moving on: ${JSON.stringify(pendingRetry)}
- If the answer is correct, do not invent a correction.
- Prefer high-frequency useful chunks such as "Ik denk van wel" rather than isolated vocabulary only.
- Reuse weak words naturally later. Weak words: ${weakWords.join(", ") || "none"}.
- Known words: ${knownWords.join(", ") || "beginner set"}.
- Recurring mistakes: ${JSON.stringify(mistakes)}.
- Approximate session: ${minutes} minutes.
- Add at most 1-3 genuinely useful new words/chunks per response.

Return ONLY JSON:
{"reply":"short Dutch reply/question","translation":"English translation","hint":"short answering hint","correction":null,"retryRequired":false,"learnedChunks":[]}
If correcting, correction must be {"wrong":"...","better":"...","why":"...","clue":"..."}. learnedChunks items must be {"dutch":"...","english":"...","pronunciation":"..."}.`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions,
        input: `${transcript}\nLEARNER: ${message}`,
        max_output_tokens: 450,
        text: { verbosity: "low" },
      }),
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok) return NextResponse.json({ error: data?.error?.message || "OpenAI request failed." }, { status: apiResponse.status });
    const parsed = extractJson(collectOutputText(data));
    return NextResponse.json({
      reply: typeof parsed.reply === "string" ? parsed.reply : "Goed! Vertel me meer.",
      translation: typeof parsed.translation === "string" ? parsed.translation : "",
      hint: typeof parsed.hint === "string" ? parsed.hint : "",
      correction: parsed.correction && typeof parsed.correction === "object" ? parsed.correction : null,
      retryRequired: Boolean(parsed.retryRequired),
      learnedChunks: Array.isArray(parsed.learnedChunks) ? parsed.learnedChunks.slice(0, 3) : [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected tutor error." }, { status: 500 });
  }
}
