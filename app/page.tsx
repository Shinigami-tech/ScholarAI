"use client";

import { ChangeEvent, FormEvent, useState } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    setSummary("");
    setError("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const isPdf =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFile(null);
      setError("Only PDF files are supported.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size === 0) {
      setFile(null);
      setError("This PDF file is empty.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("The PDF must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSummary("");

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: "application/pdf",
          base64,
        }),
      });

      const rawResponse = await response.text();

      let data: {
        summary?: string;
        error?: string;
        details?: string;
      };

      try {
        data = JSON.parse(rawResponse);
      } catch {
        throw new Error(
          rawResponse || "The server returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Document analysis failed."
        );
      }

      if (!data.summary) {
        throw new Error("Gemini returned an empty response.");
      }

      setSummary(data.summary);
    } catch (caughtError) {
      console.error("Client analysis error:", caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <section className="text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
            Powered by Gemini
          </p>

          <h1 className="text-5xl font-bold sm:text-7xl">ScholarAI</h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Upload a research paper or study document and turn it into a clear
            summary, key ideas, and a simple explanation.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-12 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        >
          <label
            htmlFor="pdf-upload"
            className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-slate-600 px-6 py-12 text-center transition hover:border-blue-500 hover:bg-slate-800"
          >
            <span className="max-w-full truncate text-lg font-semibold">
              {file ? file.name : "Choose a PDF document"}
            </span>

            <span className="mt-2 text-sm text-slate-400">
              Maximum file size: 10 MB
            </span>
          </label>

          <input
            id="pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="submit"
            disabled={!file || isLoading}
            className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isLoading ? "Analyzing document..." : "Analyze PDF"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-800 bg-red-950/50 p-5 text-red-200">
            {error}
          </div>
        )}

        {summary && (
          <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">
            <h2 className="mb-5 text-2xl font-bold">Document analysis</h2>

            <pre className="whitespace-pre-wrap font-sans leading-8 text-slate-200">
              {summary}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}