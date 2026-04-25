from fastapi.testclient import TestClient

import main
from learnmate import gemini
from learnmate.models import (
    ExampleBlock,
    GeminiLearningPath,
    Lesson,
    QuizQuestion,
    RoadmapItem,
)
from learnmate.session_store import session_store


client = TestClient(main.app)


def setup_function() -> None:
    session_store.clear()


def test_learning_path_falls_back_without_gemini_key(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = client.post(
        "/api/learning-path",
        json={
            "goal": "Learn Python functions",
            "current_level": "Beginner",
            "preferred_style": "Examples",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ai"]["provider"] == "fallback"
    assert payload["ai"]["fallback_reason"].startswith("Gemini unavailable")
    assert len(payload["roadmap"]) == 4
    assert len(payload["lesson"]["quiz"]) == 2


def test_learning_path_uses_gemini_when_available(monkeypatch) -> None:
    def fake_call_gemini_json(prompt, schema_model):
        assert "Learner input JSON" in prompt
        return GeminiLearningPath(
            topic="Cloud Run Basics",
            roadmap=[
                RoadmapItem(
                    id=f"map-{index}",
                    title=f"Step {index}",
                    outcome="Understand the practical idea.",
                    checkpoint="Explain it with one example.",
                    estimate_minutes=8,
                )
                for index in range(1, 5)
            ],
            lesson=Lesson(
                title="First Session: Cloud Run Basics",
                objective="Understand Cloud Run with one deployment example.",
                explanation=["Cloud Run runs containers without managing servers."],
                example=ExampleBlock(
                    title="Deploy A Small API",
                    setup="Imagine shipping a FastAPI service.",
                    walkthrough=["Build a container.", "Deploy it to Cloud Run."],
                    takeaway="Cloud Run handles the server layer for you.",
                    code_sample="gcloud run deploy learnmate-api --source .",
                ),
                quiz=[
                    QuizQuestion(
                        id="quiz-1",
                        prompt="What does Cloud Run run?",
                        options=["Containers", "Spreadsheets", "Emails", "Images only"],
                        answer="Containers",
                        focus_topic="Cloud Run mental model",
                    ),
                    QuizQuestion(
                        id="quiz-2",
                        prompt="What is one benefit?",
                        options=["Managed scaling", "Manual servers", "No HTTP", "No logs"],
                        answer="Managed scaling",
                        focus_topic="managed scaling",
                    ),
                ],
            ),
            next_step="Answer the quick check to test your model.",
        )

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gemini, "call_gemini_json", fake_call_gemini_json)

    response = client.post(
        "/api/learning-path",
        json={
            "goal": "Learn Cloud Run deployment",
            "current_level": "Beginner",
            "preferred_style": "Examples",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ai"]["provider"] == "gemini"
    assert payload["topic"] == "Cloud Run Basics"
    assert payload["lesson"]["quiz"][0]["answer"] == "Containers"


def test_quiz_answer_updates_progress(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    learning_response = client.post(
        "/api/learning-path",
        json={
            "goal": "Learn algebra",
            "current_level": "Beginner",
            "preferred_style": "Examples",
        },
    )
    learning_payload = learning_response.json()
    first_question = learning_payload["lesson"]["quiz"][0]

    answer_response = client.post(
        "/api/quiz/answer",
        json={
            "session_id": learning_payload["session_id"],
            "question_id": first_question["id"],
            "selected_option": first_question["answer"],
        },
    )

    assert answer_response.status_code == 200
    answer_payload = answer_response.json()
    assert answer_payload["correct"] is True
    assert answer_payload["progress"]["answered"] == 1
    assert answer_payload["progress"]["correct"] == 1
    assert first_question["focus_topic"] in answer_payload["progress"]["mastered_topics"]
