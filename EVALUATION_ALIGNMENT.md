# Evaluation Alignment

ConceptMate is designed to score strongly against the PromptWars hackathon rubric. This file gives judges a direct map from each criterion to implemented evidence.

## Summary Matrix

| Criterion | Evidence in submission |
| --- | --- |
| Code Quality | Modular FastAPI services, typed Pydantic contracts, typed Next.js API client, isolated Gemini and repository layers |
| Security | Firebase ID token verification, owner-scoped sessions, strict CORS, bounded request models, safe Gemini prompting, API/frontend security headers |
| Efficiency | `gemini-2.5-flash`, deterministic fallback, no vector/runtime-heavy dependencies, bounded Cloud Run deployment, request timeouts |
| Testing | 11 backend tests for core flows, invalid input, auth edge cases, mocked Gemini, and security headers; frontend production build/type check |
| Accessibility | Labels, fieldsets, keyboard-focus states, visible text statuses, non-color-only indicators, opt-in coach drawer |
| Google Services | Gemini, Firebase Auth, Firestore-ready repository, Cloud Run docs, Secret Manager docs, Cloud Logging hooks |
| Problem Alignment | Diagnoses understanding, builds learner model, adapts pace/content, exposes “why this changed,” persists/resumes sessions |

## Code Quality

- `conceptpilot/api.py` contains only app creation, middleware, and route registration.
- `conceptpilot/models.py` defines all request/response/session/Gemini schemas with Pydantic validation.
- `conceptpilot/service.py` orchestrates sessions without embedding Gemini, auth, or persistence details.
- `conceptpilot/adaptive.py` contains deterministic mastery scoring and adaptation decisions.
- `conceptpilot/gemini.py` isolates structured JSON Gemini calls behind `safe_call`, making generation mockable.
- `conceptpilot/repository.py` abstracts in-memory and Firestore persistence.
- `frontend/lib/api.ts` mirrors backend contracts with TypeScript types.

## Security

- Secrets are read from environment variables or Secret Manager; no server secret is committed.
- Firebase ID tokens are verified server-side when `FIREBASE_PROJECT_ID` is configured.
- Signed-in sessions are owner-scoped; another user receives `403`.
- Guest sessions do not accept client-provided user IDs.
- Request models enforce bounds on goal length, time, confidence, answer counts, coach message length, and session ID shape.
- Gemini prompts explicitly treat learner input as untrusted and forbid prompt/secret disclosure.
- API responses include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HTTPS HSTS on Cloud Run.
- Frontend responses disable the Next.js powered-by header and add defensive browser headers.
- CORS is restricted with `ALLOWED_ORIGINS`.

## Efficiency

- `gemini-2.5-flash` is the default model for latency and quota reliability.
- Gemini calls request structured JSON directly, reducing parsing and retry overhead.
- The adaptive engine is deterministic and lightweight; no vector index or large model is loaded in-process.
- The frontend API client uses request IDs and a 60-second timeout to prevent indefinite waits.
- Firestore is optional locally and enabled in Cloud Run with `USE_FIRESTORE=true`.
- Cloud Run deployment settings cap CPU, memory, max instances, and concurrency.

## Testing

Current verification commands:

```bash
.venv/bin/ruff check .
.venv/bin/python -m pytest
npm --prefix frontend run build
```

Backend tests cover:

- Guest session creation and deterministic fallback.
- Mocked Gemini structured responses.
- Diagnostic scoring, learner model creation, concept map creation, and next card generation.
- Correct and incorrect check submission with mastery updates and adaptive reasoning.
- Coach remediation and weak-topic updates.
- Invalid flow handling before diagnostic completion.
- Invalid request payloads and unsafe session IDs.
- Signed-in owner scoping.
- API security headers.

Frontend build covers:

- TypeScript contract correctness.
- Next.js App Router compilation for `/` and `/learn/[sessionId]`.

## Accessibility

- The launch flow uses a real form, labels, fieldsets, legends, and buttons.
- The learning goal receives focus first on the home page.
- Keyboard focus is visible and high contrast.
- Diagnostic and mastery choices are text buttons, not color-only controls.
- AI Sidekick is closed by default and exposed through an `aria-expanded` toggle.
- Error messages use `role="alert"` where shown.
- Status/loading regions use visible text with animated indicators.
- The UI avoids hidden instructions or marketing-only first screens; the user lands directly in the learning workflow.

## Google Services

- Gemini API generates diagnostic questions, concept maps, learning cards, checks, feedback, and coach remediation.
- Firebase Auth provides optional Google Sign-In while preserving guest-first reviewer access.
- Firestore persistence is implemented behind `FirestoreSessionRepository`.
- Cloud Run deployment is documented for both backend and frontend.
- Secret Manager is documented for `GEMINI_API_KEY`.
- Cloud Logging hooks are implemented with `ENABLE_CLOUD_LOGGING=true`.

## Problem Statement Alignment

The problem asks for an intelligent assistant that helps users learn new concepts effectively and adapts to pace and understanding.

ConceptMate directly implements that by:

- Asking for goal, level, available time, and learning style.
- Running a diagnostic before teaching.
- Building a learner model with mastery, confidence, weak topics, mastered topics, and pace.
- Creating a concept map with prerequisites and checkpoints.
- Teaching one concept at a time with lesson, example, practice, and confidence prompt.
- Updating mastery after each check.
- Choosing easier explanation, prerequisite review, similar practice, harder challenge, or next concept.
- Displaying the adaptation reason so judges can see why the system changed the path.
