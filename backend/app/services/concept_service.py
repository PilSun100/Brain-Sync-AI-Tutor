from sqlalchemy.orm import Session

from app.models.learning import Concept, LearningMaterial
from app.services.llm_provider import LLMProvider


def extract_and_store_concepts(
    db: Session,
    material: LearningMaterial,
    provider: LLMProvider,
) -> tuple[str, list[Concept]]:
    extracted = provider.extract_concepts(material.extracted_text)

    concepts_by_title: dict[str, Concept] = {}
    stored_concepts: list[Concept] = []

    for item in extracted:
        concept = Concept(
            material_id=material.id,
            title=item.title,
            description=item.description,
            difficulty=item.difficulty,
        )
        concepts_by_title[item.title] = concept
        stored_concepts.append(concept)

    db.add_all(stored_concepts)
    db.flush()

    for item, concept in zip(extracted, stored_concepts, strict=True):
        if item.parent_title and item.parent_title in concepts_by_title:
            concept.parent_concept_id = concepts_by_title[item.parent_title].id

    db.commit()

    for concept in stored_concepts:
        db.refresh(concept)

    return provider.source, stored_concepts
