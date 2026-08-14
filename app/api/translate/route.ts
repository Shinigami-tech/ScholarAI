import {
  requireUserForApi,
  consumeUsage,
} from "@/lib/usage";
import {
  NextRequest,
  NextResponse,
} from "next/server";

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

    const prompt = `
You are the translation engine for ScholarAI.

Translate ALL provided academic document analyses into ${languageName}.

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
12. Every document must be returned.
13. Keep the document IDs exactly unchanged.

Target language:
${languageName}

Input documents:

${JSON.stringify(
  documents,
  null,
  2
)}

Return exactly this structure:

{
  "translations": [
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
  ]
}
`;

    const model =
      process.env
        .GEMINI_MODEL_FAST
        ?.trim() ||
      "gemini-2.5-flash";

    const response =
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
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
            }),

          cache: "no-store",
        }
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
      if (
        response.status === 429
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
          error:
            data?.error
              ?.message ||
            `Gemini API error (${response.status}).`,
        },
        {
          status:
            response.status,
        }
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
      return NextResponse.json(
        {
          error:
            "Gemini returned an empty translation.",
        },
        {
          status: 502,
        }
      );
    }

    const extracted =
      extractJson(text);

    if (
      !extracted ||
      typeof extracted !==
        "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid translation structure returned by Gemini.",
        },
        {
          status: 502,
        }
      );
    }

    const parsed =
      extracted as ParsedTranslationResponse;

    if (
      !Array.isArray(
        parsed.translations
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid translation structure returned by Gemini.",
        },
        {
          status: 502,
        }
      );
    }

    const translations:
      TranslationResult[] =
      parsed.translations
        .filter(
          isTranslationResult
        )
        .map(
          (item) => ({
            id: item.id,
            analysis:
              item.analysis,
          })
        );

    if (
      translations.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No valid translated documents were returned.",
        },
        {
          status: 502,
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