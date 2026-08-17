"use client";

import Link from "next/link";
import {
  useRef,
  useState,
} from "react";

import {
  Camera,
  Brain,
  BookOpen,
  ClipboardCheck,
  Network,
  Sigma,
  Mic,
  Trophy,
  Map,
  Sparkles,
  FileText,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

const tools = [
  [
    "study",
    "AI Study Mode",
    "Turn a topic or notes into goals, practice, and a quick recap.",
    "study",
  ],
  [
    "smartDocument",
    "Smart Document",
    "Extract structure, key terms, formulas, and exam-relevant ideas.",
    "smartDocument",
  ],
  [
    "exam",
    "Exam Mode",
    "Build a day-by-day plan around a deadline and your weak topics.",
    "exam",
  ],
  [
    "flashcards",
    "AI Flashcards",
    "Generate high-quality active-recall cards from your material.",
    "flashcards",
  ],
  [
    "quiz",
    "Quiz Generator",
    "Create mixed quizzes with explanations and difficulty levels.",
    "quiz",
  ],
  [
    "knowledgeMap",
    "Knowledge Map",
    "See concepts, prerequisites, and confidence as a learning graph.",
    "knowledgeMap",
  ],
  [
    "source",
    "Source Mode",
    "Keep answers anchored to the uploaded material and source snippets.",
    "source",
  ],
  [
    "math",
    "Math Solver",
    "Get a step-by-step solution and a similar practice problem.",
    "math",
  ],
  [
    "voice",
    "Voice Tutor",
    "Talk to ScholarAI and receive a conversational tutor response.",
    "voice",
  ],
  [
    "camera",
    "Camera Homework",
    "Capture a problem with your camera and get guided help.",
    "camera",
  ],
  [
    "progress",
    "Personal Progress",
    "Track topics, usage, study actions, and learning streaks.",
    "progress",
  ],
  [
    "gamification",
    "Gamification",
    "Earn XP and maintain a study streak through meaningful activity.",
    "gamification",
  ],
] as const;

type ToolId =
  (typeof tools)[number][0];

type UsageInfo = {
  remaining?: number;
  plan?: string;
};

type ApiResponse = {
  data?: unknown;
  text?: string;
  error?: string;
};

type ProgressResponse = {
  points?: number;
  streakDays?: number;
  unitsToday?: number;
  topFeatures?: Array<{
    feature: string;
    units: number;
  }>;
  achievements?: string[];
  events?: number;
  error?: string;
};

type SpeechRecognitionResultLike = {
  transcript?: string;
};

type SpeechRecognitionEventLike = {
  results?: ArrayLike<
    ArrayLike<SpeechRecognitionResultLike>
  >;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;

  onresult:
    | ((
        event: SpeechRecognitionEventLike
      ) => void)
    | null;

  start: () => void;
};

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

type SpeechWindow =
  Window & {
    SpeechRecognition?:
      SpeechRecognitionConstructor;

    webkitSpeechRecognition?:
      SpeechRecognitionConstructor;
  };

const iconMap: Record<
  ToolId,
  LucideIcon
> = {
  study: BookOpen,
  smartDocument: FileText,
  exam: GraduationCap,
  flashcards: Brain,
  quiz: ClipboardCheck,
  knowledgeMap: Network,
  source: Map,
  math: Sigma,
  voice: Mic,
  camera: Camera,
  progress: Trophy,
  gamification: Sparkles,
};

const defaultPrompt: Record<
  ToolId,
  string
> = {
  study:
    "Topic: quadratic functions\nStudent level: high school\nTime available: 20 minutes",

  smartDocument:
    "Paste notes or document text here.",

  exam:
    "Exam subject: Physics\nDeadline: 14 days\nTopics: mechanics, electricity, waves\nWeak topic: electricity",

  flashcards:
    "Topic: cellular respiration\nSource facts: glycolysis occurs in the cytoplasm; Krebs cycle occurs in the mitochondrial matrix; electron transport occurs in the inner mitochondrial membrane.",

  quiz:
    "Topic: Newton's laws\nMake a 10-question mixed quiz for a high-school student.",

  knowledgeMap:
    "Topic: calculus\nConcepts: limits, derivatives, product rule, chain rule, integrals, applications",

  source:
    "Paste a document excerpt and ask a question. ScholarAI should distinguish source facts from general explanation.",

  math:
    "Solve: 2x^2 - 5x - 3 = 0",

  voice:
    "Explain the difference between speed and velocity.",

  camera:
    "Use the camera button to capture the homework problem.",

  progress:
    "My study today: 25 minutes math, 15 minutes physics. I solved 12 practice questions and missed 3.",

  gamification:
    "Activity today: 25 minutes study, 12 questions solved, 8 flashcards reviewed, 1 quiz completed.",
};

const toolCategories: Array<{
  label: string;
  hint: string;
  ids: ToolId[];
}> = [
  {
    label: "Study & Documents",
    hint: "Turn material into something you can actually learn from.",
    ids: [
      "study",
      "smartDocument",
      "source",
      "knowledgeMap",
    ],
  },
  {
    label: "Practice & Testing",
    hint: "Check what you know and get ready for the real thing.",
    ids: [
      "exam",
      "flashcards",
      "quiz",
      "math",
    ],
  },
  {
    label: "Talk & Capture",
    hint: "Ask out loud or point your camera at a problem.",
    ids: ["voice", "camera"],
  },
  {
    label: "Progress & Rewards",
    hint: "See how you're doing and stay motivated.",
    ids: ["progress", "gamification"],
  },
];

export default function ToolsPage() {
  const [
    active,
    setActive,
  ] =
    useState<ToolId>(
      "study"
    );

  const [
    input,
    setInput,
  ] =
    useState("");

  const [
    result,
    setResult,
  ] =
    useState<unknown>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    usage,
    setUsage,
  ] =
    useState<UsageInfo | null>(
      null
    );

  const [
    cameraOn,
    setCameraOn,
  ] =
    useState(false);

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  async function loadUsage() {
    try {
      const response =
        await fetch(
          "/api/usage"
        );

      if (!response.ok) {
        return;
      }

      const data =
        (await response.json()) as UsageInfo;

      setUsage(data);
    } catch {
      // Usage information is optional.
    }
  }

  async function runTool(
    feature: ToolId,
    customInput?: string
  ) {
    if (
      feature ===
        "progress" ||
      feature ===
        "gamification"
    ) {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/progress"
          );

        const data =
          (await response.json()) as ProgressResponse;

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Progress unavailable."
          );
        }

        if (
          feature ===
          "gamification"
        ) {
          setResult({
            pointsEarned: 20,
            ...data,
          });
        } else {
          setResult(data);
        }

        await loadUsage();
      } catch (caughtError) {
        setError(
          caughtError instanceof
          Error
            ? caughtError.message
            : "Progress unavailable."
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response =
        await fetch(
          "/api/feature",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                feature,
                input:
                  customInput ??
                  input,
              }),
          }
        );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Tool failed."
        );
      }

      setResult(
        data.data ??
          data.text ??
          null
      );

      await loadUsage();
    } catch (caughtError) {
      setError(
        caughtError instanceof
        Error
          ? caughtError.message
          : "Tool failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function enableCamera() {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode:
                "environment",
            },
          }
        );

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();

        setCameraOn(true);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof
        Error
          ? caughtError.message
          : "Could not access the camera."
      );
    }
  }

  async function captureCamera() {
    if (
      !videoRef.current ||
      !canvasRef.current
    ) {
      return;
    }

    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const context =
      canvas.getContext(
        "2d"
      );

    if (!context) {
      setError(
        "Could not access the camera canvas."
      );

      return;
    }

    context.drawImage(
      video,
      0,
      0
    );

    const dataUrl =
      canvas.toDataURL(
        "image/jpeg",
        0.85
      );

    await runTool(
      "camera",
      `Homework image data URL:
${dataUrl}

Please identify and solve the visible task.`
    );
  }

  async function startVoice() {
    const speechWindow =
      window as SpeechWindow;

    const Recognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setError(
        "Voice recognition is not supported by this browser. You can still use the text tutor."
      );

      return;
    }

    const recognition =
      new Recognition();

    recognition.lang =
      "en-US";

    recognition.interimResults =
      false;

    recognition.onresult =
      (event) => {
        const transcript =
          event.results?.[0]
            ?.[0]
            ?.transcript ||
          "";

        if (!transcript) {
          return;
        }

        setInput(
          transcript
        );

        void runTool(
          "voice",
          transcript
        );
      };

    recognition.start();
  }

  function speakResult() {
    if (
      result === null ||
      result === undefined
    ) {
      return;
    }

    const text =
      typeof result ===
      "string"
        ? result
        : JSON.stringify(
            result
          );

    if (
      "speechSynthesis" in
      window
    ) {
      window.speechSynthesis.speak(
        new SpeechSynthesisUtterance(
          text.slice(
            0,
            3000
          )
        )
      );
    }
  }

  const Icon =
    iconMap[active];

  const current =
    tools.find(
      ([id]) =>
        id === active
    );

  if (!current) {
    return null;
  }

  return (
    <main className="app-shell">
      <div className="grid-background" />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">
              Scholar<span>AI</span>
            </div>
            <div className="brand-caption">Learning Lab</div>
          </div>
        </div>

        <div className="topbar-actions">
          {usage && (
            <div className="tools-usage-badge">
              <span className="pulse-dot" />
              <strong>{usage.remaining ?? 0}</strong>&nbsp;units left today
              &nbsp;·&nbsp;{usage.plan ?? "Free"}
            </div>
          )}

          <a href="/" className="nav-link">
            ← Back to ScholarAI
          </a>
        </div>
      </header>

      <section className="tools-hero">
        <h1>Learning Lab</h1>
        <p>Understand → Practice → Test → Improve.</p>
      </section>

      <section className="workspace tools-workspace">
        {toolCategories.map((group) => (
          <div key={group.label} className="tools-category">
            <div className="tools-category-heading">
              <h2 className="tools-category-title">{group.label}</h2>
              <p className="tools-category-hint">{group.hint}</p>
            </div>

            <div className="tools-grid">
              {group.ids.map((id) => {
                const tool = tools.find(([toolId]) => toolId === id);

                if (!tool) {
                  return null;
                }

                const [toolId, title, description] = tool;
                const ToolIcon = iconMap[toolId];

                return (
                  <button
                    key={toolId}
                    type="button"
                    className={`tool-card${
                      active === toolId ? " tool-card-active" : ""
                    }`}
                    onClick={() => {
                      setActive(toolId);
                      setInput(defaultPrompt[toolId]);
                      setResult(null);
                      setError("");
                    }}
                  >
                    <div className="tool-card-icon">
                      <ToolIcon size={20} />
                    </div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <section className="tools-panel">
          <div className="tools-panel-header">
            <div className="tools-panel-icon">
              <Icon size={22} />
            </div>

            <div>
              <h2>{current[1]}</h2>
              <p>{current[2]}</p>
            </div>
          </div>

          {active === "camera" ? (
            <div className="tools-camera">
              <video
                ref={videoRef}
                muted
                playsInline
                className="tools-camera-video"
              />

              <canvas ref={canvasRef} style={{ display: "none" }} />

              <div className="tools-actions">
                <button
                  type="button"
                  onClick={() => void enableCamera()}
                  className="tools-btn-primary"
                >
                  Enable camera
                </button>

                <button
                  type="button"
                  onClick={() => void captureCamera()}
                  disabled={!cameraOn || loading}
                  className="tools-btn-secondary"
                >
                  Capture & solve
                </button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={9}
                placeholder="Enter your topic, notes, question, or source text…"
                className="tools-textarea"
              />

              <div className="tools-actions">
                <button
                  type="button"
                  onClick={() => void runTool(active)}
                  disabled={loading || !input.trim()}
                  className="tools-btn-primary"
                >
                  {loading ? "Working…" : "Run ScholarAI"}
                </button>

                {active === "voice" && (
                  <button
                    type="button"
                    onClick={() => void startVoice()}
                    className="tools-btn-secondary"
                  >
                    <Mic size={15} /> Start listening
                  </button>
                )}

                {result !== null &&
                  result !== undefined &&
                  active === "voice" && (
                    <button
                      type="button"
                      onClick={speakResult}
                      className="tools-btn-secondary"
                    >
                      Read aloud
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => void loadUsage()}
                  className="tools-btn-secondary"
                >
                  Refresh usage
                </button>
              </div>
            </>
          )}

          {error && <div className="tools-error">{error}</div>}

          {result !== null && (
            <div className="tools-result">
              <h3>Result</h3>
              <pre className="tools-result-box">
                {typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </section>
      </section>

      <footer className="footer">
        <span>ScholarAI</span>
        <span>Learning Lab · powered by Gemini</span>
      </footer>
    </main>
  );
}
