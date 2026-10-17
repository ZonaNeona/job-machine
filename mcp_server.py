#!/usr/bin/env python
"""Model Context Protocol (MCP) Server for JOB-MACHINE.

Enables IDE agents (Cursor, Claude Code, Antigravity, etc.) to perform deep audits,
run safe SQL queries, and retrieve high-yield leads directly from the local database.

Run directly:
    py mcp_server.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from mcp.server.fastmcp import FastMCP
from shared.intelligence import (
    execute_readonly_sql,
    get_platform_analytics,
    get_sweet_spot_leads,
    audit_funnel,
    inspect_employer,
    set_employer_blacklist,
)

mcp = FastMCP("job-machine-intelligence")


@mcp.tool()
def job_machine_sql(query: str, max_rows: int = 50) -> str:
    """Executes a safe read-only SELECT query against the JOB-MACHINE SQLite database.

    Use this for any specific or custom data request across tables:
    `leads`, `account_chats`, `employers`, `raw_inbox`, `system_settings`, `lead_events`.
    Rejects any modifying statements (INSERT, UPDATE, DELETE, DROP).
    """
    res = execute_readonly_sql(query=query, max_rows=max_rows)
    return json.dumps(res, ensure_ascii=False, indent=2)


@mcp.tool()
def job_machine_get_sweet_spot_leads(
    limit: int = 5,
    category: str = "all",
    urgency: str = "all",
    min_score: int = 60,
) -> str:
    """Retrieves top high-yield leads with highest ROI (high budget / compact dev effort).

    Args:
        limit: Max number of leads to return (1..20).
        category: Filter by stream: 'all', 'ai', 'bots_parsers', 'web', 'cms'.
        urgency: Filter by urgency: 'all', 'hot' (fresh/direct contact), 'warm', 'normal'.
        min_score: Minimum match score threshold (0..100).
    """
    cat = None if category == "all" else category
    urg = None if urgency == "all" else urgency
    res = get_sweet_spot_leads(limit=limit, category=cat, urgency=urg, min_score=min_score)
    return json.dumps(res, ensure_ascii=False, indent=2)


@mcp.tool()
def job_machine_platform_audit() -> str:
    """Performs an executive audit of all lead platforms.

    Returns:
        Breakdown of each source (hh.ru, telegram, kwork, fl_ru, habr_freelance):
        total volume, hot leads, dispatched count, response rate %, average salary,
        average sweet spot score, and AI diagnosis of which source works best or worst.
    """
    res = get_platform_analytics()
    return json.dumps(res, ensure_ascii=False, indent=2)


@mcp.tool()
def job_machine_audit_funnel() -> str:
    """Analyzes sales pipeline conversion bottlenecks from ingestion to closed contracts."""
    res = audit_funnel()
    return json.dumps(res, ensure_ascii=False, indent=2)


@mcp.tool()
def job_machine_inspect_employer(
    name: str = "",
    source: str = "",
    platform_employer_id: str = "",
) -> str:
    """Inspects employer reputation, past posted jobs and blacklist state."""
    res = inspect_employer(source=source, platform_employer_id=platform_employer_id, name=name)
    return json.dumps(res, ensure_ascii=False, indent=2)


@mcp.tool()
def job_machine_blacklist_employer(
    source: str,
    platform_employer_id: str,
    name: str,
    reason: str = "Черный список (низкий бюджет / спам)",
) -> str:
    """Adds a client or agency to the blacklist so they are automatically excluded."""
    res = set_employer_blacklist(
        source=source,
        platform_employer_id=platform_employer_id,
        name=name,
        reason=reason,
        is_blacklisted=True,
    )
    return json.dumps(res, ensure_ascii=False, indent=2)


@mcp.tool()
def job_machine_get_lead_dossier(lead_id: int) -> str:
    """Returns complete dossier on a specific lead including portfolio match suggestions.

    Provides lead details, direct contact bypass, extracted salary, and links to
    relevant case studies from `assets/portfolio/`.
    """
    res = execute_readonly_sql(
        f"SELECT * FROM leads WHERE id = {int(lead_id)} LIMIT 1"
    )
    if not res.get("data"):
        return json.dumps({"status": "error", "message": f"Lead #{lead_id} not found."})

    lead = res["data"][0]
    category = lead.get("category", "ai")

    # Match relevant case studies from assets/portfolio
    case_recommendations = {
        "ai": [
            "assets/portfolio/CASE_01_RAG_KNOWLEDGE_BASE.md (RAG-система, pgvector, чат по базе знаний)",
            "assets/portfolio/CASE_05_LLM_SALES_AGENT.md (ИИ-менеджер квалификации лидов)",
        ],
        "bots_parsers": [
            "assets/portfolio/CASE_02_TELEGRAM_USERBOT_MONITORING.md (Telethon мониторинг чатов и перехват лидов)",
            "assets/portfolio/CASE_03_SCRAPER_PIPELINE.md (Playwright парсинг с обходом Cloudflare)",
        ],
        "web": [
            "assets/portfolio/CASE_04_FASTAPI_REACT_PORTAL.md (Кабинет клиента, FastAPI + React Vite)",
        ],
        "cms": [
            "assets/portfolio/CASE_06_CRM_INTEGRATION.md (Двухсторонний вебхук amoCRM / Bitrix24)",
        ],
    }

    dossier = {
        "status": "success",
        "lead": lead,
        "recommended_case_studies": case_recommendations.get(category, case_recommendations["ai"]),
        "suggested_angle": "Pain-Hook-Proof-CTA: сослаться на конкретные цифры из выбранного кейса без AI-канцелярита",
    }
    return json.dumps(dossier, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    mcp.run()
