import os
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from database import engine, get_db, init_db
from models import Lead, KnowledgeBaseItem, SystemSetting, LeadEvent, AccountPlatform, AccountChat
from schemas import (
    LeadResponse, LeadCreate, LeadUpdate, ManualLeadCreate,
    KnowledgeBaseItemResponse, KnowledgeBaseItemCreate,
    SystemStats, GenerateOfferRequest, SendOfferRequest, DispatchOfferRequest,
    LeadEventResponse, LeadEventFeed, LeadBrief, SourceHealth,
    OverviewTotals, OverviewToday, OverviewMrr, OverviewAttention, WorkspaceOverview,
    AccountPlatformUpdate, AccountPlatformResponse, AccountChatResponse,
)
from seed_data import seed_database
import ai_service

import sys
from pathlib import Path
BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from shared.intelligence import (
    execute_readonly_sql,
    get_platform_analytics,
    get_sweet_spot_leads,
    audit_funnel,
    inspect_employer,
    set_employer_blacklist,
)
import ai_copilot


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
    category: Optional[str] = None,
    urgency: Optional[str] = None,
    deal_type: Optional[str] = None,
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
    if category and category != "all":
        query = query.filter(Lead.category == category)
    if urgency and urgency != "all":
        query = query.filter(Lead.urgency == urgency)
    if deal_type and deal_type != "all":
        query = query.filter(Lead.deal_type == deal_type)
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
    from classifier import classify_lead_full
    meta = classify_lead_full(
        title=payload.title.strip(),
        description=payload.description or "",
        tags=payload.tags or "",
        salary_raw=payload.salary_raw or "",
        contact_info=payload.contact_info or "",
    )
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
        category=payload.category or meta["category"],
        deal_type=payload.deal_type or meta["deal_type"],
        urgency=meta["urgency"],
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

def _setting_str(db: Session, key: str, default: str) -> str:
    item = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return item.value if (item and item.value is not None) else default

def _setting_bool(db: Session, key: str, default: bool) -> bool:
    val = _setting_str(db, key, "").lower()
    if not val:
        return default
    return val in {"1", "true", "yes", "on", "да"}


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

    # OpenRouter defaults
    result.setdefault("OPENROUTER_DEFAULT_MODEL", os.getenv("OPENROUTER_DEFAULT_MODEL", "anthropic/claude-3.5-sonnet"))
    result.setdefault("OPENROUTER_SCORING_MODEL", os.getenv("OPENROUTER_SCORING_MODEL", "deepseek/deepseek-chat"))
    result.setdefault("OPENROUTER_TEMPERATURE", "0.7")

    # HH Account Bot defaults (disabled by default as requested by user)
    result.setdefault("HH_ACCOUNT_SYNC_ENABLED", "false")
    result.setdefault("HH_ACCOUNT_SYNC_INTERVAL_MIN", "60")
    result.setdefault("HH_ACCOUNT_MAX_CHATS_TO_OPEN", "12")
    result.setdefault("HH_ACCOUNT_BASE_URL", "https://hh.ru")
    result.setdefault("HH_ACCOUNT_OPEN_CHAT_DETAILS", "true")
    result.setdefault("HH_ACCOUNT_ALERT_ON_REPLY", "true")

    # Business targets & safety defaults
    result.setdefault("TARGET_CLIENTS_COUNT", "6")
    result.setdefault("TARGET_MONTHLY_RATE", "85000")
    result.setdefault("MIN_MATCH_SCORE_THRESHOLD", "70")
    result.setdefault("HH_AUTO_APPLY_ENABLED", "false")
    result.setdefault("TG_AUTO_NOTIFY_ENABLED", "true")

    # Add env flags to indicate whether keys are configured
    result["OPENROUTER_CONFIGURED"] = bool(os.getenv("OPENROUTER_API_KEY") and "your_openrouter" not in os.getenv("OPENROUTER_API_KEY"))
    result["HH_CONFIGURED"] = bool(os.getenv("HH_ACCESS_TOKEN"))
    result["TG_CONFIGURED"] = bool(os.getenv("TG_API_ID"))
    # Account monitor session (Playwright profile), independent from HH_ACCESS_TOKEN
    from pathlib import Path
    hh_profile = Path(__file__).resolve().parent.parent.parent / "account-parsing" / "hh" / "browser_profile"
    result["HH_ACCOUNT_PROFILE_READY"] = hh_profile.exists() and any(hh_profile.iterdir())
    return result

