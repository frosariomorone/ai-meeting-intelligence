import os
import asyncio
from pathlib import Path

from telethon import TelegramClient
from dotenv import load_dotenv


async def _login() -> None:
    # Load environment variables from the project .env
    load_dotenv()

    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    session_name = os.getenv("TELEGRAM_SESSION_FILE", "telegram.session")

    if not api_id or not api_hash:
        raise SystemExit("Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in your .env file.")

    # Always create the session file in the project root (one level up from scripts/)
    project_root = Path(__file__).resolve().parent.parent
    session_path = project_root / session_name
    session_path.parent.mkdir(parents=True, exist_ok=True)

    client = TelegramClient(str(session_path), int(api_id), api_hash)

    print("Connecting to Telegram...")
    await client.start()
    me = await client.get_me()
    print(f"Logged in as {me.first_name} (@{getattr(me, 'username', '')})")
    print(f"Session saved to {session_path}")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(_login())


