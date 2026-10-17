import os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from database import engine, get_db, init_db
from models import Lead, KnowledgeBaseItem, SystemSetting
from schemas import (
    LeadResponse, LeadCreate, LeadUpdate,
    KnowledgeBaseItemResponse, KnowledgeBaseItemCreate,
    SystemStats, GenerateOfferRequest, SendOfferRequest, DispatchOfferRequest
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

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

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
    return query.order_by(Lead.created_at.desc()).all()

@app.get("/api/leads/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")
    return lead

@app.patch("/api/leads/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, update_data: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Лид не найден")

    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)

    lead.updated_at = datetime.utcnow()
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
        model=req.model or "anthropic/claude-3.5-sonnet"
    )

    lead.generated_offer = offer_text
    if lead.status in ["new", "ai_scored"]:
        lead.status = "offer_generated"
    lead.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lead)

    return {"status": "success", "offer": offer_text, "lead_id": lead.id}

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
    lead.generated_offer = req.offer_text
    lead.status = "sent"
    lead.sent_at = datetime.utcnow()
    lead.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lead)

    print(f"[DISPATCH] [DRY-RUN CONFIRMED] Человек подтвердил отклик по лиду #{lead.id}: '{lead.title}' через канал '{req.channel or lead.source}'")

    return {
        "status": "success",
        "mode": "dry_run_confirmed",
        "message": "Отклик подтвержден человеком и зафиксирован в воронке",
        "lead_id": lead.id,
        "sent_at": lead.sent_at.isoformat(),
        "channel": req.channel or lead.source
    }

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





