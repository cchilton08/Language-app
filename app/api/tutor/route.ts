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

function extractJson(text: string) {
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
  throw new Error("Tutor returned an unreadable response.");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const message = String(body?.message ?? "").slice(0, 1200);
    const history: HistoryItem[] = Array.isArray(body?.history) ? body.history.slice(-10) : [];
    const minutes = Number(body?.minutes ?? 10);
    const weakWords = Array.isArray(body?.weakWords) ? body.weakWords.slice(0, 25) : [];
    const commonMistakes = Array.isArray(body?.commonMistakes) ? body.commonMistakes.slice(0, 12) : [];

    const transcript = history.map(h => `${h.role === "user" ? "STUDENT" : "TUTOR"}: ${h.text}`).join("\n");

    const instructions = `You are Calvin's personal Dutch tutor. He is an English-speaking beginner whose main goal is real conversation and eventually fluency. He learns vocabulary fairly well but needs practice turning words into sentences and understanding natural replies.

Teaching rules:
- Keep the conversation primarily in simple, natural Dutch appropriate for A1/A2.
- Ask ONE natural question at a time and keep the conversation moving.
- Do not overwhelm him with long explanations.
- If his Dutch is correct or natural enough, encourage briefly and continue.
- If there is a meaningful grammar, word-order, conjugation, or naturalness error, correct it.
- Corrections must distinguish between understandable Dutch and what a native speaker would naturally say.
- Brief explanations of mistakes should be in English.
- Reuse weak words naturally when possible, but do not force them unnaturally.
- Never fabricate a mistake if the student's response is correct.
- Do not translate every Dutch sentence unless it is necessary to teach.
- Session length is about ${minutes} minutes.

Weak words to recycle: ${weakWords.join(", ") || "none yet"}
Known recurring mistakes: ${JSON.stringify(commonMistakes)}

Return ONLY valid JSON with this exact shape:
{
  "reply": "the next short Dutch tutor response/question",
  "correction": null OR {
    "wrong": "exact student wording that needs correction",
    "better": "natural corrected Dutch",
    "why": "one concise English explanation"
  }
}`;

    const input = `${transcript}\nSTUDENT: ${message}`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions,
        input,
        max_output_tokens: 300,
        text: { verbosity: "low" },
      }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      const detail = data?.error?.message || "OpenAI request failed.";
      return NextResponse.json({ error: detail }, { status: apiResponse.status });
    }

    const parsed = extractJson(collectOutputText(data));
    return NextResponse.json({
      reply: typeof parsed.reply === "string" ? parsed.reply : "Goed! Wat heb je vandaag gedaan?",
      correction: parsed.correction && typeof parsed.correction === "object" ? parsed.correction : null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected tutor error." }, { status: 500 });
  }
}
