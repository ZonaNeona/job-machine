"""
Pipeline to coordinate freelance & contract scrapers (Habr Career, FL.ru),
deduplicate leads against SQLite, calculate match scores and store them in job_machine.db.
"""
import sys
import os
import asyncio
from pathlib import Path
from typing import Dict, Any, List

# Add web-app/backend to sys.path
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
import alert_service
from scrapers.freelance.config import HABR_SEARCH_PRESETS
from scrapers.freelance.habr_scraper import search_habr_vacancies, fetch_habr_details
from scrapers.freelance.fl_scraper import fetch_fl_tasks
from scrapers.freelance.kwork_scraper import fetch_kwork_projects

async def run_habr_pipeline() -> Dict[str, Any]:
    """
    Executes Habr Career ingestion:
    1. Search across presets
    2. Deduplicate
    3. Fetch full description
    4. Run AI scoring
    5. Save to SQLite
    """
    db = SessionLocal()
    stats = {
        "presets_checked": len(HABR_SEARCH_PRESETS),
        "scanned": 0,
        "already_exists": 0,
        "new_leads_saved": 0,
        "errors": 0
    }

    try:
        # Load existing external_ids
        existing_ids = set(
            row[0] for row in db.query(Lead.external_id).filter(Lead.external_id.isnot(None)).all()
        )

        kb_items = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.is_active == True).all()
        kb_data = [{"title": k.title, "content": k.content, "category": k.category} for k in kb_items]

        async with httpx.AsyncClient(timeout=25.0) as client:
            for preset in HABR_SEARCH_PRESETS:
                p_name = preset["name"]
                query = preset["query"]
                v_type = preset.get("type", "contract")

                print(f"\n[SEARCH] [Habr] Сканирование по пресету: '{p_name}' (Запрос: '{query}')...")
                items = await search_habr_vacancies(client, query=query, vacancy_type=v_type, max_items=10)
                stats["scanned"] += len(items)

                for item in items:
                    ext_id = f"habr_{item['id']}"
                    if ext_id in existing_ids:
                        stats["already_exists"] += 1
                        continue

                    print(f"   [+] Найдена новая вакансия: {item['title'][:40]} ({item['company']})...")
                    details = await fetch_habr_details(client, item['id'])
                    desc = details["description"] if details and details.get("description") else item.get("snippet", "")

                    if not desc or len(desc) < 40:
                        stats["errors"] += 1
                        continue

                    # Score with AI / Rules
                    score_res = await ai_service.score_lead(
                        title=item["title"],
                        description=desc,
                        kb_items=kb_data
                    )
                    match_score = score_res.get("match_score", 65)

                    cl = classify_lead_full(
                        title=item["title"],
                        description=desc,
                        tags=item.get("skills", "Python, Habr"),
                        salary_raw=item.get("salary") or "По договоренности",
                    )

                    new_lead = Lead(
                        external_id=ext_id,
                        title=item["title"],
                        company=item["company"],
                        description=desc,
                        url=item["url"],
                        source="habr_freelance",
                        salary_raw=item.get("salary") or "По договоренности",
                        tags=item.get("skills", "Python, Habr"),
                        match_score=match_score,
                        scoring_reason=score_res.get("explanation", "Релевантная вакансия с Хабр Карьеры"),
                        status="ai_scored" if match_score >= 70 else "new",
                        category=cl["category"],
                        deal_type=cl["deal_type"],
                        urgency=cl["urgency"],
                    )

                    db.add(new_lead)
                    db.commit()
                    existing_ids.add(ext_id)
                    stats["new_leads_saved"] += 1
                    print(f"       -> Сохранено в базу! Match score: {match_score}%")

        print(f"\n[DONE] [Habr] Завершено. Просканировано: {stats['scanned']}, Новых сохранено: {stats['new_leads_saved']}, Дубликатов: {stats['already_exists']}")
        return stats

    except Exception as e:
        print(f"[ERR] [Habr] Ошибка в пайплайне: {e}")
        db.rollback()
        return stats
    finally:
        db.close()

