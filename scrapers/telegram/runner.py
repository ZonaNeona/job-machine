import sys
import asyncio
import argparse

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from pathlib import Path

# Add web-app/backend to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent / "web-app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from config import DEFAULT_CHANNELS, TG_API_ID, TG_API_HASH
from pipeline import run_telegram_pipeline
from telethon_client import get_client, ensure_connected
from database import SessionLocal
from models import Lead, KnowledgeBaseItem
import ai_service
from telethon import events
from parser_utils import is_relevant_message, extract_contacts, extract_salary, extract_title_and_company

async def run_demo_simulation():
    """
    Inserts high-converting, realistic Telegram orders from founders/SMBs 
    to demonstrate live pipeline, contact extraction, and AI scoring.
    """
    print("\n[DEMO] Запуск демонстрационного сбора лидов из Telegram...")
    db = SessionLocal()

    sample_tg_posts = [
        {
            "channel": "jobgeek",
            "id": 51201,
            "text": """#вакансия #telegram #ai #удаленка
Ищем опытного разработчика Telegram-ботов со знанием LLM на проектную работу / долгосрочный подряд!

Компания: AI Growth Agency
Задача:
Разработать и внедрить Telegram-бота для квалификации входящих B2B заявок.
Бот должен:
- Проводить скоринг клиента через OpenAI / Claude по чек-листу
- Интегрироваться с нашей amoCRM по API (создание сделки, запись ответов)
- Поддерживать стриминг ответов без задержек

Стек: Python, Aiogram 3, FastAPI, amoCRM API, OpenRouter.
Формат: Удаленно, свободный график.
Оплата: 90 000 руб./мес. за разработку и последующее сопровождение.
Для отклика пишите сразу с кейсами в ЛС: @alex_aigrowth или на почту hr@aigrowth.agency"""
        },
        {
            "channel": "telerabota_rf",
            "id": 84192,
            "text": """Срочно ищем спеца по Telethon / парсингу данных!
Нужно написать скрипт-парсер целевых чатов конкурентов с фильтрацией сообщений по ключевым словам.
Главное требование: стабильная работа без банов аккаунтов (ротация прокси, соблюдение лимитов Telegram).
Бюджет: 85 000 руб. (готовы платить фиксом или помесячно за поддержку парсеров).
Контакт для связи в TG: @sergey_leadtech"""
        },
        {
            "channel": "forwork_it",
            "id": 92104,
            "text": """Требуется Python-разработчик для автоматизации бизнес-процессов (e-commerce).
Связать маркетплейсы (WB/Ozon) через API с 1С и выгружать аналитику в дашборды.
Оплата: 80 000 - 100 000 руб./мес. Регулярный подряд.
Связь: @dmitry_ecomdev"""
        }
    ]

    kb_items = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.is_active == True).all()
    kb_data = [{"title": k.title, "content": k.content, "category": k.category} for k in kb_items]

    existing_ids = set(
        row[0] for row in db.query(Lead.external_id).filter(Lead.external_id.isnot(None)).all()
    )

    added = 0
    for post in sample_tg_posts:
        ext_id = f"tg_{post['channel']}_{post['id']}"
        if ext_id in existing_ids:
            continue

        title, company = extract_title_and_company(post["text"], post["channel"])
        contacts = extract_contacts(post["text"])
        salary_raw, sal_min, sal_max = extract_salary(post["text"])

        score_res = await ai_service.score_lead(title, post["text"], kb_data)
        match_score = score_res.get("match_score", 90)
        scoring_reason = score_res.get("scoring_reason", "Отличное совпадение по стеку и чеку.")

        lead = Lead(
            external_id=ext_id,
            title=title,
            company=company,
            source="telegram",
            url=f"https://t.me/{post['channel']}/{post['id']}",
            salary_raw=salary_raw,
            salary_min=sal_min,
            salary_max=sal_max,
            contact_info=contacts,
            location="Удаленно",
            job_type="Парт-тайм / Подряд",
            description=post["text"],
            tags="Telegram, LLM, Python, Automation",
            status="ai_scored",
            match_score=match_score,
            scoring_reason=scoring_reason,
            generated_offer=None,
            custom_notes=f"Перехвачено из канала @{post['channel']}"
        )
        db.add(lead)
        db.commit()
        added += 1
        print(f"   [OK] Добавлен лид из Telegram: '{title[:45]}...' ({salary_raw}) | Контакт: {contacts}")

    db.close()
    print(f"\n[DEMO] Добавлено новых заказов из Telegram: {added}\n")


