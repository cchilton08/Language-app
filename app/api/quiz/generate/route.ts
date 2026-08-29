import { NextResponse } from "next/server";

export const runtime = "nodejs";

function collectOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  const pieces: string[] = [];
  for (const item of data?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content?.text === "string") pieces.push(content.text);
  return pieces.join("\n");
}

function parseStructuredOutput(data: any) {
  const text = collectOutputText(data).trim();
  if (!text) throw new Error("Quiz generator did not return text. Please try again.");
  try { return JSON.parse(text); }
  catch {
    const start = text.indexOf("{"); const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Quiz generator response could not be parsed.");
  }
}

const quizSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 14,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          part: { type: "integer", enum: [1,2,3,4,5] },
          prompt: { type: "string" },
          word: { anyOf: [{ type: "string" }, { type: "null" }] },
          tokens: { anyOf: [{ type: "null" }, { type: "array", minItems: 5, maxItems: 14, items: { type: "string" } }] },
        },
        required: ["id","part","prompt","word","tokens"],
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
    const minutes = [5,10,20].includes(Number(body?.minutes)) ? Number(body.minutes) : 10;
    const transcript = Array.isArray(body?.transcript) ? body.transcript.slice(-16) : [];
    const weakWords = Array.isArray(body?.weakWords) ? body.weakWords.slice(0, 12) : [];
    const learnedChunks = Array.isArray(body?.learnedChunks) ? body.learnedChunks.slice(0, 10) : [];
    const focusWords = Array.isArray(body?.focusWords) ? body.focusWords.slice(0, 8) : [];
    const mistakes = Array.isArray(body?.commonMistakes) ? body.commonMistakes.slice(0, 8) : [];
    const targetCount = minutes === 5 ? 6 : minutes === 10 ? 9 : 13;

    const structure = minutes === 5
      ? `6 questions total: Part 1 has 2 vocabulary/chunk recall; Part 2 has 1 English→Dutch; Part 3 has 1 different Dutch→English; Part 4 has 1 sentence build; Part 5 has 1 short conversation response.`
      : minutes === 10
      ? `9 questions total: Part 1 has 3 vocabulary/chunk recall; Part 2 has 2 English→Dutch; Part 3 has 1 different Dutch→English; Part 4 has 1 sentence build; Part 5 has 2 short conversation responses.`
      : `13 questions total: Part 1 has 4 vocabulary/chunk recall; Part 2 has 3 English→Dutch; Part 3 has 2 different Dutch→English; Part 4 has 2 sentence builds; Part 5 has 2 conversation responses.`;

    const instructions = `Create a ${targetCount}-question adaptive Dutch retrieval quiz for an English-speaking learner of natural STANDARD NETHERLANDS DUTCH (nl-NL), level ${level}/4, after a ${minutes}-minute study session.

PURPOSE
Strengthen long-term speaking and understanding, not recognition. The learner is a true beginner, so the quiz must expose gaps without being demoralizing or testing material never taught.

CONTENT MIX
- About 70% should directly retrieve today's focus chunks, weak words, or recurring structures.
- About 30% should test TRANSFER: the same language in a new simple context.
- Never make Part 3 reveal Part 2 answers.
- Never copy a complete corrected sentence verbatim from the conversation; transform it.
- Use high-frequency everyday Dutch only.
- At Level 1, keep sentences short and use structures the learner has actually encountered.

STRUCTURE
${structure}

RULES
- Part 1 prompt is English; learner types exact Dutch dictionary form or useful chunk. Set word to that Dutch answer.
- Part 2 is English→Dutch productive recall.
- Part 3 is Dutch→English using completely different sentence ideas from Part 2.
- Part 4 prompt begins with "Build:" and gives the English target. Include required Dutch words scrambled plus 2-3 believable distractors.
- Part 5 is an open-ended Dutch question with multiple valid answers.
- No multiple choice.
- For non-vocabulary items set word=null. Without word bank set tokens=null.

Today's focus: ${JSON.stringify(focusWords)}
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
        input: "Generate the personalized retrieval quiz now.",
        max_output_tokens: 1900,
        text: { verbosity: "low", format: { type: "json_schema", name: "dutch_personalized_quiz", strict: true, schema: quizSchema } },
      }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) return NextResponse.json({ error: data?.error?.message || "OpenAI quiz generation failed." }, { status: apiResponse.status });
    const parsed = parseStructuredOutput(data);
    const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0,targetCount).map((q:any,i:number)=>({
      id:String(q.id||`q${i+1}`), part:Number(q.part), prompt:String(q.prompt||""), ...(q.word?{word:String(q.word)}:{}), ...(Array.isArray(q.tokens)?{tokens:q.tokens.map(String)}:{})
    })) : [];
    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected quiz generation error." }, { status: 500 });
  }
}
