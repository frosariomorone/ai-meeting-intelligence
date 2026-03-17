from app.config import settings
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


client = AsyncIOMotorClient(settings.mongodb_url)
db: AsyncIOMotorDatabase = client[settings.mongodb_db_name]

async def get_db() -> AsyncIOMotorDatabase:
    return db

