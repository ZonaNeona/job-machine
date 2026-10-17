import sys
import os
import asyncio
from pathlib import Path
from typing import Dict, Any, List

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add web-app/backend to sys.path to reuse DB models and AI service
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent / "web-app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
from database import SessionLocal
from models import Lead, KnowledgeBaseItem
from classifier import classify_lead_full
import ai_service

from config import (
    DEFAULT_CHANNELS, 
    MESSAGE_FETCH_LIMIT, 
    TG_API_ID, 
    TG_API_HASH, 
    TG_NOTIFICATION_BOT_TOKEN, 
    TG_ADMIN_CHAT_ID
)
from telethon_client import get_client, ensure_connected, fetch_channel_messages
from parser_utils import is_relevant_message, extract_contacts, extract_salary, extract_title_and_company

async def send_telegram_alert(lead: Lead):
    """Sends immediate alert to user's personal Telegram bot if token is configured."""
    if not TG_NOTIFICATION_BOT_TOKEN or not TG_ADMIN_CHAT_ID:
        return

    text = f"""🚨 <b>Новый горячий заказ из Telegram!</b>

<b>Проект:</b> {lead.title}
<b>Источник:</b> {lead.company}
<b>Ставка/Вилка:</b> {lead.salary_raw}
<b>Match Score:</b> {lead.match_score}%
<b>Контакты:</b> <code>{lead.contact_info}</code>

<b>AI-Анализ:</b>
<i>{lead.scoring_reason}</i>

👉 <a href="{lead.url}">Открыть сообщение в Telegram</a>
"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{TG_NOTIFICATION_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": TG_ADMIN_CHAT_ID,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False
                }
            )
    except Exception as e:
        print(f"[!] Ошибка отправки уведомления в Telegram-бот: {e}")


async def run_telegram_pipeline(channels: List[str] = None, limit_per_channel: int = MESSAGE_FETCH_LIMIT) -> Dict[str, Any]:
    """
    Executes Telegram lead ingestion:
    1. Connects via Telethon MTProto client
    2. Scans recent messages from channels/groups
    3. Filters dev & automation keywords
    4. Extracts contacts, salary, and title
    5. Scores via AI Engine and saves to SQLite
    """
    if channels is None:
        channels = DEFAULT_CHANNELS

    db = SessionLocal()
    stats = {
        "channels_scanned": 0,
        "messages_checked": 0,
        "already_exists": 0,
        "new_leads_saved": 0,
        "skipped_irrelevant": 0,
        "errors": 0,
        "mode": "telethon"
    }

    client = get_client()

    # If Telethon is not configured, inform and return status
    if not client:
        stats["mode"] = "unconfigured"
        stats["message"] = "TG_API_ID и TG_API_HASH не настроены в web-app/backend/.env. Запустите 'py auth_helper.py' для настройки."
        print(f"[!] {stats['message']}")
        db.close()
        return stats

    try:
        is_auth = await ensure_connected(client)
        if not is_auth:
            stats["mode"] = "unauthorized"
            stats["message"] = "Сессия Telethon не авторизована. Запустите 'py scrapers/telegram/auth_helper.py' для входа по номеру телефона."
            print(f"[!] {stats['message']}")
            return stats

        # Load existing TG external IDs to prevent duplicates
        existing_ids = set(
            row[0] for row in db.query(Lead.external_id).filter(Lead.external_id.isnot(None)).all()
        )

        # Load KB for AI scoring
        kb_items = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.is_active == True).all()
        kb_data = [{"title": k.title, "content": k.content, "category": k.category} for k in kb_items]

        for channel in channels:
            print(f"\n[SEARCH] [TG] Сканирование канала @{channel} (до {limit_per_channel} сообщений)...")
            stats["channels_scanned"] += 1

            raw_messages = await fetch_channel_messages(client, channel, limit=limit_per_channel)
            stats["messages_checked"] += len(raw_messages)
            print(f"   -> Получено сообщений: {len(raw_messages)}")

            for msg in raw_messages:
                ext_id = f"tg_{msg['channel']}_{msg['id']}"
                if ext_id in existing_ids:
                    stats["already_exists"] += 1
                    continue

                # Check relevance
                if not is_relevant_message(msg["text"]):
                    stats["skipped_irrelevant"] += 1
                    existing_ids.add(ext_id)
                    continue

                # Extract fields
                title, company = extract_title_and_company(msg["text"], msg["channel"])
                contacts = extract_contacts(msg["text"])
                salary_raw, sal_min, sal_max = extract_salary(msg["text"])

                print(f"   [+] Найден релевантный пост: '{title[:45]}...'")

                # AI Scoring
                score_res = await ai_service.score_lead(
                    title=title,
                    description=msg["text"],
                    kb_items=kb_data
                )
                match_score = score_res.get("match_score", 50)
                scoring_reason = score_res.get("scoring_reason", "")

                if match_score < 60:
                    print(f"   [-] Пропущен (низкий score: {match_score}%): {title[:35]}")
                    stats["skipped_irrelevant"] += 1
                    existing_ids.add(ext_id)
                    continue

                # Classify stream, deal type, urgency
                cl = classify_lead_full(
                    title=title,
                    description=msg["text"],
                    tags="Telegram, Python, Automation",
                    salary_raw=salary_raw,
                    contact_info=contacts,
                )

                # Create Lead
                new_lead = Lead(
                    external_id=ext_id,
                    title=title,
                    company=company,
                    source="telegram",
                    url=msg["url"],
                    salary_raw=salary_raw,
                    salary_min=sal_min,
                    salary_max=sal_max,
                    contact_info=contacts,
                    location="Удаленно",
                    job_type="Проект / Подряд",
                    description=msg["text"],
                    tags="Telegram, Python, Automation",
                    status="ai_scored" if match_score >= 75 else "new",
                    match_score=match_score,
                    scoring_reason=scoring_reason,
                    generated_offer=None,
                    custom_notes=f"Перехвачено из Telegram @{msg['channel']}",
                    category=cl["category"],
                    deal_type=cl["deal_type"],
                    urgency=cl["urgency"],
                )

                db.add(new_lead)
                db.commit()
                db.refresh(new_lead)
                existing_ids.add(ext_id)
                stats["new_leads_saved"] += 1

                print(f"   [OK] Сохранен лид из Telegram! ID: #{new_lead.id} | Score: {match_score}% | Контакт: {contacts}")

                # Immediate push notification if configured
                await send_telegram_alert(new_lead)

    except Exception as e:
        print(f"[!] Ошибка пайплайна Telegram: {e}")
        stats["errors"] += 1

    finally:
        db.close()

    print("\n" + "=" * 60)
    print("[STATS] ИТОГИ СБОРА С TELEGRAM:")
    print(f"  * Каналов просканировано: {stats['channels_scanned']}")
    print(f"  * Сообщений проверено: {stats['messages_checked']}")
    print(f"  * Уже в базе (дубликаты): {stats['already_exists']}")
    print(f"  * Отсеяно нерелевантных: {stats['skipped_irrelevant']}")
    print(f"  * Сохранено новых лидов: {stats['new_leads_saved']}")
    print(f"  * Ошибок: {stats['errors']}")
    print("=" * 60 + "\n")

    return stats
