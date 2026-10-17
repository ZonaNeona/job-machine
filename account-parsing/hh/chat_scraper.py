# -*- coding: utf-8 -*-
"""Playwright scraper for HH personal chats (/chat)."""
from __future__ import annotations

import asyncio
import random
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from playwright.async_api import BrowserContext, Page, async_playwright

from config import (
    DEFAULT_BASE_URL,
    DEFAULT_CHAT_LIST_URL,
    PROFILE_DIR,
    STEALTH_INIT_SCRIPT,
    USER_AGENT,
)
from html_parser import ChatDetails, ChatListItem, parse_chat_details_html, parse_chat_list_html


class SessionExpiredError(RuntimeError):
    """Raised when HH redirects to login / account is not authenticated."""


async def _launch_context(headless: bool = True) -> BrowserContext:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    pw = await async_playwright().start()
    context = await pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR.resolve()),
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--window-size=1440,960",
        ],
        user_agent=USER_AGENT,
        viewport={"width": 1440, "height": 960},
        locale="ru-RU",
        timezone_id="Europe/Moscow",
    )
    # Attach playwright instance for later close
    context._jm_pw = pw  # type: ignore[attr-defined]
    return context


async def _close_context(context: BrowserContext) -> None:
    pw = getattr(context, "_jm_pw", None)
    try:
        await context.close()
    finally:
        if pw is not None:
            await pw.stop()


async def _looks_logged_in(page: Page) -> bool:
    url = (page.url or "").lower()
    if any(x in url for x in ("/account/login", "/oauth", "login.hh.ru")):
        return False
    # Chat list markers
    openers = page.locator('[data-qa^="chatik-open-chat-"]')
    if await openers.count() > 0:
        return True
    layout = page.locator('[data-qa="chatik-layout"]')
    if await layout.count() > 0:
        return True
    # Zero-state still means session is valid
    zero = page.locator('[data-qa="chatik-zero-state"], [data-qa="chatik-no-chats"]')
    if await zero.count() > 0:
        return True
    body = (await page.content()).lower()
    if "войти" in body and "регистрац" in body and "chatik" not in body:
        return False
    return "chatik" in body or "/chat" in url


async def scrape_chat_list(
    page: Page,
    chat_list_url: str = DEFAULT_CHAT_LIST_URL,
    base_url: str = DEFAULT_BASE_URL,
) -> List[ChatListItem]:
    print(f"[HH-ACCOUNT] Открываю список чатов: {chat_list_url}")
    await page.goto(chat_list_url, wait_until="domcontentloaded", timeout=45000)
    await asyncio.sleep(2.2)

    # Wait for React/chatik to paint rows
    try:
        await page.wait_for_selector(
            '[data-qa^="chatik-open-chat-"], [data-qa="chatik-zero-state"], [data-qa="chatik-no-chats"]',
            timeout=20000,
        )
    except Exception:
        pass

    if not await _looks_logged_in(page):
        raise SessionExpiredError(
            "Сессия hh.ru недействительна. Запустите: "
            "py -m account-parsing.hh.auth_session  "
            "или из папки: py auth_session.py"
        )

    html = await page.content()
    items = parse_chat_list_html(html, base_url=base_url)

    # Prefer live DOM for titles if HTML parser missed (SPA quirks)
    if not items:
        rows = page.locator('[data-qa^="chatik-open-chat-"]')
        count = await rows.count()
        for i in range(count):
            row = rows.nth(i)
            qa = await row.get_attribute("data-qa") or ""
            chat_id = qa.replace("chatik-open-chat-", "")
            if not chat_id.isdigit():
                continue
            title = ""
            counterpart = ""
            time_label = ""
            preview = ""
            try:
                title = (await row.locator('[data-qa="chat-cell-title"]').inner_text(timeout=800)).strip()
            except Exception:
                pass
            try:
                counterpart = (await row.locator('[data-qa="chat-cell-subtitle"]').inner_text(timeout=800)).strip()
            except Exception:
                pass
            try:
                time_label = (await row.locator('[data-qa="chat-cell-creation-time"]').inner_text(timeout=800)).strip()
            except Exception:
                pass
            try:
                preview = (await row.inner_text(timeout=800)).strip()
            except Exception:
                pass
            items.append(
                ChatListItem(
                    chat_id=chat_id,
                    chat_url=urljoin(base_url.rstrip("/") + "/", f"chat/{chat_id}"),
                    title=title,
                    counterpart=counterpart,
                    time_label=time_label,
                    preview=preview[:500],
                )
            )
        for item in items:
            from html_parser import _guess_has_reply
            item.has_reply_hint = _guess_has_reply(item.preview, item.counterpart, item.title)

    print(f"[HH-ACCOUNT] Найдено чатов в списке: {len(items)}")
    return items


