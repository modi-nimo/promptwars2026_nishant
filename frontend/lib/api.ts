export type CurrentLevel = "Beginner" | "Intermediate" | "Advanced";
export type PreferredStyle = "Examples" | "Visual" | "Socratic" | "Hands-on";
export type AuthMode = "guest" | "google";
export type AdaptiveAction =
  | "easier_explanation"
  | "prerequisite_review"
  | "similar_practice"
  | "harder_challenge"
  | "next_concept";

export type AIStatus = {
  provider: string;
  model: string | null;
  fallback_reason: string | null;
};

export type DiagnosticQuestion = {
  id: string;
  concept_id: string;
  prompt: string;
  options: string[];
  answer: string;
  rationale: string;
  difficulty: number;
};

export type LearnerModel = {
  level: CurrentLevel;
  pace: "slower" | "steady" | "fast";
  confidence: number;
  mastery_score: number;
  weak_topics: string[];
  mastered_topics: string[];
};

export type ConceptNode = {
  id: string;
  title: string;
  summary: string;
  prerequisite: boolean;
  mastery: number;
  status: "not_started" | "in_progress" | "weak" | "mastered";
};

export type LearningCard = {
  id: string;
  concept_id: string;
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
  check_question: {
    id: string;
    prompt: string;
    options: string[];
    answer: string;
    focus_topic: string;
  };
  estimated_minutes: number;
  adaptive_action: AdaptiveAction;
};

export type SessionSnapshot = {
  session_id: string;
  auth_mode: AuthMode;
  owner_id: string | null;
  goal: string;
  current_level: CurrentLevel;
  preferred_style: PreferredStyle;
  time_available_minutes: number;
  created_at: string;
  updated_at: string;
  diagnostic_questions: DiagnosticQuestion[];
  learner_model: LearnerModel | null;
  concept_map: ConceptNode[];
  current_card: LearningCard | null;
  attempts: Record<string, unknown>[];
  ai: AIStatus;
};

export type CreateSessionPayload = {
  goal: string;
  current_level: CurrentLevel;
  time_available_minutes: number;
  preferred_style: PreferredStyle;
};

export type CreateSessionResponse = {
  session_id: string;
  auth_mode: AuthMode;
  diagnostic_questions: DiagnosticQuestion[];
  ai: AIStatus;
};

export type DiagnosticSubmitResponse = {
  learner_model: LearnerModel;
  concept_map: ConceptNode[];
  next_card: LearningCard;
};

export type CheckSubmitResponse = {
  correctness: "correct" | "incorrect";
  feedback: string;
  mastery_delta: number;
  adaptive_reason: string;
  learner_model: LearnerModel;
  concept_map: ConceptNode[];
  next_card: LearningCard;
};

export type CoachResponse = {
  coach_response: string;
  suggested_action: AdaptiveAction;
  updated_weak_topics: string[];
  next_card: LearningCard | null;
  ai: AIStatus;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 60000;

function requestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `web_${crypto.randomUUID()}`;
  }
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function requestJson<TResponse, TPayload = undefined>(
  path: string,
  options: {
    method?: "GET" | "POST";
    payload?: TPayload;
    token?: string | null;
  } = {}
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-ID": requestId()
  };
  if (options.payload !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.payload === undefined ? undefined : JSON.stringify(options.payload),
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("ConceptMate timed out while contacting the adaptive engine. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return response.json() as Promise<TResponse>;
}

export function createSession(payload: CreateSessionPayload, token?: string | null) {
  return requestJson<CreateSessionResponse, CreateSessionPayload>("/api/sessions", {
    method: "POST",
    payload,
    token
  });
}

export function getSession(sessionId: string, token?: string | null) {
  return requestJson<SessionSnapshot>(`/api/sessions/${sessionId}`, { token });
}

export function submitDiagnostic(
  payload: {
    session_id: string;
    answers: { question_id: string; selected_option: string; confidence: number }[];
  },
  token?: string | null
) {
  return requestJson<DiagnosticSubmitResponse, typeof payload>("/api/diagnostic/submit", {
    method: "POST",
    payload,
    token
  });
}

export function submitCheck(
  payload: {
    session_id: string;
    card_id: string;
    question_id: string;
    selected_option: string;
    confidence: number;
  },
  token?: string | null
) {
  return requestJson<CheckSubmitResponse, typeof payload>("/api/checks/submit", {
    method: "POST",
    payload,
    token
  });
}

export function askCoach(payload: { session_id: string; message: string }, token?: string | null) {
  return requestJson<CoachResponse, typeof payload>("/api/coach", {
    method: "POST",
    payload,
    token
  });
}
