import sys
import os
import asyncio
from pathlib import Path
from typing import Dict, Any, List

# Add web-app/backend to sys.path to reuse DB models and AI service
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent / "web-app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import httpx
from database import SessionLocal
from models import Lead, KnowledgeBaseItem
from classifier import classify_lead_full
import ai_service
from config import DEFAULT_SEARCH_PRESETS, MAX_VACANCIES_PER_QUERY
from hh_parser import search_vacancies, fetch_vacancy_details

async def run_hh_pipeline(presets: List[Dict[str, str]] = None, max_per_query: int = MAX_VACANCIES_PER_QUERY) -> Dict[str, Any]:
    """
    Executes complete ingestion pipeline:
    1. Search vacancies on hh.ru across presets
    2. Deduplicate against existing SQLite leads
    3. Fetch full vacancy details
    4. Run AI scoring
    5. Save high-match leads to database
    """
    if presets is None:
        presets = DEFAULT_SEARCH_PRESETS

    db = SessionLocal()
    stats = {
        "presets_checked": len(presets),
        "vacancies_scanned": 0,
        "already_exists": 0,
        "new_leads_saved": 0,
        "skipped_low_score": 0,
        "errors": 0
    }

    try:
        # Load all existing hh external_ids
        existing_ids = set(
            row[0] for row in db.query(Lead.external_id).filter(Lead.external_id.isnot(None)).all()
        )

        # Load KB for AI scoring
        kb_items = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.is_active == True).all()
        kb_data = [{"title": k.title, "content": k.content, "category": k.category} for k in kb_items]

        async with httpx.AsyncClient(timeout=30.0) as client:
            for preset in presets:
                query_name = preset.get("name", "Поиск")
                query = preset.get("query", "")
                schedule = preset.get("schedule", "remote")
                print(f"\n[SEARCH] [HH] Запуск сбора по пресету: '{query_name}' (Запрос: '{query}')...")

                try:
                    found_items = await search_vacancies(client, query=query, schedule=schedule, max_items=max_per_query)
                    stats["vacancies_scanned"] += len(found_items)
                    print(f"   -> Найдено вакансий в выдаче: {len(found_items)}")

                    for item in found_items:
                        ext_id = f"hh_{item['id']}"
                        if ext_id in existing_ids:
                            stats["already_exists"] += 1
                            continue

                        # Fetch full details
                        print(f"   [+] Загрузка деталей вакансии {item['id']}: {item['title'][:40]}...")
                        details = await fetch_vacancy_details(client, item['id'])
                        if not details or not details.get("description"):
                            stats["errors"] += 1
                            continue

                        # Run AI Scoring
                        score_res = await ai_service.score_lead(
                            title=details["title"],
                            description=details["description"],
                            kb_items=kb_data
                        )
                        match_score = score_res.get("match_score", 50)
                        scoring_reason = score_res.get("scoring_reason", "")

                        if match_score < 60:
                            print(f"   [-] Пропущен (низкий score: {match_score}%): {details['title'][:35]}")
                            stats["skipped_low_score"] += 1
                            existing_ids.add(ext_id)
                            continue

                        # Classify stream, deal type, urgency
                        cl = classify_lead_full(
                            title=details["title"],
                            description=details["description"],
                            tags=details["tags"],
                            salary_raw=details["salary_raw"],
                            contact_info=details["contact_info"],
                        )

                        # Create and save new Lead
                        new_lead = Lead(
                            external_id=ext_id,
                            title=details["title"],
                            company=details["company"],
                            source="hh.ru",
                            url=details["url"],
                            salary_raw=details["salary_raw"],
                            salary_min=details["salary_min"],
                            salary_max=details["salary_max"],
                            contact_info=details["contact_info"],
                            location=details["location"],
                            job_type=details["job_type"],
                            description=details["description"],
                            tags=details["tags"],
                            status="ai_scored" if match_score >= 75 else "new",
                            match_score=match_score,
                            scoring_reason=scoring_reason,
                            generated_offer=None,
                            custom_notes=f"Автоматически собрано парсером hh.ru по пресету '{query_name}'",
                            category=cl["category"],
                            deal_type=cl["deal_type"],
                            urgency=cl["urgency"],
                        )

                        db.add(new_lead)
                        db.commit()
                        db.refresh(new_lead)
                        existing_ids.add(ext_id)
                        stats["new_leads_saved"] += 1

                        print(f"   [OK] Сохранен в БД! ID: #{new_lead.id} | Score: {match_score}% | {details['title'][:40]} ({details['salary_raw']})")

                except Exception as e:
                    print(f"[!] Ошибка обработки пресета '{query_name}': {e}")
                    stats["errors"] += 1

    finally:
        db.close()

    print("\n" + "=" * 60)
    print("[STATS] ИТОГИ СБОРА С HEADHUNTER:")
    print(f"  * Всего проверено вакансий: {stats['vacancies_scanned']}")
    print(f"  * Уже были в базе (дубликаты): {stats['already_exists']}")
    print(f"  * Отсеяно по скорингу (<60%): {stats['skipped_low_score']}")
    print(f"  * Добавлено новых целевых лидов: {stats['new_leads_saved']}")
    print(f"  * Ошибок: {stats['errors']}")
    print("=" * 60 + "\n")

    return stats
