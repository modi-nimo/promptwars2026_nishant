"use client";

import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  Gauge,
  HelpCircle,
  Loader2,
  MessageCircle,
  Target,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  CheckSubmitResponse,
  CoachResponse,
  DiagnosticSubmitResponse,
  SessionSnapshot,
  askCoach,
  getSession,
  submitCheck,
  submitDiagnostic
} from "@/lib/api";
import { useFirebaseUser } from "@/lib/firebase";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function actionLabel(action: string) {
  return action
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export default function LearnSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const auth = useFirebaseUser();

  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [checkOption, setCheckOption] = useState("");
  const [checkConfidence, setCheckConfidence] = useState(3);
  const [coachMessage, setCoachMessage] = useState("I am confused. Give me a simpler example.");
  const [lastCheck, setLastCheck] = useState<CheckSubmitResponse | null>(null);
  const [lastCoach, setLastCoach] = useState<CoachResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingDiagnostic, setSubmittingDiagnostic] = useState(false);
  const [submittingCheck, setSubmittingCheck] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (auth.loading) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = await auth.token();
        const data = await getSession(sessionId, token);
        if (!cancelled) {
          setSession(data);
          setCheckOption("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Could not load session");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [auth.loading, sessionId]);

  const diagnosticComplete = Boolean(session?.learner_model && session.current_card);
  const answeredDiagnostics = useMemo(() => Object.keys(answers).length, [answers]);

  async function runDiagnostic() {
    if (!session) {
      return;
    }
    if (answeredDiagnostics !== session.diagnostic_questions.length) {
      setError("Answer each diagnostic question before continuing.");
      return;
    }

    setSubmittingDiagnostic(true);
    setError(null);
    setStatus(null);
    try {
      const token = await auth.token();
      const result: DiagnosticSubmitResponse = await submitDiagnostic(
        {
          session_id: session.session_id,
          answers: session.diagnostic_questions.map((question) => ({
            question_id: question.id,
            selected_option: answers[question.id],
            confidence: confidences[question.id] ?? 3
          }))
        },
        token
      );
      setSession({
        ...session,
        learner_model: result.learner_model,
        concept_map: result.concept_map,
        current_card: result.next_card
      });
      setStatus(`Diagnostic complete. Pace set to ${result.learner_model.pace}.`);
      setLastCheck(null);
      setLastCoach(null);
      setCheckOption("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Diagnostic failed");
    } finally {
      setSubmittingDiagnostic(false);
    }
  }

  async function runCheck() {
    if (!session?.current_card || !checkOption) {
      setError("Choose an answer for the current check.");
      return;
    }

    setSubmittingCheck(true);
    setError(null);
    setStatus(null);
    try {
      const token = await auth.token();
      const result = await submitCheck(
        {
          session_id: session.session_id,
          card_id: session.current_card.id,
          question_id: session.current_card.check_question.id,
          selected_option: checkOption,
          confidence: checkConfidence
        },
        token
      );
      setSession({
        ...session,
        learner_model: result.learner_model,
        concept_map: result.concept_map,
        current_card: result.next_card
      });
      setLastCheck(result);
      setLastCoach(null);
      setStatus(result.feedback);
      setCheckOption("");
      setCheckConfidence(3);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Check failed");
    } finally {
      setSubmittingCheck(false);
    }
  }

  async function requestCoach() {
    if (!session) {
      return;
    }

    setCoachLoading(true);
    setError(null);
    setStatus(null);
    try {
      const token = await auth.token();
      const result = await askCoach(
        {
          session_id: session.session_id,
          message: coachMessage
        },
        token
      );
      setLastCoach(result);
      setLastCheck(null);
      setStatus(result.coach_response);
      setSession({
        ...session,
        learner_model: session.learner_model
          ? {
              ...session.learner_model,
              weak_topics: result.updated_weak_topics
            }
          : session.learner_model,
        current_card: result.next_card ?? session.current_card
      });
      setCheckOption("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Coach failed");
    } finally {
      setCoachLoading(false);
    }
  }

  if (loading || auth.loading) {
    return (
      <main className="app-shell centered-state">
        <Loader2 className="spin" size={28} aria-hidden="true" />
        <p>Loading session</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app-shell centered-state">
        <p className="error-text" role="alert">
          {error || "Session unavailable"}
        </p>
        <Link className="icon-text-button" href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          New session
        </Link>
      </main>
    );
  }

  return (
    <main className="app-shell learning-shell">
      <a className="skip-link" href="#learning-workspace">
        Skip to workspace
      </a>

      <header className="learning-header">
        <Link className="icon-button" href="/" aria-label="Start a new session">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div>
          <p className="eyebrow">{session.auth_mode === "google" ? "Google saved" : "Guest session"}</p>
          <h1>{session.goal}</h1>
        </div>
        <div className="provider-pill">
          <Brain size={16} aria-hidden="true" />
          {session.ai.provider}
        </div>
      </header>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="status-text" aria-live="polite">
          {status}
        </p>
      ) : null}

      <section className="learning-grid" id="learning-workspace">
        {!diagnosticComplete ? (
          <section className="workspace-panel diagnostic-panel" aria-labelledby="diagnostic-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2 id="diagnostic-title">Diagnostic check</h2>
              </div>
              <span className="count-pill">
                {answeredDiagnostics}/{session.diagnostic_questions.length}
              </span>
            </div>

            <div className="question-list">
              {session.diagnostic_questions.map((question, index) => (
                <fieldset className="question-block" key={question.id}>
                  <legend>
                    {index + 1}. {question.prompt}
                  </legend>
                  <div className="option-grid">
                    {question.options.map((option) => (
                      <button
                        aria-pressed={answers[question.id] === option}
                        className={answers[question.id] === option ? "option selected" : "option"}
                        key={option}
                        onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <label className="range-label">
                    Confidence
                    <input
                      max={5}
                      min={1}
                      onChange={(event) =>
                        setConfidences((current) => ({
                          ...current,
                          [question.id]: Number(event.target.value)
                        }))
                      }
                      type="range"
                      value={confidences[question.id] ?? 3}
                    />
                    <span>{confidences[question.id] ?? 3}/5</span>
                  </label>
                </fieldset>
              ))}
            </div>

            <button className="primary-button" disabled={submittingDiagnostic} onClick={runDiagnostic} type="button">
              {submittingDiagnostic ? (
                <Loader2 size={18} className="spin" aria-hidden="true" />
              ) : (
                <ChevronRight size={18} aria-hidden="true" />
              )}
              Build adaptive path
            </button>
          </section>
        ) : (
          <>
            <aside className="workspace-panel dashboard-panel" aria-label="Learning progress">
              <div className="metric-row">
                <div className="metric">
                  <Gauge size={18} aria-hidden="true" />
                  <span>Mastery</span>
                  <strong>{percent(session.learner_model?.mastery_score ?? 0)}</strong>
                </div>
                <div className="metric">
                  <Target size={18} aria-hidden="true" />
                  <span>Pace</span>
                  <strong>{session.learner_model?.pace}</strong>
                </div>
              </div>

              <h2>Concept map</h2>
              <ol className="concept-list">
                {session.concept_map.map((concept) => (
                  <li className={`concept-item ${concept.status}`} key={concept.id}>
                    <div>
                      <span>{concept.title}</span>
                      <small>{concept.status.replace("_", " ")}</small>
                    </div>
                    <meter min={0} max={1} value={concept.mastery}>
                      {percent(concept.mastery)}
                    </meter>
                  </li>
                ))}
              </ol>

              <div className="topic-stack">
                <h3>Weak topics</h3>
                <p>
                  {session.learner_model?.weak_topics.length
                    ? session.learner_model.weak_topics.join(", ")
                    : "None marked"}
                </p>
              </div>

              <div className="topic-stack">
                <h3>Mastered topics</h3>
                <p>
                  {session.learner_model?.mastered_topics.length
                    ? session.learner_model.mastered_topics.join(", ")
                    : "In progress"}
                </p>
              </div>
            </aside>

            {session.current_card ? (
              <section className="workspace-panel lesson-panel" aria-labelledby="lesson-title">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{actionLabel(session.current_card.adaptive_action)}</p>
                    <h2 id="lesson-title">{session.current_card.title}</h2>
                  </div>
                  <span className="count-pill">{session.current_card.estimated_minutes} min</span>
                </div>

                <p className="objective">{session.current_card.objective}</p>
                <ul className="explanation-list">
                  {session.current_card.explanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                <section className="example-section" aria-label="Example">
                  <h3>{session.current_card.example.title}</h3>
                  <p>{session.current_card.example.setup}</p>
                  <ol>
                    {session.current_card.example.walkthrough.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {session.current_card.example.code_sample ? (
                    <pre>
                      <code>{session.current_card.example.code_sample}</code>
                    </pre>
                  ) : null}
                  <p className="takeaway">{session.current_card.example.takeaway}</p>
                </section>

                <section className="check-section" aria-labelledby="check-title">
                  <h3 id="check-title">{session.current_card.check_question.prompt}</h3>
                  <div className="option-grid">
                    {session.current_card.check_question.options.map((option) => (
                      <button
                        aria-pressed={checkOption === option}
                        className={checkOption === option ? "option selected" : "option"}
                        key={option}
                        onClick={() => setCheckOption(option)}
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <label className="range-label">
                    Confidence
                    <input
                      max={5}
                      min={1}
                      onChange={(event) => setCheckConfidence(Number(event.target.value))}
                      type="range"
                      value={checkConfidence}
                    />
                    <span>{checkConfidence}/5</span>
                  </label>
                  <button className="primary-button" disabled={submittingCheck} onClick={runCheck} type="button">
                    {submittingCheck ? (
                      <Loader2 size={18} className="spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={18} aria-hidden="true" />
                    )}
                    Submit check
                  </button>
                </section>
              </section>
            ) : null}

            <aside className="workspace-panel evidence-panel" aria-label="Adaptive evidence">
              <h2>Why this changed</h2>
              {lastCheck ? (
                <div className="evidence-body">
                  <p className={lastCheck.correctness === "correct" ? "result correct" : "result incorrect"}>
                    {lastCheck.correctness === "correct" ? (
                      <CheckCircle2 size={18} aria-hidden="true" />
                    ) : (
                      <XCircle size={18} aria-hidden="true" />
                    )}
                    {lastCheck.feedback}
                  </p>
                  <p>{lastCheck.adaptive_reason}</p>
                  <p>
                    Mastery delta: <strong>{lastCheck.mastery_delta > 0 ? "+" : ""}{lastCheck.mastery_delta}</strong>
                  </p>
                </div>
              ) : lastCoach ? (
                <div className="evidence-body">
                  <p>{lastCoach.coach_response}</p>
                  <p>
                    Suggested action: <strong>{actionLabel(lastCoach.suggested_action)}</strong>
                  </p>
                </div>
              ) : (
                <div className="evidence-body">
                  <p>Diagnostic pace: {session.learner_model?.pace}</p>
                  <p>Current action: {actionLabel(session.current_card?.adaptive_action ?? "next_concept")}</p>
                </div>
              )}

              <section className="coach-section" aria-labelledby="coach-title">
                <h3 id="coach-title">
                  <MessageCircle size={18} aria-hidden="true" />
                  Coach
                </h3>
                <textarea
                  aria-label="Coach message"
                  onChange={(event) => setCoachMessage(event.target.value)}
                  rows={4}
                  value={coachMessage}
                />
                <button className="icon-text-button" disabled={coachLoading} onClick={requestCoach} type="button">
                  {coachLoading ? (
                    <Loader2 size={18} className="spin" aria-hidden="true" />
                  ) : (
                    <HelpCircle size={18} aria-hidden="true" />
                  )}
                  Ask coach
                </button>
              </section>
            </aside>
          </>
        )}
      </section>
    </main>
  );
}