async def run_fl_pipeline() -> Dict[str, Any]:
    """
    Executes FL.ru freelance RSS ingestion:
    1. Fetch and filter RSS
    2. Deduplicate
    3. Score and save to SQLite
    """
    db = SessionLocal()
    stats = {
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

        async with httpx.AsyncClient(timeout=20.0) as client:
            print("\n[SEARCH] [FL.ru] Сканирование свежих проектов с RSS ленты FL.ru...")
            tasks = await fetch_fl_tasks(client, max_items=25)
            stats["scanned"] += len(tasks)

            for task in tasks:
                ext_id = task["id"]
                if ext_id in existing_ids:
                    stats["already_exists"] += 1
                    continue

                print(f"   [+] Новый фриланс проект: {task['title'][:40]} | Бюджет: {task.get('salary', 'По договоренности')}")

                # Score
                score_res = await ai_service.score_lead(
                    title=task["title"],
                    description=task["description"],
                    kb_items=kb_data
                )
                match_score = score_res.get("match_score", 70)

                cl = classify_lead_full(
                    title=task["title"],
                    description=task["description"],
                    tags="Фриланс, FL.ru, Заказ",
                    salary_raw=task.get("salary") or "По договоренности",
                )

                new_lead = Lead(
                    external_id=ext_id,
                    title=task["title"],
                    company=task.get("company", "Заказчик FL.ru"),
                    description=task["description"],
                    url=task["url"],
                    source="fl_ru",
                    salary_raw=task.get("salary") or "По договоренности",
                    tags="Фриланс, FL.ru, Заказ",
                    match_score=match_score,
                    scoring_reason=score_res.get("explanation", "Прямой проект с биржи FL.ru"),
                    status="ai_scored" if match_score >= 70 else "new",
                    category=cl["category"],
                    deal_type=cl["deal_type"],
                    urgency=cl["urgency"],
                )

                db.add(new_lead)
                db.commit()
                existing_ids.add(ext_id)
                stats["new_leads_saved"] += 1
                print(f"       -> Сохранено в базу! Match score: {match_score}%")

                # Send Telegram alert if score is >= 80%
                if match_score >= 80:
                    asyncio.create_task(alert_service.send_lead_alert({
                        "title": task["title"],
                        "company": task.get("company", "Заказчик FL.ru"),
                        "source": "fl_ru",
                        "salary_raw": task.get("salary") or "По договоренности",
                        "match_score": match_score,
                        "tags": "Фриланс, FL.ru, Заказ",
                        "scoring_reason": score_res.get("explanation", ""),
                        "url": task["url"]
                    }))

        print(f"\n[DONE] [FL.ru] Завершено. Найдено релевантных: {stats['scanned']}, Новых сохранено: {stats['new_leads_saved']}")
        return stats

    except Exception as e:
        print(f"[ERR] [FL.ru] Ошибка в пайплайне: {e}")
        db.rollback()
        return stats
    finally:
        db.close()

async def run_kwork_pipeline() -> Dict[str, Any]:
    """
    Executes Kwork project exchange ingestion:
    1. Fetch IT projects by keywords
    2. Deduplicate
    3. Score and save to SQLite
    4. Send instant push alert if score >= 80%
    """
    db = SessionLocal()
    stats = {
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

        async with httpx.AsyncClient(timeout=20.0) as client:
            print("\n[SEARCH] [Kwork] Сканирование IT-проектов с Биржи Kwork...")
            projects = await fetch_kwork_projects(client, max_items=25)
            stats["scanned"] += len(projects)

            for p in projects:
                ext_id = p["id"]
                if ext_id in existing_ids:
                    stats["already_exists"] += 1
                    continue

                print(f"   [+] Новый проект Kwork: {p['title'][:40]} | Бюджет: {p['salary']}")

                # Score
                score_res = await ai_service.score_lead(
                    title=p["title"],
                    description=p["description"],
                    kb_items=kb_data
                )
                match_score = score_res.get("match_score", 70)

                cl = classify_lead_full(
                    title=p["title"],
                    description=p["description"],
                    tags=p.get("tags", "Kwork, IT"),
                    salary_raw=p.get("salary") or "По договоренности",
                )

                new_lead = Lead(
                    external_id=ext_id,
                    title=p["title"],
                    company=p.get("company", "Заказчик Kwork"),
                    description=p["description"],
                    url=p["url"],
                    source="kwork",
                    salary_raw=p.get("salary") or "По договоренности",
                    tags=p.get("tags", "Kwork, IT"),
                    match_score=match_score,
                    scoring_reason=score_res.get("explanation", "Прямой проект с биржи Kwork"),
                    status="ai_scored" if match_score >= 70 else "new",
                    category=cl["category"],
                    deal_type=cl["deal_type"],
                    urgency=cl["urgency"],
                )

                db.add(new_lead)
                db.commit()
                existing_ids.add(ext_id)
                stats["new_leads_saved"] += 1
                print(f"       -> Сохранено в базу! Match score: {match_score}%")

                if match_score >= 80:
                    asyncio.create_task(alert_service.send_lead_alert({
                        "title": p["title"],
                        "company": p.get("company", "Заказчик Kwork"),
                        "source": "kwork",
                        "salary_raw": p.get("salary") or "По договоренности",
                        "match_score": match_score,
                        "tags": p.get("tags", ""),
                        "scoring_reason": score_res.get("explanation", ""),
                        "url": p["url"]
                    }))

        print(f"\n[DONE] [Kwork] Завершено. Найдено: {stats['scanned']}, Новых сохранено: {stats['new_leads_saved']}")
        return stats

    except Exception as e:
        print(f"[ERR] [Kwork] Ошибка в пайплайне: {e}")
        db.rollback()
        return stats
    finally:
        db.close()

async def run_all_freelance():
    """Run Habr, FL.ru, and Kwork scrapers sequentially."""
    print("=== [START] ЗАПУСК СБОРА С ФРИЛАНС И КОНТРАКТНЫХ ПЛОЩАДОК ===")
    habr_stats = await run_habr_pipeline()
    fl_stats = await run_fl_pipeline()
    kwork_stats = await run_kwork_pipeline()
    return {"habr": habr_stats, "fl": fl_stats, "kwork": kwork_stats}
