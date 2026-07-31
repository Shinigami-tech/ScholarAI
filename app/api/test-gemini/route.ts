import { GoogleGenAI } from "@google/genai";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is missing" },
      { status: 500 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
      contents: "Reply with exactly: ScholarAI is connected",
    });

    return Response.json({
      message: response.text,
    });
} catch (error) {
    console.error(error);
  
    return Response.json(
      {
        error: "Gemini request failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}