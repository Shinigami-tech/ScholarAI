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

type GeminiError = Error & { code?: string };

function isRetryable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return ["429", "500", "502", "503", "504", "resource exhausted", "overloaded", "timeout"].some((x) => message.includes(x));
}

// A 429 can mean two very different things: "you're sending requests too
// fast, back off a bit" (worth retrying quickly) vs "you've used up your
// whole daily quota for this model" (retrying in 1s/2s/4s is pointless —
// Google's own error tells you to wait 45s+). We only want to burn retry
// budget on the first kind, and fail fast + clearly on the second.
function isDailyQuotaExhausted(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("resource_exhausted") ||
    (message.includes("429") && message.includes("quota")) ||
    message.includes("free_tier_requests")
  );
}

// A single generateContent call has no timeout of its own — if Gemini is
// overloaded (the "high demand" 503s we see alongside this) it can just
// hang on one in-flight call for the whole remaining budget. Our retry
// loop only checked the deadline BETWEEN attempts, so a single stuck call
// would sail right past that check and get hard-killed by Vercel's own
// 60s limit instead of failing cleanly through our error handling. Racing
// every attempt against the remaining deadline closes that gap.
function withTimeout<T>(
  operation: () => Promise<T>,
  deadline?: number
): Promise<T> {
  if (!deadline) {
    return operation();
  }

  const remaining = deadline - Date.now();

  if (remaining <= 0) {
    return Promise.reject(
      new Error(
        "Gemini is taking too long to respond — please try again in a moment."
      )
    );
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          "Gemini is taking too long to respond — please try again in a moment."
        )
      );
    }, remaining);

    operation().then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export async function generateText(input: {
  prompt: string;
  task?: GeminiTask;
  maxOutputTokens?: number;
  responseMimeType?: string;
  deadline?: number;
}) {
  const ai = getGeminiClient();
  const model = getGeminiModel(input.task);
  let last: unknown;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await withTimeout(
        () =>
          ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: input.prompt }] }],
            config: {
              maxOutputTokens: input.maxOutputTokens ?? 2048,
              ...(input.responseMimeType ? { responseMimeType: input.responseMimeType } : {}),
            },
          }),
        input.deadline
      );
      return response.text?.trim() || "";
    } catch (error) {
      last = error;

      if (isDailyQuotaExhausted(error)) {
        const quotaError: GeminiError = new Error(
          "ScholarAI's free daily AI quota has been used up. Please try again later, or ask the ScholarAI team to enable paid Gemini API billing to remove this limit."
        );
        quotaError.code = "GEMINI_QUOTA_EXHAUSTED";
        throw quotaError;
      }

      if (!isRetryable(error) || attempt === 3) throw error;

      const delay = 1000 * Math.pow(2, attempt);

      if (input.deadline && Date.now() + delay > input.deadline) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
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
