from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.db.base import get_db
from app.db.models import MEETINGS_COLLECTION, INSIGHTS_COLLECTION


class SearchResult(BaseModel):
    meeting_id: str
    title: str
    created_at: str
    summary: str


router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=List[SearchResult])
async def search_meetings(
    q: str = Query(..., min_length=1),
    db: AsyncIOMotorDatabase = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    from_date: Optional[str] = Query(
        None,
        description="ISO date (YYYY-MM-DD) for earliest meeting date to include.",
    ),
    to_date: Optional[str] = Query(
        None,
        description="ISO date (YYYY-MM-DD) for latest meeting date to include.",
    ),
    owner: Optional[str] = Query(
        None,
        description="Filter by action item owner (case-insensitive substring).",
    ),
    sentiment: Optional[str] = Query(
        None,
        description="Filter by overall sentiment (e.g. positive, neutral, negative).",
    ),
) -> List[SearchResult]:
    """
    Search meetings by:
    - Keyword (title + summary)
    - Optional date range (created_at)
    - Optional owner in action items
    - Optional overall sentiment
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    # Simple regex-based search on title and summary fields for MVP.
    regex = {"$regex": q, "$options": "i"}

    match_filters: dict = {
        "$or": [
            {"title": regex},
            {"insights_docs.summary": regex},
        ]
    }

    if sentiment:
        match_filters["insights_docs.sentiment.overall"] = {
            "$regex": sentiment,
            "$options": "i",
        }

    if owner:
        match_filters["insights_docs.action_items.owner"] = {
            "$regex": owner,
            "$options": "i",
        }

    date_filters: dict = {}
    if from_date:
        # created_at is a datetime; Mongo can compare ISO date strings reasonably in many cases,
        # but for simplicity we rely on the stored datetime values.
        date_filters["$gte"] = from_date
    if to_date:
        date_filters["$lte"] = to_date
    if date_filters:
        match_filters["created_at"] = date_filters

    pipeline = [
        {
            "$lookup": {
                "from": INSIGHTS_COLLECTION,
                "localField": "_id",
                "foreignField": "meeting_id",
                "as": "insights_docs",
            }
        },
        {"$unwind": "$insights_docs"},
        {"$match": match_filters},
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
    ]

    cursor = db[MEETINGS_COLLECTION].aggregate(pipeline)
    results: List[SearchResult] = []
    async for doc in cursor:
        insights = doc.get("insights_docs", {})
        results.append(
            SearchResult(
                meeting_id=str(doc["_id"]),
                title=doc.get("title", ""),
                created_at=doc.get("created_at").isoformat()
                if doc.get("created_at")
                else "",
                summary=insights.get("summary", ""),
            )
        )

    return results

