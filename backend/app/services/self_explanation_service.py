from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.learning import Concept, ConceptMastery, SelfExplanation, utc_now
from app.services.llm_provider import LLMProvider


def evaluate_and_store_self_explanation(
    db: Session,
    concept: Concept,
    explanation_text: str,
    provider: LLMProvider,
) -> tuple[str, SelfExplanation, ConceptMastery, str]:
    evaluation = provider.evaluate_self_explanation(
        concept_title=concept.title,
        concept_description=concept.description,
        explanation_text=explanation_text,
    )

    self_explanation = SelfExplanation(
        concept_id=concept.id,
        explanation_text=explanation_text,
        accuracy_score=evaluation.accuracy_score,
        completeness_score=evaluation.completeness_score,
        logical_connection_score=evaluation.logical_connection_score,
    )
    db.add(self_explanation)
    db.flush()

    mastery = _update_mastery(
        db=db,
        concept=concept,
        score=(
            evaluation.accuracy_score
            + evaluation.completeness_score
            + evaluation.logical_connection_score
        )
        / 3,
    )
    db.commit()
    db.refresh(self_explanation)
    db.refresh(mastery)

    return provider.source, self_explanation, mastery, evaluation.feedback


def _update_mastery(db: Session, concept: Concept, score: float) -> ConceptMastery:
    mastery = (
        db.query(ConceptMastery)
        .filter(ConceptMastery.concept_id == concept.id)
        .one_or_none()
    )

    if mastery is None:
        mastery = ConceptMastery(concept_id=concept.id)
        db.add(mastery)
        db.flush()

    previous_attempts = mastery.total_attempts
    mastery.total_attempts += 1
    if score >= 0.7:
        mastery.correct_attempts += 1

    if previous_attempts == 0:
        mastery.mastery_level = round(score, 2)
    else:
        mastery.mastery_level = round((mastery.mastery_level + score) / 2, 2)
    mastery.last_reviewed_at = utc_now()
    mastery.next_review_at = _next_review_at(score)
    return mastery


def _next_review_at(score: float):
    now = utc_now()
    if score >= 0.85:
        return now + timedelta(days=7)
    if score >= 0.65:
        return now + timedelta(days=3)
    if score >= 0.4:
        return now + timedelta(days=1)
    return now + timedelta(hours=6)
