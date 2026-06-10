from datetime import datetime

from pydantic import BaseModel


class DailyReviewItemResponse(BaseModel):
    concept_id: int
    concept_title: str
    reason: str
    priority: str
    recommended_method: str
    estimated_minutes: int
    next_review_at: datetime | None
    mastery_level: float
    forgetting_risk: float


class DailyReviewResponse(BaseModel):
    review_items: list[DailyReviewItemResponse]
    estimated_total_minutes: int
    generated_at: datetime
