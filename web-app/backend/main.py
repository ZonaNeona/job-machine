import os
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from database import engine, get_db, init_db
from models import Lead, KnowledgeBaseItem, SystemSetting, LeadEvent
from schemas import (
    LeadResponse, LeadCreate, LeadUpdate, ManualLeadCreate,
    KnowledgeBaseItemResponse, KnowledgeBaseItemCreate,
    SystemStats, GenerateOfferRequest, SendOfferRequest, DispatchOfferRequest,
    LeadEventResponse, LeadEventFeed, LeadBrief, SourceHealth,
    OverviewTotals, OverviewToday, OverviewMrr, OverviewAttention, WorkspaceOverview,
)
from seed_data import seed_database
import ai_service

# Initialize Database and seed data on startup
init_db()
with next(get_db()) as db:
    seed_database(db)

app = FastAPI(
    title="JobMachine Command Center API",
    description="Backend API for managing AI-driven freelance/contract lead generation and outreach",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_store_for_api(request, call_next):
    """The dashboard must never show a cached overview after a collection run."""
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# --- Event journal helpers -------------------------------------------------
STATUS_LABELS_RU = {
    "new": "Входящие",
    "ai_scored": "На оценке",
    "offer_generated": "Оффер готов",
    "approved": "Готов к отправке",
    "sent": "Ожидаем ответ",
    "replied": "Ответ получен",
    "in_negotiation": "Переговоры",
    "closed_won": "Сделка",
    "archived": "Архив",
}


def _llm_configured() -> bool:
    key = os.getenv("OPENROUTER_API_KEY", "")
    return bool(key) and "your_openrouter" not in key


def log_event(
    db: Session,
    lead_id: int,
    kind: str,
    message: Optional[str] = None,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    payload: Optional[dict] = None,
) -> None:
    """Append a row to the lead journal. Caller commits the transaction."""
    db.add(
        LeadEvent(
            lead_id=lead_id,
            kind=kind,
            message=message,
            from_status=from_status,
            to_status=to_status,
            payload=json.dumps(payload, ensure_ascii=False) if payload else None,
        )
    )

@app.get("/api/stats", response_model=SystemStats)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Lead).count()
    new_count = db.query(Lead).filter(Lead.status == "new").count()
    scored = db.query(Lead).filter(Lead.status == "ai_scored").count()
    ready = db.query(Lead).filter(Lead.status == "offer_generated").count()
    sent = db.query(Lead).filter(Lead.status.in_(["approved", "sent"])).count()
    replies = db.query(Lead).filter(Lead.status == "replied").count()
    deals = db.query(Lead).filter(Lead.status.in_(["in_negotiation", "closed_won"])).count()

    # Sources breakdown
    sources = {}
    for s in ["hh.ru", "telegram", "habr_freelance", "fl_ru", "kwork", "avito", "direct"]:
        sources[s] = db.query(Lead).filter(Lead.source == s).count()

    target_clients = 6
    target_rate = 85000
    current_clients = db.query(Lead).filter(Lead.status.in_(["in_negotiation", "closed_won"])).count()
    current_mrr = current_clients * target_rate
    target_mrr = target_clients * target_rate
    conversion = round((replies / sent * 100) if sent > 0 else 0.0, 1)

    return SystemStats(
        total_leads=total,
        new_leads=new_count,
        scored_leads=scored,
        offers_ready=ready,
        sent_outreach=sent,
        responses_received=replies,
        active_deals=deals,
        target_clients=target_clients,
        current_clients=current_clients,
        current_mrr=current_mrr,
        target_mrr=target_mrr,
        conversion_rate=conversion,
        sources_breakdown=sources
    )