async def scrape_chat_details(
    page: Page,
    chat_id: str,
    base_url: str = DEFAULT_BASE_URL,
) -> ChatDetails:
    url = urljoin(base_url.rstrip("/") + "/", f"chat/{chat_id}")
    print(f"[HH-ACCOUNT] Открываю чат {chat_id}...")
    await page.goto(url, wait_until="domcontentloaded", timeout=45000)
    await asyncio.sleep(1.6 + random.uniform(0.2, 0.9))
    try:
        await page.wait_for_selector(
            '[data-qa="chat-bubble-text"], [data-qa="chatik-header-vacancy-link"], [data-qa^="chatik-chat-message-"]',
            timeout=15000,
        )
    except Exception:
        pass
    html = await page.content()
    return parse_chat_details_html(html, chat_id=chat_id, base_url=base_url)


def session_profile_exists() -> bool:
    """Heuristic: Chromium profile has cookies / Default dir after first login."""
    default_dir = PROFILE_DIR / "Default"
    cookies = PROFILE_DIR / "Default" / "Network" / "Cookies"
    return default_dir.exists() or cookies.exists() or any(PROFILE_DIR.iterdir())


async def run_hh_chat_scrape(
    *,
    base_url: str = DEFAULT_BASE_URL,
    chat_list_url: Optional[str] = None,
    open_details: bool = True,
    max_open: int = 12,
    force_open_ids: Optional[List[str]] = None,
    known_fingerprints: Optional[Dict[str, str]] = None,
    headless: bool = True,
) -> Dict[str, Any]:
    """
    Scrape chat list and selectively open chats that look new/changed
    or still miss vacancy_id mapping.
    """
    list_url = chat_list_url or urljoin(base_url.rstrip("/") + "/", "chat")
    known_fingerprints = known_fingerprints or {}
    force_open_ids = set(force_open_ids or [])

    context = await _launch_context(headless=headless)
    page = await context.new_page()
    await page.add_init_script(STEALTH_INIT_SCRIPT)

    result: Dict[str, Any] = {
        "chats": [],
        "details": {},
        "session_ok": False,
        "opened": 0,
        "error": None,
    }

    try:
        items = await scrape_chat_list(page, chat_list_url=list_url, base_url=base_url)
        result["session_ok"] = True
        result["chats"] = [item.to_dict() for item in items]

        to_open: List[ChatListItem] = []
        if open_details:
            for item in items:
                prev_fp = known_fingerprints.get(item.chat_id)
                changed = prev_fp is None or prev_fp != item.fingerprint()
                needs_vacancy = item.chat_id in force_open_ids or changed or item.has_reply_hint
                if needs_vacancy:
                    to_open.append(item)

            # Cap opens; prioritize reply hints + changed
            to_open.sort(key=lambda c: (not c.has_reply_hint, c.chat_id), reverse=False)
            to_open = to_open[: max(0, int(max_open))]

            for item in to_open:
                try:
                    details = await scrape_chat_details(page, item.chat_id, base_url=base_url)
                    result["details"][item.chat_id] = details.to_dict()
                    result["opened"] += 1
                    await asyncio.sleep(random.uniform(1.2, 2.8))
                except Exception as exc:
                    print(f"[HH-ACCOUNT] Не удалось открыть чат {item.chat_id}: {exc}")

    except SessionExpiredError as exc:
        result["session_ok"] = False
        result["error"] = str(exc)
        print(f"[HH-ACCOUNT] {exc}")
    except Exception as exc:
        result["error"] = str(exc)
        print(f"[HH-ACCOUNT] Ошибка сбора: {exc}")
    finally:
        await _close_context(context)

    return result


async def check_session(headless: bool = True, base_url: str = DEFAULT_BASE_URL) -> Dict[str, Any]:
    list_url = urljoin(base_url.rstrip("/") + "/", "chat")
    context = await _launch_context(headless=headless)
    page = await context.new_page()
    await page.add_init_script(STEALTH_INIT_SCRIPT)
    try:
        await page.goto(list_url, wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(2.0)
        ok = await _looks_logged_in(page)
        return {
            "session_ok": ok,
            "profile_path": str(PROFILE_DIR.resolve()),
            "url": page.url,
            "profile_exists": session_profile_exists(),
        }
    finally:
        await _close_context(context)
