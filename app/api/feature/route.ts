import { NextResponse } from "next/server";
import {
  generateText,
  jsonFromText,
} from "@/lib/gemini";
import {
  consumeUsage,
  requireUserForApi,
} from "@/lib/usage";
import {
  UNIT_COSTS,
  type UsageFeature,
} from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Without this Vercel kills the function at the default 10s, which is
// what was cutting off Learning Lab tools (Voice Tutor, etc.) mid-request.
export const maxDuration = 60;

const REQUEST_DEADLINE_MS = 50 * 1000;

const MAX_BODY = 50000;

type FeatureRequestBody = {
  feature?: unknown;
  input?: unknown;
};

type UsageError = Error & {
  code?: string;
};

const featureInstructions: Record<
  UsageFeature,
  string
> = {
  study:
    "Create a structured study guide with: learning goals, key concepts, misconceptions, 5 practice questions, and a 15-minute recap plan.",

  smartDocument:
    "Analyze the supplied study material into: overview, sections, key terms, definitions, important facts, formulas if present, exam-relevant points, and 5 source-based questions.",

  exam:
    "Build an adaptive exam-preparation plan. Include daily objectives, active recall, practice tasks, review spacing, and a final mock exam.",

  flashcards:
    "Generate high-quality flashcards. Return JSON with cards [{question, answer, difficulty}]. Never invent facts not present in the source.",

  quiz:
    "Generate a mixed quiz. Return JSON with questions [{question, options, answer, explanation, difficulty}].",

  knowledgeMap:
    "Create a hierarchical knowledge map. Return JSON as {root, nodes:[{id,label,parentId,confidence,reason}]}.",

  math:
    "Solve the math problem step by step. Return JSON with {problem, answer, steps:[...], commonMistake, practice}.",

  voice:
    "Act as a concise Socratic tutor. Answer the student, then give one short check-for-understanding question.",

  camera:
    "Interpret the homework image. Identify the task, solve or explain it step by step, and clearly state any uncertainty caused by the image.",

  chat:
    "Answer the student's question clearly and accurately.",

  analyze:
    "This operation is represented here only for internal usage accounting. The existing analyze route performs document analysis.",

  translate:
    "This operation is represented here only for internal usage accounting. The existing translate route performs translation.",

  progress:
    "Summarize the student's progress into strengths, weak topics, next actions, and a 7-day focus plan.",

  source:
    "Answer the question using the source text. Return JSON {answer,sourceSnippets:[{quote,reason}]}. Clearly distinguish source facts from general knowledge.",

  gamification:
    "Return JSON {pointsEarned,streakMessage,achievements,nextGoal}. Points should reward learning actions, not answer-spam.",
};

function jsonPrompt(
  feature: UsageFeature,
  input: string
) {
  return `You are ScholarAI, a learning platform designed to help students understand and practice material.

TASK: ${featureInstructions[feature]}

RULES:
- Do not invent facts.
- Prefer clear student-friendly language.
- Use the same language as the input when no target language is specified.
- Do not claim you accessed information that is not in the provided input.
- When asked for JSON, output only valid JSON with no markdown fences.

INPUT:
${input.slice(0, MAX_BODY)}`;
}

async function readInput(
  request: Request
): Promise<FeatureRequestBody> {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    const body =
      (await request.json()) as unknown;

    if (
      body &&
      typeof body === "object"
    ) {
      return body as FeatureRequestBody;
    }

    return {};
  }

  return {
    input: await request.text(),
  };
}

function toFeature(
  value: unknown
): UsageFeature {
  const allowed: UsageFeature[] = [
    "study",
    "smartDocument",
    "exam",
    "flashcards",
    "quiz",
    "knowledgeMap",
    "source",
    "math",
    "voice",
    "camera",
    "chat",
    "analyze",
    "translate",
    "progress",
    "gamification",
  ];

  if (
    typeof value === "string" &&
    allowed.includes(
      value as UsageFeature
    )
  ) {
    return value as UsageFeature;
  }

  throw new Error(
    "Unsupported feature."
  );
}

function getUsageErrorCode(
  error: unknown
): string | undefined {
  if (
    !(error instanceof Error)
  ) {
    return undefined;
  }

  return (
    error as UsageError
  ).code;
}

export async function POST(
  request: Request
) {
  const deadline =
    Date.now() +
    REQUEST_DEADLINE_MS;

  try {
    const body =
      await readInput(request);

    const feature =
      toFeature(body.feature);

    const user =
      await requireUserForApi();

    await consumeUsage(
      user.id,
      feature,
      UNIT_COSTS[feature]
    );

    if (
      feature === "progress"
    ) {
      return NextResponse.json({
        ok: true,
      });
    }

    const input =
      typeof body.input === "string"
        ? body.input
        : JSON.stringify(
            body.input ?? ""
          );

    const output =
      await generateText({
        prompt:
          jsonPrompt(
            feature,
            input
          ),

        task:
          feature === "exam" ||
          feature ===
            "knowledgeMap" ||
          feature === "math"
            ? "reasoning"
            : "light",

        maxOutputTokens:
          feature === "exam"
            ? 4096
            : 3072,

        responseMimeType:
          feature === "math" ||
          feature ===
            "flashcards" ||
          feature === "quiz" ||
          feature ===
            "knowledgeMap"
            ? "application/json"
            : undefined,

        deadline,
      });

    let data: unknown =
      output;

    if (
      [
        "math",
        "flashcards",
        "quiz",
        "knowledgeMap",
      ].includes(feature)
    ) {
      try {
        data =
          jsonFromText(
            output
          );
      } catch {
        return NextResponse.json(
          {
            error:
              "The AI returned an invalid structured response.",
          },
          {
            status: 502,
          }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      feature,
      data,
      text: output,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Please sign in to use ScholarAI tools.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      getUsageErrorCode(error) ===
      "USAGE_LIMIT_REACHED"
    ) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Usage limit reached.",
          code:
            "USAGE_LIMIT_REACHED",
        },
        {
          status: 429,
        }
      );
    }

    if (
      error instanceof Error &&
      (error as { code?: string })
        .code ===
        "GEMINI_QUOTA_EXHAUSTED"
    ) {
      return NextResponse.json(
        {
          error: error.message,
          code:
            "GEMINI_QUOTA_EXHAUSTED",
        },
        {
          status: 429,
        }
      );
    }

    // Google's raw API errors are long multi-line JSON blobs meant for
    // developers, not something to dump in the UI. Log the real error
    // server-side and show the user one clean sentence instead.
    console.error(
      "ScholarAI feature error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "ScholarAI couldn't complete this right now. Please try again in a moment.",
      },
      {
        status: 500,
      }
    );
  }
}