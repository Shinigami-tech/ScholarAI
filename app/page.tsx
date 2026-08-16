"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type Language = "en" | "ru" | "ko";
type Theme = "dark" | "light";

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

type DocumentResult = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;

  status:
    | "uploading"
    | "analyzing"
    | "completed"
    | "error";

  progress: number;

  analysis?: Analysis;
  originalAnalysis?: Analysis;

  translations?: Partial<
    Record<Language, Analysis>
  >;

  error?: string;
};

type TranslationResult = {
  id: string;
  analysis: Analysis;
};

const MAX_FILE_SIZE =
  1024 * 1024 * 1024;

const MAX_FILES = 5;

const ACCEPTED_TYPES = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".csv",
  ".html",
  ".xml",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];

const TRANSLATION_CACHE_KEY =
  "scholarai_translation_cache_v2";

const translations: Record<
  Language,
  {
    badge: string;
    title: string;
    subtitle: string;
    uploadTitle: string;
    uploadSubtitle: string;
    formats: string;
    max: string;
    selected: string;
    clear: string;
    analyzing: string;
    documents: string;
    completed: string;
    processing: string;
    errors: string;
    overview: string;
    ideas: string;
    explanation: string;
    flashcards: string;
    summary: string;
    simpleExplanation: string;
    askTitle: string;
    askSubtitle: string;
    askPlaceholder: string;
    send: string;
    thinking: string;
    noDocuments: string;
    remove: string;
    uploadError: string;
    tryAgain: string;
    theme: string;
    language: string;
    light: string;
    dark: string;
    question: string;
    answer: string;
    documentInsights: string;
    fileSize: string;
    cards: string;
    ideasCount: string;
    ready: string;
    completedStatus: string;
    uploading: string;
    error: string;
    document: string;
    analyzed: string;
    titleLabel: string;
    completedProgress: string;
    dropAnalyze: string;
    translating: string;
    translationError: string;
  }