@app.get("/api/leads", response_model=List[LeadResponse])
def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    min_score: Optional[int] = None,
    limit: Optional[int] = Query(default=None, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Lead)
    if status and status != "all":
        query = query.filter(Lead.status == status)
    if source and source != "all":
        query = query.filter(Lead.source == source)
    if min_score is not None:
        query = query.filter(Lead.match_score >= min_score)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Lead.title.ilike(search_fmt)) |
            (Lead.company.ilike(search_fmt)) |
            (Lead.description.ilike(search_fmt)) |
            (Lead.tags.ilike(search_fmt))
        )
    query = query.order_by(Lead.created_at.desc())
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return query.all()


@app.post("/api/leads", response_model=LeadResponse, status_code=201)
def create_lead(payload: ManualLeadCreate, db: Session = Depends(get_db)):
    """Add a lead manually — a warm contact, a referral, a chat message."""
    lead = Lead(
        title=payload.title.strip(),
        company=payload.company,
        source=payload.source or "direct",
        url=payload.url,
        salary_raw=payload.salary_raw or "По договоренности",
        contact_info=payload.contact_info,
        description=payload.description or "",
        tags=payload.tags,
        status="new",
        match_score=payload.match_score or 60,
        priority=payload.priority or "normal",
        next_action_at=payload.next_action_at,
    )
    db.add(lead)
    db.flush()
    log_event(db, lead.id, "created", "Лид добавлен вручную", to_status="new", payload={"source": lead.source})
    db.commit()
    db.refresh(lead)
    return lead


