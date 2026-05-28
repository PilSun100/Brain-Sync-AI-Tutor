from sqlalchemy.orm import Session

from app.models.learning import LearningSession, Question, UserAnswer
from app.services.llm_provider import LLMProvider


def evaluate_and_store_answer(
    db: Session,
    question: Question,
    answer_text: str,
    provider: LLMProvider,
    session_id: int | None = None,
    response_time: float | None = None,
) -> tuple[str, UserAnswer, str]:
    session = _resolve_session(db, question, session_id)
    evaluation = provider.evaluate_answer(
        question_text=question.question_text,
        expected_answer=question.expected_answer,
        answer_text=answer_text,
    )

    user_answer = UserAnswer(
        session_id=session.id,
        question_id=question.id,
        answer_text=answer_text,
        correctness_score=evaluation.correctness_score,
        missing_points=evaluation.missing_points,
        misconception_detected=evaluation.misconception_detected,
        response_time=response_time,
    )

    db.add(user_answer)
    db.commit()
    db.refresh(user_answer)

    return provider.source, user_answer, evaluation.feedback


def _resolve_session(
    db: Session,
    question: Question,
    session_id: int | None,
) -> LearningSession:
    if session_id is not None:
        session = db.get(LearningSession, session_id)
        if session is not None:
            return session

    material_id = question.concept.material_id
    session = LearningSession(material_id=material_id)
    db.add(session)
    db.flush()
    return session