@app.post("/api/settings")
def update_settings(settings_dict: dict, db: Session = Depends(get_db)):
    for key, value in settings_dict.items():
        item = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if item:
            item.value = str(value)
        else:
            db.add(SystemSetting(key=key, value=str(value)))

    # Keep account_platforms in sync with HH account settings
    if "HH_ACCOUNT_SYNC_ENABLED" in settings_dict:
        is_en = str(settings_dict["HH_ACCOUNT_SYNC_ENABLED"]).lower() in {"1", "true", "yes"}
        plat = db.query(AccountPlatform).filter(AccountPlatform.platform == "hh.ru").first()
        if plat:
            plat.enabled = is_en
    if "HH_ACCOUNT_SYNC_INTERVAL_MIN" in settings_dict:
        try:
            mins = int(settings_dict["HH_ACCOUNT_SYNC_INTERVAL_MIN"])
            plat = db.query(AccountPlatform).filter(AccountPlatform.platform == "hh.ru").first()
            if plat:
                plat.interval_minutes = mins
        except Exception:
            pass

    db.commit()
    return {"status": "success", "updated": list(settings_dict.keys())}


@app.post("/api/settings/test-openrouter")
async def test_openrouter_connection(payload: dict = Body(default={}), db: Session = Depends(get_db)):
    model = payload.get("model") or _setting_str(db, "OPENROUTER_DEFAULT_MODEL", "anthropic/claude-3.5-sonnet")
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key or "your_openrouter_api_key" in api_key:
        return {
            "status": "error",
            "message": "Ключ OPENROUTER_API_KEY не задан в .env. Добавьте его для работы нейросетей."
        }
    import time
    t0 = time.time()
    try:
        reply = await ai_service.call_openrouter(
            messages=[{"role": "user", "content": "Ping test. Respond with only 'PONG'"}],
            model=model,
            temperature=0.1
        )
        latency = round((time.time() - t0) * 1000)
        return {
            "status": "success",
            "model": model,
            "latency_ms": latency,
            "response": reply,
            "message": f"Связь с OpenRouter успешна! Модель {model} ответила за {latency} мс."
        }
    except Exception as e:
        return {
            "status": "error",
            "model": model,
            "message": f"Ошибка запроса к OpenRouter ({model}): {str(e)}"
        }


# --- Unified Intelligence Engine & Copilot Endpoints ---

@app.get("/api/intelligence/audit")
def get_intelligence_audit():
    """Returns platform yield, noise ratios, and funnel bottlenecks."""
    analytics = get_platform_analytics()
    funnel = audit_funnel()
    return {"status": "success", "analytics": analytics, "funnel": funnel}


@app.get("/api/intelligence/sweet-spot")
def get_sweet_spot(
    limit: int = Query(5, ge=1, le=20),
    category: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    min_score: int = Query(60, ge=0, le=100),
):
    """Returns high-yield, low-friction leads prioritized by Sweet Spot score."""
    return get_sweet_spot_leads(limit=limit, category=category, urgency=urgency, min_score=min_score)


@app.post("/api/intelligence/query-sql")
def query_sql(payload: dict = Body(default={})):
    """Executes safe read-only SELECT queries for IDE agents and analytics."""
    query = payload.get("query", "")
    max_rows = payload.get("max_rows", 50)
    return execute_readonly_sql(query=query, max_rows=max_rows)


@app.post("/api/intelligence/blacklist")
def blacklist_employer(payload: dict = Body(default={})):
    """Adds or removes an employer from the blacklist."""
    source = payload.get("source", "")
    platform_employer_id = payload.get("platform_employer_id", "")
    name = payload.get("name", "")
    reason = payload.get("reason", "Заблокирован пользователем")
    is_blacklisted = payload.get("is_blacklisted", True)
    return set_employer_blacklist(source, platform_employer_id, name, reason, is_blacklisted)


@app.post("/api/copilot/chat")
async def copilot_chat(payload: dict = Body(default={})):
    """In-app conversational copilot that audits platforms and evaluates leads."""
    messages = payload.get("messages", [])
    lead_id = payload.get("lead_id")
    model = payload.get("model")
    return await ai_copilot.answer_copilot(messages=messages, lead_id=lead_id, model=model)



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


# --- Account monitors (personal cabinets: HH chats, later Habр / FL / …) ---
account_sync_state = {
    "hh.ru": {"is_running": False, "last_run": None, "last_result": None},
}

HH_ACCOUNT_SETTING_MAP = {
    "base_url": "HH_ACCOUNT_BASE_URL",
    "open_chat_details": "HH_ACCOUNT_OPEN_CHAT_DETAILS",
    "max_chats_to_open": "HH_ACCOUNT_MAX_CHATS_TO_OPEN",
    "alert_on_reply": "HH_ACCOUNT_ALERT_ON_REPLY",
    "enabled": "HH_ACCOUNT_SYNC_ENABLED",
    "interval_minutes": "HH_ACCOUNT_SYNC_INTERVAL_MIN",
}


