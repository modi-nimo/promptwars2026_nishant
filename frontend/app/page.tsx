"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Gauge,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageCircle,
  Sparkles,
  Target,
  XCircle
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type CurrentLevel = "Beginner" | "Intermediate" | "Advanced";
type PreferredStyle = "Examples";

type RoadmapItem = {
  id: string;
  title: string;
  outcome: string;
  checkpoint: string;
  estimate_minutes: number;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  focus_topic: string;
};

type ProgressState = {
  answered: number;
  correct: number;
  weak_topics: string[];
  mastered_topics: string[];
};

type AIStatus = {
  provider: string;
  model: string | null;
  used_google_search: boolean;
  fallback_reason: string | null;
};

type LearningPath = {
  session_id: string;
  goal: string;
  topic: string;
  current_level: CurrentLevel;
  preferred_style: PreferredStyle;
  roadmap: RoadmapItem[];
  lesson: {
    title: string;
    objective: string;
    explanation: string[];
    example: {
      title: string;
      setup: string;
      walkthrough: string[];
      takeaway: string;
      code_sample: string | null;
    };
    quiz: QuizQuestion[];
  };
  progress: ProgressState;
  next_step: string;
  ai: AIStatus;
};

type QuizAnswer = {
  selected: string;
  correct: boolean;
  feedback: string;
};

type CoachResponse = {
  coach_note: string;
  simpler_example: string;
  check_question: string;
  weak_topic: string;
  ai: AIStatus;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

const levelOptions: CurrentLevel[] = ["Beginner", "Intermediate", "Advanced"];

async function postJson<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  return response.json() as Promise<TResponse>;
}

