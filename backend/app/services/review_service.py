from datetime import UTC, datetime, time

from sqlalchemy.orm import Session

from app.models.learning import Concept, ConceptMastery, LearningMaterial, utc_now
from app.schemas.reviews import DailyReviewItemResponse, DailyReviewResponse


def build_daily_review(db: Session, user_id: int) -> DailyReviewResponse:
    now = utc_now()
    end_of_today = datetime.combine(now.date(), time.max, tzinfo=UTC)
    masteries = (
        db.query(ConceptMastery)
        .join(Concept, ConceptMastery.concept_id == Concept.id)
        .join(LearningMaterial, Concept.material_id == LearningMaterial.id)
        .filter(LearningMaterial.user_id == user_id)
        .all()
    )

    review_items = []
    for mastery in masteries:
        risk = _forgetting_risk(mastery, now)
        reasons = _review_reasons(mastery, now, end_of_today, risk)
        if not reasons:
            continue

        priority = _priority(mastery, risk)
        review_items.append(
            DailyReviewItemResponse(
                concept_id=mastery.concept_id,
                concept_title=mastery.concept.title,
                reason=" ".join(reasons),
                priority=priority,
                recommended_method=_recommended_method(mastery),
                estimated_minutes=_estimated_minutes(priority, mastery),
                next_review_at=mastery.next_review_at,
                mastery_level=round(mastery.mastery_level, 2),
                forgetting_risk=risk,
            )
        )

    review_items.sort(
        key=lambda item: (
            _priority_rank(item.priority),
            -item.forgetting_risk,
            item.next_review_at or end_of_today,
        )
    )

    return DailyReviewResponse(
        review_items=review_items,
        estimated_total_minutes=sum(item.estimated_minutes for item in review_items),
        generated_at=now,
    )


def _review_reasons(
    mastery: ConceptMastery,
    now: datetime,
    end_of_today: datetime,
    forgetting_risk: float,
) -> list[str]:
    reasons = []
    next_review_at = _as_utc(mastery.next_review_at) if mastery.next_review_at else None
    if next_review_at and next_review_at <= end_of_today:
        reasons.append("복습 예정 시간이 오늘 안에 도래했습니다.")
    if mastery.mastery_level < 0.55:
        reasons.append("숙련도가 낮아 기억 인출을 다시 강화해야 합니다.")
    if mastery.misconception_count > 0:
        reasons.append("반복 오개념이 감지되어 교정 질문이 필요합니다.")
    if mastery.hint_dependency >= 0.6:
        reasons.append("힌트 의존도가 높아 독립 회상 연습이 필요합니다.")
    if forgetting_risk >= 0.65:
        reasons.append("망각 위험이 높습니다.")
    if next_review_at and next_review_at <= now:
        reasons.insert(0, "복습 기한이 이미 지났습니다.")
    return reasons


def _forgetting_risk(mastery: ConceptMastery, now: datetime) -> float:
    risk = (1 - mastery.mastery_level) * 0.45
    risk += mastery.cognitive_load_score * 0.2
    risk += min(0.2, mastery.misconception_count * 0.08)
    risk += min(0.15, mastery.hint_dependency * 0.15)

    if mastery.next_review_at:
        next_review_at = _as_utc(mastery.next_review_at)
        if next_review_at <= now:
            risk += 0.25
        elif next_review_at.date() == now.date():
            risk += 0.12

    return round(max(0.0, min(1.0, risk)), 2)


def _priority(mastery: ConceptMastery, forgetting_risk: float) -> str:
    if mastery.misconception_count > 0 or forgetting_risk >= 0.75 or mastery.mastery_level < 0.35:
        return "high"
    if forgetting_risk >= 0.55 or mastery.hint_dependency >= 0.6:
        return "medium"
    return "low"


def _recommended_method(mastery: ConceptMastery) -> str:
    if mastery.misconception_count > 0:
        return "misconception_repair"
    if mastery.hint_dependency >= 0.6 or mastery.cognitive_load_score >= 0.68:
        return "example_first"
    if mastery.mastery_level >= 0.78:
        return "mixed_practice"
    if mastery.mastery_level < 0.55:
        return "active_recall"
    return "spaced_review"


def _estimated_minutes(priority: str, mastery: ConceptMastery) -> int:
    base = {"high": 12, "medium": 8, "low": 5}[priority]
    if mastery.misconception_count > 0:
        base += 3
    return base


def _priority_rank(priority: str) -> int:
    return {"high": 0, "medium": 1, "low": 2}.get(priority, 3)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
