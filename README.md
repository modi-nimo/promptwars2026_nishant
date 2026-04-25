# ConceptMate

Adaptive learning assistant for the official PromptWars 2026 submission.

ConceptMate diagnoses a learner's current understanding, creates a concept map, teaches one concept at a time, checks mastery, and explains why the next learning step changed.

## Flow

1. The learner starts as a guest or signs in with Google.
2. The learner enters a goal, level, available time, and preferred style.
3. Gemini creates diagnostic questions; deterministic fallback keeps the demo available.
4. The backend scores the diagnostic and builds a learner model plus concept map.
5. Each check updates mastery, weak topics, pace, and the next card.
6. The coach can simplify, review prerequisites, add similar practice, or raise challenge.

## Backend Structure

```text
main.py                    Cloud Run/FastAPI entrypoint
conceptpilot/api.py        FastAPI app factory, routes, CORS, request logging
conceptpilot/models.py     Pydantic API contracts and stored session shape
conceptpilot/service.py    Session, diagnostic, check, and coach orchestration
conceptpilot/adaptive.py   Mastery scoring and adaptation decisions
conceptpilot/gemini.py     Gemini structured JSON calls
conceptpilot/fallback.py   Deterministic no-key/no-quota content
conceptpilot/repository.py Firestore repository with in-memory fallback
conceptpilot/auth.py       Optional Firebase ID token verification
```

## Local Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn main:app --reload --port 8000 --env-file .env
```

For Gemini responses, set `GEMINI_API_KEY` in `.env`. Without it, the fallback generator keeps the full flow working.

Health check:

```bash
curl http://localhost:8000/health
```

## Local Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional Firebase web config enables Google Sign-In. Guest sessions work without Firebase. For real Google login, set the frontend `NEXT_PUBLIC_FIREBASE_*` values and backend `FIREBASE_PROJECT_ID`, then restart both dev servers.

## Tests

```bash
pytest
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
```

The backend tests mock Gemini and cover guest fallback, diagnostics, adaptive checks, coach behavior, invalid flow handling, and session persistence.

## Cloud Run Backend

Create the Gemini secret:

```bash
printf "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
```

Deploy:

```bash
gcloud run deploy conceptpilot-api \
  --source . \
  --region asia-south1 \
  --cpu 1 \
  --memory 1Gi \
  --concurrency 10 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 600 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash,USE_FIRESTORE=true,ENABLE_CLOUD_LOGGING=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,FIREBASE_PROJECT_ID=YOUR_PROJECT_ID \
  --allow-unauthenticated
```

Set `ALLOWED_ORIGINS` to the frontend URL after the UI is deployed.

## Cloud Run Frontend

Deploy from `frontend/`:

```bash
gcloud run deploy conceptpilot-ui \
  --source . \
  --region asia-south1 \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 40 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars NEXT_PUBLIC_API_BASE_URL=https://YOUR_BACKEND_URL \
  --allow-unauthenticated
```

Add Firebase public web config as `NEXT_PUBLIC_FIREBASE_*` env vars if Google Sign-In is enabled.