async def start_realtime_listener():
    """Starts live MTProto background event listener for monitored channels."""
    client = get_client()
    if not client:
        print("[!] Ошибка: Не настроен TG_API_ID / TG_API_HASH в .env")
        return

    is_auth = await ensure_connected(client)
    if not is_auth:
        print("[!] Ошибка: Сессия Telethon не авторизована. Запустите 'py auth_helper.py'")
        return

    print("=" * 65)
    print("📡 [TELETHON] Запущен фоновый real-time перехват сообщений...")
    print(f"Каналы: {', '.join(['@' + c for c in DEFAULT_CHANNELS])}")
    print("При появлении новых сообщений лиды автоматически попадают в базу!")
    print("Для остановки нажмите Ctrl+C")
    print("=" * 65 + "\n")

    db = SessionLocal()
    kb_items = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.is_active == True).all()
    kb_data = [{"title": k.title, "content": k.content, "category": k.category} for k in kb_items]
    db.close()

    @client.on(events.NewMessage(chats=DEFAULT_CHANNELS))
    async def handler(event):
        text = event.message.message
        if not text or not is_relevant_message(text):
            return

        chat = await event.get_chat()
        channel_name = getattr(chat, 'username', str(event.chat_id))
        msg_id = event.message.id
        ext_id = f"tg_{channel_name}_{msg_id}"

        title, company = extract_title_and_company(text, channel_name)
        contacts = extract_contacts(text)
        salary_raw, sal_min, sal_max = extract_salary(text)

        print(f"\n🔥 [REAL-TIME] Перехвачен новый заказ в @{channel_name}: '{title[:40]}...'")

        score_res = await ai_service.score_lead(title, text, kb_data)
        match_score = score_res.get("match_score", 70)

        if match_score >= 65:
            local_db = SessionLocal()
            try:
                new_lead = Lead(
                    external_id=ext_id,
                    title=title,
                    company=company,
                    source="telegram",
                    url=f"https://t.me/{channel_name}/{msg_id}",
                    salary_raw=salary_raw,
                    salary_min=sal_min,
                    salary_max=sal_max,
                    contact_info=contacts,
                    location="Удаленно",
                    job_type="Проект / Подряд",
                    description=text,
                    tags="Telegram, Python, Live",
                    status="ai_scored",
                    match_score=match_score,
                    scoring_reason=score_res.get("scoring_reason", ""),
                    custom_notes=f"Перехвачено в real-time из @{channel_name}"
                )
                local_db.add(new_lead)
                local_db.commit()
                print(f"   [OK] Лид сохранен в базу! ID: #{new_lead.id} | Контакт: {contacts}")
            finally:
                local_db.close()

    await client.run_until_disconnected()


async def main():
    parser = argparse.ArgumentParser(description="JobMachine Telegram Lead Ingestion Engine")
    parser.add_argument("--once", action="store_true", help="Запустить один цикл сбора по каналам и выйти")
    parser.add_argument("--channel", type=str, help="Собрать сообщения только из конкретного канала")
    parser.add_argument("--listen", action="store_true", help="Запустить постоянный real-time перехват сообщений")
    parser.add_argument("--demo", action="store_true", help="Запустить демонстрационный сбор тестовых лидов")
    parser.add_argument("--limit", type=int, default=25, help="Количество сообщений на канал")

    args = parser.parse_args()

    if args.demo:
        await run_demo_simulation()
        return

    if args.listen:
        await start_realtime_listener()
        return

    channels = [args.channel] if args.channel else DEFAULT_CHANNELS
    await run_telegram_pipeline(channels=channels, limit_per_channel=args.limit)


if __name__ == "__main__":
    asyncio.run(main())
