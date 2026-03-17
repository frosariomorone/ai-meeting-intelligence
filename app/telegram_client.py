from __future__ import annotations

import os
from typing import List, Optional

from fastapi import HTTPException, status
from telethon import TelegramClient
from telethon.errors import RPCError
from telethon.tl.custom import Dialog

from app.config import settings


_client: Optional[TelegramClient] = None


def get_telegram_client() -> TelegramClient:
    """
    Return a singleton Telethon client using MTProto user session.

    IMPORTANT:
    - We expect the session file to ALREADY exist (created via scripts/telegram_login.py).
    - If it does not exist, we return a 503 instead of trying to prompt for input
      (which would fail inside the server process).
    """
    global _client

    if _client is not None:
        return _client

    if not settings.telegram_api_id or not settings.telegram_api_hash:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram MTProto is not configured. Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env.",
        )

    if not os.path.exists(settings.telegram_session_file):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Telegram session file not found. "
                "Run 'python -m scripts.telegram_login' locally to create it, "
                "and ensure it is available inside the backend container."
            ),
        )

    try:
        client = TelegramClient(
            settings.telegram_session_file,
            settings.telegram_api_id,
            settings.telegram_api_hash,
        )
        _client = client
        return client
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize Telegram client: {exc}",
        ) from exc


async def list_dialogs(limit: int = 50) -> List[dict]:
    """
    List recent dialogs (users/groups/channels).
    """
    client = get_telegram_client()

    # We assume the session is already authorized; just connect.
    await client.connect()

    dialogs: List[Dialog] = []
    try:
        async for d in client.iter_dialogs(limit=limit):
            dialogs.append(d)
    finally:
        await client.disconnect()

    results: List[dict] = []
    for d in dialogs:
        entity = d.entity
        username = getattr(entity, "username", None)
        dialog_type = entity.__class__.__name__
        results.append(
            {
                "id": str(d.id),
                "title": d.name,
                "username": username,
                "type": dialog_type,
            }
        )
    return results


async def fetch_history(peer_id: str, limit: int = 200) -> str:
    """
    Fetch recent message history with a peer and concatenate into a text transcript.
    """
    client = get_telegram_client()
    await client.connect()

    try:
        # For most cases, casting to int is enough; if it fails, fall back to string username.
        try:
            entity = await client.get_entity(int(peer_id))
        except ValueError:
            entity = await client.get_entity(peer_id)

        messages = []
        async for msg in client.iter_messages(entity, limit=limit):
            if not msg.message:
                continue
            sender = None
            if msg.sender:
                sender = getattr(msg.sender, "first_name", None) or getattr(
                    msg.sender, "username", None
                )
            prefix = f"{sender}: " if sender else ""
            messages.append(prefix + msg.message)
    except RPCError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Telegram API error: {exc}",
        ) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Telegram history: {exc}",
        ) from exc
    finally:
        await client.disconnect()

    # Oldest first for better reading
    messages.reverse()
    return "\n".join(messages)

