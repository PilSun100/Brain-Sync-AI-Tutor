from pydantic import BaseModel

from app.schemas.concepts import ConceptResponse
from app.schemas.materials import MaterialSummaryResponse
from app.schemas.questions import QuestionResponse


class StudyStartResponse(BaseModel):
    material: MaterialSummaryResponse
    concept: ConceptResponse
    questions: list[QuestionResponse]
    source: str
