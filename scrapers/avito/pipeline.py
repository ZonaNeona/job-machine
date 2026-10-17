"""
Pipeline to coordinate Avito Rabota scraping, deduplication, AI scoring, and saving to SQLite.
"""
import sys
import os
import asyncio
from pathlib import Path
from typing import Dict, Any, List

# Add backend to path
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
BACKEND_DIR = PROJECT_ROOT / "web-app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from database import SessionLocal
from models import Lead, KnowledgeBaseItem
import ai_service
import alert_service
from scrapers.avito.config import AVITO_SEARCH_PRESETS
from scrapers.avito.avito_scraper import scrape_avito_query

async def run_avito_pipeline(headless: bool = True) -> Dict[str, Any]:
    """
    Executes complete Avito Rabota ingestion pipeline:
    1. Search across presets
    2. Deduplicate against existing SQLite leads
    3. Run AI scoring
    4. Save to job_machine.db
    5. Fire Telegram alert if score >= 80%
    """
    db = SessionLocal()
    stats = {
        "presets_checked": len(AVITO_SEARCH_PRESETS),
        "scanned": 0,
        "already_exists": 0,
        "new_leads_saved": 0,
        "errors": 0
    }

    try:
        existing_ids = set(
            row[0] for row in db.query(Lead.external_id).filter(Lead.external_id.isnot(None)).all()
        )

        kb_items = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.is_active == True).all()
        kb_data = [{"title": k.title, "content": k.content, "category": k.category} for k in kb_items]

        for preset in AVITO_SEARCH_PRESETS:
            p_name = preset["name"]
            query = preset["query"]

            print(f"\n[SEARCH] [Avito] Сканирование по пресету: '{p_name}' (Запрос: '{query}')...")
            try:
                items = await scrape_avito_query(query=query, remote_only=True, max_items=10, headless=headless)
                stats["scanned"] += len(items)

                for it in items:
                    ext_id = it["id"]
                    if ext_id in existing_ids:
                        stats["already_exists"] += 1
                        continue

                    print(f"   [+] Найдена вакансия Авито: {it['title'][:40]} | {it['company']}")

                    # AI Scoring
                    score_res = await ai_service.score_lead(
                        title=it["title"],
                        description=it["description"],
                        kb_items=kb_data
                    )
                    match_score = score_res.get("match_score", 70)

                    new_lead = Lead(
                        external_id=ext_id,
                        title=it["title"],
                        company=it["company"],
                        description=it["description"],
                        url=it["url"],
                        source="avito",
                        salary_raw=it.get("salary_raw") or "По договоренности",
                        tags=it.get("tags", "Авито Работа, Python, Боты"),
                        match_score=match_score,
                        scoring_reason=score_res.get("explanation", "Прямая вакансия от малого бизнеса на Авито Работе"),
                        status="ai_scored" if match_score >= 70 else "new"
                    )

                    db.add(new_lead)
                    db.commit()
                    existing_ids.add(ext_id)
                    stats["new_leads_saved"] += 1
                    print(f"       -> Сохранено в базу! Match score: {match_score}%")

                    if match_score >= 80:
                        asyncio.create_task(alert_service.send_lead_alert({
                            "title": it["title"],
                            "company": it["company"],
                            "source": "avito",
                            "salary_raw": it.get("salary_raw") or "По договоренности",
                            "match_score": match_score,
                            "tags": it.get("tags", ""),
                            "scoring_reason": score_res.get("explanation", ""),
                            "url": it["url"]
                        }))

            except Exception as query_err:
                print(f"[ERR] [Avito] Ошибка запроса '{query}': {query_err}")
                stats["errors"] += 1

        print(f"\n[DONE] [Avito] Завершено. Найдено: {stats['scanned']}, Новых сохранено: {stats['new_leads_saved']}, Дубликатов: {stats['already_exists']}")
        return stats

    except Exception as e:
        print(f"[ERR] [Avito] Ошибка в пайплайне: {e}")
        db.rollback()
        return stats
    finally:
        db.close()
