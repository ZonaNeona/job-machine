import sys
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run():
    with sync_playwright() as p:
        # Launch with flags avoiding automation detection
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-size=1920,1080",
                "--start-maximized"
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="ru-RU",
            timezone_id="Europe/Moscow"
        )
        
        # Add stealth script to override navigator.webdriver
        page = context.new_page()
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            window.chrome = {
                runtime: {}
            };
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['ru-RU', 'ru', 'en-US', 'en']
            });
        """)

        print("[*] Navigating to Avito Vacancies...")
        try:
            resp = page.goto("https://www.avito.ru/rossiya/vakansii?q=python", timeout=25000, wait_until="domcontentloaded")
            print(f"Status: {resp.status if resp else 'No resp'}")
            print(f"Page title: {page.title()}")
            content = page.content()
            print(f"Content length: {len(content)}")
            
            # Check for items
            items = page.locator("[data-marker='item']").all()
            print(f"Items found: {len(items)}")
            if len(items) > 0:
                for it in items[:3]:
                    print("  Title:", it.locator("[itemprop='name']").text_content())
            else:
                # print snippet of page text
                print("Snippet:", page.locator("body").text_content()[:300])
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
