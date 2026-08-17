import {
  requireUserForApi,
  consumeUsage,
} from "@/lib/usage";
import {
  NextRequest,
  NextResponse,
} from "next/server";

// Same class of bug as /api/analyze and /api/chat had before: with no
// maxDuration set, Vercel caps this route at the platform default (10s)
// and silently kills it — for anything more than a document or two,
// translation legitimately takes longer than that. On top of that this
// route had zero retry logic, so a single transient hiccup from Gemini
// just failed outright instead of getting a second try.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REQUEST_DEADLINE_MS = 22 * 1000;

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 1200;

type Language = "en" | "ru" | "ko";

type Flashcard = {
  question: string;
  answer: string;
};

type Analysis = {
  title: string;
  summary: string[];
  keyIdeas: string[];
  simpleExplanation: string;
  flashcards: Flashcard[];
};

type TranslationDocument = {
  id: string;
  fileName: string;
  analysis: Analysis;
};

type TranslationResult = {
  id: string;
  analysis: Analysis;
};

type TranslationRequestBody = {
  language?: unknown;
  documents?: unknown;
};

type GeminiResponse = {
  error?: {
    message?: string;
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type ParsedTranslationResponse = {
  translations?: unknown;
};

function getLanguageName(
  language: Language
) {
  switch (language) {
    case "ru":
      return "Russian";

    case "ko":
      return "Korean";

    case "en":
    default:
      return "English";
  }
}

function extractJson(
  text: string
): unknown {
  const cleaned = text
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();

  try {
    return JSON.parse(
      cleaned
    ) as unknown;
  } catch {
    const firstBrace =
      cleaned.indexOf("{");

    const lastBrace =
      cleaned.lastIndexOf("}");

    if (
      firstBrace !== -1 &&
      lastBrace !== -1 &&
      lastBrace > firstBrace
    ) {
      return JSON.parse(
        cleaned.slice(
          firstBrace,
          lastBrace + 1
        )
      ) as unknown;
    }

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }
}

function isLanguage(
  value: unknown
): value is Language {
  return (
    value === "en" ||
    value === "ru" ||
    value === "ko"
  );
}

function isFlashcard(
  value: unknown
): value is Flashcard {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const card =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof card.question ===
      "string" &&
    typeof card.answer ===
      "string"
  );
}

function isAnalysis(
  value: unknown
): value is Analysis {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const analysis =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof analysis.title ===
      "string" &&
    Array.isArray(
      analysis.summary
    ) &&
    analysis.summary.every(
      (item) =>
        typeof item === "string"
    ) &&
    Array.isArray(
      analysis.keyIdeas
    ) &&
    analysis.keyIdeas.every(
      (item) =>
        typeof item === "string"
    ) &&
    typeof analysis.simpleExplanation ===
      "string" &&
    Array.isArray(
      analysis.flashcards
    ) &&
    analysis.flashcards.every(
      isFlashcard
    )
  );
}

function isTranslationDocument(
  value: unknown
): value is TranslationDocument {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const document =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof document.id ===
      "string" &&
    typeof document.fileName ===
      "string" &&
    isAnalysis(
      document.analysis
    )
  );
}

function isTranslationResult(
  value: unknown
): value is TranslationResult {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const item =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof item.id ===
      "string" &&
    isAnalysis(
      item.analysis
    )
  );
}

function sleep(ms: number) {
  return new Promise<void>(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(error);
}

function isRetryableError(
  error: unknown
) {
  const message =
    getErrorMessage(
      error
    ).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes(
      "resource exhausted"
    ) ||
    message.includes(
      "overloaded"
    ) ||
    message.includes(
      "unavailable"
    ) ||
    message.includes(
      "timeout"
    )
  );
}

