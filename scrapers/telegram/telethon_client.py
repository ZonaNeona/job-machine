import os
import sys
import asyncio
from typing import List, Dict, Any, Optional
from telethon import TelegramClient, events
from config import TG_API_ID, TG_API_HASH, TG_SESSION_PATH, DEFAULT_CHANNELS

# Global client singleton
_client: Optional[TelegramClient] = None

def get_client() -> Optional[TelegramClient]:
    """Returns TelegramClient instance or None if credentials are not configured."""
    global _client
    if _client is not None:
        return _client

    if not TG_API_ID or not TG_API_HASH:
        return None

    try:
        api_id_int = int(TG_API_ID)
        _client = TelegramClient(TG_SESSION_PATH, api_id_int, TG_API_HASH)
        return _client
    except Exception as e:
        print(f"[!] Error initializing Telethon client: {e}")
        return None


async def ensure_connected(client: TelegramClient) -> bool:
    """Connects client and verifies authorization."""
    if not client.is_connected():
        await client.connect()
    return await client.is_user_authorized()


async def fetch_channel_messages(
    client: TelegramClient,
    channel_name: str,
    limit: int = 25
) -> List[Dict[str, Any]]:
    """
    Fetches recent messages from specified Telegram channel or group.
    """
    clean_channel = channel_name.replace("@", "").strip()
    messages = []

    try:
        entity = await client.get_entity(clean_channel)
        async for msg in client.iter_messages(entity, limit=limit):
            if msg.message and len(msg.message.strip()) > 30:
                messages.append({
                    "id": msg.id,
                    "channel": clean_channel,
                    "text": msg.message,
                    "date": msg.date.isoformat() if msg.date else None,
                    "url": f"https://t.me/{clean_channel}/{msg.id}"
                })
    except Exception as e:
        print(f"[!] Ошибка чтения канала @{clean_channel}: {e}")

    return messages
