from bs4 import BeautifulSoup

with open("scratch/test_avito_playwright.py", "r", encoding="utf-8") as f:
    pass

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("https://www.avito.ru/rossiya/vakansii?q=python")
    html = page.content()
    soup = BeautifulSoup(html, "html.parser")
    print("Forms found:", len(soup.find_all("form")))
    print("Buttons found:", [b.text.strip() for b in soup.find_all("button")])
    print("Inputs found:", [i.get("name") or i.get("type") for i in soup.find_all("input")])
    iframes = soup.find_all("iframe")
    print("Iframes found:", len(iframes))
    for ifr in iframes:
        print("  Iframe src:", ifr.get("src"))
    browser.close()
