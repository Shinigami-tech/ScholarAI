import {
  GoogleGenAI,
  createPartFromUri,
} from "@google/genai";

import {
  requireUserForApi,
  consumeUsage,
} from "@/lib/usage";

import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";

import type {
  ReadableStream as NodeReadableStream,
} from "stream/web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERAL_MAX_FILE_SIZE =
  1024 * 1024 * 1024;

const PDF_MAX_FILE_SIZE =
  50 * 1024 * 1024;

const MAX_FILE_NAME_LENGTH = 255;

const MODEL =
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-flash-latest";

const MAX_PROCESSING_ATTEMPTS = 120;
const PROCESSING_INTERVAL_MS = 2000;

const RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY = 1500;

type Flashcard = {
  question: string;
  answer: string;
};

type AnalysisResult = {
  title: string;
  summary: string[];
  keyIdeas: string[];
  simpleExplanation: string;
  flashcards: Flashcard[];
};

type UsageError = Error & {
  code?: string;
};

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/rtf",

  "application/json",

  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",

  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
]);

function sleep(ms: number) {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, ms)
  );
}

function normalizeLanguage(
  language: string
) {
  const value =
    language?.trim().toLowerCase();

  if (!value) {
    return "English";
  }

  const languageMap: Record<
    string,
    string
  > = {
    en: "English",
    ru: "Russian",
    ko: "Korean",
    kk: "Kazakh",
    zh: "Chinese",
    ja: "Japanese",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    tr: "Turkish",
    ar: "Arabic",
    hi: "Hindi",
    uk: "Ukrainian",
    pl: "Polish",
    nl: "Dutch",
    sv: "Swedish",
    no: "Norwegian",
    da: "Danish",
    fi: "Finnish",
    cs: "Czech",
    ro: "Romanian",
    hu: "Hungarian",
    el: "Greek",
    he: "Hebrew",
    id: "Indonesian",
    ms: "Malay",
    vi: "Vietnamese",
    th: "Thai",
    uz: "Uzbek",
    ky: "Kyrgyz",
  };

  return (
    languageMap[value] ||
    language
  );
}

function sanitizeFileName(
  fileName: string
) {
  return fileName
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(
      0,
      MAX_FILE_NAME_LENGTH
    );
}

function isPdf(
  mimeType: string
) {
  return (
    mimeType ===
    "application/pdf"
  );
}

function getMaxFileSize(
  mimeType: string
) {
  return isPdf(mimeType)
    ? PDF_MAX_FILE_SIZE
    : GENERAL_MAX_FILE_SIZE;
}

function formatBytes(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  if (
    bytes <
    1024 * 1024 * 1024
  ) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
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

function getUsageErrorCode(
  error: unknown
): string | undefined {
  if (
    !(error instanceof Error)
  ) {
    return undefined;
  }

  const usageError =
    error as UsageError;

  return usageError.code;
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
      "temporarily unavailable"
    ) ||
    message.includes(
      "timeout"
    ) ||
    message.includes(
      "deadline"
    ) ||
    message.includes(
      "overloaded"
    )
  );
}

async function withRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <=
    RETRY_ATTEMPTS;
    attempt++
  ) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
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

      await sleep(delay);
    }
  }

  throw lastError;
}

async function saveRequestBodyToFile(
  request: Request,
  filePath: string,
  maxFileSize: number
) {
  if (!request.body) {
    throw new Error(
      "Request body is empty."
    );
  }

  const webStream =
    request.body as unknown as NodeReadableStream<Uint8Array>;

  const nodeStream =
    Readable.fromWeb(
      webStream
    );

  const writeStream =
    createWriteStream(
      filePath
    );

  let totalBytes = 0;

  try {
    for await (
      const chunk
      of nodeStream
    ) {
      const buffer =
        Buffer.isBuffer(
          chunk
        )
          ? chunk
          : Buffer.from(
              chunk
            );

      totalBytes +=
        buffer.length;

      if (
        totalBytes >
        maxFileSize
      ) {
        throw new Error(
          `The uploaded file is larger than the allowed limit of ${formatBytes(
            maxFileSize
          )}.`
        );
      }

      if (
        !writeStream.write(
          buffer
        )
      ) {
        await new Promise<void>(
          (
            resolve,
            reject
          ) => {
            writeStream.once(
              "drain",
              resolve
            );

            writeStream.once(
              "error",
              reject
            );
          }
        );
      }
    }

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        writeStream.once(
          "finish",
          resolve
        );

        writeStream.once(
          "error",
          reject
        );

        writeStream.end();
      }
    );

    return totalBytes;
  } catch (error) {
    writeStream.destroy();

    try {
      await fs.unlink(
        filePath
      );
    } catch {
      // File may already be removed.
    }

    throw error;
  }
}

