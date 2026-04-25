from __future__ import annotations

import uuid

from .models import (
    CoachResponse,
    CurrentLevel,
    ExampleBlock,
    LearningPathRequest,
    LearningPathResponse,
    Lesson,
    ProgressState,
    QuizQuestion,
    RoadmapItem,
)
from .utils import extract_topic, infer_domain, make_ai_status, normalize_text, utc_now


def build_roadmap(topic: str, level: CurrentLevel) -> list[RoadmapItem]:
    level_focus = {
        CurrentLevel.beginner: "plain-language foundations",
        CurrentLevel.intermediate: "practical patterns and tradeoffs",
        CurrentLevel.advanced: "edge cases, strategy, and mastery checks",
    }[level]

    return [
        RoadmapItem(
            id="map-1",
            title=f"Frame {topic}",
            outcome=f"Build a clear mental model using {level_focus}.",
            checkpoint=f"Explain what {topic} is in two sentences.",
            estimate_minutes=8,
        ),
        RoadmapItem(
            id="map-2",
            title="See It In Action",
            outcome="Walk through one realistic example from start to finish.",
            checkpoint="Identify the important moving parts in the example.",
            estimate_minutes=12,
        ),
        RoadmapItem(
            id="map-3",
            title="Try A Guided Practice",
            outcome="Apply the idea with hints before solving independently.",
            checkpoint="Complete one small practice task without looking back.",
            estimate_minutes=15,
        ),
        RoadmapItem(
            id="map-4",
            title="Lock It In",
            outcome="Review weak spots and turn the concept into recall.",
            checkpoint="Answer a mixed quiz and name the next skill to learn.",
            estimate_minutes=10,
        ),
    ]


def build_explanation(topic: str, level: CurrentLevel) -> list[str]:
    if level == CurrentLevel.beginner:
        return [
            f"Think of {topic} as a small skill you can recognize, explain, and use in a real situation.",
            "Start with the job it does, then look at the parts, then practice with one tiny example.",
            "Your goal in this first session is not perfection. It is being able to say what is happening and why.",
        ]

    if level == CurrentLevel.intermediate:
        return [
            f"You already have some context, so this session treats {topic} as a tool with choices and tradeoffs.",
            "We will connect the concept to an example, then test whether you can transfer it to a new case.",
            "The main signal of progress is being able to explain when to use it and when not to.",
        ]

    return [
        f"This session treats {topic} as something to reason about under constraints.",
        "We will focus on precision, failure modes, and how the concept behaves when the simple case stops being simple.",
        "The goal is to turn passive familiarity into fluent judgment.",
    ]


def build_example(topic: str, goal: str) -> ExampleBlock:
    domain = infer_domain(goal)

    if domain == "coding":
        return ExampleBlock(
            title="A Small Working Example",
            setup=f"Imagine you are using {topic} to keep one repeated task neat and reusable.",
            walkthrough=[
                "Name the task in a way that says what it does.",
                "Give it one or two inputs so the example can change without rewriting everything.",
                "Run it with simple values, then check whether the output matches what you expected.",
            ],
            takeaway=f"The useful habit is to make {topic} visible in a tiny example before scaling it up.",
            code_sample=(
                "def calculate_total(price, tax_rate):\n"
                "    tax = price * tax_rate\n"
                "    return price + tax\n\n"
                "total = calculate_total(100, 0.18)\n"
                "print(total)  # 118.0"
            ),
        )

    if domain == "math":
        return ExampleBlock(
            title="A Numbers-First Example",
            setup=f"Use {topic} on a small problem where every step can be checked mentally.",
            walkthrough=[
                "Write down the known values before doing any calculation.",
                "Choose the rule that connects those values.",
                "Calculate slowly once, then estimate to see if the answer is reasonable.",
            ],
            takeaway="Good math learning is not just getting an answer. It is knowing why the step was allowed.",
        )

    if domain == "language":
        return ExampleBlock(
            title="A Conversation Example",
            setup=f"Practice {topic} inside a short exchange instead of memorizing it alone.",
            walkthrough=[
                "Read the example once for meaning.",
                "Notice the pattern that repeats.",
                "Replace one part with your own detail and say the sentence again.",
            ],
            takeaway="Language sticks faster when the pattern is attached to a real message you might say.",
        )

    if domain == "business":
        return ExampleBlock(
            title="A Decision Example",
            setup=f"Imagine using {topic} to make a better call for a small product launch.",
            walkthrough=[
                "Name the outcome you want to improve.",
                "List the information you already have.",
                "Make one decision, then state what signal would prove it worked.",
            ],
            takeaway="Business concepts become useful when they change a decision, not just a slide.",
        )

    return ExampleBlock(
        title="A Real-Life Example",
        setup=f"Imagine explaining {topic} to a friend using something they already understand.",
        walkthrough=[
            "Start with the familiar situation.",
            "Map each part of the familiar situation to the new concept.",
            "Use one contrast to show what the concept is not.",
        ],
        takeaway=f"If you can create your own example for {topic}, you are already moving from memorizing to understanding.",
    )


