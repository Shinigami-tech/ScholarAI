import { GoogleGenAI } from "@google/genai";

export type GeminiTask = "light" | "reasoning";

const DEFAULT_LIGHT_MODEL = "gemini-flash-latest";
const DEFAULT_REASONING_MODEL = "gemini-flash-latest";

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenAI({ apiKey });
}

export function getGeminiModel(task: GeminiTask = "light") {
  if (task === "reasoning") {
    return process.env.GEMINI_MODEL_REASONING?.trim() || DEFAULT_REASONING_MODEL;
  }
  return process.env.GEMINI_MODEL_FAST?.trim() || DEFAULT_LIGHT_MODEL;
}

function isRetryable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return ["429", "500", "502", "503", "504", "resource exhausted", "overloaded", "timeout"].some((x) => message.includes(x));
}

export async function generateText(input: {
  prompt: string;
  task?: GeminiTask;
  maxOutputTokens?: number;
  responseMimeType?: string;
}) {
  const ai = getGeminiClient();
  const model = getGeminiModel(input.task);
  let last: unknown;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        config: {
          maxOutputTokens: input.maxOutputTokens ?? 2048,
          ...(input.responseMimeType ? { responseMimeType: input.responseMimeType } : {}),
        },
      });
      return response.text?.trim() || "";
    } catch (error) {
      last = error;
      if (!isRetryable(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  throw last;
}

export function jsonFromText<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned) as T;
}
