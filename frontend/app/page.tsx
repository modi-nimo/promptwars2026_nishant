"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  Compass,
  Eye,
  Gauge,
  GraduationCap,
  Layers3,
  Loader2,
  LogIn,
  LogOut,
  MessageCircle,
  Palette,
  Route,
  Sparkles,
  Target,
  User,
  Wrench,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CurrentLevel,
  PreferredStyle,
  createSession
} from "@/lib/api";
import { useFirebaseUser } from "@/lib/firebase";

const levels: Array<{ id: CurrentLevel; label: string; description: string; Icon: LucideIcon }> = [
  { id: "Beginner", label: "Beginner", description: "Start with foundations", Icon: Compass },
  { id: "Intermediate", label: "Intermediate", description: "Connect the gaps", Icon: Route },
  { id: "Advanced", label: "Advanced", description: "Push into challenge", Icon: Gauge }
];

const styles: Array<{ id: PreferredStyle; label: string; description: string; Icon: LucideIcon }> = [
  { id: "Examples", label: "Examples", description: "Show me patterns", Icon: BookOpen },
  { id: "Visual", label: "Visual", description: "Map the idea", Icon: Palette },
  { id: "Socratic", label: "Socratic", description: "Ask, then reveal", Icon: MessageCircle },
  { id: "Hands-on", label: "Hands-on", description: "Practice first", Icon: Wrench }
];

const launchMessages = [
  "Reading your goal and context",
  "Gemini is designing your diagnostic",
  "Calibrating pace and difficulty",
  "Preparing your adaptive workspace"
];

