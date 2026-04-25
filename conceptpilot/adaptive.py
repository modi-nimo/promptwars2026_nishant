from __future__ import annotations

from .fallback import learner_model as fallback_learner_model
from .models import (
    AdaptiveAction,
    CheckSubmitRequest,
    ConceptNode,
    ConceptStatus,
    DiagnosticAnswer,
    DiagnosticQuestion,
    LearnerModel,
    LearningCard,
    SessionSnapshot,
)
from .utils import normalize_text


def _matches(selected: str, expected: str) -> bool:
    return normalize_text(selected).casefold() == normalize_text(expected).casefold()


def score_diagnostic(
    session: SessionSnapshot,
    answers: list[DiagnosticAnswer],
) -> tuple[LearnerModel, dict[str, bool]]:
    question_lookup: dict[str, DiagnosticQuestion] = {
        question.id: question for question in session.diagnostic_questions
    }
    answer_results: dict[str, bool] = {}
    confidence_total = 0
    weak_topics: list[str] = []

    for answer in answers:
        question = question_lookup.get(answer.question_id)
        if question is None:
            continue
        is_correct = _matches(answer.selected_option, question.answer)
        answer_results[question.id] = is_correct
        confidence_total += answer.confidence
        if not is_correct and question.concept_id not in weak_topics:
            weak_topics.append(question.concept_id)

    answered_count = max(len(answer_results), 1)
    score = sum(1 for is_correct in answer_results.values() if is_correct) / answered_count
    confidence = ((confidence_total / answered_count) - 1) / 4
    model = fallback_learner_model(
        level=session.current_level,
        score=score,
        confidence=max(0.0, min(confidence, 1.0)),
        weak_topics=weak_topics,
    )
    return model, answer_results


def apply_diagnostic_to_concepts(
    concepts: list[ConceptNode],
    learner_model: LearnerModel,
    answer_results: dict[str, bool],
) -> list[ConceptNode]:
    if not concepts:
        return concepts

    score = learner_model.mastery_score
    for index, concept in enumerate(concepts):
        baseline = max(0.0, min(0.85, score - (index * 0.08)))
        concept.mastery = round(baseline, 2)
        if concept.id in learner_model.weak_topics or (
            index == 0 and learner_model.pace == "slower"
        ):
            concept.status = ConceptStatus.weak
            concept.mastery = min(concept.mastery, 0.35)
        elif concept.mastery >= 0.75:
            concept.status = ConceptStatus.mastered
            if concept.title not in learner_model.mastered_topics:
                learner_model.mastered_topics.append(concept.title)
        elif index == 0 or concept.mastery > 0:
            concept.status = ConceptStatus.in_progress

    if not answer_results:
        concepts[0].status = ConceptStatus.in_progress
    return concepts


def select_concept(concepts: list[ConceptNode], learner_model: LearnerModel) -> ConceptNode:
    weak = next((concept for concept in concepts if concept.status == ConceptStatus.weak), None)
    if weak:
        return weak

    if learner_model.pace == "fast":
        challenge = next((concept for concept in concepts if not concept.prerequisite), None)
        if challenge:
            return challenge

    return next(
        (concept for concept in concepts if concept.status != ConceptStatus.mastered),
        concepts[0],
    )


def action_after_diagnostic(learner_model: LearnerModel, concept: ConceptNode) -> AdaptiveAction:
    if learner_model.pace == "slower" or concept.status == ConceptStatus.weak:
        return AdaptiveAction.prerequisite_review if concept.prerequisite else AdaptiveAction.easier_explanation
    if learner_model.pace == "fast":
        return AdaptiveAction.harder_challenge
    return AdaptiveAction.next_concept


def reason_after_diagnostic(learner_model: LearnerModel, concept: ConceptNode, action: AdaptiveAction) -> str:
    if action == AdaptiveAction.harder_challenge:
        return "Diagnostic answers and confidence were strong, so ConceptMate is increasing challenge."
    if action == AdaptiveAction.prerequisite_review:
        return f"The diagnostic exposed a gap around {concept.title}, so ConceptMate is reviewing the prerequisite first."
    if action == AdaptiveAction.easier_explanation:
        return f"The learner model marked {concept.title} as weak, so ConceptMate is slowing down with a simpler explanation."
    return f"The learner is ready for {concept.title}, so ConceptMate is continuing at a steady pace."


def score_check(card: LearningCard, payload: CheckSubmitRequest) -> bool:
    return card.check_question.id == payload.question_id and _matches(
        payload.selected_option,
        card.check_question.answer,
    )


def update_after_check(
    session: SessionSnapshot,
    payload: CheckSubmitRequest,
    is_correct: bool,
) -> tuple[float, AdaptiveAction, str, ConceptNode]:
    if session.learner_model is None or session.current_card is None:
        raise ValueError("Session is missing an active learning card")

    concept = next(
        (item for item in session.concept_map if item.id == session.current_card.concept_id),
        session.concept_map[0],
    )
    confidence_bonus = (payload.confidence - 3) * 0.02
    mastery_delta = round((0.18 + confidence_bonus) if is_correct else (-0.12 + confidence_bonus), 2)
    concept.mastery = round(max(0.0, min(1.0, concept.mastery + mastery_delta)), 2)

    if is_correct:
        if concept.mastery >= 0.72:
            concept.status = ConceptStatus.mastered
            if concept.title not in session.learner_model.mastered_topics:
                session.learner_model.mastered_topics.append(concept.title)
        else:
            concept.status = ConceptStatus.in_progress
        if concept.title in session.learner_model.weak_topics:
            session.learner_model.weak_topics.remove(concept.title)
    else:
        concept.status = ConceptStatus.weak
        if concept.title not in session.learner_model.weak_topics:
            session.learner_model.weak_topics.append(concept.title)

    session.learner_model.mastery_score = round(
        sum(item.mastery for item in session.concept_map) / len(session.concept_map),
        2,
    )
    session.learner_model.confidence = round(
        max(0.0, min(1.0, session.learner_model.confidence + (0.05 if is_correct else -0.07))),
        2,
    )
    if session.learner_model.mastery_score >= 0.72 and session.learner_model.confidence >= 0.65:
        session.learner_model.pace = "fast"
    elif session.learner_model.mastery_score < 0.45:
        session.learner_model.pace = "slower"
    else:
        session.learner_model.pace = "steady"

    if not is_correct and payload.confidence <= 2:
        action = AdaptiveAction.easier_explanation
        reason = f"The answer was incorrect with low confidence, so ConceptMate is simplifying {concept.title}."
        target = concept
    elif not is_correct:
        action = AdaptiveAction.similar_practice
        reason = f"The answer missed {concept.title}, so ConceptMate is keeping the same concept with similar practice."
        target = concept
    elif session.learner_model.pace == "fast":
        next_unmastered = next(
            (item for item in session.concept_map if item.status != ConceptStatus.mastered),
            concept,
        )
        action = AdaptiveAction.harder_challenge
        reason = "The check was correct and mastery is trending high, so ConceptMate is raising the challenge."
        target = next_unmastered
    else:
        next_unmastered = next(
            (item for item in session.concept_map if item.status != ConceptStatus.mastered),
            concept,
        )
        action = AdaptiveAction.next_concept if next_unmastered.id != concept.id else AdaptiveAction.similar_practice
        reason = "The check was correct, so ConceptMate is moving to the next useful step."
        target = next_unmastered

    return mastery_delta, action, reason, target
