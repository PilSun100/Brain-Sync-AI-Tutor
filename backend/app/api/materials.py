from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.dependencies import get_current_user, get_db
from app.models.learning import Concept, LearningMaterial, Question, User
from app.schemas.materials import MaterialListResponse, MaterialSummaryResponse, MaterialUploadResponse
from app.schemas.study import StudyStartResponse
from app.services.concept_service import extract_and_store_concepts
from app.services.embedding_service import embed_material_chunks
from app.services.llm_provider import get_llm_provider
from app.services.material_chunk_service import build_material_chunks
from app.services.ownership_service import ensure_material_owner
from app.services.pdf_service import extract_pdf_pages, join_page_texts, save_upload_file, validate_pdf_upload
from app.services.question_service import generate_and_store_questions
from app.services.visual_chunk_service import build_visual_description_chunks

router = APIRouter()


@router.get("/materials", response_model=MaterialListResponse)
def list_materials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MaterialListResponse:
    materials = (
        db.query(LearningMaterial)
        .filter(LearningMaterial.user_id == current_user.id)
        .order_by(LearningMaterial.created_at.desc())
        .all()
    )

    return MaterialListResponse(
        materials=[
            MaterialSummaryResponse(
                id=material.id,
                title=material.title,
                extracted_text_length=len(material.extracted_text),
                preview=material.extracted_text[:220],
                created_at=material.created_at,
            )
            for material in materials
        ]
    )


@router.post(
    "/materials/upload",
    response_model=MaterialUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_material(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MaterialUploadResponse:
    content = await file.read()
    validate_pdf_upload(file, content)

    file_path = save_upload_file(file, content)
    pages = extract_pdf_pages(content)
    extracted_text = join_page_texts(pages)
    title = Path(file.filename or file_path.name).stem

    material = LearningMaterial(
        user_id=current_user.id,
        title=title,
        file_path=str(file_path),
        extracted_text=extracted_text,
    )
    db.add(material)
    db.flush()
    chunks = build_material_chunks(material.id, pages)
    chunks.extend(
        build_visual_description_chunks(
            material_id=material.id,
            pdf_content=content,
            pages=pages,
            start_index=len(chunks),
        )
    )
    embed_material_chunks(chunks)
    db.add_all(chunks)
    db.commit()
    db.refresh(material)

    return MaterialUploadResponse(
        id=material.id,
        title=material.title,
        file_path=material.file_path,
        extracted_text_length=len(material.extracted_text),
        preview=material.extracted_text[:300],
        created_at=material.created_at,
    )


@router.post("/materials/{material_id}/study/start", response_model=StudyStartResponse)
def start_material_study(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudyStartResponse:
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="학습 자료를 찾을 수 없습니다.",
        )
    ensure_material_owner(material, current_user)

    source = "stored"
    concepts = (
        db.query(Concept)
        .filter(Concept.material_id == material.id)
        .order_by(Concept.id.asc())
        .all()
    )
    provider = None

    if not concepts:
        provider = get_llm_provider()
        try:
            source, concepts = extract_and_store_concepts(db, material, provider)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

    concept = concepts[0]
    questions = (
        db.query(Question)
        .filter(Question.concept_id == concept.id)
        .order_by(Question.id.asc())
        .all()
    )

    if not questions:
        provider = provider or get_llm_provider()
        try:
            source, questions = generate_and_store_questions(db, concept, provider)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

    return StudyStartResponse(
        material=MaterialSummaryResponse(
            id=material.id,
            title=material.title,
            extracted_text_length=len(material.extracted_text),
            preview=material.extracted_text[:220],
            created_at=material.created_at,
        ),
        concept=concept,
        questions=questions,
        source=source,
    )
