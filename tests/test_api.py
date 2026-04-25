from fastapi.testclient import TestClient

import main
from conceptpilot import gemini
from conceptpilot.models import AIStatus, DiagnosticQuestion
from conceptpilot.repository import session_repository


client = TestClient(main.app)


def setup_function() -> None:
    session_repository.clear()


def _create_session(goal: str = "Learn Python async"):
    return client.post(
        "/api/sessions",
        json={
            "goal": goal,
            "current_level": "Beginner",
            "time_available_minutes": 25,
            "preferred_style": "Examples",
        },
    )


def _submit_diagnostic(session_payload: dict, all_correct: bool = False):
    answers = []
    for question in session_payload["diagnostic_questions"]:
        answers.append(
            {
                "question_id": question["id"],
                "selected_option": question["answer"] if all_correct else question["options"][-1],
                "confidence": 5 if all_correct else 2,
            }
        )

    return client.post(
        "/api/diagnostic/submit",
        json={"session_id": session_payload["session_id"], "answers": answers},
    )


def test_session_creation_uses_guest_fallback_without_gemini(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = _create_session()

    assert response.status_code == 200
    payload = response.json()
    assert payload["auth_mode"] == "guest"
    assert payload["ai"]["provider"] == "fallback"
    assert len(payload["diagnostic_questions"]) == 4
    assert payload["diagnostic_questions"][0]["answer"] in payload["diagnostic_questions"][0]["options"]


def test_diagnostic_creates_learner_model_concept_map_and_first_card(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    session_payload = _create_session().json()

    response = _submit_diagnostic(session_payload, all_correct=False)

    assert response.status_code == 200
    payload = response.json()
    assert payload["learner_model"]["pace"] == "slower"
    assert len(payload["concept_map"]) >= 3
    assert payload["next_card"]["adaptive_action"] in {"easier_explanation", "prerequisite_review"}
    assert payload["next_card"]["check_question"]["answer"] in payload["next_card"]["check_question"]["options"]


def test_check_answer_updates_mastery_and_explains_adaptation(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    session_payload = _create_session().json()
    diagnostic_payload = _submit_diagnostic(session_payload, all_correct=True).json()
    card = diagnostic_payload["next_card"]

    response = client.post(
        "/api/checks/submit",
        json={
            "session_id": session_payload["session_id"],
            "card_id": card["id"],
            "question_id": card["check_question"]["id"],
            "selected_option": card["check_question"]["answer"],
            "confidence": 5,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["correctness"] == "correct"
    assert payload["mastery_delta"] > 0
    assert "ConceptMate" in payload["adaptive_reason"]
    assert payload["learner_model"]["mastery_score"] >= diagnostic_payload["learner_model"]["mastery_score"]


def test_incorrect_low_confidence_check_returns_easier_card(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    session_payload = _create_session().json()
    diagnostic_payload = _submit_diagnostic(session_payload, all_correct=True).json()
    card = diagnostic_payload["next_card"]
    wrong_option = next(
        option for option in card["check_question"]["options"] if option != card["check_question"]["answer"]
    )

    response = client.post(
        "/api/checks/submit",
        json={
            "session_id": session_payload["session_id"],
            "card_id": card["id"],
            "question_id": card["check_question"]["id"],
            "selected_option": wrong_option,
            "confidence": 1,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["correctness"] == "incorrect"
    assert payload["mastery_delta"] < 0
    assert payload["next_card"]["adaptive_action"] == "easier_explanation"


def test_coach_updates_weak_topics_and_returns_card(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    session_payload = _create_session().json()
    _submit_diagnostic(session_payload, all_correct=True)

    response = client.post(
        "/api/coach",
        json={
            "session_id": session_payload["session_id"],
            "message": "I am confused. Please make this simpler.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["suggested_action"] == "easier_explanation"
    assert payload["updated_weak_topics"]
    assert payload["next_card"]["adaptive_action"] == "easier_explanation"


def test_check_before_diagnostic_is_rejected(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    session_payload = _create_session().json()

    response = client.post(
        "/api/checks/submit",
        json={
            "session_id": session_payload["session_id"],
            "card_id": "missing",
            "question_id": "missing",
            "selected_option": "A",
        },
    )

    assert response.status_code == 409


def test_session_creation_can_use_mocked_gemini(monkeypatch) -> None:
    def fake_generate_diagnostics(goal, level, minutes, style):
        return [
            DiagnosticQuestion(
                id=f"diag-{index}",
                concept_id=f"concept-{index}",
                prompt=f"Question {index}?",
                options=["A", "B", "C", "D"],
                answer="A",
                rationale="A is the best diagnostic signal.",
                difficulty=1,
            )
            for index in range(1, 5)
        ], AIStatus(provider="gemini", model="test-gemini")

    monkeypatch.setattr(gemini, "generate_diagnostics", fake_generate_diagnostics)

    response = _create_session("Learn Cloud Run basics")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ai"]["provider"] == "gemini"
    assert payload["diagnostic_questions"][0]["concept_id"] == "concept-1"
