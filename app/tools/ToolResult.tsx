"use client";
type Flashcard = {
  question: string;
  answer: string;
  difficulty?: string;
};
type FlashcardsResult = {
  cards: Flashcard[];
};
type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  difficulty?: string;
};
type QuizResult = {
  questions: QuizQuestion[];
};
type KnowledgeMapNode = {
  id: string;
  label: string;
  parentId?: string | null;
  confidence?: number;
  reason?: string;
};
type KnowledgeMapResult = {
  root?: string;
  nodes: KnowledgeMapNode[];
};
type MathResult = {
  problem?: string;
  answer?: string;
  steps?: string[];
  commonMistake?: string;
  practice?: string;
};
type SourceSnippet = {
  quote: string;
  reason?: string;
};
type SourceResult = {
  answer?: string;
  sourceSnippets?: SourceSnippet[];
};
type ProgressLikeResult = {
  points?: number;
  pointsEarned?: number;
  streakDays?: number;
  streakMessage?: string;
  unitsToday?: number;
  topFeatures?: Array<{ feature: string; units: number }>;
  achievements?: string[];
  nextGoal?: string;
  events?: number;
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFlashcardsResult(value: unknown): value is FlashcardsResult {
  return isRecord(value) && Array.isArray(value.cards) && value.cards.every((card) => isRecord(card) && typeof card.question === "string" && typeof card.answer === "string");
}
function isQuizResult(value: unknown): value is QuizResult {
  return isRecord(value) && Array.isArray(value.questions) && value.questions.every((question) => isRecord(question) && typeof question.question === "string" && Array.isArray(question.options));
}
function isKnowledgeMapResult(value: unknown): value is KnowledgeMapResult {
  return isRecord(value) && Array.isArray(value.nodes) && value.nodes.every((node) => isRecord(node) && typeof node.id === "string" && typeof node.label === "string");
}
function isMathResult(value: unknown): value is MathResult {
  return isRecord(value) && ("problem" in value || "answer" in value || "steps" in value);
}
function isSourceResult(value: unknown): value is SourceResult {
  return isRecord(value) && (typeof value.answer === "string" || Array.isArray(value.sourceSnippets));
}
function isProgressLikeResult(value: unknown): value is ProgressLikeResult {
  return isRecord(value) && ("points" in value || "pointsEarned" in value || "streakDays" in value || "unitsToday" in value);
}
function difficultyLabel(difficulty?: string) {
  if (!difficulty) {
    return null;
  }
  return <span className="tool-badge">{difficulty}</span>;
}
function TextBlock({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return null;
  }
  return (
    <div className="tool-text-block">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph.split("\n").map((line, lineIndex, lines) => (
            <span key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
function FlashcardsView({ data }: { data: FlashcardsResult }) {
  if (data.cards.length === 0) {
    return <p className="tool-empty">No flashcards were generated.</p>;
  }
  return (
    <div className="tool-card-grid">
      {data.cards.map((card, index) => (
        <div key={index} className="tool-flashcard">
          <div className="tool-flashcard-header">
            <span className="tool-flashcard-index">#{index + 1}</span>
            {difficultyLabel(card.difficulty)}
          </div>
          <p className="tool-flashcard-question">{card.question}</p>
          <p className="tool-flashcard-answer">{card.answer}</p>
        </div>
      ))}
    </div>
  );
}
function QuizView({ data }: { data: QuizResult }) {
  if (data.questions.length === 0) {
    return <p className="tool-empty">No quiz questions were generated.</p>;
  }
  return (
    <div className="tool-list">
      {data.questions.map((question, index) => (
        <div key={index} className="tool-quiz-item">
          <div className="tool-quiz-item-header">
            <span className="tool-flashcard-index">Q{index + 1}</span>
            {difficultyLabel(question.difficulty)}
          </div>
          <p className="tool-quiz-question">{question.question}</p>
          <ul className="tool-quiz-options">
            {question.options.map((option, optionIndex) => (
              <li key={optionIndex} className={option === question.answer ? "tool-quiz-option tool-quiz-option-correct" : "tool-quiz-option"}>
                {option}
              </li>
            ))}
          </ul>
          {question.explanation && <p className="tool-quiz-explanation">{question.explanation}</p>}
        </div>
      ))}
    </div>
  );
}
function KnowledgeMapView({ data }: { data: KnowledgeMapResult }) {
  if (data.nodes.length === 0) {
    return <p className="tool-empty">No knowledge map was generated.</p>;
  }
  const byParent = new Map<string, KnowledgeMapNode[]>();
  data.nodes.forEach((node) => {
    const key = node.parentId ?? "__root__";
    const list = byParent.get(key) ?? [];
    list.push(node);
    byParent.set(key, list);
  });
  function renderChildren(parentKey: string, depth: number) {
    const children = byParent.get(parentKey);
    if (!children || children.length === 0) {
      return null;
    }
    return (
      <ul className="tool-map-list" style={{ paddingLeft: depth === 0 ? 0 : 18 }}>
        {children.map((node) => (
          <li key={node.id} className="tool-map-node">
            <div className="tool-map-node-row">
              <span className="tool-map-node-label">{node.label}</span>
              {typeof node.confidence === "number" && <span className="tool-badge">{Math.round(node.confidence * 100)}% confidence</span>}
            </div>
            {node.reason && <p className="tool-map-node-reason">{node.reason}</p>}
            {renderChildren(node.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div>
      {data.root && <p className="tool-map-root">{data.root}</p>}
      {renderChildren("__root__", 0)}
    </div>
  );
}
function MathView({ data }: { data: MathResult }) {
  return (
    <div className="tool-math">
      {data.problem && (
        <div className="tool-math-section">
          <h4>Problem</h4>
          <p>{data.problem}</p>
        </div>
      )}
      {Array.isArray(data.steps) && data.steps.length > 0 && (
        <div className="tool-math-section">
          <h4>Steps</h4>
          <ol className="tool-math-steps">
            {data.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      {data.answer && (
        <div className="tool-math-answer">
          <h4>Answer</h4>
          <p>{data.answer}</p>
        </div>
      )}
      {data.commonMistake && (
        <div className="tool-math-section tool-math-mistake">
          <h4>Common mistake</h4>
          <p>{data.commonMistake}</p>
        </div>
      )}
      {data.practice && (
        <div className="tool-math-section">
          <h4>Practice problem</h4>
          <p>{data.practice}</p>
        </div>
      )}
    </div>
  );
}
function SourceView({ data }: { data: SourceResult }) {
  return (
    <div>
      {data.answer && <TextBlock text={data.answer} />}
      {Array.isArray(data.sourceSnippets) && data.sourceSnippets.length > 0 && (
        <div className="tool-source-snippets">
          <h4>Source snippets</h4>
          {data.sourceSnippets.map((snippet, index) => (
            <div key={index} className="tool-source-snippet">
              <p className="tool-source-quote">&ldquo;{snippet.quote}&rdquo;</p>
              {snippet.reason && <p className="tool-source-reason">{snippet.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function ProgressView({ data }: { data: ProgressLikeResult }) {
  const stats: Array<{ label: string; value: string | number }> = [];
  if (typeof data.pointsEarned === "number") {
    stats.push({ label: "Points earned", value: data.pointsEarned });
  }
  if (typeof data.points === "number") {
    stats.push({ label: "Total points", value: data.points });
  }
  if (typeof data.streakDays === "number") {
    stats.push({ label: "Streak", value: `${data.streakDays} days` });
  }
  if (typeof data.unitsToday === "number") {
    stats.push({ label: "Units today", value: data.unitsToday });
  }
  if (typeof data.events === "number") {
    stats.push({ label: "Activity events", value: data.events });
  }
  return (
    <div>
      {data.streakMessage && <p className="tool-progress-message">{data.streakMessage}</p>}
      {stats.length > 0 && (
        <div className="tool-stat-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="tool-stat-card">
              <span className="tool-stat-value">{stat.value}</span>
              <span className="tool-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(data.topFeatures) && data.topFeatures.length > 0 && (
        <div className="tool-source-snippets">
          <h4>Most used tools</h4>
          <ul className="tool-map-list">
            {data.topFeatures.map((item) => (
              <li key={item.feature} className="tool-map-node">
                <div className="tool-map-node-row">
                  <span className="tool-map-node-label">{item.feature}</span>
                  <span className="tool-badge">{item.units} units</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(data.achievements) && data.achievements.length > 0 && (
        <div className="tool-source-snippets">
          <h4>Achievements</h4>
          <div className="tool-achievements">
            {data.achievements.map((achievement, index) => (
              <span key={index} className="tool-badge tool-achievement">
                {achievement}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.nextGoal && (
        <div className="tool-math-section">
          <h4>Next goal</h4>
          <p>{data.nextGoal}</p>
        </div>
      )}
    </div>
  );
}
function GenericObjectView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) {
    return <p className="tool-empty">No result data.</p>;
  }
  return (
    <dl className="tool-kv-list">
      {entries.map(([key, value]) => (
        <div key={key} className="tool-kv-row">
          <dt>{key}</dt>
          <dd>{typeof value === "string" ? value : Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ") : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ToolResultView({ feature, result }: { feature: string; result: unknown }) {
  if (typeof result === "string") {
    return <TextBlock text={result} />;
  }
  if (feature === "flashcards" && isFlashcardsResult(result)) {
    return <FlashcardsView data={result} />;
  }
  if (feature === "quiz" && isQuizResult(result)) {
    return <QuizView data={result} />;
  }
  if (feature === "knowledgeMap" && isKnowledgeMapResult(result)) {
    return <KnowledgeMapView data={result} />;
  }
  if (feature === "math" && isMathResult(result)) {
    return <MathView data={result} />;
  }
  if (feature === "source" && isSourceResult(result)) {
    return <SourceView data={result} />;
  }
  if ((feature === "progress" || feature === "gamification") && isProgressLikeResult(result)) {
    return <ProgressView data={result} />;
  }
  if (isRecord(result)) {
    return <GenericObjectView data={result} />;
  }
  return <TextBlock text={String(result)} />;
}
