from datetime import datetime
from typing import Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.ai.client import llm_client
from app.ai.prompts import MASTER_PROMPT
from app.ai.schema import MeetingInsights, coerce_and_validate_insights
from app.db.models import (
    MEETINGS_COLLECTION,
    INSIGHTS_COLLECTION,
    build_insights_document,
    build_meeting_document,
)


def _preprocess_transcript(transcript: str) -> str:
    """
    Very lightweight preprocessing for MVP:
    - strip leading/trailing whitespace
    - normalize blank lines
    """
    cleaned = "\n".join(line.rstrip() for line in transcript.strip().splitlines())
    return cleaned


async def analyze_meeting(
    db: AsyncIOMotorDatabase,
    transcript: str,
    *,
    title: str | None = None,
    telegram_user_id: str | None = None,
    telegram_username: str | None = None,
) -> Tuple[str, MeetingInsights]:
    """
    Full end-to-end pipeline:
    - preprocess transcript
    - call LLM once with a structured master prompt (MVP; can fan out later)
    - validate JSON schema
    - persist Meeting + Insights in DB
    """

    cleaned = _preprocess_transcript(transcript)

    raw_json = await llm_client.complete_json(MASTER_PROMPT, cleaned)
    insights_model = coerce_and_validate_insights(raw_json)

    meeting_doc = build_meeting_document(
        title=title or f"Meeting {datetime.utcnow().isoformat()}",
        raw_transcript=cleaned,
        telegram_user_id=telegram_user_id,
        telegram_username=telegram_username,
    )
    result = await db[MEETINGS_COLLECTION].insert_one(meeting_doc)
    meeting_id = str(result.inserted_id)

    insights_doc = build_insights_document(
        meeting_id=meeting_id,
        insights={
            "summary": insights_model.summary,
            "key_points": [kp for kp in insights_model.key_points],
            "action_items": [item.model_dump() for item in insights_model.action_items],
            "decisions": [d for d in insights_model.decisions],
            "topics": [t.model_dump() for t in insights_model.topics],
            "sentiment": insights_model.sentiment.model_dump(),
        },
    )
    await db[INSIGHTS_COLLECTION].insert_one(insights_doc)

    return meeting_id, insights_model

