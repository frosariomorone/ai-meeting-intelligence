from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
from docx import Document
from pypdf import PdfReader

from app.ai.pipeline import analyze_meeting
from app.ai.schema import MeetingInsights
from app.db.base import get_db


class AnalyzeRequest(BaseModel):
    transcript: str = Field(..., description="Raw meeting transcript text")
    title: str | None = Field(
        default=None, description="Optional meeting title; otherwise auto-generated"
    )
    telegram_user_id: str | None = Field(
        default=None, description="Optional Telegram user id to associate with this meeting"
    )
    telegram_username: str | None = Field(
        default=None, description="Optional Telegram username for display"
    )


class AnalyzeResponse(BaseModel):
    meeting_id: str
    insights: MeetingInsights


router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post(
    "",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def analyze_endpoint(
    payload: AnalyzeRequest, db: AsyncIOMotorDatabase = Depends(get_db)
) -> AnalyzeResponse:
    if not payload.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript must not be empty.",
        )

    try:
        meeting_id, insights = await analyze_meeting(
            db,
            transcript=payload.transcript,
            title=payload.title,
            telegram_user_id=payload.telegram_user_id,
            telegram_username=payload.telegram_username,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM returned invalid schema: {exc}",
        ) from exc
    except Exception as exc:  # pragma: no cover - safety net
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to analyze meeting: {exc}",
        ) from exc

    return AnalyzeResponse(meeting_id=meeting_id, insights=insights)


def _extract_text_from_upload(file: UploadFile) -> str:
    content_type = (file.content_type or "").lower()
    filename = file.filename or ""

    if filename.lower().endswith(".txt") or "text/plain" in content_type:
        return file.file.read().decode("utf-8", errors="ignore")

    if filename.lower().endswith(".docx") or "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type:
        doc = Document(file.file)
        return "\n".join(p.text for p in doc.paragraphs)

    if filename.lower().endswith(".pdf") or "application/pdf" in content_type:
        reader = PdfReader(file.file)
        texts: list[str] = []
        for page in reader.pages:
            texts.append(page.extract_text() or "")
        return "\n".join(texts)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file type. Allowed: .txt, .docx, .pdf",
    )


@router.post(
    "/file",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def analyze_file_endpoint(
    file: UploadFile = File(..., description="Meeting transcript file (.txt, .docx, .pdf)"),
    title: str | None = Form(
        default=None, description="Optional meeting title; otherwise auto-generated"
    ),
    telegram_user_id: str | None = Form(
        default=None, description="Optional Telegram user id to associate with this meeting"
    ),
    telegram_username: str | None = Form(
        default=None, description="Optional Telegram username for display"
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> AnalyzeResponse:
    try:
        text = _extract_text_from_upload(file)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {exc}",
        ) from exc

    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Extracted transcript is empty.",
        )

    try:
        meeting_id, insights = await analyze_meeting(
            db,
            transcript=text,
            title=title,
            telegram_user_id=telegram_user_id,
            telegram_username=telegram_username,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM returned invalid schema: {exc}",
        ) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to analyze meeting: {exc}",
        ) from exc

    return AnalyzeResponse(meeting_id=meeting_id, insights=insights)

