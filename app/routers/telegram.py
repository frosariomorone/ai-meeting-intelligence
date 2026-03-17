from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.telegram_client import list_dialogs, fetch_history


class TelegramDialog(BaseModel):
    id: str
    title: str
    username: str | None = None
    type: str | None = None


class TelegramHistoryResponse(BaseModel):
    transcript: str


router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.get("/dialogs", response_model=List[TelegramDialog])
async def get_dialogs(limit: int = Query(50, ge=1, le=200)) -> List[TelegramDialog]:
    """
    Return recent Telegram dialogs (users, groups, channels) from the MTProto session.
    """
    dialogs_raw = await list_dialogs(limit=limit)
    return [TelegramDialog(**d) for d in dialogs_raw]


@router.get("/history", response_model=TelegramHistoryResponse)
async def get_history(peer_id: str = Query(...), limit: int = Query(200, ge=1, le=1000)) -> TelegramHistoryResponse:
    """
    Fetch recent message history for the given peer id and return as plaintext transcript.
    """
    if not peer_id:
        raise HTTPException(status_code=400, detail="peer_id is required")
    transcript = await fetch_history(peer_id=peer_id, limit=limit)
    return TelegramHistoryResponse(transcript=transcript)