async function waitForFileProcessing(
  ai: GoogleGenAI,
  fileName: string
) {
  for (
    let attempt = 0;
    attempt <
    MAX_PROCESSING_ATTEMPTS;
    attempt++
  ) {
    const file =
      await withRetry(
        () =>
          ai.files.get({
            name: fileName,
          })
      );

    const state =
      String(
        file.state || ""
      ).toUpperCase();

    if (
      state === "ACTIVE"
    ) {
      return file;
    }

    if (
      state === "FAILED"
    ) {
      throw new Error(
        "Gemini failed to process the uploaded file."
      );
    }

    await sleep(
      PROCESSING_INTERVAL_MS
    );
  }

  throw new Error(
    "Gemini file processing timed out after several minutes."
  );
}

function buildPrompt(
  language: string
) {
  const outputLanguage =
    normalizeLanguage(
      language
    );

  return `
You are ScholarAI, an advanced academic intelligence system.

Your task is to analyze the attached file accurately and produce a structured academic analysis.

OUTPUT LANGUAGE:
${outputLanguage}

CORE RULES:

1. Return ONLY valid JSON.
2. Do not write anything before or after the JSON.
3. Do not use Markdown syntax inside JSON values.
4. Do not invent facts.
5. Do not hallucinate information that is absent from the document.
6. Preserve important names, dates, numbers, organizations, terminology, requirements and technical terms.
7. If information is genuinely unavailable, explicitly state that it is unavailable.
8. First understand the original document completely.
9. Then produce the analysis in ${outputLanguage}.
10. The document itself may be written in another language.
11. Translate the analysis when necessary.
12. Keep official names, organization names, certificate names and proper nouns accurate.
13. For official documents, clearly distinguish information explicitly stated by the document from reasonable interpretation.
14. Do not exaggerate the importance, legitimacy, authority or meaning of the document.
15. Do not create information merely to fill an expected structure.
16. Use concise but useful academic language.
17. The analysis should be understandable to a high-school student while remaining factually precise.

TITLE:

Create a clear title that represents the actual document.

SUMMARY:

Create 4 to 6 informative summary points.
Each item should contain meaningful information from the document.
Do not repeat the same point in different wording.

KEY IDEAS:

Create 5 to 8 of the most important ideas, facts, requirements, concepts or conclusions contained in the document.

SIMPLE EXPLANATION:

Explain the document as if you are teaching a high-school student.
Explain difficult terminology in simple language when useful.
Do not introduce facts that are not supported by the document.

FLASHCARDS:

Create up to 10 useful academic flashcards.

Each flashcard must contain:
- question
- answer

Flashcards must be based strictly on information actually present in the document.

If the document does not contain enough information for 10 legitimate flashcards, return fewer.

Do not fabricate flashcards.

REQUIRED JSON STRUCTURE:

{
  "title": "string",
  "summary": [
    "string"
  ],
  "keyIdeas": [
    "string"
  ],
  "simpleExplanation": "string",
  "flashcards": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
`.trim();
}

