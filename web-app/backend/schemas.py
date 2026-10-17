from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class LeadBase(BaseModel):
    title: str
    company: Optional[str] = None
    source: str = "hh.ru"
    url: Optional[str] = None
    salary_raw: Optional[str] = "По договоренности"
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    contact_info: Optional[str] = None
    location: Optional[str] = "Удаленно"
    job_type: Optional[str] = "Проект / Парт-тайм"
    description: str
    tags: Optional[str] = "LLM,Python"
    status: Optional[str] = "new"
    match_score: Optional[int] = 0
    scoring_reason: Optional[str] = None
    generated_offer: Optional[str] = None
    custom_notes: Optional[str] = None

class LeadCreate(LeadBase):
    external_id: Optional[str] = None

class LeadUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None
    match_score: Optional[int] = None
    scoring_reason: Optional[str] = None
    generated_offer: Optional[str] = None
    custom_notes: Optional[str] = None
    tags: Optional[str] = None

class LeadResponse(LeadBase):
    id: int
    external_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class KnowledgeBaseItemBase(BaseModel):
    title: str
    category: str = "case_study"
    content: str
    tags: Optional[str] = ""
    is_active: bool = True

class KnowledgeBaseItemCreate(KnowledgeBaseItemBase):
    pass

class KnowledgeBaseItemResponse(KnowledgeBaseItemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class SystemStats(BaseModel):
    total_leads: int
    new_leads: int
    scored_leads: int
    offers_ready: int
    sent_outreach: int
    responses_received: int
    active_deals: int
    target_clients: int
    current_clients: int
    current_mrr: int
    target_mrr: int
    conversion_rate: float
    sources_breakdown: dict

class GenerateOfferRequest(BaseModel):
    model: Optional[str] = "anthropic/claude-3.5-sonnet"
    custom_instructions: Optional[str] = None

class SendOfferRequest(BaseModel):
    offer_text: str

class DispatchOfferRequest(BaseModel):
    offer_text: str
    confirmed_by_human: bool = True
    dry_run: bool = True
    channel: Optional[str] = None

