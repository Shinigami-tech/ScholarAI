export type Language = "en" | "ru" | "ko";

export type Theme = "dark" | "light";

export type Flashcard = {
  question: string;
  answer: string;
};

export type Analysis = {
  title: string;
  summary: string[];
  keyIdeas: string[];
  simpleExplanation: string;
  flashcards: Flashcard[];
};

export type DocumentStatus =
  | "uploading"
  | "analyzing"
  | "completed"
  | "error";

export type DocumentResult = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  progress: number;
  analysis?: Analysis;
  originalAnalysis?: Analysis;
  translations?: Partial<
    Record<Language, Analysis>
  >;
  error?: string;
};