// Same distinction as the other Gemini routes: a daily-quota 429 won't
// resolve itself in a few seconds (Google itself asks for 45s+), so it's
// treated as non-retryable and surfaced immediately instead of burning
// the request's time budget on pointless retries.
function isDailyQuotaExhausted(
  error: unknown
) {
  const message =
    getErrorMessage(
      error
    ).toLowerCase();

  return (
    message.includes(
      "resource_exhausted"
    ) ||
    (message.includes("429") &&
      message.includes(
        "quota"
      )) ||
    message.includes(
      "free_tier_requests"
    )
  );
}

// Races a single attempt against the remaining deadline so one stuck
// call can't silently eat the whole request budget — same fix applied
// to /api/analyze, /api/chat and lib/gemini.ts after a Gemini slowdown
// caused calls to hang instead of failing fast.
function withTimeout<T>(
  operation: () => Promise<T>,
  deadline: number
): Promise<T> {
  const remaining =
    deadline - Date.now();

  if (remaining <= 0) {
    return Promise.reject(
      new Error(
        "Translation is taking too long — please try again in a moment."
      )
    );
  }

  return new Promise<T>(
    (resolve, reject) => {
      const timeoutId =
        setTimeout(() => {
          reject(
            new Error(
              "Translation is taking too long — please try again in a moment."
            )
          );
        }, remaining);

      operation().then(
        (value) => {
          clearTimeout(
            timeoutId
          );
          resolve(value);
        },
        (error) => {
          clearTimeout(
            timeoutId
          );
          reject(error);
        }
      );
    }
  );
}

function buildSingleDocumentPrompt(
  document: TranslationDocument,
  languageName: string
) {
  return `
You are the translation engine for ScholarAI.

Translate the provided academic document analysis into ${languageName}.

IMPORTANT RULES:

1. Translate every human-readable piece of content.
2. Translate:
   - title
   - summary
   - keyIdeas
   - simpleExplanation
   - flashcard questions
   - flashcard answers
3. Do NOT translate the product/website name "ScholarAI".
4. Preserve names of people, places, organizations, books, anime, manga, scientific terms and other proper nouns when appropriate.
5. Do not summarize.
6. Do not shorten.
7. Do not add information.
8. Do not remove information.
9. Preserve the exact JSON structure.
10. Return ONLY valid JSON.
11. Do not wrap the JSON in markdown.
12. Keep the document ID exactly unchanged.

Target language:
${languageName}

Input document:

${JSON.stringify(
  document,
  null,
  2
)}

Return exactly this structure:

{
  "id": "same-document-id",
  "analysis": {
    "title": "...",
    "summary": ["..."],
    "keyIdeas": ["..."],
    "simpleExplanation": "...",
    "flashcards": [
      {
        "question": "...",
        "answer": "..."
      }
    ]
  }
}
`;
}

