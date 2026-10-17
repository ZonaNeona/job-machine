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


class AccountPlatform(Base):
    """Per-platform account-parser state (hh chats, later Habр/FL/…)."""
    __tablename__ = "account_platforms"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, unique=True, index=True, nullable=False)  # hh.ru, habr, …
    label = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    interval_minutes = Column(Integer, default=60)
    session_ok = Column(Boolean, default=False)
    profile_ready = Column(Boolean, default=False)
    last_run_at = Column(DateTime, nullable=True)
    last_status = Column(String, nullable=True)  # ok | auth_required | error | idle
    last_error = Column(Text, nullable=True)
    last_stats_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AccountChat(Base):
    """Synced personal chats / threads from a platform account."""
    __tablename__ = "account_chats"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, index=True, nullable=False)  # hh.ru
    external_chat_id = Column(String, index=True, nullable=False)  # HH chat id (≠ vacancy id)
    chat_url = Column(String, nullable=True)
    vacancy_external_id = Column(String, index=True, nullable=True)  # hh_138270661
    vacancy_url = Column(String, nullable=True)
    title = Column(String, nullable=True)
    counterpart = Column(String, nullable=True)  # company / recruiter
    time_label = Column(String, nullable=True)
    last_message_preview = Column(Text, nullable=True)
    fingerprint = Column(String, nullable=True)
    has_reply = Column(Boolean, default=False)
    unread = Column(Boolean, default=False)
    message_count = Column(Integer, default=0)
    messages_json = Column(Text, nullable=True)
    lead_id = Column(Integer, index=True, nullable=True)
    reply_detected_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
