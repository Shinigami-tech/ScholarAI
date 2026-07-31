import { GoogleGenAI } from "@google/genai";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type AnalyzeRequest = {
  fileName?: string;
  mimeType?: string;
  base64?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is missing." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as AnalyzeRequest;

    const fileName = body.fileName?.trim();
    const mimeType = body.mimeType;
    const base64 = body.base64;

    if (!fileName || !mimeType || !base64) {
      return Response.json(
        { error: "The PDF data is incomplete." },
        { status: 400 }
      );
    }

    if (mimeType !== "application/pdf") {
      return Response.json(
        { error: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    const estimatedFileSize = Math.ceil((base64.length * 3) / 4);

    if (estimatedFileSize > MAX_FILE_SIZE) {
      return Response.json(
        { error: "The PDF must be smaller than 10 MB." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
            {
              text: `
Analyze the attached PDF document.

Return the result using exactly this structure:

TITLE:
Write the real document title. If it is unavailable, infer a suitable title.

SUMMARY:
Write a clear and accurate summary in 4–6 short paragraphs.

KEY IDEAS:
- List 5–8 of the most important ideas from the document.

SIMPLE EXPLANATION:
Explain the document in simple language suitable for a high-school student.

IMPORTANT:
- Base the response only on the document.
- Do not invent facts.
- Clearly mention if the document has too little readable information.
- Preserve important names, numbers, terminology, and conclusions.
              `.trim(),
            },
          ],
        },
      ],
    });

    const summary = response.text?.trim();

    if (!summary) {
      return Response.json(
        { error: "Gemini returned an empty response." },
        { status: 502 }
      );
    }

    return Response.json({
      fileName,
      summary,
    });
  } catch (error) {
    console.error("PDF analysis failed:", error);

    return Response.json(
      {
        error: "PDF analysis failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}