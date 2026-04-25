from __future__ import annotations

import os
import uuid

from fastapi import HTTPException

from . import fallback, gemini
from .config import settings
from .models import (
    CoachRequest,
    CoachResponse,
    LearningPathRequest,
    LearningPathResponse,
    ProgressState,
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizQuestion,
)
from .utils import make_ai_status, normalize_text, summarize_exception, utc_now


def build_gemini_learning_path(payload: LearningPathRequest) -> LearningPathResponse:
    goal = normalize_text(payload.goal)
    ai_payload = gemini.generate_learning_path(payload)

    return LearningPathResponse(
        session_id=f"learn_{uuid.uuid4().hex[:12]}",
        goal=goal,
        topic=ai_payload.topic,
        current_level=payload.current_level,
        preferred_style=payload.preferred_style,
        created_at=utc_now(),
        roadmap=ai_payload.roadmap,
        lesson=ai_payload.lesson,
        progress=ProgressState(),
        next_step=ai_payload.next_step,
        ai=make_ai_status(
            provider="gemini",
            model=settings.gemini_model,
            used_google_search=gemini.gemini_search_enabled(),
        ),
    )


def build_learning_path(payload: LearningPathRequest) -> LearningPathResponse:
    try:
        return build_gemini_learning_path(payload)
    except Exception as exc:
        return fallback.build_learning_path(
            payload,
            fallback_reason=f"Gemini unavailable: {summarize_exception(exc)}",
        )


def score_quiz_answer(
    progress: ProgressState,
    payload: QuizAnswerRequest,
    expected_answer: str,
    focus_topic: str,
) -> QuizAnswerResponse:
    selected = normalize_text(payload.selected_option).lower()
    expected = expected_answer.lower()
    is_correct = selected == expected

    progress.answered += 1
    if is_correct:
        progress.correct += 1
        if focus_topic not in progress.mastered_topics:
            progress.mastered_topics.append(focus_topic)
        feedback = "Nice. You chose the answer that shows transfer, not memorization."
        next_prompt = "Keep going with the next quick check."
    else:
        if focus_topic not in progress.weak_topics:
            progress.weak_topics.append(focus_topic)
        feedback = f"Close, but the stronger move is: {expected_answer}."
        next_prompt = "Try the simpler-example coach before moving ahead."

    return QuizAnswerResponse(
        correct=is_correct,
        feedback=feedback,
        progress=progress,
        next_prompt=next_prompt,
    )


def answer_quiz(
    session_learning_path: LearningPathResponse,
    question_lookup: dict[str, QuizQuestion],
    payload: QuizAnswerRequest,
) -> QuizAnswerResponse:
    question = question_lookup.get(payload.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Quiz question not found")

    return score_quiz_answer(
        progress=session_learning_path.progress,
        payload=payload,
        expected_answer=question.answer,
        focus_topic=question.focus_topic,
    )


def build_gemini_coach_response(
    learning_path: LearningPathResponse,
    payload: CoachRequest,
    weak_topic: str,
) -> CoachResponse:
    ai_payload = gemini.generate_coach_response(learning_path, payload, weak_topic)

    return CoachResponse(
        coach_note=normalize_text(ai_payload.coach_note),
        simpler_example=normalize_text(ai_payload.simpler_example),
        check_question=normalize_text(ai_payload.check_question),
        weak_topic=normalize_text(ai_payload.weak_topic),
        ai=make_ai_status(
            provider="gemini",
            model=settings.gemini_model,
            used_google_search=gemini.gemini_search_enabled(),
        ),
    )


def reframe_confusion(learning_path: LearningPathResponse, payload: CoachRequest) -> CoachResponse:
    weak_topic = learning_path.progress.weak_topics[0] if learning_path.progress.weak_topics else learning_path.topic

    if weak_topic not in learning_path.progress.weak_topics:
        learning_path.progress.weak_topics.append(weak_topic)

    try:
        coach_response = build_gemini_coach_response(learning_path, payload, weak_topic)
    except Exception as exc:
        coach_response = fallback.build_coach_response(
            learning_path,
            weak_topic,
            fallback_reason=f"Gemini unavailable: {summarize_exception(exc)}",
        )

    if coach_response.weak_topic not in learning_path.progress.weak_topics:
        learning_path.progress.weak_topics.append(coach_response.weak_topic)

    return coach_response


def health_payload() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "learnmate-api",
        "ai_provider": "gemini" if os.getenv("GEMINI_API_KEY") else "fallback",
        "gemini_model": settings.gemini_model,
    }
