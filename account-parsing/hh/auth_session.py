# -*- coding: utf-8 -*-
"""
Interactive HH.ru login helper.
Opens a visible Chromium with persistent profile so cookies are saved
for subsequent headless chat sync.

Usage (from repo root):
    py account-parsing/hh/auth_session.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from playwright.async_api import async_playwright

from config import DEFAULT_CHAT_LIST_URL, PROFILE_DIR, STEALTH_INIT_SCRIPT, USER_AGENT


async def main() -> None:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    print("=" * 65)
    print(" HH.ru — мастер авторизации для мониторинга чатов")
    print("=" * 65)
    print(f"[*] Профиль браузера: {PROFILE_DIR.resolve()}")
    print("[*] Откроется окно Chromium. Войдите в аккаунт соискателя.")
    print("[*] После входа дождитесь страницы /chat и закройте окно")
    print("    или подождите авто-проверку (~90 сек).")
    print("-" * 65)

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR.resolve()),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--start-maximized",
            ],
            user_agent=USER_AGENT,
            locale="ru-RU",
            timezone_id="Europe/Moscow",
        )
        page = await context.new_page()
        await page.add_init_script(STEALTH_INIT_SCRIPT)

        try:
            await page.goto(DEFAULT_CHAT_LIST_URL, wait_until="domcontentloaded")
            print("[OK] Страница чатов открыта. Войдите, если нужно...")

            logged_in = False
            for i in range(90):
                await asyncio.sleep(1)
                url = (page.url or "").lower()
                try:
                    chat_rows = await page.locator('[data-qa^="chatik-open-chat-"]').count()
                    layout = await page.locator('[data-qa="chatik-layout"]').count()
                except Exception:
                    chat_rows = 0
                    layout = 0

                if chat_rows > 0 or layout > 0:
                    logged_in = True
                    print(f"\n[SUCCESS] Сессия активна (чатов видно: {chat_rows}).")
                    break
                if "/account/login" in url or "login.hh.ru" in url:
                    if i % 15 == 0:
                        print("[*] Ожидание логина...")

            if not logged_in:
                print("[WARN] Авто-проверка не подтвердила вход.")
                print("       Если вы уже вошли — профиль всё равно сохранён,")
                print("       закройте окно и попробуйте sync.")
            else:
                await asyncio.sleep(3)
        except Exception as exc:
            print(f"[ERR] {exc}")
        finally:
            await context.close()
            print("[*] Профиль сохранён. Можно запускать синхронизацию из HQ.")


if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    asyncio.run(main())
