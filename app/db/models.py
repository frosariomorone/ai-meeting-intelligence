from datetime import datetime


MEETINGS_COLLECTION = "meetings"
INSIGHTS_COLLECTION = "insights"
EMBEDDINGS_COLLECTION = "meeting_embeddings"


def build_meeting_document(
    title: str,
    raw_transcript: str,
    telegram_user_id: str | None = None,
    telegram_username: str | None = None,
) -> dict:
    doc: dict = {
        "title": title,
        "created_at": datetime.utcnow(),
        "raw_transcript": raw_transcript,
    }
    if telegram_user_id:
        doc["telegram_user_id"] = telegram_user_id
    if telegram_username:
        doc["telegram_username"] = telegram_username
    return doc


def build_insights_document(meeting_id: str, insights: dict) -> dict:
    return {
        "meeting_id": meeting_id,
        **insights,
    }

