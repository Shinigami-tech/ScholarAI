import { GoogleGenAI } from "@google/genai";
import { requireUserForApi, consumeUsage } from "@/lib/usage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Same reasoning as /api/analyze: without this Vercel caps the function
// at the default 10s and kills it silently, which shows up to users as
// Drake randomly failing instead of just taking a bit longer.
export const maxDuration = 60;
const REQUEST_DEADLINE_MS = 45 * 1000;
type DocumentContext = {
  fileName?: string;
  title?: string;
  summary?: string[];
  keyIdeas?: string[];
  simpleExplanation?: string;
};
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
type ChatRequest = {
  question?: string;
  language?: string;
  documents?: DocumentContext[];
  history?: ChatMessage[];
};
type UsageError = Error & {
  code?: string;
};
type GroundingChunk = {
  web?: {
    uri?: string;
    title?: string;
  };
};
type ChatSource = {
  uri: string;
  title: string;
};
type GenerateContentResult = {
  text?: string;
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[];
    };
  }>;
};
// Google Search grounding returns sources as `groundingChunks` keyed by
// index from `groundingSupports` — we only need the flat, de-duplicated
// list of links to show under Drake's reply, not the text-segment
// alignment, so this intentionally ignores groundingSupports.
function extractSources(response: GenerateContentResult): ChatSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: ChatSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (!uri || seen.has(uri)) {
      continue;
    }
    seen.add(uri);
    sources.push({
      uri,
      title: chunk.web?.title || uri,
    });
    if (sources.length >= 5) {
      break;
    }
  }
  return sources;
}
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
const MAX_QUESTION_LENGTH = 12000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_DOCUMENTS = 10;
const RETRY_ATTEMPTS = 5;
// Was 1500ms. With exponential backoff, 4 sleeps between 5 attempts at
// 1500ms base summed to 22.5s of pure waiting before the 5th attempt
// even started — out of a 45s deadline. That's why requests were timing
// out even when Gemini was only moderately slow/flaky: the retry logic
// itself was eating most of the budget. 500ms base leaves far more of
// the deadline for actual attempts.
const RETRY_BASE_DELAY = 500;
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
function getUsageErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  return (error as UsageError).code;
}
function isRetryableError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("429") || message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504") || message.includes("unavailable") || message.includes("resource exhausted") || message.includes("temporarily") || message.includes("overloaded") || message.includes("timeout") || message.includes("deadline");
}
function cleanText(value: unknown, maxLength = 4000) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}
function getLanguageName(language: string) {
  const map: Record<string, string> = {
    en: "English",
    ru: "Russian",
    ko: "Korean",
    kk: "Kazakh",
    zh: "Chinese",
    ja: "Japanese",
    de: "German",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    pt: "Portuguese",
    tr: "Turkish",
    ar: "Arabic",
    hi: "Hindi",
    uz: "Uzbek",
    ky: "Kyrgyz",
    uk: "Ukrainian",
    pl: "Polish",
    nl: "Dutch",
    sv: "Swedish",
    no: "Norwegian",
    da: "Danish",
    fi: "Finnish",
  };
  const normalized = typeof language === "string" ? language.trim().toLowerCase() : "";
  return map[normalized] || "the same language as the user's current message";
}
function buildDocumentContext(documents: DocumentContext[] | undefined) {
  if (!documents?.length) {
    return "NO DOCUMENTS ARE AVAILABLE.";
  }
  return documents
    .slice(0, MAX_DOCUMENTS)
    .map((document, index) => {
      const fileName = cleanText(document.fileName, 500);
      const title = cleanText(document.title, 1000);
      const summary = Array.isArray(document.summary)
        ? document.summary
            .filter((item): item is string => typeof item === "string")
            .map((item) => cleanText(item, 1500))
            .filter(Boolean)
        : [];
      const keyIdeas = Array.isArray(document.keyIdeas)
        ? document.keyIdeas
            .filter((item): item is string => typeof item === "string")
            .map((item) => cleanText(item, 1200))
            .filter(Boolean)
        : [];
      const explanation = cleanText(document.simpleExplanation, 3000);
      return `
DOCUMENT ${index + 1}
FILE:
${fileName || "Unknown"}
TITLE:
${title || "Unknown"}
SUMMARY:
${summary.length ? summary.join("\n") : "Not available"}
KEY IDEAS:
${keyIdeas.length ? keyIdeas.join("\n") : "Not available"}
SIMPLE EXPLANATION:
${explanation || "Not available"}
`.trim();
    })
    .join("\n\n====================\n\n");
}
function buildHistory(history: ChatMessage[] | undefined) {
  if (!history?.length) {
    return "NO PREVIOUS CONVERSATION.";
  }
  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => {
      const role = message.role === "user" ? "USER" : "DRAKE";
      return `${role}: ${cleanText(message.content, 6000)}`;
    })
    .join("\n\n");
}
function buildPrompt(question: string, language: string, documents: DocumentContext[] | undefined, history: ChatMessage[] | undefined) {
  const outputLanguage = getLanguageName(language);
  return `
You are Drake, the general-purpose AI assistant built into ScholarAI.
You are powered by Gemini.
You are NOT a document-only chatbot.
You are a capable general-purpose academic and technical assistant.
You can help with:
- education
- mathematics
- physics
- chemistry
- biology
- history
- geography
- programming
- software engineering
- artificial intelligence
- machine learning
- cybersecurity
- university applications
- IELTS
- SAT
- TOEFL
- writing
- translation
- brainstorming
- research
- explanations
- analysis
- technology
- everyday questions
- creative tasks
- general knowledge
- planning
- problem solving
CORE INTELLIGENCE RULES:
1. Understand the user's actual intent before answering.
2. Do not simply match keywords.
3. Do not invent intent.
4. If the question is genuinely ambiguous and the conversation does not establish the meaning, ask ONE concise clarification.
5. Do not ask unnecessary clarification questions.
6. Use conversation context.
7. Understand references such as:
   - he
   - she
   - it
   - that
   - this
   - the second one
   - continue
   - explain the previous point
8. If the user clarifies an ambiguous question, use that clarification in future turns.
9. Reply in the language of the user's CURRENT message.
10. Do not blindly follow the interface language.
11. NEVER translate these names:
   ScholarAI
   Drake
12. Be accurate.
13. Be useful.
14. Do not dump unrelated information.
15. Do not unnecessarily repeat the user's question.
16. Match response depth to the actual question.
17. Simple questions should receive concise answers.
18. Complex questions should receive detailed answers.
19. If the user explicitly asks for deep explanation, provide a comprehensive explanation.
20. For mathematical and technical questions, show reasoning when useful.
21. Never fabricate unknown information.
22. If you genuinely do not know something, say so.
23. You have access to live Google Search grounding — use it for current events, prices, releases, scores, or anything time-sensitive, and answer from what the search actually returns rather than guessing. Do not paste raw source URLs into your answer text; sources are shown separately below your response.
DOCUMENT RULES:
24. Documents are CONTEXT, not a restriction.
25. Documents must NEVER limit your general knowledge.
26. If the question is unrelated to the documents, answer it immediately using general knowledge or search — do not pause to consider whether it relates to the documents, and do not ask the user whether it does.
27. Do not mention documents when they are irrelevant.
28. If the user explicitly asks about a document, prioritize the document.
29. Preserve facts from the document.
30. Distinguish document facts from general knowledge.
31. Do not invent missing document information.
32. If a question contains both document-related and general parts, use the document where relevant and general knowledge for the rest.
33. Do not constantly say:
"According to your documents..."
34. Do not assume that a document is relevant merely because one word appears in it.
CONVERSATIONAL STYLE:
Be intelligent, calm, direct, natural and helpful.
Do not constantly say that you are an AI.
Do not use unnecessary disclaimers.
PRODUCT IDENTITY:
Your name is Drake.
The platform is ScholarAI.
Do not rename either.
DEFAULT INTERFACE LANGUAGE:
${outputLanguage}
CURRENT USER QUESTION:
${question}
PREVIOUS CONVERSATION:
${buildHistory(history)}
AVAILABLE DOCUMENT CONTEXT:
${buildDocumentContext(documents)}
Now answer the CURRENT USER QUESTION.
Remember:
- Understand intent.
- Use context.
- Clarify genuine ambiguity.
- Never invent intent.
- Documents are optional context.
- Answer unrelated questions normally.
- Use the user's current language.
- Never translate ScholarAI or Drake.
`.trim();
}
// A single Gemini call has no timeout of its own — if the model is
// overloaded it can hang on one in-flight call for the whole remaining
// budget. The old deadline check only ran BETWEEN retry attempts, so a
// single stuck call sailed right past it and got hard-killed by Vercel's
// own 60s limit (an opaque platform timeout) instead of failing cleanly
// through our own error handling. Racing every attempt against the
// remaining deadline closes that gap.
function withTimeout<T>(operation: () => Promise<T>, deadline?: number): Promise<T> {
  if (!deadline) {
    return operation();
  }
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return Promise.reject(new Error("Drake is taking too long to respond — please try again in a moment."));
  }
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Drake is taking too long to respond — please try again in a moment."));
    }, remaining);
    operation().then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
