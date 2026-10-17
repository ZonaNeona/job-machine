"""Unified Intelligence Engine for JOB-MACHINE.

Provides core business audit, analytics, safe database inspection, and lead
evaluation for both IDE agents (via MCP) and the in-app Web Copilot.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Path resolution
BACKEND_DIR = Path(__file__).resolve().parent.parent / "web-app" / "backend"
DB_PATH = BACKEND_DIR / "job_machine.db"


def get_db_connection() -> sqlite3.Connection:
    """Returns an optimized read-write SQLite connection with Row factory."""
    conn = sqlite3.connect(DB_PATH.as_posix(), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


# --- 1. SAFE READ-ONLY SQL QUERY EXECUTOR ---

FORBIDDEN_SQL_KEYWORDS = {
    "insert", "update", "delete", "drop", "alter", "truncate", "replace",
    "create", "attach", "detach", "vacuum", "reindex", "pragma", "grant", "revoke"
}

def execute_readonly_sql(query: str, max_rows: int = 50) -> Dict[str, Any]:
    """Executes an arbitrary SELECT query safely against job_machine.db.

    Rejects any destructive or modifying statements.
    """
    clean = query.strip().rstrip(";").strip()
    first_word = clean.split()[0].lower() if clean else ""

    if first_word != "select" and first_word != "with":
        return {
            "status": "error",
            "message": "Only SELECT or WITH ... SELECT queries are allowed in readonly mode.",
            "query": query,
        }

    # Check for forbidden mutation keywords across all tokens
    tokens = {t.strip().lower() for t in re.split(r"[\s,;()]+", clean)}
    intersection = tokens.intersection(FORBIDDEN_SQL_KEYWORDS)
    if intersection:
        return {
            "status": "error",
            "message": f"Query contains disallowed write keyword(s): {', '.join(sorted(intersection))}",
            "query": query,
        }

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(clean)
            rows = cur.fetchmany(max_rows)
            columns = [desc[0] for desc in cur.description] if cur.description else []
            data = [dict(row) for row in rows]
            return {
                "status": "success",
                "columns": columns,
                "row_count": len(data),
                "data": data,
                "query": clean,
            }
    except Exception as exc:
        return {
            "status": "error",
            "message": f"SQL execution error: {str(exc)}",
            "query": query,
        }


# --- 2. DIRECT CONTACT EXTRACTION ---

TELEGRAM_REGEX = re.compile(r"(?:@|t\.me/|telegram[:\s]+@?)([a-zA-Z0-9_]{4,32})", re.IGNORECASE)
EMAIL_REGEX = re.compile(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)", re.IGNORECASE)
PHONE_REGEX = re.compile(r"(?:\+7|8)[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})")

IGNORED_TG_USERNAMES = {"gmail", "yandex", "mail", "hh", "kwork", "fl", "habr", "com", "ru", "channel", "group", "support"}

def extract_direct_contacts(text: str) -> Dict[str, List[str]]:
    """Finds hidden telegram handles, emails and phones in free-form text."""
    contacts: Dict[str, List[str]] = {"telegram": [], "email": [], "phone": []}
    if not text:
        return contacts

    # Telegram
    for match in TELEGRAM_REGEX.finditer(text):
        username = match.group(1).strip("@").lower()
        if username not in IGNORED_TG_USERNAMES and not username.isdigit() and len(username) >= 5:
            full = f"@{username}"
            if full not in contacts["telegram"]:
                contacts["telegram"].append(full)

    # Email
    for match in EMAIL_REGEX.finditer(text):
        email = match.group(1).lower()
        if not email.endswith((".png", ".jpg", ".svg", ".webp")) and email not in contacts["email"]:
            contacts["email"].append(email)

    # Phone
    for match in PHONE_REGEX.finditer(text):
        phone = f"+7 ({match.group(1)}) {match.group(2)}-{match.group(3)}-{match.group(4)}"
        if phone not in contacts["phone"]:
            contacts["phone"].append(phone)

    return contacts


# --- 3. SWEET SPOT (MONEY / EFFORT) HEURISTICS ---

def calculate_sweet_spot(
    deal_type: str,
    category: str,
    salary_min: Optional[int],
    salary_max: Optional[int],
    salary_raw: str,
    match_score: int,
    urgency: str,
    has_direct_contacts: bool = False,
) -> tuple[int, float]:
    """Calculates Sweet Spot score (1..10) and estimated hours.

    Sweet Spot measures return-on-effort: high payout for compact, well-defined work.
    """
    effective_salary = salary_max or salary_min or 0

    # Fallback parse from salary_raw if integers were 0
    if not effective_salary and salary_raw:
        raw_matches = re.findall(r"\d[\d\s]*\d", salary_raw.replace("\xa0", " "))
        clean_nums = []
        for m in raw_matches:
            digits = re.sub(r"\s+", "", m)
            if digits.isdigit() and int(digits) >= 1000:
                clean_nums.append(int(digits))
        if clean_nums:
            effective_salary = max(clean_nums)

    # Base hours by category and deal type
    if deal_type == "quick":
        hours = 4.0 if category in ("bots_parsers", "cms") else 6.0
    elif deal_type == "retainer":
        hours = 25.0  # monthly workload estimate
    else:  # project
        hours = 16.0 if category in ("bots_parsers", "web") else 30.0

    score = 5

    # Hourly rate estimation
    if effective_salary and hours > 0:
        hourly_rate = effective_salary / hours
        if hourly_rate >= 5000:
            score = 10
        elif hourly_rate >= 3500:
            score = 9
        elif hourly_rate >= 2500:
            score = 8
        elif hourly_rate >= 1800:
            score = 7
        elif hourly_rate >= 1200:
            score = 6
        elif hourly_rate >= 700:
            score = 5
        else:
            score = 3
    else:
        # Default heuristics based on match quality and deal type
        if deal_type == "retainer" and match_score >= 80:
            score = 8
        elif deal_type == "quick":
            score = 7
        elif match_score >= 85:
            score = 8
        elif match_score <= 40:
            score = 3

    # Direct contact bonus (instant bypass of platforms)
    if has_direct_contacts:
        score = min(10, score + 1)

    # Urgency bonus (less competition if grabbed immediately)
    if urgency == "hot":
        score = min(10, score + 1)

    return max(1, min(10, score)), round(hours, 1)


# --- 4. PLATFORM AUDIT & ANALYTICS ---

def get_platform_analytics() -> Dict[str, Any]:
    """Generates an executive audit of all lead generation platforms."""
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Overall leads per source
        cur.execute("""
            SELECT 
                source,
                COUNT(*) as total_leads,
                SUM(CASE WHEN urgency = 'hot' THEN 1 ELSE 0 END) as hot_leads,
                SUM(CASE WHEN status IN ('sent', 'replied', 'closed_won') THEN 1 ELSE 0 END) as dispatched,
                SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replies,
                AVG(match_score) as avg_match,
                AVG(CASE WHEN salary_max > 0 THEN salary_max WHEN salary_min > 0 THEN salary_min ELSE NULL END) as avg_salary,
                AVG(sweet_spot_score) as avg_sweet_spot
            FROM leads
            GROUP BY source
            ORDER BY total_leads DESC
        """)
        source_rows = cur.fetchall()

        # Account chat health
        cur.execute("""
            SELECT 
                platform,
                COUNT(*) as total_chats,
                SUM(CASE WHEN has_reply = 1 THEN 1 ELSE 0 END) as replied_chats,
                SUM(CASE WHEN unread = 1 THEN 1 ELSE 0 END) as unread_chats
            FROM account_chats
            GROUP BY platform
        """)
        chat_rows = {r["platform"]: dict(r) for r in cur.fetchall()}

        platforms: List[Dict[str, Any]] = []
        for r in source_rows:
            src = r["source"]
            tot = r["total_leads"] or 0
            dispatched = r["dispatched"] or 0
            replies = r["replies"] or 0
            avg_sweet = round(r["avg_sweet_spot"] or 5.0, 1)
            avg_sal = round(r["avg_salary"] or 0)
            avg_match = round(r["avg_match"] or 0)

            # Reply rate
            reply_rate = f"{round((replies / dispatched) * 100, 1)}%" if dispatched > 0 else "0%"

            # Diagnosis
            if tot >= 20 and avg_sweet >= 7.0:
                verdict = "🟢 Высокая отдача (Фокус на перехват)"
            elif tot >= 25 and (avg_sal < 30000 or avg_sweet <= 4.5):
                verdict = "🟡 Много мелких задач (Требуется фильтр бюджета)"
            elif tot < 5:
                verdict = "⚪ Недостаточно данных (Подключить регулярный сбор)"
            else:
                verdict = "🔵 Стабильный поток"

            platforms.append({
                "source": src,
                "total_leads": tot,
                "hot_leads": r["hot_leads"] or 0,
                "dispatched": dispatched,
                "replies": replies,
                "reply_rate": reply_rate,
                "avg_match_score": avg_match,
                "avg_salary_rub": avg_sal,
                "avg_sweet_spot": avg_sweet,
                "verdict": verdict,
                "account_sync": chat_rows.get(src, {"total_chats": 0, "replied_chats": 0, "unread_chats": 0}),
            })

        # Find best and worst performing platform
        ranked_by_sweet = sorted([p for p in platforms if p["total_leads"] >= 5], key=lambda x: x["avg_sweet_spot"], reverse=True)
        best = ranked_by_sweet[0]["source"] if ranked_by_sweet else "н/д"
        worst = ranked_by_sweet[-1]["source"] if ranked_by_sweet else "н/д"

        return {
            "status": "success",
            "platforms": platforms,
            "summary": {
                "total_platforms": len(platforms),
                "top_opportunity_source": best,
                "highest_friction_source": worst,
                "generated_at": datetime.utcnow().isoformat(),
            }
        }


# --- 5. SWEET SPOT LEADS RETRIEVAL (TOP OPPORTUNITIES) ---

def get_sweet_spot_leads(
    limit: int = 5,
    category: Optional[str] = None,
    urgency: Optional[str] = None,
    min_score: int = 60,
) -> Dict[str, Any]:
    """Retrieves top high-yield leads with minimal effort requirement."""
    with get_db_connection() as conn:
        cur = conn.cursor()

        conditions = ["status IN ('new', 'ai_scored', 'offer_generated', 'approved')"]
        params: List[Any] = []

        if category and category != "all":
            conditions.append("category = ?")
            params.append(category)

        if urgency and urgency != "all":
            conditions.append("urgency = ?")
            params.append(urgency)

        if min_score > 0:
            conditions.append("match_score >= ?")
            params.append(min_score)

        where_clause = " AND ".join(conditions)
        params.append(limit)

        cur.execute(f"""
            SELECT 
                id, external_id, title, company, source, url, salary_raw,
                category, deal_type, urgency, match_score, sweet_spot_score,
                estimated_hours, direct_contacts_json, contact_info,
                scoring_reason, description, created_at
            FROM leads
            WHERE {where_clause}
            ORDER BY sweet_spot_score DESC, match_score DESC, id DESC
            LIMIT ?
        """, params)

        rows = cur.fetchall()
        leads: List[Dict[str, Any]] = []

        for r in rows:
            contacts = {}
            if r["direct_contacts_json"]:
                try:
                    contacts = json.loads(r["direct_contacts_json"])
                except Exception:
                    contacts = {}

            leads.append({
                "id": r["id"],
                "title": r["title"],
                "company": r["company"] or "Не указана",
                "source": r["source"],
                "url": r["url"],
                "salary": r["salary_raw"],
                "category": r["category"],
                "deal_type": r["deal_type"],
                "urgency": r["urgency"],
                "match_score": r["match_score"],
                "sweet_spot_score": r["sweet_spot_score"] or 5,
                "estimated_hours": r["estimated_hours"] or 4.0,
                "direct_contacts": contacts,
                "scoring_summary": r["scoring_reason"] or "",
                "created_at": r["created_at"],
            })

        return {
            "status": "success",
            "count": len(leads),
            "leads": leads,
        }


# --- 6. FUNNEL AUDIT ---

def audit_funnel() -> Dict[str, Any]:
    """Provides complete funnel conversion breakdown and identifies bottlenecks."""
    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute("""
            SELECT status, COUNT(*) as cnt
            FROM leads
            GROUP BY status
        """)
        status_counts = {r["status"]: r["cnt"] for r in cur.fetchall()}

        total = sum(status_counts.values())
        new_cnt = status_counts.get("new", 0)
        scored_cnt = status_counts.get("ai_scored", 0)
        approved_cnt = status_counts.get("approved", 0) + status_counts.get("offer_generated", 0)
        sent_cnt = status_counts.get("sent", 0)
        replied_cnt = status_counts.get("replied", 0)
        won_cnt = status_counts.get("closed_won", 0)

        # Bottlenecks analysis
        bottlenecks = []
        if sent_cnt > 0 and (replied_cnt / sent_cnt) < 0.15:
            bottlenecks.append({
                "stage": "Отклик -> Ответ",
                "issue": "Низкая конверсия в ответ (<15%).",
                "solution": "Усилить первый хук (Hook) и прикреплять ссылку на конкретный RAG/Telethon кейс с цифрами."
            })
        if new_cnt > 40:
            bottlenecks.append({
                "stage": "Входящий поток -> Скоринг",
                "issue": f"{new_cnt} лидов лежат неразобранными в статусе 'new'.",
                "solution": "Запустить утренний спринт или фоновый скоринг по чек-листу."
            })

        return {
            "status": "success",
            "total_leads": total,
            "stages": {
                "new": new_cnt,
                "ai_scored": scored_cnt,
                "approved_or_ready": approved_cnt,
                "sent": sent_cnt,
                "replied": replied_cnt,
                "closed_won": won_cnt,
            },
            "conversion_rates": {
                "response_rate": f"{round((replied_cnt / sent_cnt * 100), 1)}%" if sent_cnt > 0 else "0%",
                "close_rate": f"{round((won_cnt / sent_cnt * 100), 1)}%" if sent_cnt > 0 else "0%",
            },
            "bottlenecks": bottlenecks,
        }


# --- 7. EMPLOYER INSPECTION & BLACKLIST ---

def inspect_employer(
    source: Optional[str] = None,
    platform_employer_id: Optional[str] = None,
    name: Optional[str] = None,
) -> Dict[str, Any]:
    """Inspects employer history, posted vacancies and blacklist state."""
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Check blacklist table
        cur.execute("""
            SELECT * FROM employers 
            WHERE (source = ? AND platform_employer_id = ?) 
               OR (name = ? AND name != '')
            LIMIT 1
        """, (source or "", platform_employer_id or "", name or ""))
        emp = cur.fetchone()

        # Fetch all vacancies by this company
        cur.execute("""
            SELECT id, title, source, salary_raw, status, created_at
            FROM leads
            WHERE company = ? AND company IS NOT NULL AND company != ''
            ORDER BY id DESC
            LIMIT 10
        """, (name or (emp["name"] if emp else ""),))
        leads = [dict(r) for r in cur.fetchall()]

        return {
            "status": "success",
            "employer": dict(emp) if emp else None,
            "is_blacklisted": bool(emp["is_blacklisted"]) if emp else False,
            "blacklist_reason": emp["blacklist_reason"] if emp else None,
            "history_leads_count": len(leads),
            "recent_leads": leads,
        }


def set_employer_blacklist(
    source: str,
    platform_employer_id: str,
    name: str,
    reason: str = "Ручной бан пользователем",
    is_blacklisted: bool = True,
) -> Dict[str, Any]:
    """Adds or updates an employer's blacklist status."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id FROM employers
            WHERE source = ? AND platform_employer_id = ?
        """, (source, platform_employer_id))
        row = cur.fetchone()

        now = datetime.utcnow().isoformat()
        if row:
            cur.execute("""
                UPDATE employers 
                SET is_blacklisted = ?, blacklist_reason = ?, name = COALESCE(?, name), updated_at = ?
                WHERE id = ?
            """, (1 if is_blacklisted else 0, reason, name, now, row["id"]))
        else:
            cur.execute("""
                INSERT INTO employers (source, platform_employer_id, name, is_blacklisted, blacklist_reason, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (source, platform_employer_id, name, 1 if is_blacklisted else 0, reason, now, now))
        conn.commit()

        return {
            "status": "success",
            "source": source,
            "platform_employer_id": platform_employer_id,
            "name": name,
            "is_blacklisted": is_blacklisted,
            "reason": reason,
        }


