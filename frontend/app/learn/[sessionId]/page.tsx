"use client";

import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Sparkles,
  Zap,
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

export default function LearnSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const auth = useFirebaseUser();

  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [checkOption, setCheckOption] = useState("");
  const [checkConfidence, setCheckConfidence] = useState(3);
  const [coachMessage, setCoachMessage] = useState("Explain this concept using a real-world analogy.");
  const [lastCheck, setLastCheck] = useState<CheckSubmitResponse | null>(null);
  const [lastCoach, setLastCoach] = useState<CoachResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [coachOpen, setCoachOpen] = useState(false);
  const [submittingDiagnostic, setSubmittingDiagnostic] = useState(false);
  const [submittingCheck, setSubmittingCheck] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      if (auth.loading) return;
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
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSession();
    return () => { cancelled = true; };
  }, [auth.loading, sessionId]);

  const diagnosticComplete = Boolean(session?.learner_model && session.current_card);
  const answeredDiagnostics = useMemo(() => Object.keys(answers).length, [answers]);

  async function runDiagnostic() {
    if (!session || answeredDiagnostics !== session.diagnostic_questions.length) {
      setError("Please answer all diagnostic questions.");
      return;
    }
    setSubmittingDiagnostic(true);
    setError(null);
    try {
      const token = await auth.token();
      const result: DiagnosticSubmitResponse = await submitDiagnostic({
        session_id: session.session_id,
        answers: session.diagnostic_questions.map((q) => ({
          question_id: q.id,
          selected_option: answers[q.id],
          confidence: confidences[q.id] ?? 3
        }))
      }, token);
      setSession({ ...session, learner_model: result.learner_model, concept_map: result.concept_map, current_card: result.next_card });
      setStatus("Diagnostic calibrated. Adaptive path initialized.");
    } catch (e) { setError(e instanceof Error ? e.message : "Diagnostic failed"); }
    finally { setSubmittingDiagnostic(false); }
  }

  async function runCheck() {
    if (!session?.current_card || !checkOption) return;
    setSubmittingCheck(true);
    setError(null);
    try {
      const token = await auth.token();
      const result = await submitCheck({
        session_id: session.session_id,
        card_id: session.current_card.id,
        question_id: session.current_card.check_question.id,
        selected_option: checkOption,
        confidence: checkConfidence
      }, token);
      setSession({ ...session, learner_model: result.learner_model, concept_map: result.concept_map, current_card: result.next_card });
      setLastCheck(result);
      setCheckOption("");
    } catch (e) { setError(e instanceof Error ? e.message : "Check failed"); }
    finally { setSubmittingCheck(false); }
  }

  async function requestCoach() {
    if (!session) return;
    setCoachLoading(true);
    setError(null);
    try {
      const token = await auth.token();
      const result = await askCoach({ session_id: session.session_id, message: coachMessage }, token);
      setLastCoach(result);
      setSession({
        ...session,
        learner_model: session.learner_model ? { ...session.learner_model, weak_topics: result.updated_weak_topics } : session.learner_model,
        current_card: result.next_card ?? session.current_card
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Coach failed"); }
    finally { setCoachLoading(false); }
  }

  if (loading || auth.loading) return (
    <main className="learn-shell centered-state" style={{ height: '100vh' }}>
      <Loader2 className="spin text-cyan" size={48} />
      <h2 className="text-cyan">Calibrating Session...</h2>
    </main>
  );

  if (!session) return (
    <main className="learn-shell centered-state" style={{ height: '100vh' }}>
      <div className="glass-panel text-center">
        <h2 className="text-error">Session Lost</h2>
        <p>{error || "We couldn't find your session data."}</p>
        <Link href="/" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1rem' }}>
          <ArrowLeft size={18} /> New Mission
        </Link>
      </div>
    </main>
  );

  return (
    <main className="learn-shell">
      <div className="learn-type-background" aria-hidden="true">
        <span>LEARN</span>
        <span>ADAPT</span>
        <span>MASTER</span>
      </div>

      {/* Header */}
      <header className="learn-topbar">
        <div className="learn-topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/" className="btn-secondary learn-back-button" aria-label="Back to setup">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="eyebrow" style={{ margin: 0, fontSize: '0.6rem' }}>Current Mission</p>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }} className="text-cyan">{session.goal}</h3>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className={`btn-secondary learn-pill`} style={{ borderColor: session.ai.provider === 'gemini' ? 'var(--zenith-success)' : 'var(--zenith-warning)' }}>
              <Brain size={16} className={session.ai.provider === 'gemini' ? 'text-success' : 'text-warning'} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{session.ai.provider === 'gemini' ? "Gemini Live" : "Fallback Active"}</span>
            </div>
            <button
              aria-controls="ai-sidekick"
              aria-expanded={coachOpen}
              className="btn-secondary learn-pill"
              onClick={() => setCoachOpen((open) => !open)}
              type="button"
            >
              <Bot size={16} className="text-accent" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{coachOpen ? "Hide Sidekick" : "AI Sidekick"}</span>
            </button>
            {auth.user && <div className="btn-secondary learn-pill">{auth.user.displayName || "User"}</div>}
          </div>
        </div>
      </header>

      <div className={`learning-layout ${coachOpen ? "coach-open" : "coach-closed"}`}>
        {/* Sidebar Left: Progress & Map */}
        <aside className="glass-panel learn-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutDashboard size={20} className="text-cyan" />
            <h3 style={{ margin: 0 }}>Mission Status</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="glass-panel learn-metric" style={{ padding: '1rem', textAlign: 'center' }}>
              <p className="eyebrow">Mastery</p>
              <h2 className="text-cyan">{percent(session.learner_model?.mastery_score ?? 0)}</h2>
            </div>
            <div className="glass-panel learn-metric" style={{ padding: '1rem', textAlign: 'center' }}>
              <p className="eyebrow">Pace</p>
              <h2 className="text-accent">{session.learner_model?.pace ?? "N/A"}</h2>
            </div>
          </div>

          <div>
            <h3 className="eyebrow" style={{ marginBottom: '1rem' }}>Concept Map</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {session.concept_map.map((c) => (
                <div key={c.id} className={`concept-node ${c.status} ${session.current_card?.title === c.title ? 'active' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{c.title}</span>
                    {c.status === 'mastered' && <CheckCircle2 size={14} className="text-success" />}
                  </div>
                  <div style={{ height: '4px', background: 'var(--zenith-accent-soft)', borderRadius: '2px', marginTop: '0.5rem' }}>
                    <div style={{ height: '100%', width: percent(c.mastery), background: 'var(--zenith-accent)', borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Stage */}
        <section className="stage-main">
          {!diagnosticComplete ? (
            <div className="step-card">
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2 className="text-cyan">Diagnostic Calibration</h2>
                  <span className="btn-secondary">{answeredDiagnostics}/{session.diagnostic_questions.length}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {session.diagnostic_questions.map((q, i) => (
                    <div key={q.id} className="glass-panel question-card">
                      <p className="heading-font question-prompt">{i + 1}. {q.prompt}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            className={`${answers[q.id] === opt ? "btn-primary" : "btn-secondary"} answer-option`}
                            onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                            style={{ textAlign: 'left' }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className="eyebrow" style={{ margin: 0 }}>Confidence:</span>
                        <input
                          type="range"
                          min={1} max={5}
                          value={confidences[q.id] ?? 3}
                          onChange={(e) => setConfidences({ ...confidences, [q.id]: Number(e.target.value) })}
                          style={{ flex: 1 }}
                        />
                        <span className="text-cyan">{confidences[q.id] ?? 3}/5</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn-primary" onClick={runDiagnostic} disabled={submittingDiagnostic} style={{ marginTop: '2rem', width: '100%' }}>
                  {submittingDiagnostic ? <Loader2 className="spin" /> : <Zap size={18} />}
                  <span style={{ marginLeft: '8px' }}>Analyze My Skills</span>
                </button>
              </div>
            </div>
          ) : session.current_card ? (
            <div className="stage-card">
              {/* Insight Toast for Adaptive Logic */}
              {(lastCheck || lastCoach) && (
                <div className="glass-panel fade-in learn-insight" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <Sparkles className="text-accent" />
                    <div>
                      <p className="eyebrow" style={{ color: 'var(--zenith-accent)' }}>Coach Insight</p>
                      <p style={{ color: 'var(--zenith-text)', margin: 0, fontWeight: 500 }}>
                        {lastCheck ? lastCheck.adaptive_reason : lastCoach?.coach_response}
                      </p>
                      {lastCheck && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Mastery Change: <span className="text-accent">+{lastCheck.mastery_delta}</span></p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <span className="text-accent eyebrow">{session.current_card.adaptive_action.replace('_', ' ')}</span>
                    <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{session.current_card.title}</h1>
                  </div>
                  <div className="btn-secondary">
                    <Clock3 size={16} className="text-cyan" />
                    <span style={{ marginLeft: '8px' }}>{session.current_card.estimated_minutes} min</span>
                  </div>
                </div>

                <p className="lesson-objective">{session.current_card.objective}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel learning-subpanel">
                    <h3 className="text-cyan" style={{ marginBottom: '1rem' }}>The Concept</h3>
                    <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {session.current_card.explanation.map((e, i) => <li key={i} style={{ color: 'var(--zenith-text-muted)' }}>{e}</li>)}
                    </ul>
                  </div>

                  <div className="glass-panel learning-subpanel">
                    <h3 className="text-accent" style={{ marginBottom: '1rem' }}>Deep Dive: {session.current_card.example.title}</h3>
                    <p style={{ marginBottom: '1rem' }}>{session.current_card.example.setup}</p>
                    {session.current_card.example.code_sample && (
                      <div className="code-block" style={{ margin: '1rem 0' }}>
                        <pre><code>{session.current_card.example.code_sample}</code></pre>
                      </div>
                    )}
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--zenith-accent-soft)', borderRadius: '12px', borderLeft: '4px solid var(--zenith-accent)' }}>
                      <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--zenith-text)' }}>Takeaway: {session.current_card.example.takeaway}</p>
                    </div>
                  </div>

                  {/* Knowledge Check */}
                  <div className="glass-panel mastery-panel">
                    <h3 className="text-accent" style={{ marginBottom: '1.5rem' }}>Mastery Check</h3>
                    <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--zenith-text)', fontWeight: 500 }}>{session.current_card.check_question.prompt}</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {session.current_card.check_question.options.map((opt) => (
                        <button
                          key={opt}
                          className={`${checkOption === opt ? "btn-primary" : "btn-secondary"} answer-option`}
                          onClick={() => setCheckOption(opt)}
                          style={{ textAlign: 'left' }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '400px' }}>
                        <span className="eyebrow" style={{ margin: 0 }}>Confidence:</span>
                        <input
                          type="range"
                          min={1} max={5}
                          value={checkConfidence}
                          onChange={(e) => setCheckConfidence(Number(e.target.value))}
                          style={{ flex: 1 }}
                        />
                        <span className="text-cyan">{checkConfidence}/5</span>
                      </div>
                      <button className="btn-primary" onClick={runCheck} disabled={submittingCheck || !checkOption}>
                        {submittingCheck ? <Loader2 className="spin" /> : <ChevronRight size={18} />}
                        <span style={{ marginLeft: '8px' }}>Continue Mission</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Sidebar Right: AI Coach */}
        {coachOpen && (
          <aside id="ai-sidekick" className="glass-panel learn-coach" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={20} className="text-accent" />
              <h3 style={{ margin: 0 }}>AI Sidekick</h3>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="glass-panel" style={{ background: 'var(--zenith-bg)', padding: '1rem', fontSize: '0.9rem', border: '1px solid var(--zenith-border)' }}>
                <p style={{ margin: 0, color: 'var(--zenith-text)', fontWeight: 500 }}>Hello! I'm your adaptive coach. Ask me to simplify, give more examples, or explain the "why" behind any concept.</p>
              </div>
              
              {lastCoach && (
                <div className="glass-panel fade-in" style={{ background: 'var(--zenith-accent-soft)', padding: '1rem', fontSize: '0.9rem', borderLeft: '3px solid var(--zenith-accent)' }}>
                  <p style={{ margin: 0, color: 'var(--zenith-text)' }}>{lastCoach.coach_response}</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 'auto' }}>
              <textarea
                value={coachMessage}
                onChange={(e) => setCoachMessage(e.target.value)}
                placeholder="Ask the coach..."
                rows={3}
                style={{ fontSize: '0.9rem', marginBottom: '1rem' }}
              />
              <button className="btn-primary" style={{ width: '100%' }} onClick={requestCoach} disabled={coachLoading}>
                {coachLoading ? <Loader2 className="spin" /> : <MessageCircle size={18} />}
                <span style={{ marginLeft: '8px' }}>Send Request</span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