async function generateWithRetry(ai: GoogleGenAI, prompt: string, deadline: number, useSearch: boolean, maxAttempts: number = RETRY_ATTEMPTS) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(
        () =>
          ai.models.generateContent({
            model: MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            config: {
              maxOutputTokens: 4096,
              ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
            },
          }),
        deadline,
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
      // Fail fast with a clean message instead of sleeping past the
      // point where Vercel would kill the function anyway.
      if (Date.now() + delay > deadline) {
        throw error;
      }
      await sleep(delay);
    }
  }
  throw lastError;
}
function getHttpStatus(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("429") || message.includes("quota") || message.includes("resource exhausted")) {
    return 429;
  }
  if (message.includes("400") || message.includes("invalid argument")) {
    return 400;
  }
  if (message.includes("403") || message.includes("permission denied")) {
    return 403;
  }
  if (message.includes("404") || message.includes("not found")) {
    return 404;
  }
  return 500;
}
export async function POST(request: Request) {
  const deadline = Date.now() + REQUEST_DEADLINE_MS;
  try {
    const usageUser = await requireUserForApi();
    await consumeUsage(usageUser.id, "chat");
  } catch (usageError) {
    const code = getUsageErrorCode(usageError);
    if (code === "AUTH_REQUIRED") {
      return Response.json(
        {
          error: "Please sign in to use Drake.",
        },
        {
          status: 401,
        },
      );
    }
    if (code === "USAGE_LIMIT_REACHED") {
      return Response.json(
        {
          error: usageError instanceof Error ? usageError.message : "Usage limit reached.",
          code: "USAGE_LIMIT_REACHED",
        },
        {
          status: 429,
        },
      );
    }
    throw usageError;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        success: false,
        error: "GEMINI_API_KEY is missing. Add it to .env.local.",
      },
      {
        status: 500,
      },
    );
  }
  try {
    const body = (await request.json()) as ChatRequest;
    const question = cleanText(body.question, MAX_QUESTION_LENGTH);
    if (!question) {
      return Response.json(
        {
          success: false,
          error: "Question is empty.",
        },
        {
          status: 400,
        },
      );
    }
    const language = typeof body.language === "string" ? body.language : "en";
    const history = Array.isArray(body.history)
      ? body.history
          .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
          .map((message) => ({
            role: message.role,
            content: cleanText(message.content, 6000),
          }))
          .filter((message) => message.content)
          .slice(-MAX_HISTORY_MESSAGES)
      : [];
    const documents = Array.isArray(body.documents) ? body.documents.slice(0, MAX_DOCUMENTS) : [];
    const ai = new GoogleGenAI({
      apiKey,
    });
    const prompt = buildPrompt(question, language, documents, history);
    let response;
    let searchFailed = false;
    try {
      // Cap the search attempt at 2 tries instead of the full 5. Search
      // calls add real latency (Gemini has to hit Google Search, wait,
      // then generate), so letting it burn through all 5 attempts +
      // backoff can eat the entire deadline before the plain fallback
      // ever gets a turn. Failing fast here leaves most of the budget
      // for the fallback below, which is simpler and more likely to
      // succeed.
      response = await generateWithRetry(ai, prompt, deadline, true, 2);
    } catch (searchError) {
      // Google Search grounding can be unavailable for a given API key,
      // billing tier, or model (it 400s instead of just being ignored),
      // which would otherwise take Drake down for every single message,
      // not just time-sensitive ones. Fall back to a plain answer instead
      // of failing the whole request.
      //
      // IMPORTANT: reuse the SAME overall deadline for the fallback
      // attempt instead of handing it a fresh budget. A fresh deadline
      // here is what previously pushed a real request over Vercel's 60s
      // hard kill (search attempt burns ~45s, then the fallback burns
      // another ~45s = 90s total, so Vercel kills the function with an
      // opaque 504 instead of our clean JSON error). Sharing the deadline
      // guarantees the whole request can never take longer than
      // REQUEST_DEADLINE_MS end to end.
      console.error("Drake chat with search grounding failed, retrying without search:", searchError);
      searchFailed = true;
      if (Date.now() >= deadline) {
        throw searchError;
      }
      response = await generateWithRetry(ai, prompt, deadline, false);
    }
    if (searchFailed) {
      console.warn("Drake answered without live search grounding this turn.");
    }
    const answer = response.text?.trim();
    if (!answer) {
      return Response.json(
        {
          success: false,
          error: "Drake returned an empty response.",
        },
        {
          status: 502,
        },
      );
    }
    const sources = extractSources(response);
    return Response.json(
      {
        success: true,
        answer,
        model: MODEL,
        sources: sources.length ? sources : undefined,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Drake chat failed:", error);
    const details = getErrorMessage(error);
    return Response.json(
      {
        success: false,
        error: "Drake could not process the request.",
        details,
        model: MODEL,
      },
      {
        status: getHttpStatus(error),
      },
    );
  }
}
