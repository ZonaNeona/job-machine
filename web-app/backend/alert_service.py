"""
Telegram Alert Service for JobMachine.
Sends real-time push notifications to the user's personal Telegram chat
when a high-match lead (Score >= 80%) is discovered or when a client responds.
"""
import os
import sys
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
import httpx
from dotenv import load_dotenv

# Ensure .env is loaded
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

ALERT_BOT_TOKEN = os.getenv("ALERT_BOT_TOKEN", "").strip()
ALERT_CHAT_ID = os.getenv("ALERT_CHAT_ID", "").strip()

def is_configured() -> bool:
    """Check if bot token and chat ID are configured."""
    return bool(ALERT_BOT_TOKEN and ALERT_CHAT_ID and "your_bot_token" not in ALERT_BOT_TOKEN)

async def send_raw_message(text: str, reply_markup: Optional[Dict[str, Any]] = None) -> bool:
    """Send arbitrary HTML message via Telegram Bot API."""
    token = os.getenv("ALERT_BOT_TOKEN", "").strip()
    chat_id = os.getenv("ALERT_CHAT_ID", "").strip()

    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                return True
            else:
                print(f"[WARN] [AlertService] Telegram API error: {resp.status_code} - {resp.text}")
                return False
    except Exception as e:
        print(f"[ERR] [AlertService] Не удалось отправить алерт: {e}")
        return False

async def send_lead_alert(lead: Dict[str, Any]) -> bool:
    """
    Format and send hot lead alert to user's Telegram.
    """
    if not is_configured():
        return False

    title = lead.get("title", "Новый проект")
    company = lead.get("company", "Заказчик")
    source = lead.get("source", "Площадка")
    salary = lead.get("salary_raw") or lead.get("salary") or "По договоренности"
    score = lead.get("match_score", 0)
    url = lead.get("url", "")
    reason = lead.get("scoring_reason") or lead.get("ai_summary", "")

    # Source visual label
    source_labels = {
        "hh.ru": "🔴 hh.ru",
        "telegram": "🔵 Telegram Чат",
        "habr_freelance": "🟣 Хабр Карьера",
        "fl_ru": "🟠 FL.ru Биржа",
        "kwork": "🟢 Kwork"
    }
    source_name = source_labels.get(source, f"🌐 {source}")

    # Build HTML Message
    lines = [
        f"🔥 <b>ГОРЯЧИЙ ЛИД [Score: {score}%]</b>",
        f"━━━━━━━━━━━━━━━━━━",
        f"📌 <b>Проект:</b> {title}",
        f"🏢 <b>Компания:</b> {company}",
        f"💰 <b>Бюджет:</b> <code>{salary}</code>",
        f"📡 <b>Канал:</b> {source_name}",
    ]

    if lead.get("tags"):
        lines.append(f"🏷 <b>Стек:</b> <i>{lead['tags']}</i>")

    if reason:
        # truncate reason if too long
        short_reason = reason[:280] + "..." if len(reason) > 280 else reason
        lines.append(f"\n💡 <b>ИИ-анализ:</b>\n{short_reason}")

    lines.append(f"\n🎯 <b>Цель:</b> Retainer 85 000 ₽ / мес")

    text = "\n".join(lines)

    # Inline Buttons
    buttons = []
    row1 = []
    if url:
        row1.append({"text": "🌐 Открыть заказ", "url": url})
    row1.append({"text": "🎛 Командный Пункт", "url": "http://localhost:5173"})
    buttons.append(row1)

    reply_markup = {"inline_keyboard": buttons}
    return await send_raw_message(text, reply_markup=reply_markup)

async def send_client_reply_alert(lead_title: str, client_name: str, message_snippet: str) -> bool:
    """Send instant push notification when a client replies to an outreach offer."""
    if not is_configured():
        return False

    text = (
        f"🚨 <b>ОТВЕТ ОТ ЗАКАЗЧИКА! ВЫХОД НА СОЗВОН</b> 🚨\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"👤 <b>Клиент:</b> {client_name}\n"
        f"📌 <b>Вакансия / Проект:</b> {lead_title}\n"
        f"💬 <b>Сообщение:</b>\n<i>«{message_snippet[:350]}»</i>\n\n"
        f"⚡️ <i>Срочно ответьте в течение 5 минут для максимальной конверсии!</i>"
    )
    return await send_raw_message(text)

async def test_alert() -> Dict[str, Any]:
    """Test function to verify bot token and chat_id."""
    if not is_configured():
        return {
            "status": "not_configured",
            "message": "ALERT_BOT_TOKEN или ALERT_CHAT_ID не заданы в .env. Заполните их по инструкции в USER_ACTION_GUIDE.md"
        }

    test_lead = {
        "title": "Senior Python / LLM Архитектор (Telegram-боты & RAG)",
        "company": "AI StartUp Hub",
        "source": "habr_freelance",
        "salary_raw": "85 000 – 90 000 ₽ / мес (Retainer)",
        "match_score": 98,
        "tags": "Python 3.12, FastAPI, Telethon, Claude 3.5, Docker",
        "scoring_reason": "Тестовое оповещение системы JobMachine HQ. Телеграм-алертер настроен идеально!",
        "url": "http://localhost:5173"
    }

    success = await send_lead_alert(test_lead)
    if success:
        return {"status": "success", "message": "Тестовый алерт успешно доставлен в ваш Telegram!"}
    else:
        return {"status": "error", "message": "Ошибка отправки в Telegram. Проверьте правильность токена и Chat ID."}

if __name__ == "__main__":
    if "--test" in sys.argv:
        print("[*] Отправка тестового алерта в Telegram...")
        res = asyncio.run(test_alert())
        print(f"Результат: {res}")