function cleanAnalysis(
  parsed:
    Partial<AnalysisResult>,
  fileName: string
): AnalysisResult {
  const summary =
    Array.isArray(
      parsed.summary
    )
      ? parsed.summary
          .filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
          .map(
            (item) =>
              item.trim()
          )
          .filter(Boolean)
          .slice(0, 8)
      : [];

  const keyIdeas =
    Array.isArray(
      parsed.keyIdeas
    )
      ? parsed.keyIdeas
          .filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          )
          .map(
            (item) =>
              item.trim()
          )
          .filter(Boolean)
          .slice(0, 10)
      : [];

  const flashcards =
    Array.isArray(
      parsed.flashcards
    )
      ? parsed.flashcards
          .filter(
            (card) =>
              card &&
              typeof card.question ===
                "string" &&
              typeof card.answer ===
                "string"
          )
          .map(
            (card) => ({
              question:
                card.question.trim(),
              answer:
                card.answer.trim(),
            })
          )
          .filter(
            (card) =>
              card.question &&
              card.answer
          )
          .slice(0, 10)
      : [];

  const title =
    typeof parsed.title ===
      "string" &&
    parsed.title.trim()
      ? parsed.title.trim()
      : fileName;

  const simpleExplanation =
    typeof parsed
      .simpleExplanation ===
    "string"
      ? parsed.simpleExplanation.trim()
      : "";

  if (
    !simpleExplanation
  ) {
    throw new Error(
      "Gemini returned an incomplete analysis: simpleExplanation is missing."
    );
  }

  return {
    title,
    summary,
    keyIdeas,
    simpleExplanation,
    flashcards,
  };
}

async function analyzeFile(
  ai: GoogleGenAI,
  filePath: string,
  fileName: string,
  mimeType: string,
  language: string
): Promise<AnalysisResult> {
  const uploadedFile =
    await withRetry(
      () =>
        ai.files.upload({
          file: filePath,

          config: {
            displayName:
              fileName,
            mimeType,
          },
        })
    );

  if (
    !uploadedFile.name
  ) {
    throw new Error(
      "Gemini did not return a file identifier after upload."
    );
  }

  const activeFile =
    await waitForFileProcessing(
      ai,
      uploadedFile.name
    );

  if (
    !activeFile.uri ||
    !activeFile.mimeType
  ) {
    throw new Error(
      "Gemini did not return a usable file URI."
    );
  }

  const filePart =
    createPartFromUri(
      activeFile.uri,
      activeFile.mimeType
    );

  const response =
    await withRetry(
      () =>
        ai.models.generateContent({
          model: MODEL,

          contents: [
            {
              role: "user",

              parts: [
                filePart,
                {
                  text: buildPrompt(
                    language
                  ),
                },
              ],
            },
          ],

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                title: {
                  type: "string",
                },

                summary: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                keyIdeas: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                simpleExplanation: {
                  type: "string",
                },

                flashcards: {
                  type: "array",

                  items: {
                    type: "object",

                    properties: {
                      question: {
                        type: "string",
                      },

                      answer: {
                        type: "string",
                      },
                    },

                    required: [
                      "question",
                      "answer",
                    ],
                  },
                },
              },

              required: [
                "title",
                "summary",
                "keyIdeas",
                "simpleExplanation",
                "flashcards",
              ],
            },
          },
        })
    );

  const rawText =
    response.text?.trim();

  if (!rawText) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  let parsed:
    Partial<AnalysisResult>;

  try {
    parsed =
      JSON.parse(
        rawText
      ) as Partial<AnalysisResult>;
  } catch {
    console.error(
      "Invalid Gemini JSON:",
      rawText
    );

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }

  return cleanAnalysis(
    parsed,
    fileName
  );
}

function getHttpStatus(
  error: unknown
) {
  const message =
    getErrorMessage(
      error
    ).toLowerCase();

  if (
    message.includes(
      "larger than the allowed limit"
    ) ||
    message.includes(
      "larger than the 1 gb"
    )
  ) {
    return 413;
  }

  if (
    message.includes(
      "not supported"
    ) ||
    message.includes(
      "unsupported"
    )
  ) {
    return 415;
  }

  if (
    message.includes("429") ||
    message.includes(
      "quota"
    ) ||
    message.includes(
      "resource exhausted"
    )
  ) {
    return 429;
  }

  if (
    message.includes("400") ||
    message.includes(
      "invalid argument"
    )
  ) {
    return 400;
  }

  if (
    message.includes("403") ||
    message.includes(
      "permission denied"
    )
  ) {
    return 403;
  }

  if (
    message.includes("404") ||
    message.includes(
      "not found"
    )
  ) {
    return 404;
  }

  return 500;
}

