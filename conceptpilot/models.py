from __future__ import annotations

from enum import Enum
from typing import Annotated
from typing import Literal

from pydantic import BaseModel, Field


SessionId = Annotated[str, Field(pattern=r"^cp_[a-f0-9]{14}$")]


class CurrentLevel(str, Enum):
    beginner = "Beginner"
    intermediate = "Intermediate"
    advanced = "Advanced"


class PreferredStyle(str, Enum):
    examples = "Examples"
    visual = "Visual"
    socratic = "Socratic"
    hands_on = "Hands-on"


class AuthMode(str, Enum):
    guest = "guest"
    google = "google"


class AdaptiveAction(str, Enum):
    easier_explanation = "easier_explanation"
    prerequisite_review = "prerequisite_review"
    similar_practice = "similar_practice"
    harder_challenge = "harder_challenge"
    next_concept = "next_concept"


class ConceptStatus(str, Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    weak = "weak"
    mastered = "mastered"


class AIStatus(BaseModel):
    provider: str
    model: str | None = None
    fallback_reason: str | None = None


class SessionCreateRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=180)
    current_level: CurrentLevel
    time_available_minutes: int = Field(..., ge=5, le=180)
    preferred_style: PreferredStyle = PreferredStyle.examples


class DiagnosticQuestion(BaseModel):
    id: str
    concept_id: str
    prompt: str = Field(..., min_length=8)
    options: list[str] = Field(..., min_length=4, max_length=4)
    answer: str = Field(..., min_length=1)
    rationale: str = Field(..., min_length=8)
    difficulty: int = Field(..., ge=1, le=5)


class SessionCreateResponse(BaseModel):
    session_id: str
    auth_mode: AuthMode
    diagnostic_questions: list[DiagnosticQuestion] = Field(..., min_length=4, max_length=6)
    ai: AIStatus


class DiagnosticAnswer(BaseModel):
    question_id: str
    selected_option: str = Field(..., min_length=1)
    confidence: int = Field(default=3, ge=1, le=5)


class DiagnosticSubmitRequest(BaseModel):
    session_id: SessionId
    answers: list[DiagnosticAnswer] = Field(..., min_length=1, max_length=6)


class ConceptNode(BaseModel):
    id: str
    title: str = Field(..., min_length=2)
    summary: str = Field(..., min_length=8)
    prerequisite: bool = False
    mastery: float = Field(default=0.0, ge=0.0, le=1.0)
    status: ConceptStatus = ConceptStatus.not_started


class LearnerModel(BaseModel):
    level: CurrentLevel
    pace: Literal["slower", "steady", "fast"] = "steady"
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    mastery_score: float = Field(default=0.0, ge=0.0, le=1.0)
    weak_topics: list[str] = Field(default_factory=list)
    mastered_topics: list[str] = Field(default_factory=list)


class ExampleBlock(BaseModel):
    title: str
    setup: str
    walkthrough: list[str] = Field(..., min_length=2, max_length=5)
    takeaway: str
    code_sample: str | None = None


class CheckQuestion(BaseModel):
    id: str
    prompt: str
    options: list[str] = Field(..., min_length=4, max_length=4)
    answer: str
    focus_topic: str


class LearningCard(BaseModel):
    id: str
    concept_id: str
    title: str
    objective: str
    explanation: list[str] = Field(..., min_length=1, max_length=5)
    example: ExampleBlock
    check_question: CheckQuestion
    estimated_minutes: int = Field(..., ge=3, le=30)
    adaptive_action: AdaptiveAction = AdaptiveAction.next_concept


class DiagnosticSubmitResponse(BaseModel):
    learner_model: LearnerModel
    concept_map: list[ConceptNode] = Field(..., min_length=3, max_length=7)
    next_card: LearningCard


class CheckSubmitRequest(BaseModel):
    session_id: SessionId
    card_id: str
    question_id: str
    selected_option: str = Field(..., min_length=1)
    confidence: int = Field(default=3, ge=1, le=5)


class CheckSubmitResponse(BaseModel):
    correctness: Literal["correct", "incorrect"]
    feedback: str
    mastery_delta: float
    adaptive_reason: str
    learner_model: LearnerModel
    concept_map: list[ConceptNode]
    next_card: LearningCard


class CoachRequest(BaseModel):
    session_id: SessionId
    message: str = Field(..., min_length=2, max_length=500)


class CoachResponse(BaseModel):
    coach_response: str
    suggested_action: AdaptiveAction
    updated_weak_topics: list[str]
    next_card: LearningCard | None = None
    ai: AIStatus


class SessionSnapshot(BaseModel):
    session_id: SessionId
    auth_mode: AuthMode
    owner_id: str | None = None
    goal: str
    current_level: CurrentLevel
    preferred_style: PreferredStyle
    time_available_minutes: int
    created_at: str
    updated_at: str
    diagnostic_questions: list[DiagnosticQuestion]
    learner_model: LearnerModel | None = None
    concept_map: list[ConceptNode] = Field(default_factory=list)
    current_card: LearningCard | None = None
    attempts: list[dict] = Field(default_factory=list)
    ai: AIStatus


class ConceptMapPayload(BaseModel):
    concepts: list[ConceptNode] = Field(..., min_length=3, max_length=7)


class GeminiLessonPayload(BaseModel):
    card: LearningCard


class GeminiCoachPayload(BaseModel):
    coach_response: str
    suggested_action: AdaptiveAction
    card: LearningCard | None = None


class GeminiDiagnosticPayload(BaseModel):
    questions: list[DiagnosticQuestion] = Field(..., min_length=4, max_length=6)
