from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.ai.schema import MeetingInsights
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

