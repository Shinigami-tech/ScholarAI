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
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "#0a0a0b",
        color:
          "#f4f4f5",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth:
            1180,
          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            gap: 16,
            alignItems:
              "center",
            marginBottom:
              24,
          }}
        >
          <div>
            <div
              style={{
                opacity:
                  0.55,
              }}
            >
              ScholarAI
            </div>

            <h1
              style={{
                margin:
                  "4px 0",
                fontSize:
                  36,
              }}
            >
              Learning Lab
            </h1>

            <p
              style={{
                opacity:
                  0.65,
              }}
            >
              Understand →
              Practice → Test
              → Improve.
            </p>
          </div>

          <div
            style={{
              textAlign:
                "right",
            }}
          >
            {usage && (
              <div
                style={
                  usageBadge
                }
              >
                <strong>
                  {usage.remaining ??
                    0}
                </strong>{" "}
                units left
                today ·{" "}
                {usage.plan ??
                  "Free"}
              </div>
            )}

            <Link
              href="/"
              style={{
                color:
                  "#fff",
              }}
            >
              Back to
              ScholarAI
            </Link>
          </div>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
            marginBottom:
              24,
          }}
        >
          {tools.map(
            ([
              id,
              title,
              description,
            ]) => {
              const ToolIcon =
                iconMap[id];

              return (
                <button
                  key={id}
                  onClick={() => {
                    setActive(
                      id
                    );

                    setInput(
                      defaultPrompt[
                        id
                      ]
                    );

                    setResult(
                      null
                    );

                    setError(
                      ""
                    );
                  }}
                  style={{
                    ...card,
                    textAlign:
                      "left",
                    cursor:
                      "pointer",
                    borderColor:
                      active ===
                      id
                        ? "#71717a"
                        : "#27272a",
                  }}
                >
                  <ToolIcon
                    size={
                      20
                    }
                  />

                  <h3
                    style={{
                      margin:
                        "10px 0 6px",
                    }}
                  >
                    {title}
                  </h3>

                  <p
                    style={{
                      margin:
                        0,
                      opacity:
                        0.65,
                      lineHeight:
                        1.45,
                    }}
                  >
                    {
                      description
                    }
                  </p>
                </button>
              );
            }
          )}
        </div>

        <section
          style={{
            ...panel,
            minHeight:
              420,
          }}
        >
          <div
            style={{
              display:
                "flex",
              gap: 14,
              alignItems:
                "center",
              marginBottom:
                18,
            }}
          >
            <Icon
              size={24}
            />

            <div>
              <h2
                style={{
                  margin:
                    0,
                }}
              >
                {
                  current[
                    1
                  ]
                }
              </h2>

              <p
                style={{
                  margin:
                    "4px 0 0",
                  opacity:
                    0.6,
                }}
              >
                {
                  current[
                    2
                  ]
                }
              </p>
            </div>
          </div>

          {active ===
          "camera" ? (
            <div
              style={{
                display:
                  "grid",
                gap: 12,
              }}
            >
              <video
                ref={
                  videoRef
                }
                muted
                playsInline
                style={{
                  width:
                    "100%",
                  maxHeight:
                    420,
                  objectFit:
                    "contain",
                  borderRadius:
                    16,
                  background:
                    "#09090b",
                }}
              />

              <canvas
                ref={
                  canvasRef
                }
                style={{
                  display:
                    "none",
                }}
              />

              <div
                style={{
                  display:
                    "flex",
                  gap: 10,
                }}
              >
                <button
                  onClick={() =>
                    void enableCamera()
                  }
                  style={
                    button
                  }
                >
                  Enable
                  camera
                </button>

                <button
                  onClick={() =>
                    void captureCamera()
                  }
                  disabled={
                    !cameraOn ||
                    loading
                  }
                  style={
                    buttonSecondary
                  }
                >
                  Capture &
                  solve
                </button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                value={
                  input
                }
                onChange={(
                  event
                ) =>
                  setInput(
                    event
                      .target
                      .value
                  )
                }
                rows={9}
                placeholder="Enter your topic, notes, question, or source text…"
                style={
                  textarea
                }
              />

              <div
                style={{
                  display:
                    "flex",
                  gap: 10,
                  marginTop:
                    12,
                  flexWrap:
                    "wrap",
                }}
              >
                <button
                  onClick={() =>
                    void runTool(
                      active
                    )
                  }
                  disabled={
                    loading ||
                    !input.trim()
                  }
                  style={
                    button
                  }
                >
                  {loading
                    ? "Working…"
                    : "Run ScholarAI"}
                </button>

                {active ===
                  "voice" && (
                  <button
                    onClick={() =>
                      void startVoice()
                    }
                    style={
                      buttonSecondary
                    }
                  >
                    🎙 Start
                    listening
                  </button>
                )}

{result !== null &&
  result !== undefined &&
  active === "voice" && (
    <button
      onClick={speakResult}
      style={buttonSecondary}
    >
      🔊 Read aloud
    </button>
  )}

                <button
                  onClick={() =>
                    void loadUsage()
                  }
                  style={
                    buttonSecondary
                  }
                >
                  Refresh
                  usage
                </button>
              </div>
            </>
          )}

          {error && (
            <div
              style={
                errorBox
              }
            >
              {error}
            </div>
          )}

          {result !==
            null && (
            <div
              style={{
                marginTop:
                  20,
              }}
            >
              <h3
                style={{
                  marginBottom:
                    10,
                }}
              >
                Result
              </h3>

              <pre
                style={
                  resultBox
                }
              >
                {typeof result ===
                "string"
                  ? result
                  : JSON.stringify(
                      result,
                      null,
                      2
                    )}
              </pre>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const panel:
  React.CSSProperties = {
  background:
    "#111113",
  border:
    "1px solid #27272a",
  borderRadius: 20,
  padding: 20,
};

const card:
  React.CSSProperties = {
  background:
    "#111113",
  color:
    "#f4f4f5",
  border:
    "1px solid #27272a",
  borderRadius: 16,
  padding: 16,
};

const textarea:
  React.CSSProperties = {
  width: "100%",
  boxSizing:
    "border-box",
  borderRadius: 14,
  border:
    "1px solid #3f3f46",
  background:
    "#18181b",
  color: "#fff",
  padding: 14,
  resize:
    "vertical",
};

const button:
  React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  background: "#fff",
  color:
    "#09090b",
  fontWeight: 700,
  padding:
    "12px 16px",
  cursor:
    "pointer",
};

const buttonSecondary:
  React.CSSProperties = {
  border:
    "1px solid #3f3f46",
  borderRadius: 12,
  background:
    "#18181b",
  color: "#fff",
  fontWeight: 600,
  padding:
    "12px 16px",
  cursor:
    "pointer",
};

const resultBox:
  React.CSSProperties = {
  whiteSpace:
    "pre-wrap",
  overflowX:
    "auto",
  background:
    "#0d0d0f",
  border:
    "1px solid #27272a",
  borderRadius: 14,
  padding: 16,
  lineHeight: 1.5,
};

const errorBox:
  React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 12,
  border:
    "1px solid #7f1d1d",
  background:
    "#2a1010",
  color:
    "#fecaca",
};

const usageBadge:
  React.CSSProperties = {
  display:
    "inline-block",
  padding:
    "8px 10px",
  borderRadius:
    999,
  background:
    "#18181b",
  border:
    "1px solid #27272a",
  marginBottom:
    10,
};