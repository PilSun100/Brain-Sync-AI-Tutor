from datetime import datetime

from pydantic import BaseModel, Field


class SelfExplanationRequest(BaseModel):
    explanation_text: str = Field(..., min_length=10)


class SelfExplanationResponse(BaseModel):
    id: int
    concept_id: int
    explanation_text: str
    accuracy_score: float
    completeness_score: float
    logical_connection_score: float
    mastery_level: float
    next_review_at: datetime | None
    feedback: str
    source: str
    created_at: datetime
