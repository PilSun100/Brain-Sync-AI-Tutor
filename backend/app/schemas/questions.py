from datetime import datetime

from pydantic import BaseModel, ConfigDict


class QuestionResponse(BaseModel):
    id: int
    concept_id: int
    question_text: str
    question_type: str
    expected_answer: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuestionGenerationResponse(BaseModel):
    concept_id: int
    source: str
    count: int
    questions: list[QuestionResponse]