def build_quiz(topic: str, level: CurrentLevel) -> list[QuizQuestion]:
    level_phrase = {
        CurrentLevel.beginner: "first",
        CurrentLevel.intermediate: "practical",
        CurrentLevel.advanced: "strong",
    }[level]

    return [
        QuizQuestion(
            id="quiz-1",
            prompt=f"What is the best {level_phrase} signal that you understand {topic}?",
            options=[
                "You can repeat a definition word for word",
                "You can explain it with a simple example",
                "You can skip practice and remember it later",
                "You can recognize the topic name",
            ],
            answer="You can explain it with a simple example",
            focus_topic=f"{topic} mental model",
        ),
        QuizQuestion(
            id="quiz-2",
            prompt="What should you do when an example feels confusing?",
            options=[
                "Make the example smaller and trace one step",
                "Jump to a harder exercise",
                "Ignore the confusing part",
                "Memorize the final answer only",
            ],
            answer="Make the example smaller and trace one step",
            focus_topic="example tracing",
        ),
    ]


def build_learning_path(
    payload: LearningPathRequest,
    fallback_reason: str | None = None,
) -> LearningPathResponse:
    goal = normalize_text(payload.goal)
    topic = extract_topic(goal)
    lesson = Lesson(
        title=f"First Session: {topic}",
        objective=f"Understand the core idea of {topic} through one example-based walkthrough.",
        explanation=build_explanation(topic, payload.current_level),
        example=build_example(topic, goal),
        quiz=build_quiz(topic, payload.current_level),
    )

    return LearningPathResponse(
        session_id=f"learn_{uuid.uuid4().hex[:12]}",
        goal=goal,
        topic=topic,
        current_level=payload.current_level,
        preferred_style=payload.preferred_style,
        created_at=utc_now(),
        roadmap=build_roadmap(topic, payload.current_level),
        lesson=lesson,
        progress=ProgressState(),
        next_step="Answer the quick check to reveal your first weak spot.",
        ai=make_ai_status(provider="fallback", fallback_reason=fallback_reason),
    )


def build_coach_response(
    learning_path: LearningPathResponse,
    weak_topic: str,
    fallback_reason: str | None = None,
) -> CoachResponse:
    return CoachResponse(
        coach_note=(
            f"Let's shrink {weak_topic} until it is easy to inspect. "
            "One small example is better than five vague definitions."
        ),
        simpler_example=(
            f"Think of {learning_path.topic} like learning one move in a game: "
            "you watch the move, copy it once with help, then try it in a slightly new situation."
        ),
        check_question=f"In one sentence, what job is {learning_path.topic} doing in the example?",
        weak_topic=weak_topic,
        ai=make_ai_status(provider="fallback", fallback_reason=fallback_reason),
    )
