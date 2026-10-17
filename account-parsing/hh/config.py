# -*- coding: utf-8 -*-
"""Defaults for HH account chat monitoring."""
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROFILE_DIR = CURRENT_DIR / "browser_profile"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

# Public chat list; region subdomain redirects after login.
DEFAULT_CHAT_LIST_URL = "https://hh.ru/chat"
DEFAULT_BASE_URL = "https://hh.ru"

PLATFORM_ID = "hh.ru"

# SystemSetting keys (HQ)
SETTING_ENABLED = "HH_ACCOUNT_SYNC_ENABLED"
SETTING_INTERVAL = "HH_ACCOUNT_SYNC_INTERVAL_MIN"
SETTING_BASE_URL = "HH_ACCOUNT_BASE_URL"
SETTING_OPEN_DETAILS = "HH_ACCOUNT_OPEN_CHAT_DETAILS"
SETTING_MAX_OPEN = "HH_ACCOUNT_MAX_CHATS_TO_OPEN"
SETTING_ALERTS = "HH_ACCOUNT_ALERT_ON_REPLY"

DEFAULT_INTERVAL_MIN = 60
DEFAULT_MAX_OPEN = 12

STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
"""

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Preview / status labels that mean "no employer reply yet"
NO_REPLY_PREVIEWS = {
    "отклик на вакансию",
    "отклик отправлен",
}

SYSTEM_COUNTERPARTS = {
    "бот hh.ru",
    "hh.ru",
    "поддержка hh",
}

REPLY_STATUS_HINTS = (
    "собеседование",
    "приглашение",
    "отказ",
    "выход на связь",
    "назначено",
)
