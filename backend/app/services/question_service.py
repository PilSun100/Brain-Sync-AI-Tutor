from sqlalchemy.orm import Session

from app.models.learning import Concept, Question
from app.services.llm_provider import LLMProvider


def generate_and_store_questions(
    db: Session,
    concept: Concept,
    provider: LLMProvider,
) -> tuple[str, list[Question]]:
    material_text = concept.material.extracted_text if concept.material else ""
    generated = provider.generate_questions(
        concept_title=concept.title,
        concept_description=concept.description,
        material_text=material_text,
    )

    questions = [
        Question(
            concept_id=concept.id,
            question_text=item.question_text,
            question_type=item.question_type,
            expected_answer=item.expected_answer,
        )
        for item in generated
    ]

    db.add_all(questions)
    db.commit()

    for question in questions:
        db.refresh(question)

    return provider.source, questions
