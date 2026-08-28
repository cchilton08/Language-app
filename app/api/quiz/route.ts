import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
  throw new Error("Quiz grader returned an unreadable response.");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  try {
    const body = await request.json();
    const questions = Array.isArray(body?.questions) ? body.questions.slice(0, 20) : [];
    const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
    const payload = questions.map((q: any) => ({ id: q.id, part: q.part, prompt: q.prompt, word: q.word, tokens: q.tokens, answer: String(answers[q.id] || "") }));

    const instructions = `You are a strict but fair Dutch teacher grading a beginner's quiz in STANDARD NETHERLANDS DUTCH.

Grading rules:
- A blank answer is always incorrect and receives 0 points.
- Do not silently replace a wrong answer and then count it correct.
- For vocabulary recall, require the requested dictionary form. Example: if prompt is "to think", "denk" is not the infinitive "denken".
- For English→Dutch, grade grammar, spelling, conjugation, word order, and whether a Dutch speaker would naturally say it.
- For Dutch→English, accept natural English equivalents; do not over-penalize a non-literal but correct meaning.
- For sentence building, the final sentence must be grammatical and convey the target meaning. Extra distractor words should not appear unless needed.
- For conversation, accept multiple natural responses if they answer the actual question correctly.
- Minor punctuation/capitalization alone should not make an otherwise correct answer wrong.
- Each item is worth 1 point. Use points 0 or 1 only.
- Give the corrected answer for every wrong item. Keep explanations to one short sentence.
- Calculate score as percentage correct, rounded to nearest whole number.

Return ONLY JSON:
{"score":0,"items":[{"id":"...","correct":true,"points":1,"correction":"","explanation":""}],"coachNote":"1-2 concise sentences identifying the biggest skill to work on next."}`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions,
        input: JSON.stringify(payload),
        max_output_tokens: 1200,
        text: { verbosity: "low" },
      }),
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok) return NextResponse.json({ error: data?.error?.message || "OpenAI grading request failed." }, { status: apiResponse.status });
    const parsed = extractJson(collectOutputText(data));
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const score = Number.isFinite(Number(parsed.score)) ? Math.max(0, Math.min(100, Math.round(Number(parsed.score)))) : Math.round((items.filter((x: any) => x.correct).length / Math.max(items.length, 1)) * 100);
    return NextResponse.json({ score, items, coachNote: typeof parsed.coachNote === "string" ? parsed.coachNote : "Review your missed answers, then use them again in conversation." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected quiz grading error." }, { status: 500 });
  }
}
