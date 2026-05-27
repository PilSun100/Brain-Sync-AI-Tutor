from pathlib import Path

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import learning


def init_db() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
