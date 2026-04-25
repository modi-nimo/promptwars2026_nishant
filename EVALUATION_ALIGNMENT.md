# Evaluation Alignment

This project is aligned to the hackathon criteria in `Hackathon_Guidelines.MD`.

## Code Quality

- FastAPI uses Pydantic request and response models for typed API contracts.
- The Next.js UI keeps API payload types explicit in `frontend/app/page.tsx`.
- Gemini responses are normalized before being stored or returned.
- Local fallback generation keeps the demo resilient if Gemini quota is unavailable.

## Security

- API keys are read from `.env` or Secret Manager, not hard-coded.
- `.env` is ignored by git and Docker build context.
- Gemini errors are redacted before being returned to the UI.
- Learner prompts are treated as untrusted data in Gemini instructions.
- CORS defaults to local frontend origins and can be restricted with `ALLOWED_ORIGINS`.
- Inputs are bounded with Pydantic length and list constraints.
- Frontend dependencies are audited with `npm audit --omit=dev`.

## Efficiency

- The Cloud Run backend uses a lightweight FastAPI service and calls Gemini on demand.
- Default model is `gemini-2.5-flash` for lower latency and better quota reliability.
- No large model or vector index is loaded in memory.
- Cloud Run settings in `README.md` cap concurrency and max instances for cost control.

## Testing

- Backend tests cover fallback mode, Gemini mode through a mocked model response, and quiz progress.
- Tests avoid live Gemini calls so they are fast, stable, and quota-safe.
- Run tests with:

```bash
pip install -r requirements-dev.txt
pytest
npm --prefix frontend audit --omit=dev
npm --prefix frontend run build
```

## Accessibility

- Goal input has a visible label.
- Current level uses a segmented radio group with `aria-checked`.
- Loading buttons expose `aria-busy`.
- Learning content is announced with `aria-live`.
- Keyboard users get visible focus states and a skip link.
- Color is not the only state indicator; answer options also use icons and text feedback.

## Google Services

- Gemini API is used for roadmap, lesson, quiz, and coach generation.
- `google-genai` is the official Gemini SDK dependency.
- Cloud Run deployment is documented for backend and frontend.
- Secret Manager setup is documented for `GEMINI_API_KEY`.