export async function POST(
  request: Request
) {
  try {
    const usageUser =
      await requireUserForApi();

    await consumeUsage(
      usageUser.id,
      "analyze"
    );
  } catch (usageError) {
    const code =
      getUsageErrorCode(
        usageError
      );

    if (
      code ===
      "AUTH_REQUIRED"
    ) {
      return Response.json(
        {
          error:
            "Please sign in to analyze documents.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      code ===
      "USAGE_LIMIT_REACHED"
    ) {
      return Response.json(
        {
          error:
            usageError instanceof
            Error
              ? usageError.message
              : "Usage limit reached.",
          code:
            "USAGE_LIMIT_REACHED",
        },
        {
          status: 429,
        }
      );
    }

    throw usageError;
  }

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        success: false,
        error:
          "GEMINI_API_KEY is missing. Add it to .env.local.",
      },
      {
        status: 500,
      }
    );
  }

  let tempFilePath:
    | string
    | null = null;

  try {
    const fileNameHeader =
      request.headers.get(
        "x-file-name"
      );

    const mimeType =
      request.headers.get(
        "x-file-type"
      ) ||
      "application/octet-stream";

    const language =
      request.headers.get(
        "x-language"
      ) || "en";

    if (
      !fileNameHeader
    ) {
      return Response.json(
        {
          success: false,
          error:
            "File name is missing.",
        },
        {
          status: 400,
        }
      );
    }

    let rawFileName:
      string;

    try {
      rawFileName =
        decodeURIComponent(
          fileNameHeader
        );
    } catch {
      rawFileName =
        fileNameHeader;
    }

    const fileName =
      sanitizeFileName(
        rawFileName
      );

    if (!fileName) {
      return Response.json(
        {
          success: false,
          error:
            "Invalid file name.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_MIME_TYPES.has(
        mimeType
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "This file type is not supported.",
          mimeType,
        },
        {
          status: 415,
        }
      );
    }

    const maxFileSize =
      getMaxFileSize(
        mimeType
      );

    const contentLength =
      request.headers.get(
        "content-length"
      );

    if (
      contentLength &&
      Number.isFinite(
        Number(
          contentLength
        )
      ) &&
      Number(
        contentLength
      ) >
        maxFileSize
    ) {
      return Response.json(
        {
          success: false,

          error: `The file is larger than the allowed limit of ${formatBytes(
            maxFileSize
          )}.`,

          limitBytes:
            maxFileSize,

          limit:
            formatBytes(
              maxFileSize
            ),
        },
        {
          status: 413,
        }
      );
    }

    tempFilePath =
      path.join(
        os.tmpdir(),
        `scholarai-${randomUUID()}-${fileName.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )}`
      );

    const size =
      await saveRequestBodyToFile(
        request,
        tempFilePath,
        maxFileSize
      );

    if (
      size <= 0
    ) {
      return Response.json(
        {
          success: false,
          error:
            "The uploaded file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    const analysis =
      await analyzeFile(
        ai,
        tempFilePath,
        fileName,
        mimeType,
        language
      );

    return Response.json(
      {
        success: true,
        fileName,
        mimeType,
        fileSize: size,
        model: MODEL,
        analysis,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "ScholarAI analysis error:",
      error
    );

    const details =
      getErrorMessage(
        error
      );

    const status =
      getHttpStatus(
        error
      );

    return Response.json(
      {
        success: false,
        error:
          "ScholarAI could not analyze this document.",
        details,
        model: MODEL,
      },
      {
        status,
      }
    );
  } finally {
    if (
      tempFilePath
    ) {
      try {
        await fs.unlink(
          tempFilePath
        );
      } catch {
        // Temporary file may already be removed.
      }
    }
  }
}