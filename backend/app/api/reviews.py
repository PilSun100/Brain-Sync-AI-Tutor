from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.dependencies import get_current_user, get_db
from app.models.learning import User
from app.schemas.reviews import DailyReviewResponse
from app.services.review_service import build_daily_review

router = APIRouter()


@router.get("/reviews/daily", response_model=DailyReviewResponse)
def get_daily_review(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DailyReviewResponse:
    return build_daily_review(db, current_user.id)
