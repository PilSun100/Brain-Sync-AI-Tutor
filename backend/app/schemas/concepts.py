from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConceptResponse(BaseModel):
    id: int
    material_id: int
    title: str
    description: str
    difficulty: str
    parent_concept_id: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConceptExtractionResponse(BaseModel):
    material_id: int
    source: str
    count: int
    concepts: list[ConceptResponse]
