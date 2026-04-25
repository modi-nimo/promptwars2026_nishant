# Evaluation Alignment

ConceptMate is aligned to the hackathon criteria in `Hackathon_Guidelines.MD`.

## Code Quality

- FastAPI is split into focused modules for routes, models, service orchestration, adaptation logic, Gemini, fallback content, auth, and persistence.
- Pydantic models define every request, response, Gemini payload, and stored session shape.
- The Next.js UI keeps backend contracts typed in `frontend/lib/api.ts`.
- Gemini calls are isolated behind a service layer and mocked in tests.

## Security

- API keys are read from `.env` or Secret Manager, never hard-coded.
- Firebase ID tokens are verified server-side when Firebase is configured.
- Guest sessions work without trusting client-provided user ids.
- Learner input is treated as untrusted data in Gemini prompts.
- CORS is restricted with `ALLOWED_ORIGINS`.
- Pydantic bounds limit goal length, answer lists, confidence, and time values.

## Efficiency

- `gemini-2.5-flash` is the default model for latency and quota reliability.
- Firestore is optional and the service falls back to memory locally.
- The adaptive engine is deterministic and lightweight; no vector index is loaded.
- Cloud Run deployment caps concurrency and max instances for cost control.

## Testing

- Backend tests cover session creation, diagnostic scoring, adaptive mastery updates, coach responses, mocked Gemini, and invalid flow handling.
- Tests avoid live Gemini calls, so they are stable and quota-safe.
- The frontend production build validates TypeScript and App Router pages.

## Accessibility

- Inputs and controls use visible labels, semantic fieldsets, and focus states.
- Status and error updates use live regions or alert roles.
- Adaptation state is conveyed with text and icons, not color alone.
- Layouts respond across desktop and mobile without overlapping controls.

## Google Services

- Gemini API powers diagnostics, concept maps, learning cards, and coaching.
- Firebase Auth supports optional Google Sign-In.
- Firestore persists sessions when `USE_FIRESTORE=true`.
- Cloud Run deployment is documented for backend and frontend.
- Secret Manager stores `GEMINI_API_KEY`.
- Cloud Logging can be enabled with `ENABLE_CLOUD_LOGGING=true`.
