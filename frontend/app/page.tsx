"use client";

import {
  ArrowRight,
  Brain,
  Clock3,
  Gauge,
  GraduationCap,
  Loader2,
  LogIn,
  LogOut,
  Sparkles
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CurrentLevel,
  PreferredStyle,
  createSession
} from "@/lib/api";
import { useFirebaseUser } from "@/lib/firebase";

const levels: CurrentLevel[] = ["Beginner", "Intermediate", "Advanced"];
const styles: PreferredStyle[] = ["Examples", "Visual", "Socratic", "Hands-on"];

export default function Home() {
  const router = useRouter();
  const auth = useFirebaseUser();
  const [goal, setGoal] = useState("Learn Python async with practical examples");
  const [level, setLevel] = useState<CurrentLevel>("Beginner");
  const [style, setStyle] = useState<PreferredStyle>("Examples");
  const [minutes, setMinutes] = useState(25);
  const [loading, setLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await auth.token();
      const session = await createSession(
        {
          goal,
          current_level: level,
          time_available_minutes: minutes,
          preferred_style: style
        },
        token
      );
      router.push(`/learn/${session.session_id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start session");
    } finally {
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
    <main className="app-shell">
      <a className="skip-link" href="#session-form">
        Skip to setup
      </a>
      <section className="start-grid" aria-labelledby="app-title">
        <div className="start-copy">
          <div className="brand-row">
            <span className="brand-mark" aria-hidden="true">
              <GraduationCap size={24} />
            </span>
            <div>
              <p className="eyebrow">PromptWars 2026</p>
              <h1 id="app-title">ConceptPilot</h1>
            </div>
          </div>

          <div className="signal-panel" aria-label="Session signals">
            <div>
              <Brain size={20} aria-hidden="true" />
              <span>Diagnostic first</span>
            </div>
            <div>
              <Gauge size={20} aria-hidden="true" />
              <span>Adaptive pace</span>
            </div>
            <div>
              <Sparkles size={20} aria-hidden="true" />
              <span>Gemini assisted</span>
            </div>
          </div>
        </div>

        <form className="setup-panel" id="session-form" onSubmit={startSession}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">New session</p>
              <h2>Learning setup</h2>
            </div>
            <button
              className="icon-text-button secondary"
              disabled={!auth.enabled || auth.loading || authBusy}
              onClick={toggleSignIn}
              type="button"
            >
              {authBusy || auth.loading ? (
                <Loader2 size={18} className="spin" aria-hidden="true" />
              ) : auth.user ? (
                <LogOut size={18} aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              {auth.user ? "Sign out" : "Google"}
            </button>
          </div>

          {auth.user ? (
            <p className="auth-note">Saving progress for {auth.user.displayName || auth.user.email}</p>
          ) : (
            <p className="auth-note">Guest session</p>
          )}

          <label className="field-label" htmlFor="goal">
            Goal
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            minLength={3}
            maxLength={180}
            rows={4}
            required
          />

          <fieldset className="segmented-field">
            <legend>Current level</legend>
            <div className="segmented-control">
              {levels.map((option) => (
                <button
                  aria-pressed={level === option}
                  className={level === option ? "selected" : ""}
                  key={option}
                  onClick={() => setLevel(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="form-row">
            <label className="field-label compact" htmlFor="minutes">
              <Clock3 size={18} aria-hidden="true" />
              Time
            </label>
            <input
              id="minutes"
              max={180}
              min={5}
              onChange={(event) => setMinutes(Number(event.target.value))}
              type="number"
              value={minutes}
            />
          </div>

          <label className="field-label" htmlFor="style">
            Style
          </label>
          <select id="style" value={style} onChange={(event) => setStyle(event.target.value as PreferredStyle)}>
            {styles.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
            Start diagnostic
          </button>
        </form>
      </section>
    </main>
  );
}