# --- 8. BACKFILL UTILITY FOR EXISTING LEADS ---

def backfill_sweet_spots_and_contacts() -> int:
    """Updates existing leads with sweet_spot_score, estimated_hours, and direct contacts."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, title, description, category, deal_type, salary_raw, salary_min, salary_max, match_score, urgency FROM leads")
        rows = cur.fetchall()

        updated = 0
        for r in rows:
            text = f"{r['title']} {r['description']}"
            contacts = extract_direct_contacts(text)
            has_direct = bool(contacts["telegram"] or contacts["phone"] or contacts["email"])
            contacts_json = json.dumps(contacts, ensure_ascii=False) if has_direct else None

            score, hours = calculate_sweet_spot(
                deal_type=r["deal_type"] or "retainer",
                category=r["category"] or "ai",
                salary_min=r["salary_min"],
                salary_max=r["salary_max"],
                salary_raw=r["salary_raw"] or "",
                match_score=r["match_score"] or 0,
                urgency=r["urgency"] or "normal",
                has_direct_contacts=has_direct,
            )

            cur.execute("""
                UPDATE leads
                SET sweet_spot_score = ?, estimated_hours = ?, direct_contacts_json = ?
                WHERE id = ?
            """, (score, hours, contacts_json, r["id"]))
            updated += 1

        conn.commit()
        return updated