def _settings_map(db: Session) -> dict:
    return {s.key: s.value for s in db.query(SystemSetting).all()}


def _upsert_setting(db: Session, key: str, value: str) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=key, value=value))


def _platform_response(db: Session, platform: AccountPlatform) -> AccountPlatformResponse:
    from pathlib import Path
    sm = _settings_map(db)
    stats = None
    if platform.last_stats_json:
        try:
            stats = json.loads(platform.last_stats_json)
        except Exception:
            stats = None

    profile_ready = platform.profile_ready
    if platform.platform == "hh.ru":
        profile_dir = Path(__file__).resolve().parent.parent.parent / "account-parsing" / "hh" / "browser_profile"
        profile_ready = profile_dir.exists() and any(profile_dir.iterdir())

    running = bool(account_sync_state.get(platform.platform, {}).get("is_running"))
    login_hint = None
    if platform.platform == "hh.ru":
        login_hint = "py account-parsing/hh/auth_session.py"

    return AccountPlatformResponse(
        platform=platform.platform,
        label=platform.label,
        enabled=platform.enabled if platform.platform != "hh.ru" else sm.get("HH_ACCOUNT_SYNC_ENABLED", "true").lower() in {"1", "true", "yes"},
        interval_minutes=int(sm.get("HH_ACCOUNT_SYNC_INTERVAL_MIN", platform.interval_minutes or 60)),
        session_ok=bool(platform.session_ok),
        profile_ready=bool(profile_ready),
        last_run_at=platform.last_run_at,
        last_status=platform.last_status,
        last_error=platform.last_error,
        last_stats=stats,
        base_url=sm.get("HH_ACCOUNT_BASE_URL", "https://hh.ru") if platform.platform == "hh.ru" else None,
        open_chat_details=sm.get("HH_ACCOUNT_OPEN_CHAT_DETAILS", "true").lower() in {"1", "true", "yes"} if platform.platform == "hh.ru" else None,
        max_chats_to_open=int(sm.get("HH_ACCOUNT_MAX_CHATS_TO_OPEN", "12")) if platform.platform == "hh.ru" else None,
        alert_on_reply=sm.get("HH_ACCOUNT_ALERT_ON_REPLY", "true").lower() in {"1", "true", "yes"} if platform.platform == "hh.ru" else None,
        login_hint=login_hint,
        is_running=running,
    )


@app.get("/api/accounts", response_model=List[AccountPlatformResponse])
def list_account_platforms(db: Session = Depends(get_db)):
    rows = db.query(AccountPlatform).order_by(AccountPlatform.platform.asc()).all()
    if not rows:
        # Soft ensure — init_db should have seeded, but keep API resilient
        db.add(AccountPlatform(platform="hh.ru", label="hh.ru · чаты откликов", enabled=True, interval_minutes=60, last_status="idle"))
        db.commit()
        rows = db.query(AccountPlatform).all()
    return [_platform_response(db, row) for row in rows]


@app.get("/api/accounts/{platform}", response_model=AccountPlatformResponse)
def get_account_platform(platform: str, db: Session = Depends(get_db)):
    row = db.query(AccountPlatform).filter(AccountPlatform.platform == platform).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Платформа {platform} не найдена")
    return _platform_response(db, row)


@app.patch("/api/accounts/{platform}", response_model=AccountPlatformResponse)
def update_account_platform(platform: str, body: AccountPlatformUpdate, db: Session = Depends(get_db)):
    row = db.query(AccountPlatform).filter(AccountPlatform.platform == platform).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Платформа {platform} не найдена")

    if body.enabled is not None:
        row.enabled = body.enabled
        if platform == "hh.ru":
            _upsert_setting(db, "HH_ACCOUNT_SYNC_ENABLED", "true" if body.enabled else "false")
    if body.interval_minutes is not None:
        mins = max(15, min(24 * 60, int(body.interval_minutes)))
        row.interval_minutes = mins
        if platform == "hh.ru":
            _upsert_setting(db, "HH_ACCOUNT_SYNC_INTERVAL_MIN", str(mins))
    if platform == "hh.ru":
        if body.base_url is not None:
            _upsert_setting(db, "HH_ACCOUNT_BASE_URL", body.base_url.rstrip("/") or "https://hh.ru")
        if body.open_chat_details is not None:
            _upsert_setting(db, "HH_ACCOUNT_OPEN_CHAT_DETAILS", "true" if body.open_chat_details else "false")
        if body.max_chats_to_open is not None:
            _upsert_setting(db, "HH_ACCOUNT_MAX_CHATS_TO_OPEN", str(max(0, min(40, int(body.max_chats_to_open)))))
        if body.alert_on_reply is not None:
            _upsert_setting(db, "HH_ACCOUNT_ALERT_ON_REPLY", "true" if body.alert_on_reply else "false")

    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _platform_response(db, row)


