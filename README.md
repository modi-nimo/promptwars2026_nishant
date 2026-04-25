# LearnMate

Example-based learning companion for the PromptWars 2026 hackathon, powered by Gemini when a `GEMINI_API_KEY` is configured.

## Flow

1. The learner enters a goal.
2. The learner chooses a current level.
3. The style is fixed to examples for the MVP.
4. Gemini creates a roadmap, first lesson, example walkthrough, and quick check.
5. Quiz answers update mastered topics and weak spots.
6. Gemini can reframe confusion with a smaller example.

If Gemini is not configured or the model call fails, the API falls back to a deterministic local generator so the demo still runs.

## Local Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your AI Studio key to GEMINI_API_KEY in .env for real Gemini responses.
uvicorn main:app --reload --port 8000 --env-file .env
```

Health check:

```bash
curl http://localhost:8000/health
```

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Local Frontend

Node is required for the Next.js UI.

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Cloud Run Backend

Recommended hackathon backend settings:

Create a Secret Manager secret for the AI Studio key first:

```bash
printf "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
```

```bash
gcloud run deploy learnmate-api \
  --source . \
  --region asia-south1 \
  --cpu 1 \
  --memory 1Gi \
  --concurrency 10 \
  --min-instances 1 \
  --max-instances 3 \
  --timeout 600 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash,GEMINI_ENABLE_SEARCH=false \
  --allow-unauthenticated
```

During development, use `--min-instances 0`.

## Cloud Run Frontend

Deploy from the frontend directory and point it at the backend URL:

```bash
cd frontend
gcloud run deploy learnmate-ui \
  --source . \
  --region asia-south1 \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 40 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars API_BASE_URL=https://YOUR_BACKEND_URL \
  --allow-unauthenticated
```

For the backend, set `ALLOWED_ORIGINS` to the frontend URL after deploy.
