from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.ai.schema import MeetingInsights
from app.ai.client import llm_client
from app.db.base import get_db
from app.db.models import MEETINGS_COLLECTION, INSIGHTS_COLLECTION


class MeetingSummary(BaseModel):
    id: str
    title: str
    created_at: str


class MeetingDetail(BaseModel):
    id: str
    title: str
    created_at: str
    raw_transcript: str
    insights: MeetingInsights


class MeetingTitleUpdate(BaseModel):
    title: str


class MeetingChatRequest(BaseModel):
    question: str


class MeetingChatResponse(BaseModel):
    answer: str


router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("", response_model=List[MeetingSummary])
async def list_meetings(
    db: AsyncIOMotorDatabase = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> List[MeetingSummary]:
    cursor = (
        db[MEETINGS_COLLECTION]
        .find({})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    meetings: List[MeetingSummary] = []
    async for doc in cursor:
        meetings.append(
            MeetingSummary(
                id=str(doc["_id"]),
                title=doc.get("title", ""),
                created_at=doc.get("created_at").isoformat()
                if doc.get("created_at")
                else "",
            )
        )
    return meetings


@router.get("/{meeting_id}", response_model=MeetingDetail)
async def get_meeting(
    meeting_id: str, db: AsyncIOMotorDatabase = Depends(get_db)
) -> MeetingDetail:
    try:
        oid = ObjectId(meeting_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found.",
        )

    meeting = await db[MEETINGS_COLLECTION].find_one({"_id": oid})
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found.",
        )

    insights = await db[INSIGHTS_COLLECTION].find_one({"meeting_id": meeting_id})
    if not insights:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insights not found for this meeting.",
        )

    insights_model = MeetingInsights(
        summary=insights.get("summary", ""),
        key_points=list(insights.get("key_points") or []),
        action_items=insights.get("action_items") or [],
        decisions=list(insights.get("decisions") or []),
        topics=insights.get("topics") or [],
        sentiment=insights.get("sentiment"),
    )

    return MeetingDetail(
        id=str(meeting["_id"]),
        title=meeting.get("title", ""),
        created_at=meeting.get("created_at").isoformat()
        if meeting.get("created_at")
        else "",
        raw_transcript=meeting.get("raw_transcript", ""),
        insights=insights_model,
    )


@router.patch("/{meeting_id}/title", response_model=MeetingDetail)
async def update_meeting_title(
    meeting_id: str,
    payload: MeetingTitleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MeetingDetail:
    try:
        oid = ObjectId(meeting_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found."
        )

    result = await db[MEETINGS_COLLECTION].find_one_and_update(
        {"_id": oid},
        {"$set": {"title": payload.title}},
        return_document=True,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found."
        )

    # Reuse get_meeting logic to build the response
    return await get_meeting(meeting_id, db)


@router.post("/{meeting_id}/chat", response_model=MeetingChatResponse)
async def chat_with_meeting(
    meeting_id: str,
    payload: MeetingChatRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MeetingChatResponse:
    """
    Lightweight chat endpoint that lets a user ask a free-form question
    about a specific meeting. Uses the stored transcript + insights as context.
    """
    try:
        oid = ObjectId(meeting_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found."
        )

    meeting = await db[MEETINGS_COLLECTION].find_one({"_id": oid})
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found."
        )

    insights = await db[INSIGHTS_COLLECTION].find_one({"meeting_id": meeting_id})
    if not insights:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insights not found for this meeting.",
        )

    transcript = meeting.get("raw_transcript", "")
    title = meeting.get("title", "") or "Untitled meeting"

    # Build a compact context string from insights to keep prompts reasonable in size.
    summary = insights.get("summary") or ""
    decisions = insights.get("decisions") or []
    action_items = insights.get("action_items") or []

    context_parts: List[str] = []
    context_parts.append(f"Title: {title}")
    if summary:
        context_parts.append(f"Summary: {summary}")
    if decisions:
        context_parts.append("Decisions:")
        for d in decisions[:10]:
            context_parts.append(f"- {d}")
    if action_items:
        context_parts.append("Action items:")
        for a in action_items[:15]:
            task = a.get("task") or ""
            owner = a.get("owner") or ""
            deadline = a.get("deadline") or ""
            extra = []
            if owner:
                extra.append(f"owner={owner}")
            if deadline:
                extra.append(f"deadline={deadline}")
            suffix = f" ({', '.join(extra)})" if extra else ""
            context_parts.append(f"- {task}{suffix}")

    context = "\n".join(context_parts)

    system_prompt = (
        "You are an AI assistant that answers questions about a single meeting.\n"
        "Use ONLY the provided transcript and structured insights as your source of truth.\n"
        "If the answer is not clearly supported by the data, say you don't know instead of guessing.\n"
        "Be concise but specific. When helpful, reference speakers or decisions explicitly.\n"
    )

    user_content = (
        f"Meeting transcript:\n{transcript}\n\n"
        f"Structured insights:\n{context}\n\n"
        f"User question: {payload.question}"
    )

    try:
        # We reuse the same client but ask for free-form text instead of JSON.
        from app.config import settings  # imported lazily to avoid cycles
        import httpx

        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": settings.groq_model,
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(llm_client._base_url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        answer = data["choices"][0]["message"]["content"].strip()
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to chat with meeting: {exc}",
        )

    return MeetingChatResponse(answer=answer)

