import fitz
from fastapi.testclient import TestClient

from app.main import create_app
from auth_helpers import auth_headers


def make_pdf_bytes(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    return document.tobytes()


def create_review_candidate(client: TestClient, headers: dict[str, str]) -> None:
    upload_response = client.post(
        "/api/materials/upload",
        files={
            "file": (
                "daily-review.pdf",
                make_pdf_bytes(
                    "Prediction error helps learning when a student notices the gap "
                    "between an initial answer and evidence from the material."
                ),
                "application/pdf",
            )
        },
        headers=headers,
    )
    assert upload_response.status_code == 201
    material_id = upload_response.json()["id"]

    concept_response = client.post(f"/api/materials/{material_id}/concepts/extract", headers=headers)
    assert concept_response.status_code == 201
    concept_id = concept_response.json()["concepts"][0]["id"]

    question_response = client.post(f"/api/concepts/{concept_id}/questions/generate", headers=headers)
    assert question_response.status_code == 201
    question_id = question_response.json()["questions"][0]["id"]

    answer_response = client.post(
        f"/api/questions/{question_id}/answer",
        json={"answer_text": "This is just reading again and not about the evidence gap."},
        headers=headers,
    )
    assert answer_response.status_code == 201


def test_daily_review_returns_empty_state_for_new_user() -> None:
    with TestClient(create_app()) as client:
        headers = auth_headers(client)

        response = client.get("/api/reviews/daily", headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert body["review_items"] == []
        assert body["estimated_total_minutes"] == 0
        assert body["generated_at"]


def test_daily_review_returns_prioritized_review_items() -> None:
    with TestClient(create_app()) as client:
        headers = auth_headers(client)
        create_review_candidate(client, headers)

        response = client.get("/api/reviews/daily", headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert body["review_items"]
        assert body["estimated_total_minutes"] > 0
        item = body["review_items"][0]
        assert item["priority"] in {"high", "medium", "low"}
        assert item["recommended_method"] in {
            "active_recall",
            "example_first",
            "misconception_repair",
            "mixed_practice",
            "spaced_review",
        }
        assert item["reason"]
        assert 0 <= item["forgetting_risk"] <= 1
