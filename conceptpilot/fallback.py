from __future__ import annotations

from .models import (
    AdaptiveAction,
    AIStatus,
    CheckQuestion,
    ConceptNode,
    ConceptStatus,
    CurrentLevel,
    DiagnosticQuestion,
    ExampleBlock,
    LearningCard,
    LearnerModel,
    PreferredStyle,
)
from .utils import normalize_text, safe_id


def ai_status(reason: str) -> AIStatus:
    return AIStatus(provider="fallback", model=None, fallback_reason=reason)


def infer_topic(goal: str) -> str:
    cleaned = normalize_text(goal)
    for prefix in ("learn ", "understand ", "master ", "study "):
        if cleaned.lower().startswith(prefix):
            return cleaned[len(prefix) :].strip().title()
    return cleaned.title()


def diagnostic_questions(goal: str, level: CurrentLevel, reason: str) -> tuple[list[DiagnosticQuestion], AIStatus]:
    topic = infer_topic(goal)
    base_id = safe_id(topic, "topic")
    questions = [
        DiagnosticQuestion(
            id="diag-1",
            concept_id=f"{base_id}-mental-model",
            prompt=f"Which answer best describes the core purpose of {topic}?",
            options=[
                "To solve a specific class of problems with a repeatable mental model",
                "To memorize isolated facts without applying them",
                "To skip prerequisites and jump to advanced details",
                "To avoid practice once the terms are familiar",
            ],
            answer="To solve a specific class of problems with a repeatable mental model",
            rationale="The first step is a usable mental model, not memorized wording.",
            difficulty=1 if level == CurrentLevel.beginner else 2,
        ),
        DiagnosticQuestion(
            id="diag-2",
            concept_id=f"{base_id}-prerequisites",
            prompt=f"What should you do when a {topic} example feels unclear?",
            options=[
                "Break it into prerequisites and test each small step",
                "Keep rereading the same paragraph without checking understanding",
                "Assume the whole topic is too advanced",
                "Ignore the confusing part and move on",
            ],
            answer="Break it into prerequisites and test each small step",
            rationale="Adaptive learning works by finding the smallest missing piece.",
            difficulty=2,
        ),
        DiagnosticQuestion(
            id="diag-3",
            concept_id=f"{base_id}-application",
            prompt=f"Which practice style best proves you understand {topic}?",
            options=[
                "Applying it to a fresh example and explaining the result",
                "Recognizing the term in a list",
                "Copying a solution without changing it",
                "Reading an advanced article before practicing basics",
            ],
            answer="Applying it to a fresh example and explaining the result",
            rationale="Transfer to a fresh example is stronger evidence than recognition.",
            difficulty=3,
        ),
        DiagnosticQuestion(
            id="diag-4",
            concept_id=f"{base_id}-debugging",
            prompt=f"If your answer about {topic} is wrong, what is the most useful next step?",
            options=[
                "Compare the mistake to the expected reasoning and retry a similar problem",
                "Start a totally unrelated concept",
                "Lower the goal permanently",
                "Hide the feedback until the end",
            ],
            answer="Compare the mistake to the expected reasoning and retry a similar problem",
            rationale="Feedback should immediately shape the next learning step.",
            difficulty=3 if level != CurrentLevel.advanced else 4,
        ),
    ]
    return questions, ai_status(reason)


def concept_map(goal: str) -> list[ConceptNode]:
    topic = infer_topic(goal)
    base_id = safe_id(topic, "concept")
    return [
        ConceptNode(
            id=f"{base_id}-foundations",
            title=f"{topic} foundations",
            summary="Build the core vocabulary and mental model.",
            prerequisite=True,
            mastery=0.0,
            status=ConceptStatus.in_progress,
        ),
        ConceptNode(
            id=f"{base_id}-worked-example",
            title="Worked example",
            summary="Trace a realistic example step by step.",
            mastery=0.0,
        ),
        ConceptNode(
            id=f"{base_id}-practice",
            title="Guided practice",
            summary="Apply the idea to a new situation with feedback.",
            mastery=0.0,
        ),
        ConceptNode(
            id=f"{base_id}-transfer",
            title="Transfer challenge",
            summary="Use the concept in a slightly different context.",
            mastery=0.0,
        ),
    ]


def learner_model(level: CurrentLevel, score: float, confidence: float, weak_topics: list[str]) -> LearnerModel:
    pace = "fast" if score >= 0.8 and confidence >= 0.65 else "slower" if score < 0.5 else "steady"
    return LearnerModel(
        level=level,
        pace=pace,
        confidence=round(confidence, 2),
        mastery_score=round(score, 2),
        weak_topics=weak_topics,
        mastered_topics=[],
    )


def learning_card(
    goal: str,
    concept: ConceptNode,
    action: AdaptiveAction,
    style: PreferredStyle,
    reason: str | None = None,
) -> tuple[LearningCard, AIStatus]:
    topic = infer_topic(goal)
    action_label = {
        AdaptiveAction.easier_explanation: "Simpler explanation",
        AdaptiveAction.prerequisite_review: "Prerequisite review",
        AdaptiveAction.similar_practice: "Similar practice",
        AdaptiveAction.harder_challenge: "Harder challenge",
        AdaptiveAction.next_concept: "Next concept",
    }[action]

    if style == PreferredStyle.socratic:
        explanation = [
            f"Start with this question: what problem is {concept.title} helping you solve?",
            "Then name the input, the action, and the result in one sentence.",
        ]
    elif style == PreferredStyle.visual:
        explanation = [
            f"Picture {topic} as a small flow: situation -> decision -> result.",
            f"{concept.title} is the part of the flow we are strengthening now.",
        ]
    else:
        explanation = [
            f"{concept.title} is easiest when you connect the term to a concrete move.",
            "We will use one example, then test whether you can transfer the idea.",
        ]

    card = LearningCard(
        id=f"card-{concept.id}-{action.value}",
        concept_id=concept.id,
        title=f"{action_label}: {concept.title}",
        objective=f"Explain and apply {concept.title} without relying on memorized wording.",
        explanation=explanation,
        example=ExampleBlock(
            title=f"A practical {topic} moment",
            setup=f"Imagine you are using {topic} in a real task and need to decide the next step.",
            walkthrough=[
                "Name the current situation in plain language.",
                f"Choose the part of {topic} that changes the situation.",
                "Check the result against the goal before moving on.",
            ],
            takeaway="Understanding means you can explain the move and reuse it in a fresh case.",
            code_sample="async def fetch_data():\n    result = await client.get('/items')\n    return result.json()"
            if "python" in goal.lower() or "async" in goal.lower()
            else None,
        ),
        check_question=CheckQuestion(
            id=f"check-{concept.id}",
            prompt=f"What is the best evidence that you understand {concept.title}?",
            options=[
                "I can apply it to a new example and explain my reasoning",
                "I saw the term once in the lesson",
                "I can repeat one sentence without context",
                "I skipped the check because the example looked familiar",
            ],
            answer="I can apply it to a new example and explain my reasoning",
            focus_topic=concept.title,
        ),
        estimated_minutes=8,
        adaptive_action=action,
    )
    return card, ai_status(reason or "Gemini unavailable; deterministic adaptive content used.")


def coach_response(goal: str, weak_topics: list[str]) -> str:
    topic = weak_topics[0] if weak_topics else infer_topic(goal)
    return (
        f"Let's shrink the problem to {topic}. Say what changes before and after the step, "
        "then try one similar case. If that feels easy, the next card can raise the difficulty."
    )