@app.get("/api/leads/{lead_id}/events", response_model=List[LeadEventResponse])
def get_lead_events(lead_id: int, limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")
    return (
        db.query(LeadEvent)
        .filter(LeadEvent.lead_id == lead_id)
        .order_by(LeadEvent.created_at.desc())
        .limit(limit)
        .all()
    )

@app.get("/api/leads/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")
    return lead

ALLOWED_STATUSES = set(STATUS_LABELS_RU.keys())


@app.patch("/api/leads/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, update_data: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    data = update_data.model_dump(exclude_unset=True)
    if not data:
        return lead

    if "status" in data and data["status"] not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Неизвестная стадия: {data['status']}")

    old_status = lead.status
    old_offer = lead.generated_offer or ""
    old_score = lead.match_score
    for key, value in data.items():
        setattr(lead, key, value)

    if lead.status == "sent" and not lead.sent_at:
        lead.sent_at = datetime.utcnow()
    if lead.status == "replied" and not lead.replied_at:
        lead.replied_at = datetime.utcnow()
    if lead.status in ("closed_won", "archived"):
        lead.next_action_at = None
    lead.updated_at = datetime.utcnow()

    if old_status != lead.status:
        log_event(
            db,
            lead.id,
            "status_changed",
            f"{STATUS_LABELS_RU.get(old_status, old_status)} → {STATUS_LABELS_RU.get(lead.status, lead.status)}",
            from_status=old_status,
            to_status=lead.status,
        )
    if "generated_offer" in data and (lead.generated_offer or "") != old_offer:
        log_event(db, lead.id, "offer_saved", "Черновик предложения сохранён")
    if "match_score" in data and lead.match_score != old_score:
        log_event(db, lead.id, "score_changed", f"Оценка изменена на {lead.match_score}%")
    touched = [k for k in data if k not in ("status", "generated_offer", "match_score")]
    if touched:
        log_event(db, lead.id, "field_updated", "Обновлены поля: " + ", ".join(touched), payload={"fields": touched})

    db.commit()
    db.refresh(lead)
    return lead

@app.post("/api/leads/{lead_id}/generate-offer")
async def generate_offer(
    lead_id: int, 
    req: GenerateOfferRequest, 
    db: Session = Depends(get_db)
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    # Fetch active case studies from Knowledge Base
    kb_items = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.is_active == True).all()
    kb_data = [{"title": k.title, "content": k.content, "category": k.category} for k in kb_items]

    # Generate personalized response
    offer_text = await ai_service.generate_tailored_offer(
        title=lead.title,
        company=lead.company,
        description=lead.description,
        kb_cases=kb_data,
        custom_instructions=req.custom_instructions,
        model=req.model or "anthropic/claude-3.5-sonnet",
        angle=req.angle or "pain",
        length=req.length or "short",
        variation=req.variation or 0,
    )

    previous_status = lead.status
    llm_used = _llm_configured()
    lead.generated_offer = offer_text
    if lead.status in ["new", "ai_scored"]:
        lead.status = "offer_generated"
    lead.updated_at = datetime.utcnow()
    log_event(
        db,
        lead.id,
        "offer_generated",
        "Черновик предложения создан" + ("" if llm_used else " — LLM не подключён, это заготовка"),
        from_status=previous_status,
        to_status=lead.status,
        payload={"model": req.model, "angle": req.angle, "length": req.length, "chars": len(offer_text), "fallback": not llm_used},
    )
    db.commit()
    db.refresh(lead)

    return {"status": "success", "offer": offer_text, "lead_id": lead.id, "fallback": not llm_used}

@app.post("/api/leads/{lead_id}/send-offer")
def send_offer(
    lead_id: int,
    req: SendOfferRequest,
    db: Session = Depends(get_db)
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    lead.generated_offer = req.offer_text
    lead.status = "sent"
    lead.sent_at = datetime.utcnow()
    lead.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lead)

    return {"status": "success", "message": "Оффер помечен как отправленный", "lead": lead}

@app.post("/api/leads/{lead_id}/dispatch")
def dispatch_offer(
    lead_id: int,
    req: DispatchOfferRequest,
    db: Session = Depends(get_db)
):
    """
    1-Click Outreach Dispatcher (Human-in-the-Loop Safeguard)
    Требует явного подтверждения человеком (confirmed_by_human=True).
    Без подтверждения человека отправка категорически отклоняется.
    """
    if not req.confirmed_by_human:
        raise HTTPException(
            status_code=400, 
            detail="Режим Human-in-the-Loop: требуется явное подтверждение человека для отправки отклика"
        )

    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    # Update lead status and store approved offer text
    previous_status = lead.status
    follow_up_days = req.follow_up_days if req.follow_up_days is not None else 2
    lead.generated_offer = req.offer_text
    lead.status = "sent"
    lead.sent_at = datetime.utcnow()
    lead.updated_at = datetime.utcnow()
    lead.next_action_at = lead.sent_at + timedelta(days=max(1, follow_up_days))
    log_event(
        db,
        lead.id,
        "dispatched",
        f"Отклик подтверждён и зафиксирован · follow-up через {max(1, follow_up_days)} дн.",
        from_status=previous_status,
        to_status="sent",
        payload={"channel": req.channel or lead.source, "dry_run": req.dry_run, "follow_up_days": follow_up_days},
    )
    db.commit()
    db.refresh(lead)

    print(f"[DISPATCH] [DRY-RUN CONFIRMED] Человек подтвердил отклик по лиду #{lead.id}: '{lead.title}' через канал '{req.channel or lead.source}'")

    return {
        "status": "success",
        "mode": "dry_run_confirmed",
        "message": "Отклик подтвержден человеком и зафиксирован в воронке",
        "lead_id": lead.id,
        "sent_at": lead.sent_at.isoformat(),
        "next_action_at": lead.next_action_at.isoformat() if lead.next_action_at else None,
        "channel": req.channel or lead.source,
    }

def _setting_int(db: Session, key: str, default: int) -> int:
    item = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not item:
        return default
    try:
        return int(float(item.value))
    except (TypeError, ValueError):
        return default


OPEN_STATUSES = ("new", "ai_scored", "offer_generated", "approved")
TRACKED_SOURCES = ("hh.ru", "telegram", "habr_freelance", "fl_ru", "kwork", "avito", "direct")


@app.get("/api/workspace/overview", response_model=WorkspaceOverview)
def workspace_overview(db: Session = Depends(get_db)):
    """One call that powers the morning screen.

    Everything the owner needs at 9am: what came in tonight, what is waiting
    for a proposal, what needs a follow-up today, and how the funnel moves.
    """
    now = datetime.utcnow()
    start_today = datetime(now.year, now.month, now.day)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    leads = db.query(Lead).all()

    by_status = {key: 0 for key in STATUS_LABELS_RU}
    for lead in leads:
        by_status[lead.status] = by_status.get(lead.status, 0) + 1

    sources = []
    for key in TRACKED_SOURCES:
        bucket = [lead for lead in leads if lead.source == key]
        sources.append(
            SourceHealth(
                source=key,
                total=len(bucket),
                new=sum(1 for lead in bucket if lead.status in ("new", "ai_scored")),
                fresh=sum(1 for lead in bucket if lead.created_at and lead.created_at >= day_ago),
                last_seen=max((lead.created_at for lead in bucket if lead.created_at), default=None),
            )
        )

    needs_offer = [lead for lead in leads if lead.status in ("new", "ai_scored")]
    needs_offer.sort(key=lambda lead: (-(lead.match_score or 0), lead.created_at or now))

    ready_to_send = [
        lead for lead in leads
        if lead.status in ("offer_generated", "approved") and (lead.generated_offer or "").strip()
    ]
    ready_to_send.sort(key=lambda lead: -(lead.match_score or 0))

    follow_ups = [
        lead for lead in leads
        if lead.status == "sent" and (
            (lead.next_action_at is not None and lead.next_action_at <= now + timedelta(days=1))
            or (lead.next_action_at is None and lead.sent_at is not None and lead.sent_at <= now - timedelta(days=2))
        )
    ]
    follow_ups.sort(key=lambda lead: lead.next_action_at or lead.sent_at or now)

    replied = [lead for lead in leads if lead.status == "replied"]
    replied.sort(key=lambda lead: lead.replied_at or lead.updated_at or now, reverse=True)

    stale = [
        lead for lead in leads
        if lead.status in OPEN_STATUSES and lead.updated_at is not None and lead.updated_at <= week_ago
    ]
    stale.sort(key=lambda lead: lead.updated_at or now)

    events = db.query(LeadEvent).order_by(LeadEvent.created_at.desc()).limit(8).all()
    titles = {lead.id: lead.title for lead in leads}
    feed = [
        LeadEventFeed(
            **LeadEventResponse.model_validate(event).model_dump(),
            lead_title=titles.get(event.lead_id, "Лид"),
        )
        for event in events
    ]

    monthly_rate = _setting_int(db, "TARGET_MONTHLY_RATE", int(os.getenv("TARGET_MONTHLY_RATE", "85000") or 85000))
    target_clients = _setting_int(db, "TARGET_CLIENTS_COUNT", int(os.getenv("TARGET_CLIENTS_COUNT", "6") or 6))
    clients = by_status.get("in_negotiation", 0) + by_status.get("closed_won", 0)

    return WorkspaceOverview(
        generated_at=now,
        totals=OverviewTotals(
            all=len(leads),
            new=by_status.get("new", 0),
            scored=by_status.get("ai_scored", 0),
            offers_ready=by_status.get("offer_generated", 0) + by_status.get("approved", 0),
            sent=by_status.get("sent", 0),
            replied=by_status.get("replied", 0),
            negotiation=by_status.get("in_negotiation", 0),
            won=by_status.get("closed_won", 0),
            archived=by_status.get("archived", 0),
        ),
        today=OverviewToday(
            new_leads=sum(1 for lead in leads if lead.created_at and lead.created_at >= start_today),
            offers_created=db.query(LeadEvent).filter(
                LeadEvent.kind == "offer_generated", LeadEvent.created_at >= start_today
            ).count(),
            sent=sum(1 for lead in leads if lead.sent_at and lead.sent_at >= start_today),
            responses=sum(1 for lead in leads if lead.replied_at and lead.replied_at >= start_today),
        ),
        mrr=OverviewMrr(
            current=clients * monthly_rate,
            target=target_clients * monthly_rate,
            clients=clients,
            target_clients=target_clients,
            monthly_rate=monthly_rate,
        ),
        sources=sources,
        attention=OverviewAttention(
            needs_offer=[LeadBrief.model_validate(lead) for lead in needs_offer[:8]],
            ready_to_send=[LeadBrief.model_validate(lead) for lead in ready_to_send[:6]],
            follow_ups=[LeadBrief.model_validate(lead) for lead in follow_ups[:6]],
            replied=[LeadBrief.model_validate(lead) for lead in replied[:6]],
            stale=[LeadBrief.model_validate(lead) for lead in stale[:5]],
        ),
        recent_events=feed,
    )


@app.get("/api/knowledge-base", response_model=List[KnowledgeBaseItemResponse])
def get_knowledge_base(db: Session = Depends(get_db)):
    return db.query(KnowledgeBaseItem).order_by(KnowledgeBaseItem.id.asc()).all()

@app.post("/api/knowledge-base", response_model=KnowledgeBaseItemResponse)
def create_knowledge_base_item(item: KnowledgeBaseItemCreate, db: Session = Depends(get_db)):
    new_item = KnowledgeBaseItem(**item.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.delete("/api/knowledge-base/{item_id}")
def delete_knowledge_base_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(KnowledgeBaseItem).filter(KnowledgeBaseItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Элемент не найден")
    db.delete(item)
    db.commit()
    return {"status": "success"}

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(SystemSetting).all()
    result = {s.key: s.value for s in settings}
    # Add env flags to indicate whether keys are configured
    result["OPENROUTER_CONFIGURED"] = bool(os.getenv("OPENROUTER_API_KEY") and "your_openrouter" not in os.getenv("OPENROUTER_API_KEY"))
    result["HH_CONFIGURED"] = bool(os.getenv("HH_ACCESS_TOKEN"))
    result["TG_CONFIGURED"] = bool(os.getenv("TG_API_ID"))
    return result

@app.post("/api/settings")
def update_settings(settings_dict: dict, db: Session = Depends(get_db)):
    for key, value in settings_dict.items():
        item = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if item:
            item.value = str(value)
        else:
            db.add(SystemSetting(key=key, value=str(value)))
    db.commit()
    return {"status": "success", "updated": list(settings_dict.keys())}


# --- HeadHunter Scraper Background Tasks & Status ---
scraper_state = {
    "is_running": False,
    "last_run": None,
    "last_result": None
}

@app.post("/api/scrapers/hh/trigger")
async def trigger_hh_scraper(background_tasks: BackgroundTasks):
    if scraper_state["is_running"]:
        return {"status": "already_running", "message": "Сбор уже выполняется в фоновом режиме"}

    async def run_task():
        scraper_state["is_running"] = True
        try:
            from pathlib import Path
            import sys
            hh_dir = Path(__file__).resolve().parent.parent.parent / "scrapers" / "hh"
            if str(hh_dir) not in sys.path:
                sys.path.insert(0, str(hh_dir))
            from pipeline import run_hh_pipeline
            res = await run_hh_pipeline()
            scraper_state["last_result"] = res
            scraper_state["last_run"] = datetime.utcnow().isoformat()
        except Exception as e:
            print(f"[!] Error in background scraper task: {e}")
            scraper_state["last_result"] = {"error": str(e)}
        finally:
            scraper_state["is_running"] = False

    background_tasks.add_task(run_task)
    return {"status": "started", "message": "Сбор вакансий с hh.ru успешно запущен в фоне"}

@app.get("/api/scrapers/hh/status")
def get_hh_scraper_status():
    return scraper_state


# --- Telegram Ingestor Background Tasks & Status ---
tg_scraper_state = {
    "is_running": False,
    "last_run": None,
    "last_result": None
}

@app.post("/api/scrapers/tg/trigger")
async def trigger_tg_scraper(background_tasks: BackgroundTasks):
    if tg_scraper_state["is_running"]:
        return {"status": "already_running", "message": "Сбор Telegram уже выполняется в фоновом режиме"}

    async def run_tg_task():
        tg_scraper_state["is_running"] = True
        try:
            from pathlib import Path
            import sys
            tg_dir = Path(__file__).resolve().parent.parent.parent / "scrapers" / "telegram"
            if str(tg_dir) not in sys.path:
                sys.path.insert(0, str(tg_dir))
            from pipeline import run_telegram_pipeline
            res = await run_telegram_pipeline()
            tg_scraper_state["last_result"] = res
            tg_scraper_state["last_run"] = datetime.utcnow().isoformat()
        except Exception as e:
            print(f"[!] Error in background TG scraper task: {e}")
            tg_scraper_state["last_result"] = {"error": str(e)}
        finally:
            tg_scraper_state["is_running"] = False

    background_tasks.add_task(run_tg_task)
    return {"status": "started", "message": "Сбор лидов из Telegram запущен в фоне"}

@app.get("/api/scrapers/tg/status")
def get_tg_scraper_status():
    return tg_scraper_state


# --- Freelance & Habr Ingestor Background Tasks & Status ---
freelance_scraper_state = {
    "is_running": False,
    "last_run": None,
    "last_result": None
}

@app.post("/api/scrapers/freelance/trigger")
async def trigger_freelance_scraper(background_tasks: BackgroundTasks):
    if freelance_scraper_state["is_running"]:
        return {"status": "already_running", "message": "Сбор фриланс-площадок уже выполняется"}

    async def run_freelance_task():
        freelance_scraper_state["is_running"] = True
        try:
            from pathlib import Path
            import sys
            freelance_dir = Path(__file__).resolve().parent.parent.parent / "scrapers" / "freelance"
            if str(freelance_dir) not in sys.path:
                sys.path.insert(0, str(freelance_dir))
            from pipeline import run_all_freelance
            res = await run_all_freelance()
            freelance_scraper_state["last_result"] = res
            freelance_scraper_state["last_run"] = datetime.utcnow().isoformat()
        except Exception as e:
            print(f"[!] Error in background freelance scraper task: {e}")
            freelance_scraper_state["last_result"] = {"error": str(e)}
        finally:
            freelance_scraper_state["is_running"] = False

    background_tasks.add_task(run_freelance_task)
    return {"status": "started", "message": "Сбор лидов с Хабр Карьеры и FL.ru запущен в фоне"}

@app.get("/api/scrapers/freelance/status")
def get_freelance_scraper_status():
    return freelance_scraper_state


# --- Telegram Alert Service Endpoints ---
@app.post("/api/alerts/test")
async def trigger_test_alert():
    import alert_service
    result = await alert_service.test_alert()
    return result


# --- Avito Rabota Ingestor Background Tasks & Status ---
avito_scraper_state = {
    "is_running": False,
    "last_run": None,
    "last_result": None
}

@app.post("/api/scrapers/avito/trigger")
async def trigger_avito_scraper(background_tasks: BackgroundTasks):
    if avito_scraper_state["is_running"]:
        return {"status": "already_running", "message": "Сбор вакансий с Авито Работы уже выполняется"}

    async def run_avito_task():
        avito_scraper_state["is_running"] = True
        try:
            from pathlib import Path
            import sys
            avito_dir = Path(__file__).resolve().parent.parent.parent / "scrapers" / "avito"
            if str(avito_dir) not in sys.path:
                sys.path.insert(0, str(avito_dir))
            from pipeline import run_avito_pipeline
            res = await run_avito_pipeline(headless=True)
            avito_scraper_state["last_result"] = res
            avito_scraper_state["last_run"] = datetime.utcnow().isoformat()
        except Exception as e:
            print(f"[!] Error in background Avito scraper task: {e}")
            avito_scraper_state["last_result"] = {"error": str(e)}
        finally:
            avito_scraper_state["is_running"] = False

    background_tasks.add_task(run_avito_task)
    return {"status": "started", "message": "Сбор вакансий с Авито Работы запущен в фоне"}

@app.get("/api/scrapers/avito/status")
def get_avito_scraper_status():
    return avito_scraper_state





