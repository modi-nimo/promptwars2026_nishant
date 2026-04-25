from __future__ import annotations

import uuid

from fastapi import HTTPException

from . import adaptive, fallback, gemini
from .auth import UserContext, require_session_access
from .models import (
    AdaptiveAction,
    CheckSubmitRequest,
    CheckSubmitResponse,
    CoachRequest,
    CoachResponse,
    DiagnosticSubmitRequest,
    DiagnosticSubmitResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionSnapshot,
)
from .repository import SessionRepository, session_repository
from .utils import utc_now


class ConceptPilotService:
    def __init__(self, repository: SessionRepository = session_repository) -> None:
        self.repository = repository

    def create_session(self, payload: SessionCreateRequest, user: UserContext) -> SessionCreateResponse:
        questions, ai = gemini.safe_call(
            gemini.generate_diagnostics,
            payload.goal,
            payload.current_level,
            payload.time_available_minutes,
            payload.preferred_style,
        )
        if not questions:
            questions, ai = fallback.diagnostic_questions(
                payload.goal,
                payload.current_level,
                ai.fallback_reason if ai else "Gemini unavailable",
            )

        now = utc_now()
        session = SessionSnapshot(
            session_id=f"cp_{uuid.uuid4().hex[:14]}",
            auth_mode=user.auth_mode,
            owner_id=user.user_id,
            goal=payload.goal,
            current_level=payload.current_level,
            preferred_style=payload.preferred_style,
            time_available_minutes=payload.time_available_minutes,
            created_at=now,
            updated_at=now,
            diagnostic_questions=questions,
            ai=ai,
        )
        self.repository.save(session)
        return SessionCreateResponse(
            session_id=session.session_id,
            auth_mode=session.auth_mode,
            diagnostic_questions=questions,
            ai=ai,
        )

    def get_session(self, session_id: str, user: UserContext) -> SessionSnapshot:
        session = self.repository.get(session_id)
        require_session_access(session, user)
        return session

    def submit_diagnostic(
        self,
        payload: DiagnosticSubmitRequest,
        user: UserContext,
    ) -> DiagnosticSubmitResponse:
        session = self.get_session(payload.session_id, user)
        learner_model, answer_results = adaptive.score_diagnostic(session, payload.answers)

        concepts, map_ai = gemini.safe_call(
            gemini.generate_concept_map,
            session.goal,
            session.current_level,
            learner_model,
        )
        if not concepts:
            concepts = fallback.concept_map(session.goal)
            map_ai = map_ai or fallback.ai_status("Gemini unavailable; deterministic concept map used.")

        concepts = adaptive.apply_diagnostic_to_concepts(concepts, learner_model, answer_results)
        learner_model.mastery_score = round(
            sum(concept.mastery for concept in concepts) / len(concepts),
            2,
        )
        target = adaptive.select_concept(concepts, learner_model)
        action = adaptive.action_after_diagnostic(learner_model, target)
        reason = adaptive.reason_after_diagnostic(learner_model, target, action)

        card, card_ai = gemini.safe_call(
            gemini.generate_learning_card,
            session.goal,
            target,
            learner_model,
            session.preferred_style,
            action,
            reason,
        )
        if not card:
            card, card_ai = fallback.learning_card(
                session.goal,
                target,
                action,
                session.preferred_style,
                card_ai.fallback_reason if card_ai else "Gemini unavailable",
            )

        session.learner_model = learner_model
        session.concept_map = concepts
        session.current_card = card
        session.ai = card_ai if card_ai.provider == "gemini" else map_ai
        session.updated_at = utc_now()
        session.attempts.append(
            {
                "type": "diagnostic",
                "answers": [answer.model_dump(mode="json") for answer in payload.answers],
                "adaptive_reason": reason,
                "created_at": session.updated_at,
            }
        )
        self.repository.save(session)
        return DiagnosticSubmitResponse(
            learner_model=learner_model,
            concept_map=concepts,
            next_card=card,
        )

    def submit_check(self, payload: CheckSubmitRequest, user: UserContext) -> CheckSubmitResponse:
        session = self.get_session(payload.session_id, user)
        if not session.current_card or not session.learner_model or not session.concept_map:
            raise HTTPException(status_code=409, detail="Complete the diagnostic before submitting checks")

        is_correct = adaptive.score_check(session.current_card, payload)
        mastery_delta, action, reason, target = adaptive.update_after_check(session, payload, is_correct)

        card, ai = gemini.safe_call(
            gemini.generate_learning_card,
            session.goal,
            target,
            session.learner_model,
            session.preferred_style,
            action,
            reason,
        )
        if not card:
            card, ai = fallback.learning_card(
                session.goal,
                target,
                action,
                session.preferred_style,
                ai.fallback_reason if ai else "Gemini unavailable",
            )

        feedback = (
            "Correct. You transferred the idea, so the tutor can safely adjust the path."
            if is_correct
            else f"Not quite. The stronger answer is: {session.current_card.check_question.answer}."
        )
        session.current_card = card
        session.ai = ai
        session.updated_at = utc_now()
        session.attempts.append(
            {
                "type": "check",
                "card_id": payload.card_id,
                "question_id": payload.question_id,
                "selected_option": payload.selected_option,
                "correct": is_correct,
                "mastery_delta": mastery_delta,
                "adaptive_reason": reason,
                "created_at": session.updated_at,
            }
        )
        self.repository.save(session)
        return CheckSubmitResponse(
            correctness="correct" if is_correct else "incorrect",
            feedback=feedback,
            mastery_delta=mastery_delta,
            adaptive_reason=reason,
            learner_model=session.learner_model,
            concept_map=session.concept_map,
            next_card=card,
        )

    def coach(self, payload: CoachRequest, user: UserContext) -> CoachResponse:
        session = self.get_session(payload.session_id, user)
        if not session.learner_model:
            raise HTTPException(status_code=409, detail="Complete the diagnostic before using the coach")

        if session.current_card and session.current_card.check_question.focus_topic not in session.learner_model.weak_topics:
            session.learner_model.weak_topics.append(session.current_card.check_question.focus_topic)

        coach_payload, ai = gemini.safe_call(
            gemini.generate_coach,
            session.goal,
            payload.message,
            session.learner_model,
            session.current_card,
            session.preferred_style,
        )
        if coach_payload:
            next_card = coach_payload.card
            suggested_action = coach_payload.suggested_action
            response_text = coach_payload.coach_response
        else:
            suggested_action = AdaptiveAction.easier_explanation
            response_text = fallback.coach_response(session.goal, session.learner_model.weak_topics)
            target = next(
                (
                    item
                    for item in session.concept_map
                    if session.current_card and item.id == session.current_card.concept_id
                ),
                session.concept_map[0],
            )
            next_card, _ = fallback.learning_card(
                session.goal,
                target,
                suggested_action,
                session.preferred_style,
                ai.fallback_reason if ai else "Gemini unavailable",
            )

        if next_card:
            session.current_card = next_card

        session.updated_at = utc_now()
        session.attempts.append(
            {
                "type": "coach",
                "message": payload.message,
                "suggested_action": suggested_action.value if suggested_action else "easier_explanation",
                "created_at": session.updated_at,
            }
        )
        self.repository.save(session)
        return CoachResponse(
            coach_response=response_text,
            suggested_action=suggested_action,
            updated_weak_topics=session.learner_model.weak_topics,
            next_card=session.current_card if next_card else None,
            ai=ai,
        )


conceptpilot_service = ConceptPilotService()