@app.get("/api/accounts/{platform}/chats", response_model=List[AccountChatResponse])
def list_account_chats(
    platform: str,
    unread_only: bool = Query(False),
    has_reply: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(AccountChat).filter(AccountChat.platform == platform)
    if unread_only:
        q = q.filter(AccountChat.unread == True)  # noqa: E712
    if has_reply is not None:
        q = q.filter(AccountChat.has_reply == has_reply)
    rows = q.order_by(AccountChat.updated_at.desc()).limit(limit).all()
    return rows


@app.post("/api/accounts/{platform}/chats/{chat_id}/read")
def mark_account_chat_read(platform: str, chat_id: str, db: Session = Depends(get_db)):
    row = (
        db.query(AccountChat)
        .filter(AccountChat.platform == platform, AccountChat.external_chat_id == chat_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Чат не найден")
    row.unread = False
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "ok"}


@app.post("/api/accounts/{platform}/sync")
async def trigger_account_sync(platform: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    row = db.query(AccountPlatform).filter(AccountPlatform.platform == platform).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Платформа {platform} не найдена")

    state = account_sync_state.setdefault(platform, {"is_running": False, "last_run": None, "last_result": None})
    if state["is_running"]:
        return {"status": "already_running", "message": f"Синхронизация {platform} уже идёт"}

    if platform != "hh.ru":
        raise HTTPException(status_code=400, detail="Пока поддерживается только hh.ru — остальные площадки по порядку")

    is_enabled = _setting_bool(db, "HH_ACCOUNT_SYNC_ENABLED", False)
    if not is_enabled:
        return {
            "status": "disabled",
            "message": "Мониторинг hh-аккаунта временно отключен в технических настройках. Включите активность бота, чтобы запустить сбор.",
        }

    async def run_hh_account_task():
        state["is_running"] = True
        try:
            from pathlib import Path
            import sys
            hh_account_dir = Path(__file__).resolve().parent.parent.parent / "account-parsing" / "hh"
            if str(hh_account_dir) not in sys.path:
                sys.path.insert(0, str(hh_account_dir))
            from pipeline import run_hh_account_sync
            res = await run_hh_account_sync(headless=True, force=True)
            state["last_result"] = res
            state["last_run"] = datetime.utcnow().isoformat()
        except Exception as e:
            print(f"[!] Error in HH account sync: {e}")
            state["last_result"] = {"error": str(e)}
        finally:
            state["is_running"] = False

    background_tasks.add_task(run_hh_account_task)
    return {
        "status": "started",
        "message": "Синхронизация чатов hh.ru запущена. Если сессии нет — выполните py account-parsing/hh/auth_session.py",
    }


@app.post("/api/accounts/{platform}/import-sample")
async def import_account_sample(platform: str, db: Session = Depends(get_db)):
    row = db.query(AccountPlatform).filter(AccountPlatform.platform == platform).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Платформа {platform} не найдена")
    if platform != "hh.ru":
        raise HTTPException(status_code=400, detail="Сэмплы пока доступны только для hh.ru")

    from pathlib import Path
    import sys
    hh_account_dir = Path(__file__).resolve().parent.parent.parent / "account-parsing" / "hh"
    if str(hh_account_dir) not in sys.path:
        sys.path.insert(0, str(hh_account_dir))
    from pipeline import run_hh_sample_import

    res = await run_hh_sample_import(alerts_on=False)
    return {"status": "ok", "stats": res}


@app.get("/api/accounts/{platform}/status")
def get_account_sync_status(platform: str, db: Session = Depends(get_db)):
    row = db.query(AccountPlatform).filter(AccountPlatform.platform == platform).first()
    state = account_sync_state.get(platform, {"is_running": False, "last_run": None, "last_result": None})
    payload = {
        "is_running": state.get("is_running", False),
        "last_run": state.get("last_run") or (row.last_run_at.isoformat() if row and row.last_run_at else None),
        "last_result": state.get("last_result"),
    }
    if row:
        payload["session_ok"] = row.session_ok
        payload["last_status"] = row.last_status
        payload["last_error"] = row.last_error
    return payload