export default function Home() {
  const [goal, setGoal] = useState("Learn Python functions with practical examples");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel>("Beginner");
  const [preferredStyle] = useState<PreferredStyle>("Examples");
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [loadingPath, setLoadingPath] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(() => {
    if (!learningPath || learningPath.progress.answered === 0) {
      return 0;
    }

    return Math.round((learningPath.progress.correct / learningPath.progress.answered) * 100);
  }, [learningPath]);

  async function createLearningPath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingPath(true);
    setError(null);
    setCoach(null);
    setAnswers({});

    try {
      const data = await postJson<LearningPath, unknown>("/api/learning-path", {
        goal,
        current_level: currentLevel,
        preferred_style: preferredStyle
      });
      setLearningPath(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong");
    } finally {
      setLoadingPath(false);
    }
  }

  async function answerQuestion(question: QuizQuestion, selectedOption: string) {
    if (!learningPath || answers[question.id]) {
      return;
    }

    setError(null);

    try {
      const data = await postJson<
        {
          correct: boolean;
          feedback: string;
          progress: ProgressState;
          next_prompt: string;
        },
        unknown
      >("/api/quiz/answer", {
        session_id: learningPath.session_id,
        question_id: question.id,
        selected_option: selectedOption
      });

      setAnswers((current) => ({
        ...current,
        [question.id]: {
          selected: selectedOption,
          correct: data.correct,
          feedback: data.feedback
        }
      }));
      setLearningPath((current) =>
        current
          ? {
              ...current,
              progress: data.progress,
              next_step: data.next_prompt
            }
          : current
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not check answer");
    }
  }

  async function askCoach() {
    if (!learningPath) {
      return;
    }

    setCoachLoading(true);
    setError(null);

    try {
      const data = await postJson<CoachResponse, unknown>("/api/coach/reframe", {
        session_id: learningPath.session_id,
        message: "Give me a simpler example"
      });
      setCoach(data);
      setLearningPath((current) =>
        current
          ? {
              ...current,
              progress: {
                ...current.progress,
                weak_topics: current.progress.weak_topics.includes(data.weak_topic)
                  ? current.progress.weak_topics
                  : [...current.progress.weak_topics, data.weak_topic]
              }
            }
          : current
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Coach is unavailable");
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <main className="app-shell" id="main-content">
      <a className="skip-link" href="#learning-content">
        Skip to learning content
      </a>
      <section className="workspace">
        <aside className="control-panel" aria-label="Learning setup">
          <div className="brand-row">
            <div className="brand-mark" aria-hidden="true">
              <GraduationCap size={24} />
            </div>
            <div>
              <p className="eyebrow">PromptWars 2026</p>
              <h1>LearnMate</h1>
            </div>
          </div>

          <form className="setup-form" onSubmit={createLearningPath}>
            <label className="field-label" htmlFor="goal">
              Goal
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              minLength={3}
              maxLength={180}
              rows={5}
              placeholder="What do you want to learn?"
            />

            <div className="field-group">
              <p className="field-label">Current level</p>
              <div className="segmented-control" role="radiogroup" aria-label="Current level">
                {levelOptions.map((level) => (
                  <button
                    className={currentLevel === level ? "segment active" : "segment"}
                    key={level}
                    onClick={() => setCurrentLevel(level)}
                    type="button"
                    role="radio"
                    aria-checked={currentLevel === level}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="style-row">
              <div>
                <p className="field-label">Preferred style</p>
                <strong>Examples</strong>
              </div>
              <div className="style-chip">
                <BookOpen size={18} />
                Active
              </div>
            </div>

            <button
              aria-busy={loadingPath}
              className="primary-button"
              disabled={loadingPath}
              type="submit"
            >
              {loadingPath ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              Build path
            </button>
          </form>

          {learningPath ? (
            <div className="progress-panel" aria-label="Learning progress">
              <div className="metric-row">
                <div>
                  <span className="metric-label">Score</span>
                  <strong>{score}%</strong>
                </div>
                <div>
                  <span className="metric-label">Checks</span>
                  <strong>{learningPath.progress.answered}</strong>
                </div>
              </div>

              <div className="topic-list">
                <span className="metric-label">Weak spots</span>
                {learningPath.progress.weak_topics.length ? (
                  learningPath.progress.weak_topics.map((topic) => (
                    <span className="pill warning" key={topic}>
                      {topic}
                    </span>
                  ))
                ) : (
                  <span className="pill">None yet</span>
                )}
              </div>

              <div className="topic-list">
                <span className="metric-label">Mastered</span>
                {learningPath.progress.mastered_topics.length ? (
                  learningPath.progress.mastered_topics.map((topic) => (
                    <span className="pill success" key={topic}>
                      {topic}
                    </span>
                  ))
                ) : (
                  <span className="pill">Waiting for answers</span>
                )}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="learning-surface" id="learning-content" aria-live="polite" aria-label="Learning content">
          {error ? (
            <div className="error-banner">
              <XCircle size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          {learningPath ? (
            <>
              <div className="session-header">
                <div>
                  <p className="eyebrow">{learningPath.current_level} path</p>
                  <h2>{learningPath.topic}</h2>
                  <p>{learningPath.goal}</p>
                </div>
                <div className="session-actions">
                  <div
                    aria-label={
                      learningPath.ai.provider === "gemini"
                        ? `AI generated by Gemini model ${learningPath.ai.model}`
                        : "Using local fallback generator"
                    }
                    className={learningPath.ai.provider === "gemini" ? "ai-badge live" : "ai-badge fallback"}
                    role="status"
                  >
                    <Sparkles size={17} />
                    <span>{learningPath.ai.provider === "gemini" ? "Gemini" : "Fallback"}</span>
                    <small>{learningPath.ai.model ?? "local"}</small>
                  </div>
                  <div className="session-badge">
                    <Target size={18} />
                    {learningPath.next_step}
                  </div>
                </div>
              </div>

              {learningPath.ai.fallback_reason ? (
                <div className="fallback-note">
                  <Sparkles size={17} />
                  <span>{learningPath.ai.fallback_reason}</span>
                </div>
              ) : null}

              <div className="roadmap-grid">
                {learningPath.roadmap.map((item, index) => (
                  <article className="roadmap-card" key={item.id}>
                    <span className="step-number">{index + 1}</span>
                    <h3>{item.title}</h3>
                    <p>{item.outcome}</p>
                    <div className="checkpoint">
                      <Gauge size={16} />
                      <span>{item.estimate_minutes} min</span>
                    </div>
                  </article>
                ))}
              </div>

              <article className="lesson-panel">
                <div className="lesson-heading">
                  <div>
                    <p className="eyebrow">Session one</p>
                    <h2>{learningPath.lesson.title}</h2>
                  </div>
                  <div className="icon-token" title="Objective">
                    <Brain size={22} />
                  </div>
                </div>

                <p className="objective">{learningPath.lesson.objective}</p>

                <div className="lesson-copy">
                  {learningPath.lesson.explanation.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>

                <section className="example-section">
                  <div className="section-title">
                    <Lightbulb size={20} />
                    <h3>{learningPath.lesson.example.title}</h3>
                  </div>
                  <p>{learningPath.lesson.example.setup}</p>
                  <ol className="walkthrough-list">
                    {learningPath.lesson.example.walkthrough.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {learningPath.lesson.example.code_sample ? (
                    <pre className="code-block">
                      <code>{learningPath.lesson.example.code_sample}</code>
                    </pre>
                  ) : null}
                  <p className="takeaway">{learningPath.lesson.example.takeaway}</p>
                </section>

                <section className="quiz-section">
                  <div className="section-title">
                    <MessageCircle size={20} />
                    <h3>Quick check</h3>
                  </div>

                  <div className="quiz-grid">
                    {learningPath.lesson.quiz.map((question) => {
                      const answer = answers[question.id];

                      return (
                        <div className="quiz-card" key={question.id}>
                          <p className="quiz-prompt">{question.prompt}</p>
                          <div className="option-list">
                            {question.options.map((option) => {
                              const selected = answer?.selected === option;
                              const optionClass = [
                                "option-button",
                                selected && answer?.correct ? "correct" : "",
                                selected && answer && !answer.correct ? "wrong" : ""
                              ]
                                .filter(Boolean)
                                .join(" ");

                              return (
                                <button
                                  className={optionClass}
                                  disabled={Boolean(answer)}
                                  key={option}
                                  onClick={() => answerQuestion(question, option)}
                                  type="button"
                                >
                                  {selected && answer?.correct ? <CheckCircle2 size={17} /> : null}
                                  {selected && answer && !answer.correct ? <XCircle size={17} /> : null}
                                  <span>{option}</span>
                                </button>
                              );
                            })}
                          </div>
                          {answer ? <p className="feedback">{answer.feedback}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="coach-section">
                  <div>
                    <div className="section-title">
                      <Brain size={20} />
                      <h3>Coach</h3>
                    </div>
                    {coach ? (
                      <div className="coach-copy">
                        <span className={coach.ai.provider === "gemini" ? "mini-ai live" : "mini-ai fallback"}>
                          {coach.ai.provider === "gemini" ? "Gemini coach" : "Fallback coach"}
                        </span>
                        <p>{coach.coach_note}</p>
                        <p>{coach.simpler_example}</p>
                        <strong>{coach.check_question}</strong>
                      </div>
                    ) : (
                      <p>No confusion notes yet.</p>
                    )}
                  </div>
                  <button
                    aria-busy={coachLoading}
                    className="secondary-button"
                    disabled={coachLoading}
                    onClick={askCoach}
                    type="button"
                  >
                    {coachLoading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
                    Simpler example
                  </button>
                </section>
              </article>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Sparkles size={32} />
              </div>
              <p className="eyebrow">Ready</p>
              <h2>Start with a goal.</h2>
              <p>A focused first session will appear here.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