> = {
  en: {
    badge:
      "AI-powered academic intelligence",
    title: "Scholar",
    subtitle:
      "Turn academic documents into clear insights, explanations and study materials.",
    uploadTitle:
      "Drop your documents here",
    uploadSubtitle:
      "or click to browse your files",
    formats:
      "PDF · DOCX · PPTX · XLSX · TXT · CSV · Images",
    max: "Up to 1 GB per file",
    selected:
      "Selected documents",
    clear: "Clear all",
    analyzing: "Analyzing",
    documents: "Documents",
    completed: "Completed",
    processing: "Processing",
    errors: "Errors",
    overview: "Overview",
    ideas: "Key Ideas",
    explanation: "Explanation",
    flashcards: "Flashcards",
    summary: "Summary",
    simpleExplanation:
      "Simple Explanation",
    askTitle: "Drake",
    askSubtitle:
      "Your intelligent AI assistant",
    askPlaceholder:
      "Ask Drake anything...",
    send: "Send",
    thinking: "Thinking...",
    noDocuments:
      "Upload documents or ask me anything.",
    remove: "Remove",
    uploadError: "Upload failed",
    tryAgain: "Try again",
    theme: "Theme",
    language: "Language",
    light: "Light",
    dark: "Dark",
    question: "Question",
    answer: "Answer",
    documentInsights:
      "Document Insights",
    fileSize: "File size",
    cards: "Flashcards",
    ideasCount: "Key ideas",
    ready: "Ready",
    completedStatus: "Completed",
    uploading: "Uploading",
    error: "Error",
    document: "DOCUMENT",
    analyzed: "Analyzed",
    titleLabel: "Title",
    completedProgress:
      "completed",
    dropAnalyze:
      "Drop to analyze",
    translating:
      "Translating...",
    translationError:
      "Translation could not be completed. Please try again later.",
  },

  ru: {
    badge:
      "Академический интеллект на базе ИИ",
    title: "Scholar",
    subtitle:
      "Превращайте академические документы в понятные выводы, объяснения и учебные материалы.",
    uploadTitle:
      "Перетащите документы сюда",
    uploadSubtitle:
      "или нажмите, чтобы выбрать файлы",
    formats:
      "PDF · DOCX · PPTX · XLSX · TXT · CSV · Изображения",
    max: "До 1 ГБ на файл",
    selected:
      "Выбранные документы",
    clear: "Очистить всё",
    analyzing: "Анализ",
    documents: "Документы",
    completed: "Готово",
    processing: "Обработка",
    errors: "Ошибки",
    overview: "Обзор",
    ideas: "Ключевые идеи",
    explanation: "Объяснение",
    flashcards:
      "Флеш-карточки",
    summary:
      "Краткое содержание",
    simpleExplanation:
      "Простое объяснение",
    askTitle: "Drake",
    askSubtitle:
      "Ваш интеллектуальный ИИ-ассистент",
    askPlaceholder:
      "Спросите Drake о чём угодно...",
    send: "Отправить",
    thinking: "Думаю...",
    noDocuments:
      "Загрузите документы или задайте мне любой вопрос.",
    remove: "Удалить",
    uploadError:
      "Ошибка загрузки",
    tryAgain:
      "Попробовать снова",
    theme: "Тема",
    language: "Язык",
    light: "Светлая",
    dark: "Тёмная",
    question: "Вопрос",
    answer: "Ответ",
    documentInsights:
      "Информация о документе",
    fileSize:
      "Размер файла",
    cards: "Карточки",
    ideasCount:
      "Ключевые идеи",
    ready: "Готово",
    completedStatus:
      "Готово",
    uploading: "Загрузка",
    error: "Ошибка",
    document: "ДОКУМЕНТ",
    analyzed:
      "Проанализирован",
    titleLabel: "Название",
    completedProgress:
      "готово",
    dropAnalyze:
      "Отпустите для анализа",
    translating: "Перевод...",
    translationError:
      "Не удалось выполнить перевод. Попробуйте ещё раз позже.",
  },

  ko: {
    badge:
      "AI 기반 학술 지능",
    title: "Scholar",
    subtitle:
      "학술 문서를 명확한 인사이트, 설명 및 학습 자료로 변환하세요.",
    uploadTitle:
      "문서를 여기에 놓으세요",
    uploadSubtitle:
      "또는 클릭하여 파일을 선택하세요",
    formats:
      "PDF · DOCX · PPTX · XLSX · TXT · CSV · 이미지",
    max:
      "파일당 최대 1GB",
    selected:
      "선택한 문서",
    clear:
      "모두 지우기",
    analyzing:
      "분석 중",
    documents: "문서",
    completed: "완료",
    processing:
      "처리 중",
    errors: "오류",
    overview: "개요",
    ideas:
      "핵심 아이디어",
    explanation: "설명",
    flashcards:
      "플래시카드",
    summary: "요약",
    simpleExplanation:
      "쉬운 설명",
    askTitle: "Drake",
    askSubtitle:
      "당신의 지능형 AI 어시스턴트",
    askPlaceholder:
      "Drake에게 무엇이든 물어보세요...",
    send: "보내기",
    thinking:
      "생각 중...",
    noDocuments:
      "문서를 업로드하거나 무엇이든 질문하세요.",
    remove: "삭제",
    uploadError:
      "업로드 오류",
    tryAgain:
      "다시 시도",
    theme: "테마",
    language: "언어",
    light: "라이트",
    dark: "다크",
    question: "질문",
    answer: "답변",
    documentInsights:
      "문서 정보",
    fileSize:
      "파일 크기",
    cards: "카드",
    ideasCount:
      "핵심 아이디어",
    ready: "완료",
    completedStatus:
      "완료",
    uploading:
      "업로드 중",
    error: "오류",
    document: "문서",
    analyzed:
      "분석 완료",
    titleLabel: "제목",
    completedProgress:
      "완료",
    dropAnalyze:
      "놓으면 분석합니다",
    translating:
      "번역 중...",
    translationError:
      "번역을 완료할 수 없습니다. 잠시 후 다시 시도해주세요.",
  },
};

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
    (1024 *
      1024 *
      1024)
  ).toFixed(2)} GB`;
}

function getFileExtension(
  name: string
) {
  return (
    name
      .split(".")
      .pop()
      ?.toUpperCase() ||
    "FILE"
  );
}

function isAcceptedFile(
  file: File
) {
  const extension =
    `.${file.name
      .split(".")
      .pop()
      ?.toLowerCase()}`;

  return ACCEPTED_TYPES.includes(
    extension
  );
}

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getLanguageName(
  language: Language
) {
  if (
    language === "ru"
  ) {
    return "Russian";
  }

  if (
    language === "ko"
  ) {
    return "Korean";
  }

  return "English";
}

function GlobeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13.5 13.5 0 0 1 3.5 9 13.5 13.5 0 0 1-3.5 9 13.5 13.5 0 0 1-3.5-9A13.5 13.5 0 0 1 12 3z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 13.4A8.5 8.5 0 1 1 10.6 3.5a6.7 6.7 0 0 0 9.9 9.9z" />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2.5v6.4a2.4 2.4 0 0 1-.35 1.24L4.03 18.6a2.1 2.1 0 0 0 1.8 3.15h12.34a2.1 2.1 0 0 0 1.8-3.15l-5.12-8.46a2.4 2.4 0 0 1-.35-1.24V2.5" />
      <path d="M8 2.5h8" />
      <path d="M6.6 15.5h10.8" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.4 13.24 13.16 20.5a1.8 1.8 0 0 1-2.55 0L2.5 12.4V2.5h9.9l8.02 8.02a1.8 1.8 0 0 1-.02 2.72Z" />
      <circle cx="7.3" cy="7.3" r="1.15" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 3.5h4a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4" />
      <path d="M9.5 7 14.5 12 9.5 17" />
      <path d="M14.5 12h-12" />
    </svg>
  );
}

const LANGUAGE_OPTIONS: {
  value: Language;
  label: string;
  code: string;
}[] = [
  { value: "en", label: "English", code: "EN" },
  { value: "ru", label: "Русский", code: "RU" },
  { value: "ko", label: "한국어", code: "KO" },
];

export default function Home() {
  const [
    language,
    setLanguage,
  ] =
    useState<Language>(
      "en"
    );

  const [
    theme,
    setTheme,
  ] =
    useState<Theme>(
      "dark"
    );

  const [
    documents,
    setDocuments,
  ] =
    useState<
      DocumentResult[]
    >([]);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<
      | "overview"
      | "ideas"
      | "explanation"
      | "flashcards"
    >("overview");

  const [
    dragging,
    setDragging,
  ] =
    useState(false);

  const [
    chatOpen,
    setChatOpen,
  ] =
    useState(false);

  const [
    question,
    setQuestion,
  ] =
    useState("");

  const [
    chatLoading,
    setChatLoading,
  ] =
    useState(false);

  const [
    messages,
    setMessages,
  ] =
    useState<
      {
        role:
          | "user"
          | "assistant";
        content: string;
      }[]
    >([]);

  const [
    translationLoading,
    setTranslationLoading,
  ] =
    useState(false);

  const [
    translationError,
    setTranslationError,
  ] =
    useState(false);

  const [
    me,
    setMe,
  ] =
    useState<{
      authenticated: boolean;
      user?: {
        id: string;
        email: string;
      };
      usage?: {
        plan: "FREE" | "PRO" | "PREMIUM";
      };
    } | null>(null);

  const [
    profileOpen,
    setProfileOpen,
  ] =
    useState(false);

  const profileMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    languageOpen,
    setLanguageOpen,
  ] =
    useState(false);

  const languageMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const translationRequestId =
    useRef(0);

  const translationAbortController =
    useRef<AbortController | null>(
      null
    );

  const t =
    translations[language];

  const completed =
    documents.filter(
      (doc) =>
        doc.status ===
        "completed"
    ).length;

  const processing =
    documents.filter(
      (doc) =>
        doc.status ===
          "uploading" ||
        doc.status ===
          "analyzing"
    ).length;

  const errors =
    documents.filter(
      (doc) =>
        doc.status ===
        "error"
    ).length;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) =>
        response.json()
      )
      .then((data) =>
        setMe(data)
      )
      .catch(() =>
        setMe({
          authenticated: false,
        })
      );
  }, []);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent
    ) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setProfileOpen(false);
      }

      if (
        languageMenuRef.current &&
        !languageMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setLanguageOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // ignore network errors on sign out
    }

    window.location.href = "/";
  }

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          TRANSLATION_CACHE_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(
          saved
        ) as Record<
          string,
          Partial<
            Record<
              Language,
              Analysis
            >
          >
        >;

      if (
        !parsed ||
        typeof parsed !==
          "object"
      ) {
        return;
      }

      setDocuments(
        (previous) =>
          previous.map(
            (doc) => {
              const cached =
                parsed[
                  doc.id
                ];

              if (
                !cached
              ) {
                return doc;
              }

              return {
                ...doc,

                translations: {
                  ...(doc.translations ||
                    {}),

                  ...cached,
                },
              };
            }
          )
      );
    } catch {
      // Ignore broken local cache.
    }
  }, []);

  function saveTranslationCache(
    documentsToCache:
      DocumentResult[]
  ) {
    try {
      const cache: Record<
        string,
        Partial<
          Record<
            Language,
            Analysis
          >
        >
      > = {};

      for (
        const doc of
        documentsToCache
      ) {
        if (
          doc.translations &&
          Object.keys(
            doc.translations
          ).length > 0
        ) {
          cache[doc.id] =
            doc.translations;
        }
      }

      localStorage.setItem(
        TRANSLATION_CACHE_KEY,
        JSON.stringify(
          cache
        )
      );
    } catch {
      // Local storage may be unavailable.
    }
  }

  function getDisplayedAnalysis(
    doc: DocumentResult
  ): Analysis | undefined {
    if (
      !doc.originalAnalysis
    ) {
      return doc.analysis;
    }

    if (
      language === "en"
    ) {
      return (
        doc.translations
          ?.en ||
        doc.originalAnalysis
      );
    }

    return (
      doc.translations?.[
        language
      ] || undefined
    );
  }

  async function translateDocuments(
    targetLanguage: Language
  ) {
    const documentsToTranslate =
      documents.filter(
        (doc) =>
          doc.status ===
            "completed" &&
          doc.originalAnalysis &&
          !doc.translations?.[
            targetLanguage
          ]
      );

    if (
      targetLanguage ===
        "en" ||
      !documentsToTranslate.length
    ) {
      return;
    }

    translationAbortController.current?.abort();

    const controller =
      new AbortController();

    translationAbortController.current =
      controller;

    const requestId =
      ++translationRequestId.current;

    setTranslationLoading(
      true
    );

    setTranslationError(
      false
    );

    try {
      const response =
        await fetch(
          "/api/translate",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body:
              JSON.stringify(
                {
                  language:
                    targetLanguage,

                  languageName:
                    getLanguageName(
                      targetLanguage
                    ),

                  documents:
                    documentsToTranslate.map(
                      (
                        doc
                      ) => ({
                        id: doc.id,

                        fileName:
                          doc.fileName,

                        analysis:
                          doc.originalAnalysis,
                      })
                    ),
                }
              ),
          }
        );

      const data =
        (await response.json()) as {
          error?: string;
          translations?: TranslationResult[];
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Translation failed."
        );
      }

      if (
        requestId !==
        translationRequestId.current
      ) {
        return;
      }

      const translatedDocuments =
        data.translations;

      if (
        !Array.isArray(
          translatedDocuments
        )
      ) {
        throw new Error(
          "Invalid translation response."
        );
      }

      setDocuments(
        (previous) => {
          const updated =
            previous.map(
              (doc) => {
                const result =
                  translatedDocuments.find(
                    (
                      item
                    ) =>
                      item.id ===
                      doc.id
                  );

                if (
                  !result ||
                  !result.analysis
                ) {
                  return doc;
                }

                return {
                  ...doc,

                  translations: {
                    ...(doc.translations ||
                      {}),

                    [targetLanguage]:
                      result.analysis,
                  },
                };
              }
            );

          saveTranslationCache(
            updated
          );

          return updated;
        }
      );
    } catch (error) {
      if (
        error instanceof
          DOMException &&
        error.name ===
          "AbortError"
      ) {
        return;
      }

      console.error(
        "Translation failed:",
        error
      );

      if (
        requestId ===
        translationRequestId.current
      ) {
        setTranslationError(
          true
        );
      }
    } finally {
      if (
        requestId ===
        translationRequestId.current
      ) {
        setTranslationLoading(
          false
        );
      }
    }
  }

  async function handleLanguageChange(
    nextLanguage: Language
  ) {
    if (
      nextLanguage ===
      language
    ) {
      return;
    }

    setTranslationError(
      false
    );

    if (
      nextLanguage ===
      "en"
    ) {
      translationAbortController.current?.abort();

      setLanguage("en");

      setTranslationLoading(
        false
      );

      return;
    }

    const completedDocuments =
      documents.filter(
        (doc) =>
          doc.status ===
            "completed" &&
          doc.originalAnalysis
      );

    const missingTranslation =
      completedDocuments.some(
        (doc) =>
          !doc.translations?.[
            nextLanguage
          ]
      );

    setLanguage(
      nextLanguage
    );

    if (
      !completedDocuments.length ||
      !missingTranslation
    ) {
      setTranslationLoading(
        false
      );

      return;
    }

    await translateDocuments(
      nextLanguage
    );
  }

  function addFiles(
    fileList:
      | FileList
      | File[]
  ) {
    const incoming =
      Array.from(
        fileList
      );

    if (
      !incoming.length
    ) {
      return;
    }

    const availableSlots =
      MAX_FILES -
      documents.length;

    if (
      availableSlots <= 0
    ) {
      alert(
        `Maximum ${MAX_FILES} documents.`
      );

      return;
    }

    const accepted =
      incoming
        .filter(
          (file) => {
            if (
              !isAcceptedFile(
                file
              )
            ) {
              alert(
                `${file.name}: unsupported file type.`
              );

              return false;
            }

            if (
              file.size >
              MAX_FILE_SIZE
            ) {
              alert(
                `${file.name}: file is larger than the 1 GB limit.`
              );

              return false;
            }

            return true;
          }
        )
        .slice(
          0,
          availableSlots
        );

    const newDocuments:
      DocumentResult[] =
      accepted.map(
        (file) => ({
          id: createId(),

          fileName:
            file.name,

          fileSize:
            file.size,

          mimeType:
            file.type ||
            "application/octet-stream",

          status:
            "uploading",

          progress: 0,
        })
      );

    setDocuments(
      (previous) => [
        ...previous,
        ...newDocuments,
      ]
    );

    newDocuments.forEach(
      (
        doc,
        index
      ) => {
        const file =
          accepted[index];

        uploadAndAnalyze(
          doc.id,
          file
        );
      }
    );
  }

  async function uploadAndAnalyze(
    id: string,
    file: File
  ) {
    setDocuments(
      (previous) =>
        previous.map(
          (doc) =>
            doc.id === id
              ? {
                  ...doc,

                  status:
                    "analyzing",

                  progress: 8,
                }
              : doc
        )
    );

    try {
      const response =
        await fetch(
          "/api/analyze",
          {
            method: "POST",

            headers: {
              "x-file-name":
                encodeURIComponent(
                  file.name
                ),

              "x-file-type":
                file.type ||
                "application/octet-stream",

              "x-language":
                "en",
            },

            body: file,
          }
        );

      const data =
        (await response.json()) as {
          error?: string;
          analysis?: Analysis;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Analysis failed."
        );
      }

      if (
        !data.analysis
      ) {
        throw new Error(
          "Analysis response is missing."
        );
      }

      const analysis =
        data.analysis;

      setDocuments(
        (previous) =>
          previous.map(
            (doc) =>
              doc.id === id
                ? {
                    ...doc,

                    status:
                      "completed",

                    progress:
                      100,

                    analysis,

                    originalAnalysis:
                      analysis,

                    translations:
                      {
                        en: analysis,
                      },
                  }
                : doc
          )
      );
    } catch (error) {
      setDocuments(
        (previous) =>
          previous.map(
            (doc) =>
              doc.id === id
                ? {
                    ...doc,

                    status:
                      "error",

                    progress:
                      0,

                    error:
                      error instanceof
                      Error
                        ? error.message
                        : "Unknown error",
                  }
                : doc
          )
      );
    }
  }

  function handleFileInput(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    if (
      event.target.files
    ) {
      addFiles(
        event.target.files
      );
    }

    event.target.value =
      "";
  }

  function removeDocument(
    id: string
  ) {
    setDocuments(
      (previous) =>
        previous.filter(
          (doc) =>
            doc.id !== id
        )
    );
  }

  function clearDocuments() {
    translationAbortController.current?.abort();

    setDocuments([]);

    setMessages([]);

    try {
      localStorage.removeItem(
        TRANSLATION_CACHE_KEY
      );
    } catch {
      // Ignore.
    }
  }

  async function askAssistant() {
    const trimmed =
      question.trim();

    if (
      !trimmed ||
      chatLoading
    ) {
      return;
    }

    const currentHistory =
      messages.slice(
        -20
      );

    setMessages(
      (previous) => [
        ...previous,

        {
          role: "user",
          content:
            trimmed,
        },
      ]
    );

    setQuestion("");

    setChatLoading(
      true
    );

    try {
      const analyzedDocuments =
        documents
          .filter(
            (doc) =>
              doc.originalAnalysis
          )
          .map(
            (doc) => {
              const analysis =
                getDisplayedAnalysis(
                  doc
                );

              return {
                fileName:
                  doc.fileName,

                title:
                  analysis?.title,

                summary:
                  analysis?.summary,

                keyIdeas:
                  analysis?.keyIdeas,

                simpleExplanation:
                  analysis?.simpleExplanation,
              };
            }
          );

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  question:
                    trimmed,

                  language,

                  documents:
                    analyzedDocuments,

                  history:
                    currentHistory,
                }
              ),
          }
        );

      const data =
        (await response.json()) as {
          error?: string;
          answer?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Assistant failed."
        );
      }

      if (!data.answer) {
        throw new Error(
          "Assistant returned an empty response."
        );
      }
      
      const answer = data.answer;
      
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      setMessages(
        (previous) => [
          ...previous,

          {
            role:
              "assistant",

            content:
              error instanceof
              Error
                ? error.message
                : "Something went wrong.",
          },
        ]
      );
    } finally {
      setChatLoading(
        false
      );
    }
  }

  function handleDrop(
    event:
      React.DragEvent
  ) {
    event.preventDefault();

    setDragging(false);

    if (
      event.dataTransfer.files
    ) {
      addFiles(
        event.dataTransfer.files
      );
    }
  }

  return (
    <main
      className={`app-shell ${
        theme ===
        "light"
          ? "theme-light"
          : "theme-dark"
      }`}
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            ✦
          </div>

          <div>
            <div className="brand-name">
              Scholar
              <span>
                AI
              </span>
            </div>

            <div className="brand-caption">
              Academic Intelligence
            </div>
          </div>
        </div>

        <div
          style={{
            display:
              "flex",
            gap: 8,
            alignItems:
              "center",
            marginRight:
              "auto",
            marginLeft:
              24,
          }}
        >
          <a href="/tools" className="nav-link">
            <FlaskIcon />
            <span>Learning Lab</span>
          </a>

          <a href="/pricing" className="nav-link">
            <TagIcon />
            <span>Plans</span>
          </a>

          {me?.authenticated ? (
            <div
              ref={profileMenuRef}
              style={{
                position: "relative",
              }}
            >
              <button
                onClick={() =>
                  setProfileOpen(
                    (previous) => !previous
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 10,
                  border:
                    "1px solid currentColor",
                  opacity: 0.85,
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  font: "inherit",
                }}
                aria-label="Account menu"
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border:
                      "1px solid currentColor",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {(
                    me.user?.email?.[0] ||
                    "?"
                  ).toUpperCase()}
                </span>

                {me.usage?.plan ===
                  "PRO" ||
                me.usage?.plan ===
                  "PREMIUM"
                  ? me.usage.plan
                  : ""}
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    minWidth: 200,
                    padding: 10,
                    borderRadius: 12,
                    border:
                      "1px solid currentColor",
                    background:
                      "var(--panel, #111113)",
                    zIndex: 20,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 8px",
                      fontSize: 13,
                      opacity: 0.8,
                      wordBreak: "break-all",
                    }}
                  >
                    {me.user?.email}
                  </div>

                  <div
                    style={{
                      padding: "2px 8px 8px",
                      fontSize: 12,
                      opacity: 0.6,
                    }}
                  >
                    Plan:{" "}
                    {me.usage?.plan || "FREE"}
                  </div>

                  <a
                    href="/account"
                    style={{
                      display: "block",
                      textDecoration: "none",
                      padding: "8px",
                      borderRadius: 8,
                      color: "inherit",
                    }}
                  >
                    Account
                  </a>

                  <button
                    onClick={signOut}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px",
                      borderRadius: 8,
                      border: 0,
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/login" className="nav-link">
              <LoginIcon />
              <span>Sign in</span>
            </a>
          )}
        </div>

        <div className="topbar-actions">
          <div
            ref={languageMenuRef}
            className="icon-control"
            style={{ position: "relative" }}
          >
            <button
              type="button"
              className="icon-control-trigger"
              onClick={() =>
                setLanguageOpen(
                  (previous) => !previous
                )
              }
              aria-label={t.language}
              aria-expanded={languageOpen}
            >
              <GlobeIcon />
              <span className="icon-control-label">
                {
                  LANGUAGE_OPTIONS.find(
                    (option) =>
                      option.value === language
                  )?.code
                }
              </span>
              <span className="icon-control-chevron">
                <ChevronIcon />
              </span>
            </button>

            {translationLoading && (
              <span
                className="icon-control-loading"
                aria-label={t.translating}
              >
                •••
              </span>
            )}

            {languageOpen && (
              <div className="icon-control-menu">
                {LANGUAGE_OPTIONS.map(
                  (option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`icon-control-item ${
                        option.value === language
                          ? "icon-control-item-active"
                          : ""
                      }`}
                      onClick={() => {
                        handleLanguageChange(
                          option.value
                        );
                        setLanguageOpen(false);
                      }}
                    >
                      <span>{option.label}</span>
                      {option.value ===
                        language && <CheckIcon />}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <button
            className="theme-button"
            onClick={() =>
              setTheme(
                theme ===
                  "dark"
                  ? "light"
                  : "dark"
              )
            }
            aria-label={
              t.theme
            }
          >
            {theme === "dark" ? (
              <SunIcon />
            ) : (
              <MoonIcon />
            )}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-badge">
          <span className="pulse-dot" />

          {t.badge}
        </div>

        <h1>
          {t.title}

          <span>
            AI
          </span>
        </h1>

        <p>
          {t.subtitle}
        </p>
      </section>

      <section className="workspace">
        {translationError && (
          <div
            role="alert"
            style={{
              marginBottom:
                18,
              padding:
                "14px 16px",
              borderRadius:
                14,
              border:
                "1px solid rgba(255, 114, 133, 0.35)",
              background:
                "rgba(255, 114, 133, 0.08)",
              color:
                "var(--red)",
              fontSize:
                13,
            }}
          >
            {
              t.translationError
            }
          </div>
        )}

        <div
          className={`dropzone ${
            dragging
              ? "dropzone-active"
              : ""
          }`}
          onClick={() =>
            inputRef.current?.click()
          }
          onDragOver={(
            event
          ) => {
            event.preventDefault();

            setDragging(
              true
            );
          }}
          onDragLeave={() =>
            setDragging(
              false
            )
          }
          onDrop={
            handleDrop
          }
        >
          <input
            ref={
              inputRef
            }
            type="file"
            multiple
            hidden
            accept={ACCEPTED_TYPES.join(
              ","
            )}
            onChange={
              handleFileInput
            }
          />

          <div className="upload-orbit">
            <div className="upload-icon">
              ↑
            </div>
          </div>

          <h2>
            {dragging
              ? t.dropAnalyze
              : t.uploadTitle}
          </h2>

          <p>
            {
              t.uploadSubtitle
            }
          </p>

          <div className="format-row">
            <span>
              {
                t.formats
              }
            </span>
          </div>

          <div className="upload-limit">
            <span>
              ◎
            </span>

            {t.max}

            <span>
              •
            </span>

            {MAX_FILES} files
          </div>
        </div>

        {documents.length >
          0 && (
          <section className="selected-section">
            <div className="section-heading">
              <div>
                <h2>
                  {
                    t.selected
                  }
                </h2>

                <p>
                  {
                    documents.length
                  }{" "}
                  /{" "}
                  {
                    MAX_FILES
                  }
                </p>
              </div>

              <button
                className="text-button"
                onClick={
                  clearDocuments
                }
              >
                {
                  t.clear
                }
              </button>
            </div>

            <div className="document-list">
              {documents.map(
                (doc) => (
                  <div
                    key={
                      doc.id
                    }
                    className="document-row"
                  >
                    <div className="file-icon">
                      {getFileExtension(
                        doc.fileName
                      ).slice(
                        0,
                        4
                      )}
                    </div>

                    <div className="document-info">
                      <strong>
                        {
                          doc.fileName
                        }
                      </strong>

                      <span>
                        {formatBytes(
                          doc.fileSize
                        )}
                      </span>
                    </div>

                    <div className="document-progress">
                      <div className="mini-progress">
                        <div
                          style={{
                            width: `${doc.progress}%`,
                          }}
                        />
                      </div>

                      <span
                        className={`status status-${doc.status}`}
                      >
                        {doc.status ===
                        "completed"
                          ? `✓ ${t.completedStatus}`
                          : doc.status ===
                            "analyzing"
                          ? `${t.analyzing}...`
                          : doc.status ===
                            "uploading"
                          ? `${t.uploading}...`
                          : t.error}
                      </span>
                    </div>

                    <button
                      className="remove-button"
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        removeDocument(
                          doc.id
                        );
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {documents.length >
          0 && (
          <section className="stats-grid">
            <div className="stat-card">
              <span>
                {
                  t.documents
                }
              </span>

              <strong>
                {String(
                  documents.length
                ).padStart(
                  2,
                  "0"
                )}
              </strong>
            </div>

            <div className="stat-card stat-green">
              <span>
                {
                  t.completed
                }
              </span>

              <strong>
                {String(
                  completed
                ).padStart(
                  2,
                  "0"
                )}
              </strong>
            </div>

            <div className="stat-card stat-blue">
              <span>
                {
                  t.processing
                }
              </span>

              <strong>
                {String(
                  processing
                ).padStart(
                  2,
                  "0"
                )}
              </strong>
            </div>

            <div className="stat-card stat-red">
              <span>
                {
                  t.errors
                }
              </span>

              <strong>
                {String(
                  errors
                ).padStart(
                  2,
                  "0"
                )}
              </strong>
            </div>
          </section>
        )}

        {documents.length >
          0 && (
          <section className="progress-panel">
            <div>
              <strong>
                {
                  t.analyzing
                }
              </strong>

              <span>
                {
                  completed
                }{" "}
                /{" "}
                {
                  documents.length
                }{" "}
                {
                  t.completedProgress
                }
              </span>
            </div>

            <div className="big-progress">
              <div
                style={{
                  width: `${
                    documents.length
                      ? (completed /
                          documents.length) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </section>
        )}

        <section className="results">
          {documents
            .filter(
              (doc) =>
                doc.analysis
            )
            .map(
              (
                doc,
                documentIndex
              ) => {
                const analysis =
                  getDisplayedAnalysis(
                    doc
                  );

                const waitingForTranslation =
                  language !==
                    "en" &&
                  doc.originalAnalysis &&
                  !doc.translations?.[
                    language
                  ];

                return (
                  <article
                    className="result-document"
                    key={
                      doc.id
                    }
                  >
                    <div className="result-header">
                      <div className="result-number">
                        {String(
                          documentIndex +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div>
                        <span className="eyebrow">
                          {
                            t.document
                          }{" "}
                          {documentIndex +
                            1}
                        </span>

                        <h2>
                          {
                            doc.fileName
                          }
                        </h2>
                      </div>

                      <span className="analyzed-pill">
                        ✓{" "}
                        {
                          t.analyzed
                        }
                      </span>
                    </div>

                    {waitingForTranslation ? (
                      <div className="result-section">
                        <div className="explanation-card">
                          <p>
                            {
                              t.translating
                            }
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="title-card">
                          <span>
                            ▧{" "}
                            {
                              t.titleLabel
                            }
                          </span>

                          <h3>
                            {
                              analysis?.title
                            }
                          </h3>
                        </div>

                        <div className="tabs">
                          <button
                            className={
                              activeTab ===
                              "overview"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setActiveTab(
                                "overview"
                              )
                            }
                          >
                            {
                              t.overview
                            }
                          </button>

                          <button
                            className={
                              activeTab ===
                              "ideas"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setActiveTab(
                                "ideas"
                              )
                            }
                          >
                            {
                              t.ideas
                            }
                          </button>

                          <button
                            className={
                              activeTab ===
                              "explanation"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setActiveTab(
                                "explanation"
                              )
                            }
                          >
                            {
                              t.explanation
                            }
                          </button>

                          <button
                            className={
                              activeTab ===
                              "flashcards"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setActiveTab(
                                "flashcards"
                              )
                            }
                          >
                            {
                              t.flashcards
                            }
                          </button>
                        </div>

                        {activeTab ===
                          "overview" && (
                          <div className="result-section">
                            <div className="section-title">
                              <span>
                                📝
                              </span>

                              <h3>
                                {
                                  t.summary
                                }
                              </h3>
                            </div>

                            <div className="summary-list">
                              {analysis?.summary.map(
                                (
                                  paragraph,
                                  index
                                ) => (
                                  <p
                                    key={
                                      index
                                    }
                                  >
                                    {
                                      paragraph
                                    }
                                  </p>
                                )
                              )}
                            </div>

                            <div className="insights">
                              <div>
                                <span>
                                  {
                                    t.ideasCount
                                  }
                                </span>

                                <strong>
                                  {
                                    analysis
                                      ?.keyIdeas
                                      .length
                                  }
                                </strong>
                              </div>

                              <div>
                                <span>
                                  {
                                    t.cards
                                  }
                                </span>

                                <strong>
                                  {
                                    analysis
                                      ?.flashcards
                                      .length
                                  }
                                </strong>
                              </div>

                              <div>
                                <span>
                                  {
                                    t.fileSize
                                  }
                                </span>

                                <strong>
                                  {formatBytes(
                                    doc.fileSize
                                  )}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab ===
                          "ideas" && (
                          <div className="result-section">
                            <div className="section-title">
                              <span>
                                💡
                              </span>

                              <h3>
                                {
                                  t.ideas
                                }
                              </h3>
                            </div>

                            <div className="idea-list">
                              {analysis?.keyIdeas.map(
                                (
                                  idea,
                                  index
                                ) => (
                                  <div
                                    className="idea-card"
                                    key={
                                      index
                                    }
                                  >
                                    <span>
                                      {String(
                                        index +
                                          1
                                      ).padStart(
                                        2,
                                        "0"
                                      )}
                                    </span>

                                    <p>
                                      {
                                        idea
                                      }
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {activeTab ===
                          "explanation" && (
                          <div className="result-section">
                            <div className="section-title">
                              <span>
                                🎓
                              </span>

                              <h3>
                                {
                                  t.simpleExplanation
                                }
                              </h3>
                            </div>

                            <div className="explanation-card">
                              <p>
                                {
                                  analysis?.simpleExplanation
                                }
                              </p>
                            </div>
                          </div>
                        )}

                        {activeTab ===
                          "flashcards" && (
                          <div className="result-section">
                            <div className="section-title">
                              <span>
                                🧠
                              </span>

                              <h3>
                                {
                                  t.flashcards
                                }
                              </h3>
                            </div>

                            <div className="flashcards-grid">
                              {analysis?.flashcards.map(
                                (
                                  card,
                                  index
                                ) => (
                                  <div
                                    className="flashcard"
                                    key={
                                      index
                                    }
                                  >
                                    <div className="flashcard-number">
                                      {
                                        index +
                                        1
                                      }
                                    </div>

                                    <span>
                                      {
                                        t.question
                                      }
                                    </span>

                                    <h4>
                                      {
                                        card.question
                                      }
                                    </h4>

                                    <div className="flashcard-divider" />

                                    <span className="answer-label">
                                      {
                                        t.answer
                                      }
                                    </span>

                                    <p>
                                      {
                                        card.answer
                                      }
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              }
            )}
        </section>
      </section>

      <button
        className={`assistant-orb ${
          chatOpen
            ? "assistant-open"
            : ""
        }`}
        onClick={() =>
          setChatOpen(
            !chatOpen
          )
        }
        aria-label="Drake"
      >
        <span>
          ✦
        </span>
      </button>

      {chatOpen && (
        <aside className="assistant-panel">
          <div className="assistant-header">
            <div className="assistant-avatar">
              ✦
            </div>

            <div>
              <strong>
                {
                  t.askTitle
                }
              </strong>

              <span>
                {
                  t.askSubtitle
                }
              </span>
            </div>

            <button
              onClick={() =>
                setChatOpen(
                  false
                )
              }
            >
              ×
            </button>
          </div>

          <div className="assistant-messages">
            {!messages.length && (
              <div className="assistant-empty">
                <div>
                  ✦
                </div>

                <p>
                  {
                    t.noDocuments
                  }
                </p>
              </div>
            )}

            {messages.map(
              (
                message,
                index
              ) => (
                <div
                  key={
                    index
                  }
                  className={`message ${
                    message.role ===
                    "user"
                      ? "message-user"
                      : "message-ai"
                  }`}
                >
                  {
                    message.content
                  }
                </div>
              )
            )}

            {chatLoading && (
              <div className="message message-ai">
                {
                  t.thinking
                }
              </div>
            )}
          </div>

          <div className="assistant-input">
            <textarea
              value={
                question
              }
              onChange={(
                event
              ) =>
                setQuestion(
                  event
                    .target
                    .value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  askAssistant();
                }
              }}
              placeholder={
                t.askPlaceholder
              }
              rows={2}
            />

            <button
              onClick={
                askAssistant
              }
              disabled={
                chatLoading ||
                !question.trim()
              }
            >
              ↑
            </button>
          </div>
        </aside>
      )}

      <footer className="footer">
        <span>
          ScholarAI
        </span>

        <span>
          Academic Intelligence Platform
        </span>

        <span>
          AI-powered
        </span>
      </footer>
    </main>
  );
}