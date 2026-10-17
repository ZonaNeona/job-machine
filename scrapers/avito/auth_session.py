"""
Interactive Browser Session for Avito.
Launches a visible Chromium window with persistent profile to solve hCaptcha / log in.
Once completed, session cookies and TLS fingerprints are saved into `browser_profile/`
allowing subsequent headless automated scraping.
Usage:
    py -m scrapers.avito.auth_session
"""
import sys
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

CURRENT_DIR = Path(__file__).resolve().parent
PROFILE_DIR = CURRENT_DIR / "browser_profile"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
"""

async def main():
    print("=" * 65)
    print("🤖 МАСТЕР АВТОРИЗАЦИИ И СНЯТИЯ КАПЧИ АВИТО (AVITO STEALTH HELPER)")
    print("=" * 65)
    print(f"[*] Профиль браузера: {PROFILE_DIR.resolve()}")
    print("[*] Запуск видимого окна браузера...")
    print("[*] Если появится экран с проверкой ('Доступ ограничен / капча') —")
    print("    пожалуйста, поставьте галочку и нажмите 'Продолжить'.")
    print("[*] Браузер сохранит сессию и закроется автоматически через 30 секунд (или закройте окно сами).")
    print("-" * 65)

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR.resolve()),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--start-maximized"
            ],
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="ru-RU",
            timezone_id="Europe/Moscow"
        )

        page = await context.new_page()
        await page.add_init_script(STEALTH_INIT_SCRIPT)

        try:
            await page.goto("https://www.avito.ru/rossiya/vakansii?q=python", wait_until="domcontentloaded")
            print("[OK] Страница открыта. Ожидание действий пользователя (30 сек)...")
            
            # Wait up to 30 seconds or until user solves it
            for _ in range(30):
                await asyncio.sleep(1)
                title = await page.title()
                if "Вакансии" in title or "Работа" in title:
                    print(f"\n[SUCCESS] Успешно пройдено! Заголовок: '{title}'")
                    print("[OK] Сессия сохранена в browser_profile/. Теперь фоновый скрапер может работать автоматически.")
                    break
        except Exception as e:
            print(f"[ERR] Ошибка: {e}")
        finally:
            await context.close()
            print("[*] Сессия успешно сохранена.")

if __name__ == "__main__":
    asyncio.run(main())