export default function Home() {
  const router = useRouter();
  const auth = useFirebaseUser();
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<CurrentLevel>("Beginner");
  const [style, setStyle] = useState<PreferredStyle>("Examples");
  const [minutes, setMinutes] = useState(25);
  const [loading, setLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchMessage, setLaunchMessage] = useState("Initializing ConceptMate");

  useEffect(() => {
    if (!loading) return;
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % launchMessages.length;
      setLaunchMessage((current) => (
        current.startsWith("Workspace ready") ? current : launchMessages[index]
      ));
    }, 1100);

    return () => window.clearInterval(timer);
  }, [loading]);

  async function startSession() {
    if (goal.trim().length < 3) {
      setError("Add a learning goal to launch your adaptive session.");
      return;
    }
    setLoading(true);
    setError(null);
    setLaunchMessage(launchMessages[0]);

    try {
      const token = await auth.token();
      setLaunchMessage(launchMessages[1]);
      const session = await createSession(
        {
          goal: goal.trim(),
          current_level: level,
          time_available_minutes: minutes,
          preferred_style: style
        },
        token
      );
      setLaunchMessage("Workspace ready. Opening learning console");
      router.push(`/learn/${session.session_id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start session");
      setLaunchMessage("Initializing ConceptMate");
      setLoading(false);
    }
  }

  async function toggleSignIn() {
    setAuthBusy(true);
    setError(null);
    try {
      if (auth.user) {
        await auth.signOutUser();
      } else {
        await auth.signIn();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Google sign-in failed");
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <main className="home-shell">
      {loading && (
        <div className="launch-overlay" role="status" aria-live="polite" aria-label="Launching adaptive session">
          <div className="launch-card">
            <div className="launch-orbit" aria-hidden="true">
              <span />
              <span />
              <Zap size={24} />
            </div>
            <p className="eyebrow text-accent">Launching ConceptMate</p>
            <h2>{launchMessage}</h2>
            <div className="launch-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        </div>
      )}

      <div className="type-background" aria-hidden="true">
        <span>ADAPT</span>
        <span>CLARITY</span>
        <span>PACE</span>
        <span>MASTER</span>
        <span>DIAGNOSE</span>
        <span>GEMINI</span>
      </div>

      <header className="home-topbar">
        <div className="home-brand">
          <div className="home-brand-mark" aria-hidden="true">
            <GraduationCap size={23} />
          </div>
          <div>
            <p className="home-kicker">PromptWars 2026</p>
            <h2>ConceptMate</h2>
          </div>
        </div>

        <button
          className="home-auth-button"
          disabled={!auth.enabled || auth.loading || authBusy}
          onClick={toggleSignIn}
          type="button"
        >
          {authBusy || auth.loading ? (
            <Loader2 size={17} className="spin" aria-hidden="true" />
          ) : auth.user ? (
            <LogOut size={17} aria-hidden="true" />
          ) : (
            <LogIn size={17} aria-hidden="true" />
          )}
          <span>{auth.user ? "Sign out" : auth.enabled ? "Google Sign-In" : "Guest Mode"}</span>
        </button>
      </header>

      <section className="home-stage" aria-labelledby="home-title">
        <div className="home-narrative">
          <div className="compact-hero-copy">
            <p className="home-kicker">Meet your adaptive study partner</p>
            <h1 id="home-title"><span>Concept</span><span>Mate</span></h1>
            <p className="home-tagline">Understand faster. Remember longer. Move at your own pace.</p>
          </div>

          <div className="compact-proof-row" aria-label="Adaptive learning signals">
            <div className="ai-badge">
              <Sparkles size={16} aria-hidden="true" />
              Gemini powered
            </div>
            <span><Brain size={16} aria-hidden="true" /> Learner model</span>
            <span><Layers3 size={16} aria-hidden="true" /> Concept map</span>
            <span><Eye size={16} aria-hidden="true" /> Why it changed</span>
          </div>
        </div>

        <form className="mission-panel" onSubmit={(event) => { event.preventDefault(); startSession(); }}>
          <div className="mission-goal-column">
            <div className="mission-header">
              <div>
                <p className="home-kicker">Launch session</p>
                <h2>Tell ConceptMate what to teach you</h2>
              </div>
              <div className="mini-status">
                <CheckCircle2 size={16} aria-hidden="true" />
                {auth.user ? "Sync ready" : "Guest ready"}
              </div>
            </div>

            <label className="home-field-label" htmlFor="learning-goal">
              <Target size={16} aria-hidden="true" />
              Learning goal
            </label>
            <textarea
              autoFocus
              id="learning-goal"
              maxLength={180}
              minLength={3}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Example: Learn Python async well enough to use it in a backend project"
              rows={4}
              value={goal}
            />
          </div>

          <div className="mission-choice-column">
            <div className="control-grid">
              <fieldset className="choice-group">
                <legend>
                  <User size={16} aria-hidden="true" />
                  Current level
                </legend>
                <div className="choice-list level-list">
                  {levels.map(({ id, label, description, Icon }) => {
                    const selected = level === id;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`selection-card ${selected ? "selected" : ""}`}
                        key={id}
                        onClick={() => setLevel(id)}
                        type="button"
                      >
                        <Icon size={20} aria-hidden="true" />
                        <span>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </span>
                        {selected ? <CheckCircle2 size={16} aria-label="Selected" /> : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="choice-group">
                <legend>
                  <Sparkles size={16} aria-hidden="true" />
                  Preferred style
                </legend>
                <div className="choice-list">
                  {styles.map(({ id, label, description, Icon }) => {
                    const selected = style === id;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`selection-card ${selected ? "selected" : ""}`}
                        key={id}
                        onClick={() => setStyle(id)}
                        type="button"
                      >
                        <Icon size={20} aria-hidden="true" />
                        <span>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </span>
                        {selected ? <CheckCircle2 size={16} aria-label="Selected" /> : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="mission-launch-column">
            <div className="time-card">
              <label className="home-field-label" htmlFor="minutes">
                <Clock3 size={16} aria-hidden="true" />
                Available time
              </label>
              <div className="time-meter">
                <span>5m</span>
                <input
                  id="minutes"
                  max={180}
                  min={5}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                  type="range"
                  value={minutes}
                />
                <span>3h</span>
              </div>
              <output className="time-output" htmlFor="minutes">{minutes} minutes</output>
            </div>

            <div className="session-foot">
              {error ? <p className="home-error" role="alert">{error}</p> : null}

              <button className="launch-button" disabled={loading || goal.trim().length < 3} type="submit">
                {loading ? <Loader2 size={20} className="spin" aria-hidden="true" /> : <Zap size={20} aria-hidden="true" />}
                <span>{loading ? "Building your diagnostic" : "Launch Adaptive Session"}</span>
              </button>

              {auth.user ? (
                <p className="sync-note signed-in">
                  <Brain size={17} aria-hidden="true" />
                  Saving progress for {auth.user.displayName || auth.user.email?.split("@")[0] || "signed-in learner"}
                </p>
              ) : (
                <p className="sync-note">
                  <Zap size={17} aria-hidden="true" />
                  Start instantly as guest. Sign in only when you want saved progress.
                </p>
              )}
            </div>
          </div>
        </form>
      </section>

      <footer className="home-footer">
        <span>ConceptMate</span>
        <span>Gemini + learner modeling + visible adaptation logic</span>
      </footer>
    </main>
  );
}
