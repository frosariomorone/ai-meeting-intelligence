from typing import List

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
) -> List[SearchResult]:
    """
    MVP search:
    - Keyword search over title + summary (Postgres ILIKE / full-text can be added).
    - Later: extend with pgvector semantic search against embeddings.
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    # Simple regex-based search on title and summary fields for MVP.
    regex = {"$regex": q, "$options": "i"}

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
        {
            "$match": {
                "$or": [
                    {"title": regex},
                    {"insights_docs.summary": regex},
                ]
            }
        },
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

