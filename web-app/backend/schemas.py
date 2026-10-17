from typing import List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field

LeadStatus = Literal[
    "new", "ai_scored", "offer_generated", "approved", "sent",
    "replied", "in_negotiation", "closed_won", "archived",
]


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
    status: str = "new"
    match_score: Optional[int] = 0
    scoring_reason: Optional[str] = None
    generated_offer: Optional[str] = None
    custom_notes: Optional[str] = None
    priority: Optional[str] = "normal"
    next_action_at: Optional[datetime] = None


class LeadCreate(LeadBase):
    external_id: Optional[str] = None


class ManualLeadCreate(BaseModel):
    """Lead added by hand from the workspace (нет на площадке — есть в переписке)."""
    title: str
    company: Optional[str] = None
    source: str = "direct"
    url: Optional[str] = None
    salary_raw: Optional[str] = None
    contact_info: Optional[str] = None
    description: str = ""
    tags: Optional[str] = None
    match_score: Optional[int] = 60
    priority: Optional[str] = "normal"
    next_action_at: Optional[datetime] = None


class LeadUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    salary_raw: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    contact_info: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    match_score: Optional[int] = None
    scoring_reason: Optional[str] = None
    generated_offer: Optional[str] = None
    custom_notes: Optional[str] = None
    tags: Optional[str] = None
    priority: Optional[str] = None
    next_action_at: Optional[datetime] = None


class LeadResponse(LeadBase):
    id: int
    external_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeadBrief(BaseModel):
    id: int
    title: str
    company: Optional[str] = None
    source: str
    status: str
    match_score: int = 0
    salary_raw: Optional[str] = None
    contact_info: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    next_action_at: Optional[datetime] = None
    priority: Optional[str] = "normal"

    class Config:
        from_attributes = True


class LeadEventResponse(BaseModel):
    id: int
    lead_id: int
    kind: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeadEventFeed(LeadEventResponse):
    lead_title: str


class SourceHealth(BaseModel):
    source: str
    total: int
    new: int
    fresh: int
    last_seen: Optional[datetime] = None


class OverviewTotals(BaseModel):
    all: int
    new: int
    scored: int
    offers_ready: int
    sent: int
    replied: int
    negotiation: int
    won: int
    archived: int


class OverviewToday(BaseModel):
    new_leads: int
    offers_created: int
    sent: int
    responses: int


class OverviewMrr(BaseModel):
    current: int
    target: int
    clients: int
    target_clients: int
    monthly_rate: int


class OverviewAttention(BaseModel):
    needs_offer: List[LeadBrief]
    ready_to_send: List[LeadBrief]
    follow_ups: List[LeadBrief]
    replied: List[LeadBrief]
    stale: List[LeadBrief]


class WorkspaceOverview(BaseModel):
    generated_at: datetime
    totals: OverviewTotals
    today: OverviewToday
    mrr: OverviewMrr
    sources: List[SourceHealth]
    attention: OverviewAttention
    recent_events: List[LeadEventFeed]


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
    angle: Optional[str] = Field(default="pain", description="pain | speed | money | architecture | prototype")
    length: Optional[str] = Field(default="short", description="short | medium")
    variation: Optional[int] = 0


class SendOfferRequest(BaseModel):
    offer_text: str


class DispatchOfferRequest(BaseModel):
    offer_text: str
    confirmed_by_human: bool = True
    dry_run: bool = True
    channel: Optional[str] = None
    follow_up_days: Optional[int] = 2


