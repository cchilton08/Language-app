import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
  if (!text) throw new Error("Quiz generator did not return text. Please try again.");
  try { return JSON.parse(text); } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Quiz generator response could not be parsed.");
  }
}

const quizSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 10,
      maxItems: 16,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          part: { type: "integer", enum: [1, 2, 3, 4, 5] },
          prompt: { type: "string" },
          word: { anyOf: [{ type: "string" }, { type: "null" }] },
          tokens: {
            anyOf: [
              { type: "null" },
              { type: "array", minItems: 6, maxItems: 14, items: { type: "string" } },
            ],
          },
        },
        required: ["id", "part", "prompt", "word", "tokens"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });

  try {
    const body = await request.json();
    const level = Math.max(1, Math.min(4, Number(body?.level || 1)));
    const transcript = Array.isArray(body?.transcript) ? body.transcript.slice(-16) : [];
    const weakWords = Array.isArray(body?.weakWords) ? body.weakWords.slice(0, 12) : [];
    const learnedChunks = Array.isArray(body?.learnedChunks) ? body.learnedChunks.slice(0, 10) : [];
    const mistakes = Array.isArray(body?.commonMistakes) ? body.commonMistakes.slice(0, 8) : [];

    const instructions = `Create a short adaptive Dutch quiz for an English-speaking learner of STANDARD NETHERLANDS DUTCH (nl-NL), level ${level}/4.

Use the learner's actual recent conversation, weak vocabulary, newly learned chunks, and recurring mistakes. Test production and comprehension, not recognition.

Required structure:
- Part 1: 3-4 vocabulary recall questions. Prompt is English; the learner must type the Dutch dictionary form or exact useful chunk. Set word to the Dutch answer so mastery can be tracked. Prefer weak/recent words.
- Part 2: 3 English → Dutch sentence translations using useful beginner/intermediate sentences.
- Part 3: 3 Dutch → English sentences. These MUST be completely different sentences and ideas from Part 2 so they never reveal Part 2 answers.
- Part 4: 2 build-the-sentence questions. Prompt begins with "Build:" and gives the English target. tokens must contain all required Dutch words scrambled PLUS 2-4 believable distractor words. Sentences should be 6-10 required words, not trivial 3-word sentences.
- Part 5: 2 open-ended Dutch conversation questions with no single memorized answer.

Rules:
- Do not repeat the exact same question across parts.
- Use natural Dutch people in the Netherlands would actually say.
- Keep difficulty challenging but fair for level ${level}.
- Prefer high-frequency useful language over obscure vocabulary.
- Return 13-14 total questions when possible.
- For non-vocabulary questions, set word=null. For questions without word-bank tokens, set tokens=null.

Learner context:
Weak words: ${JSON.stringify(weakWords)}
New chunks: ${JSON.stringify(learnedChunks)}
Recurring mistakes: ${JSON.stringify(mistakes)}
Recent conversation: ${JSON.stringify(transcript)}`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions,
        input: "Generate the personalized quiz now.",
        max_output_tokens: 2200,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "dutch_personalized_quiz",
            strict: true,
            schema: quizSchema,
          },
        },
      }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) return NextResponse.json({ error: data?.error?.message || "OpenAI quiz generation failed." }, { status: apiResponse.status });

    const parsed = parseStructuredOutput(data);
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.map((q: any, i: number) => ({
          id: String(q.id || `q${i + 1}`),
          part: Number(q.part),
          prompt: String(q.prompt || ""),
          ...(q.word ? { word: String(q.word) } : {}),
          ...(Array.isArray(q.tokens) ? { tokens: q.tokens.map(String) } : {}),
        }))
      : [];

    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected quiz generation error." }, { status: 500 });
  }
}
