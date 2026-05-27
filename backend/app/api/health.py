from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, object]:
    database_ok = False

    with SessionLocal() as session:
        session.execute(text("SELECT 1"))
        database_ok = True

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": "connected" if database_ok else "unavailable",
    }
