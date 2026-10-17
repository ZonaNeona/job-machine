from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String, index=True, nullable=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=True)
    source = Column(String, default="hh.ru")  # hh.ru, telegram, habr_freelance, fl_ru, direct
    url = Column(String, nullable=True)
    salary_raw = Column(String, default="По договоренности")
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    contact_info = Column(String, nullable=True)
    location = Column(String, default="Удаленно")
    job_type = Column(String, default="Проект / Парт-тайм")  # Парт-тайм, Проект, Фикс, Подряд
    description = Column(Text, nullable=False)
    tags = Column(String, default="LLM,Python")  # Comma-separated tags
    
    # AI & Workflow status
    # statuses: 'new', 'ai_scored', 'offer_generated', 'approved', 'sent', 'replied', 'in_negotiation', 'closed_won', 'archived'
    status = Column(String, default="new", index=True)
    match_score = Column(Integer, default=0)
    scoring_reason = Column(Text, nullable=True)
    generated_offer = Column(Text, nullable=True)
    custom_notes = Column(Text, nullable=True)

    # Personal workflow layer
    priority = Column(String, default="normal")          # high | normal | low
    next_action_at = Column(DateTime, nullable=True)     # follow-up / reminder date

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)


class KnowledgeBaseItem(Base):
    __tablename__ = "knowledge_base"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, default="case_study")  # case_study, stack, tone_of_voice, about_me
    content = Column(Text, nullable=False)
    tags = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LeadEvent(Base):
    """Append-only journal of everything that happens with a lead.

    Backwards compatible addition: a brand new table, no changes to `leads`.
    """
    __tablename__ = "lead_events"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, index=True, nullable=False)
    kind = Column(String, nullable=False, index=True)    # created | status_changed | offer_generated | offer_saved | dispatched | field_updated
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=True)
    message = Column(String, nullable=True)
    payload = Column(Text, nullable=True)                # JSON string with extra context
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(String, nullable=True)
