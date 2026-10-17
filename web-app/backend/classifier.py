# -*- coding: utf-8 -*-
"""Lead classifier: Direction waves (AI, Bots/Parsers, Web, CMS), urgency traffic lights and deal types."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def classify_urgency(created_at: Optional[datetime], contact_info: str = "", description: str = "") -> str:
    """Calculate urgency:
      - 'hot': created < 2h ago OR direct messenger/phone available
      - 'warm': created 2-12h ago (today)
      - 'normal': created > 12h ago
    """
    haystack = f"{contact_info or ''} {description or ''}".lower()
    has_direct_contact = bool(
        re.search(r'@[a-z0-9_]{4,}', haystack)
        or "t.me/" in haystack
        or "wa.me/" in haystack
        or "whatsapp" in haystack
        or re.search(r'\+7\s?\(?\d{3}\)?', haystack)
    )

    if not created_at:
        return "hot" if has_direct_contact else "normal"

    now = datetime.utcnow()
    # Normalize naive
    if created_at.tzinfo is not None:
        created_naive = created_at.astimezone(timezone.utc).replace(tzinfo=None)
    else:
        created_naive = created_at

    diff_seconds = max(0, (now - created_naive).total_seconds())
    diff_hours = diff_seconds / 3600.0

    if diff_hours < 2.0 or (diff_hours < 8.0 and has_direct_contact):
        return "hot"
    if diff_hours < 12.0:
        return "warm"
    return "normal"


_AI_RE = re.compile(r'\b(ai|llm|rag|gpt|claude|нейро\w*|ии|ml|deepseek|langchain|llama|agentic|агент\w*)\b', re.I)
_BOT_RE = re.compile(r'\b(парсер\w*|парсинг\w*|scraper\w*|scraping|бот\b|боты\b|бота\b|ботов\b|ботом\b|bot\b|bots\b|telegram|телеграм|aiogram|telethon|pyrogram)\b', re.I)
_CMS_RE = re.compile(r'\b(битрикс\w*|bitrix\w*|1с\b|wordpress\w*|вордпресс\w*|woocommerce|tilda\w*|тильд\w*|opencart|amocrm|amo\b)\b', re.I)
_WEB_RE = re.compile(r'\b(сайт\w*|лендинг\w*|landing|верстк\w*|верстальщик\w*|frontend\w*|фронтенд\w*|react\w*|vue\w*|next\.?js)\b', re.I)


def classify_category(title: str = "", description: str = "", tags: str = "") -> str:
    """Classify lead direction into 4 waves:
      - 'ai': AI & LLM & Automation (Core retainer)
      - 'bots_parsers': Telegram bots & Scrapers (Quick cash)
      - 'web': Websites, Frontend & Web Apps
      - 'cms': Bitrix24, WordPress, 1C, CRM & integrations
    """
    clean_title = (title or "").lower()
    clean_text = f"{clean_title} {(tags or '').lower()} {(description or '')[:1500].lower()}"

    # 1. AI in title has absolute priority (our primary focus)
    if _AI_RE.search(clean_title):
        return "ai"

    # 2. CMS/CRM in title
    if _CMS_RE.search(clean_title):
        return "cms"

    # 3. Bots or Parsers in title
    if _BOT_RE.search(clean_title):
        return "bots_parsers"

    # 4. Web / Frontend in title
    if _WEB_RE.search(clean_title):
        return "web"

    # 5. Fallback to full text analysis
    if _AI_RE.search(clean_text):
        return "ai"
    if _CMS_RE.search(clean_text):
        return "cms"
    if _BOT_RE.search(clean_text):
        return "bots_parsers"
    if _WEB_RE.search(clean_text):
        return "web"

    return "ai"


def classify_deal_type(
    category: str,
    title: str = "",
    description: str = "",
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
    salary_raw: str = "",
) -> str:
    """Classify deal weight:
      - 'retainer': monthly partnership (80-90k+ / regular support)
      - 'quick': fast 1-2 day turnaround (parsers, small fixes, scripts, 15-35k)
      - 'project': turn-key development / MVP (50-200k)
    """
    text = f"{title or ''} {description or ''} {salary_raw or ''}".lower()

    # Retainer indicators
    if (
        any(w in text for w in [
            "парт-тайм", "парттайм", "part-time", "постоянн", "retainer", "ежемесячн",
            "в месяц", "в штат", "на постоянную", "сопровожден", "поддержк"
        ])
        or (salary_min and salary_min >= 65000)
        or (salary_max and salary_max >= 80000)
    ):
        return "retainer"

    # Quick cash indicators
    if (
        any(w in text for w in [
            "срочно", "доработать", "поправить", "исправить", "простой", "небольшой",
            "скрипт", "на вечер", "разовая", "разовый", "парсер"
        ])
        or (salary_max and salary_max <= 35000)
        or (category == "bots_parsers" and "проект" not in text)
    ):
        return "quick"

    return "project"


def classify_lead_full(
    title: str = "",
    description: str = "",
    tags: str = "",
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
    salary_raw: str = "",
    contact_info: str = "",
    created_at: Optional[datetime] = None,
) -> Dict[str, str]:
    cat = classify_category(title=title, description=description, tags=tags)
    dtype = classify_deal_type(
        category=cat,
        title=title,
        description=description,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_raw=salary_raw,
    )
    urg = classify_urgency(created_at=created_at, contact_info=contact_info, description=description)
    return {
        "category": cat,
        "deal_type": dtype,
        "urgency": urg,
    }


def backfill_all_leads(db) -> Dict[str, int]:
    """Iterate over all existing leads in SQLite and populate category, deal_type, urgency."""
    from models import Lead

    leads = db.query(Lead).all()
    stats = {"total": len(leads), "updated": 0, "ai": 0, "bots_parsers": 0, "web": 0, "cms": 0}

    for lead in leads:
        meta = classify_lead_full(
            title=lead.title,
            description=lead.description or "",
            tags=lead.tags or "",
            salary_min=lead.salary_min,
            salary_max=lead.salary_max,
            salary_raw=lead.salary_raw or "",
            contact_info=lead.contact_info or "",
            created_at=lead.created_at,
        )
        lead.category = meta["category"]
        lead.deal_type = meta["deal_type"]
        lead.urgency = meta["urgency"]
        stats["updated"] += 1
        stats[meta["category"]] = stats.get(meta["category"], 0) + 1

    db.commit()
    return stats
