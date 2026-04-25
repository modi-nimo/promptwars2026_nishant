from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class CurrentLevel(str, Enum):
    beginner = "Beginner"
    intermediate = "Intermediate"
    advanced = "Advanced"


class PreferredStyle(str, Enum):
    examples = "Examples"


class LearningPathRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=180)
    current_level: CurrentLevel
    preferred_style: PreferredStyle = PreferredStyle.examples


class RoadmapItem(BaseModel):
    id: str
    title: str
    outcome: str
    checkpoint: str
    estimate_minutes: int = Field(..., ge=1, le=60)


class ExampleBlock(BaseModel):
    title: str
    setup: str
    walkthrough: list[str] = Field(..., min_length=2, max_length=6)
    takeaway: str
    code_sample: str | None = None


class QuizQuestion(BaseModel):
    id: str
    prompt: str
    options: list[str] = Field(..., min_length=4, max_length=4)
    answer: str
    focus_topic: str


class Lesson(BaseModel):
    title: str
    objective: str
    explanation: list[str] = Field(..., min_length=1, max_length=6)
    example: ExampleBlock
    quiz: list[QuizQuestion] = Field(..., min_length=2, max_length=2)


class ProgressState(BaseModel):
    answered: int = 0
    correct: int = 0
    weak_topics: list[str] = Field(default_factory=list)
    mastered_topics: list[str] = Field(default_factory=list)


class AIStatus(BaseModel):
    provider: str
    model: str | None = None
    used_google_search: bool = False
    fallback_reason: str | None = None


class LearningPathResponse(BaseModel):
    session_id: str
    goal: str
    topic: str
    current_level: CurrentLevel
    preferred_style: PreferredStyle
    created_at: str
    roadmap: list[RoadmapItem] = Field(..., min_length=4, max_length=4)
    lesson: Lesson
    progress: ProgressState
    next_step: str
    ai: AIStatus


class QuizAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    selected_option: str = Field(..., min_length=1)


class QuizAnswerResponse(BaseModel):
    correct: bool
    feedback: str
    progress: ProgressState
    next_prompt: str


class CoachRequest(BaseModel):
    session_id: str
    message: str = Field(..., min_length=2, max_length=500)


class CoachResponse(BaseModel):
    coach_note: str
    simpler_example: str
    check_question: str
    weak_topic: str
    ai: AIStatus


class GeminiLearningPath(BaseModel):
    topic: str = Field(..., min_length=2)
    roadmap: list[RoadmapItem] = Field(..., min_length=4, max_length=4)
    lesson: Lesson
    next_step: str = Field(..., min_length=8)


class GeminiCoachPayload(BaseModel):
    coach_note: str = Field(..., min_length=10)
    simpler_example: str = Field(..., min_length=10)
    check_question: str = Field(..., min_length=10)
    weak_topic: str = Field(..., min_length=2)


class StoredSession(BaseModel):
    learning_path: LearningPathResponse
    question_lookup: dict[str, QuizQuestion]