async function translateDocument(
  document: TranslationDocument,
  languageName: string,
  apiKey: string,
  model: string,
  deadline: number
): Promise<TranslationResult> {
  const prompt =
    buildSingleDocumentPrompt(
      document,
      languageName
    );

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <=
    RETRY_ATTEMPTS;
    attempt++
  ) {
    try {
      const response =
        await withTimeout(
          () =>
            fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify(
                  {
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

                    generationConfig: {
                      temperature: 0.1,

                      responseMimeType:
                        "application/json",
                    },
                  }
                ),

                cache: "no-store",
              }
            ),
          deadline
        );

      const rawText =
        await response.text();

      let data:
        | GeminiResponse
        | null = null;

      try {
        const parsedData =
          JSON.parse(
            rawText
          ) as unknown;

        if (
          parsedData &&
          typeof parsedData ===
            "object"
        ) {
          data =
            parsedData as GeminiResponse;
        }
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.error
            ?.message ||
            `Gemini API error (${response.status}).`
        );
      }

      const text =
        data?.candidates?.[0]
          ?.content?.parts?.[0]
          ?.text;

      if (
        typeof text !==
          "string" ||
        !text.trim()
      ) {
        throw new Error(
          "Gemini returned an empty translation."
        );
      }

      const extracted =
        extractJson(text);

      if (
        !isTranslationResult(
          extracted
        )
      ) {
        throw new Error(
          "Invalid translation structure returned by Gemini."
        );
      }

      return {
        id: extracted.id,
        analysis:
          extracted.analysis,
      };
    } catch (error) {
      lastError = error;

      if (
        isDailyQuotaExhausted(
          error
        ) ||
        !isRetryableError(
          error
        ) ||
        attempt ===
          RETRY_ATTEMPTS
      ) {
        throw error;
      }

      const delay =
        RETRY_BASE_DELAY *
        Math.pow(
          2,
          attempt - 1
        );

      if (
        Date.now() + delay >
        deadline
      ) {
        throw error;
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

export async function POST(
  request: NextRequest
) {
  try {
    const usageUser =
      await requireUserForApi();

    await consumeUsage(
      usageUser.id,
      "translate"
    );

    const rawBody =
      (await request.json()) as unknown;

    const body: TranslationRequestBody =
      rawBody &&
      typeof rawBody === "object"
        ? (
            rawBody as TranslationRequestBody
          )
        : {};

    const languageValue =
      body.language;

    if (
      !isLanguage(
        languageValue
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid target language.",
        },
        {
          status: 400,
        }
      );
    }

    const language =
      languageValue;

    const documentsValue =
      body.documents;

    if (
      !Array.isArray(
        documentsValue
      ) ||
      documentsValue.length === 0
    ) {
      return NextResponse.json(
        {
          translations: [],
        },
        {
          status: 200,
        }
      );
    }

    const documents =
      documentsValue.filter(
        isTranslationDocument
      );

    if (
      documents.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No valid documents were provided.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      language === "en"
    ) {
      return NextResponse.json({
        translations:
          documents.map(
            (doc) => ({
              id: doc.id,
              analysis:
                doc.analysis,
            })
          ),
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const languageName =
      getLanguageName(
        language
      );

    const model =
      process.env
        .GEMINI_MODEL_FAST
        ?.trim() ||
      "gemini-flash-latest";

    const deadline =
      Date.now() +
      REQUEST_DEADLINE_MS;

    // Translating was previously ONE giant request covering every
    // document at once — with several saved documents that prompt (and
    // the expected output) grows large, which is the other big reason
    // this "loaded forever." Translating each document in its own
    // smaller, independent request run CONCURRENTLY cuts wall-clock time
    // from "sum of every document" down to roughly "the slowest single
    // document," and a stuck/failed translation for one document no
    // longer blocks the rest.
    const settled =
      await Promise.allSettled(
        documents.map(
          (document) =>
            translateDocument(
              document,
              languageName,
              apiKey,
              model,
              deadline
            )
        )
      );

    let quotaExhausted = false;

    const translations: TranslationResult[] =
      settled.map(
        (result, index) => {
          if (
            result.status ===
            "fulfilled"
          ) {
            return result.value;
          }

          if (
            isDailyQuotaExhausted(
              result.reason
            )
          ) {
            quotaExhausted = true;
          }

          // A single document's translation failing shouldn't nuke the
          // whole batch — fall back to the original (untranslated)
          // analysis for that one document so the user still gets
          // everything else back successfully.
          return {
            id: documents[
              index
            ].id,
            analysis:
              documents[
                index
              ].analysis,
          };
        }
      );

    if (
      quotaExhausted &&
      settled.every(
        (result) =>
          result.status ===
          "rejected"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Gemini API quota is exhausted. The translation request was stopped safely. Please wait for the quota reset or use a Gemini API project with available quota.",
          code:
            "GEMINI_QUOTA_EXHAUSTED",
        },
        {
          status: 429,
        }
      );
    }

    return NextResponse.json(
      {
        translations,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Translation route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Translation service failed.",
      },
      {
        status: 500,
      }
    );
  }
}