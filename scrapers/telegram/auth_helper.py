import sys
import asyncio
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from config import TG_API_ID, TG_API_HASH, TG_PHONE, TG_SESSION_PATH
from telethon import TelegramClient

async def authorize_telegram():
    print("=" * 65)
    print("📱 JOBMACHINE TELEGRAM: Мастер авторизации Telethon")
    print("=" * 65)

    if not TG_API_ID or not TG_API_HASH:
        print("\n[!] ОШИБКА: TG_API_ID и TG_API_HASH не найдены в файле web-app/backend/.env!")
        print("\nКак получить за 1 минуту:")
        print("1. Перейдите на https://my.telegram.org и войдите по номеру телефона.")
        print("2. Откройте раздел 'API development tools'.")
        print("3. Создайте приложение (любое имя, например 'JobMachine').")
        print("4. Скопируйте 'api_id' и 'api_hash' в web-app/backend/.env:")
        print("   TG_API_ID=12345678")
        print("   TG_API_HASH=abcdef1234567890abcdef...")
        print("   TG_PHONE=+79991234567")
        print("\nПосле этого запустите этот скрипт снова: py auth_helper.py")
        return

    client = TelegramClient(TG_SESSION_PATH, int(TG_API_ID), TG_API_HASH)
    await client.connect()

    if await client.is_user_authorized():
        me = await client.get_me()
        print(f"\n[OK] Сессия уже авторизована!")
        print(f"Пользователь: {me.first_name} (@{me.username or 'без юзернейма'})")
        print(f"Файл сессии: {TG_SESSION_PATH}")
        await client.disconnect()
        return

    phone = TG_PHONE or input("\nВведите номер телефона (в формате +7999...): ").strip()
    await client.start(phone=phone)

    me = await client.get_me()
    print("\n" + "=" * 65)
    print(f"[OK] УСПЕШНАЯ АВТОРИЗАЦИЯ!")
    print(f"Вы вошли как: {me.first_name} (@{me.username or 'без юзернейма'})")
    print(f"Файл сессии сохранен в: {TG_SESSION_PATH}")
    print("Теперь сборщик лидов из Telegram готов к фоновой работе!")
    print("=" * 65)

    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(authorize_telegram())
