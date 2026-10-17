# -*- coding: utf-8 -*-
"""Sync HH account chats into job_machine.db and fire reply alerts."""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
BACKEND_DIR = PROJECT_ROOT / "web-app" / "backend"

if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from sqlalchemy.orm import Session

from config import (
    DEFAULT_BASE_URL,
    DEFAULT_INTERVAL_MIN,
    DEFAULT_MAX_OPEN,
    PLATFORM_ID,
    SETTING_ALERTS,
    SETTING_BASE_URL,
    SETTING_ENABLED,
    SETTING_INTERVAL,
    SETTING_MAX_OPEN,
    SETTING_OPEN_DETAILS,
)
from chat_scraper import run_hh_chat_scrape, session_profile_exists


def _setting(db: Session, key: str, default: str = "") -> str:
    from models import SystemSetting
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return row.value if row else default


def _set_setting(db: Session, key: str, value: str, description: str = "") -> None:
    from models import SystemSetting
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=key, value=value, description=description or None))


def _truthy(value: str, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on", "да"}


def _find_lead(db: Session, vacancy_id: Optional[str], title: str, company: str):
    from models import Lead

    if vacancy_id:
        ext = f"hh_{vacancy_id}"
        lead = db.query(Lead).filter(Lead.external_id == ext).first()
        if lead:
            return lead
        lead = db.query(Lead).filter(Lead.url.isnot(None), Lead.url.contains(f"vacancy/{vacancy_id}")).first()
        if lead:
            return lead

    clean_title = (title or "").strip()
    clean_company = (company or "").strip()

    if clean_title and clean_company:
        lead = db.query(Lead).filter(
            Lead.source == "hh.ru",
            Lead.title == clean_title,
            Lead.company == clean_company,
        ).first()
        if lead:
            return lead

    if clean_title:
        lead = db.query(Lead).filter(Lead.source == "hh.ru", Lead.title == clean_title).first()
        if lead:
            return lead

    if clean_company and len(clean_company) >= 3 and clean_company.lower() not in {"ооо", "ип", "компания", "бот", "hh.ru"}:
        lead = db.query(Lead).filter(
            Lead.source == "hh.ru",
            Lead.company.ilike(f"%{clean_company}%"),
        ).first()
        if lead:
            return lead

    return None


def _record_event(db: Session, lead_id: int, kind: str, message: str, payload: Optional[dict] = None,
                  from_status: Optional[str] = None, to_status: Optional[str] = None) -> None:
    from models import LeadEvent
    db.add(
        LeadEvent(
            lead_id=lead_id,
            kind=kind,
            from_status=from_status,
            to_status=to_status,
            message=message,
            payload=json.dumps(payload or {}, ensure_ascii=False),
        )
    )


def _upsert_platform(db: Session, *, session_ok: bool, last_error: Optional[str], stats: dict) -> None:
    from models import AccountPlatform
    row = db.query(AccountPlatform).filter(AccountPlatform.platform == PLATFORM_ID).first()
    now = datetime.utcnow()
    if not row:
        row = AccountPlatform(platform=PLATFORM_ID, label="hh.ru · чаты")
        db.add(row)
    row.enabled = _truthy(_setting(db, SETTING_ENABLED, "true"), True)
    row.interval_minutes = int(_setting(db, SETTING_INTERVAL, str(DEFAULT_INTERVAL_MIN)) or DEFAULT_INTERVAL_MIN)
    row.session_ok = session_ok
    row.profile_ready = session_profile_exists()
    row.last_run_at = now
    row.last_status = "ok" if session_ok and not last_error else ("auth_required" if not session_ok else "error")
    row.last_error = last_error
    row.last_stats_json = json.dumps(stats, ensure_ascii=False)
    row.updated_at = now


async def _process_and_save_chats(
    db: Session,
    chats: List[dict],
    details_map: Dict[str, dict],
    *,
    base_url: str = DEFAULT_BASE_URL,
    alerts_on: bool = False,
    stats: Dict[str, Any],
    session_ok: bool = True,
) -> Dict[str, Any]:
    from models import AccountChat, Lead
    import alert_service

    by_id = {
        c.external_chat_id: c
        for c in db.query(AccountChat).filter(AccountChat.platform == PLATFORM_ID).all()
    }

    for item in chats:
        chat_id = str(item["chat_id"])
        detail = details_map.get(chat_id) or {}
        vacancy_id = detail.get("vacancy_id")
        vacancy_url = detail.get("vacancy_url")
        cand_title = (detail.get("vacancy_title") or "").strip()
        if cand_title.lower() in {"перейти", "перейти к вакансии", "вакансия", ""}:
            cand_title = ""
        title = (cand_title or item.get("title") or "").strip()
        counterpart = (
            detail.get("participant_title")
            or item.get("counterpart")
            or ""
        ).strip()
        preview = (detail.get("last_message") or item.get("preview") or "").strip()
        fingerprint = item.get("fingerprint") or ""
        has_reply = bool(item.get("has_reply_hint"))
        if detail.get("messages") and len(detail["messages"]) > 1:
            has_reply = True
        if detail.get("last_message"):
            from html_parser import _guess_has_reply
            has_reply = has_reply or _guess_has_reply(preview, counterpart, title)

        row = by_id.get(chat_id)
        is_new = row is None
        prev_fp = row.fingerprint if row else None
        prev_had_reply = bool(row and row.has_reply)
        changed = is_new or (prev_fp != fingerprint)

        if is_new:
            row = AccountChat(
                platform=PLATFORM_ID,
                external_chat_id=chat_id,
            )
            db.add(row)
            by_id[chat_id] = row

        row.chat_url = item.get("chat_url") or urljoin(base_url.rstrip("/") + "/", f"chat/{chat_id}")
        row.title = title or row.title
        row.counterpart = counterpart or row.counterpart
        row.time_label = item.get("time_label") or row.time_label
        row.last_message_preview = preview[:1000] if preview else row.last_message_preview
        row.fingerprint = fingerprint
        row.has_reply = has_reply
        row.last_synced_at = datetime.utcnow()
        row.updated_at = datetime.utcnow()
        if vacancy_id:
            row.vacancy_external_id = f"hh_{vacancy_id}"
            row.vacancy_url = vacancy_url
        if detail.get("messages"):
            row.messages_json = json.dumps(detail["messages"], ensure_ascii=False)
            row.message_count = len(detail["messages"])

        # Link lead
        lead = None
        if row.lead_id:
            lead = db.query(Lead).filter(Lead.id == row.lead_id).first()
        if not lead:
            lead = _find_lead(
                db,
                vacancy_id=vacancy_id,
                title=title,
                company=counterpart,
            )
            if lead:
                row.lead_id = lead.id
                stats["leads_linked"] += 1

        # Fresh employer activity: first time we see a reply, or fingerprint moved on an active thread
        fresh_reply = False
        if has_reply:
            if not prev_had_reply:
                fresh_reply = True
            elif changed and preview:
                fresh_reply = True

        if fresh_reply:
            row.unread = True
            if not row.reply_detected_at:
                row.reply_detected_at = datetime.utcnow()
            stats["new_replies"] += 1

            if lead and lead.status in {"sent", "approved", "offer_generated", "new", "ai_scored"}:
                old = lead.status
                lead.status = "replied"
                if not lead.replied_at:
                    lead.replied_at = datetime.utcnow()
                lead.updated_at = datetime.utcnow()
                _record_event(
                    db,
                    lead.id,
                    kind="status_changed",
                    message=f"Ответ с hh.ru (чат {chat_id})",
                    from_status=old,
                    to_status="replied",
                    payload={
                        "chat_id": chat_id,
                        "preview": preview[:400],
                        "chat_url": row.chat_url,
                    },
                )
                stats["leads_marked_replied"] += 1

            if alerts_on:
                try:
                    ok = await alert_service.send_client_reply_alert(
                        lead_title=title or f"Чат {chat_id}",
                        client_name=counterpart or "Работодатель",
                        message_snippet=preview or "Новое сообщение в чате hh.ru",
                    )
                    if ok:
                        stats["alerts_sent"] += 1
                except Exception as exc:
                    print(f"[HH-ACCOUNT] Alert error: {exc}")

            if lead:
                _record_event(
                    db,
                    lead.id,
                    kind="account_reply",
                    message="Новое сообщение в чате hh.ru",
                    payload={"chat_id": chat_id, "preview": preview[:400], "url": row.chat_url},
                )

        stats["chats_upserted"] += 1

    _upsert_platform(
        db,
        session_ok=session_ok,
        last_error=stats.get("error"),
        stats=stats,
    )
    db.commit()
    return stats


async def run_hh_account_sync(
    *,
    headless: bool = True,
    force: bool = False,
) -> Dict[str, Any]:
    from database import SessionLocal

    db = SessionLocal()
    stats: Dict[str, Any] = {
        "platform": PLATFORM_ID,
        "chats_seen": 0,
        "chats_upserted": 0,
        "details_opened": 0,
        "new_replies": 0,
        "leads_linked": 0,
        "leads_marked_replied": 0,
        "alerts_sent": 0,
        "session_ok": False,
        "error": None,
    }

    try:
        enabled = _truthy(_setting(db, SETTING_ENABLED, "true"), True)
        if not enabled and not force:
            stats["error"] = "Синхронизация hh-аккаунта отключена в настройках"
            return stats

        base_url = (_setting(db, SETTING_BASE_URL, DEFAULT_BASE_URL) or DEFAULT_BASE_URL).rstrip("/")
        open_details = _truthy(_setting(db, SETTING_OPEN_DETAILS, "true"), True)
        max_open = int(_setting(db, SETTING_MAX_OPEN, str(DEFAULT_MAX_OPEN)) or DEFAULT_MAX_OPEN)
        alerts_on = _truthy(_setting(db, SETTING_ALERTS, "true"), True)

        from models import AccountChat
        existing = (
            db.query(AccountChat)
            .filter(AccountChat.platform == PLATFORM_ID)
            .all()
        )
        known_fp = {c.external_chat_id: (c.fingerprint or "") for c in existing}
        # Force open chats that still miss vacancy_id
        force_open = [c.external_chat_id for c in existing if not c.vacancy_external_id]

        scrape = await run_hh_chat_scrape(
            base_url=base_url,
            chat_list_url=urljoin(base_url + "/", "chat"),
            open_details=open_details,
            max_open=max_open,
            force_open_ids=force_open,
            known_fingerprints=known_fp,
            headless=headless,
        )

        stats["session_ok"] = bool(scrape.get("session_ok"))
        stats["details_opened"] = int(scrape.get("opened") or 0)
        if scrape.get("error"):
            stats["error"] = scrape["error"]

        details_map: Dict[str, dict] = scrape.get("details") or {}
        chats: List[dict] = scrape.get("chats") or []
        stats["chats_seen"] = len(chats)

        await _process_and_save_chats(
            db,
            chats=chats,
            details_map=details_map,
            base_url=base_url,
            alerts_on=alerts_on,
            stats=stats,
            session_ok=stats["session_ok"],
        )
    except Exception as exc:
        db.rollback()
        stats["error"] = str(exc)
        print(f"[HH-ACCOUNT] Pipeline error: {exc}")
        try:
            _upsert_platform(db, session_ok=False, last_error=str(exc), stats=stats)
            db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()

    return stats


async def run_hh_sample_import(
    sample_dir: Optional[Path] = None,
    alerts_on: bool = False,
) -> Dict[str, Any]:
    from database import SessionLocal
    from html_parser import parse_chat_details_html, parse_chat_list_html

    db = SessionLocal()
    stats: Dict[str, Any] = {
        "platform": PLATFORM_ID,
        "chats_seen": 0,
        "chats_upserted": 0,
        "details_opened": 0,
        "new_replies": 0,
        "leads_linked": 0,
        "leads_marked_replied": 0,
        "alerts_sent": 0,
        "session_ok": True,
        "error": None,
    }

    try:
        candidates = []
        if sample_dir:
            candidates.append(Path(sample_dir))
        candidates.extend([
            CURRENT_DIR,
            PROJECT_ROOT / "account-parsing" / "hh",
            PROJECT_ROOT / "parsing" / "hh",
        ])

        list_file: Optional[Path] = None
        opened_file: Optional[Path] = None
        for cand in candidates:
            if not list_file:
                lf = cand / "Чаты.html"
                if lf.exists():
                    list_file = lf
            if not opened_file:
                of = cand / "Чаты-opened.html"
                if of.exists():
                    opened_file = of

        if not list_file:
            stats["error"] = "Файл 'Чаты.html' не найден для импорта сэмпла"
            return stats

        list_html = list_file.read_text(encoding="utf-8", errors="replace")
        items = parse_chat_list_html(list_html)
        chats = [item.to_dict() for item in items]
        stats["chats_seen"] = len(chats)

        details_map: Dict[str, dict] = {}
        if opened_file:
            opened_html = opened_file.read_text(encoding="utf-8", errors="replace")
            details = parse_chat_details_html(opened_html, chat_id="5697264260")
            details_map["5697264260"] = details.to_dict()
            stats["details_opened"] = 1

        await _process_and_save_chats(
            db,
            chats=chats,
            details_map=details_map,
            base_url=DEFAULT_BASE_URL,
            alerts_on=alerts_on,
            stats=stats,
            session_ok=True,
        )
    except Exception as exc:
        db.rollback()
        stats["error"] = str(exc)
        print(f"[HH-ACCOUNT] Sample import error: {exc}")
    finally:
        db.close()

    return stats


def ensure_default_settings(db: Session) -> None:
    defaults = [
        (SETTING_ENABLED, "true", "Мониторинг чатов hh.ru включён"),
        (SETTING_INTERVAL, str(DEFAULT_INTERVAL_MIN), "Интервал синка hh-аккаунта (мин)"),
        (SETTING_BASE_URL, DEFAULT_BASE_URL, "Базовый URL hh.ru для чатов"),
        (SETTING_OPEN_DETAILS, "true", "Открывать чаты для vacancy_id и текста"),
        (SETTING_MAX_OPEN, str(DEFAULT_MAX_OPEN), "Макс. чатов открывать за один проход"),
        (SETTING_ALERTS, "true", "Telegram-алерт при ответе работодателя"),
    ]
    for key, value, desc in defaults:
        if not _setting(db, key, ""):
            _set_setting(db, key, value, desc)
