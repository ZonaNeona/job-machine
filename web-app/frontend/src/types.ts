export type LeadStatus =
  | 'new'
  | 'ai_scored'
  | 'offer_generated'
  | 'approved'
  | 'sent'
  | 'replied'
  | 'in_negotiation'
  | 'closed_won'
  | 'archived';

export type LeadSource =
  | 'hh.ru'
  | 'telegram'
  | 'habr_freelance'
  | 'fl_ru'
  | 'kwork'
  | 'avito'
  | 'direct';

export type Priority = 'high' | 'normal' | 'low';
export type OfferAngle = 'pain' | 'speed' | 'money' | 'architecture' | 'prototype';
export type OfferLength = 'short' | 'medium';
export type LeadCategory = 'ai' | 'bots_parsers' | 'web' | 'cms';
export type DealType = 'quick' | 'retainer' | 'project';
export type Urgency = 'hot' | 'warm' | 'normal';

export interface Lead {
  id: number;
  external_id?: string | null;
  title: string;
  company?: string | null;
  source: LeadSource | string;
  url?: string | null;
  salary_raw?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  contact_info?: string | null;
  location?: string | null;
  job_type?: string | null;
  description: string;
  tags?: string | null;
  status: LeadStatus;
  match_score: number;
  scoring_reason?: string | null;
  generated_offer?: string | null;
  custom_notes?: string | null;
  priority?: Priority | string | null;
  next_action_at?: string | null;
  category?: LeadCategory | string | null;
  deal_type?: DealType | string | null;
  urgency?: Urgency | string | null;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  replied_at?: string | null;
}

export interface LeadBrief {
  id: number;
  title: string;
  company?: string | null;
  source: string;
  status: LeadStatus;
  match_score: number;
  salary_raw?: string | null;
  contact_info?: string | null;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  next_action_at?: string | null;
  priority?: string | null;
  category?: LeadCategory | string | null;
  deal_type?: DealType | string | null;
  urgency?: Urgency | string | null;
}

export interface LeadEvent {
  id: number;
  lead_id: number;
  kind: string;
  from_status?: string | null;
  to_status?: string | null;
  message?: string | null;
  created_at: string;
}

export interface LeadFeedEvent extends LeadEvent {
  lead_title: string;
}

export interface SourceHealth {
  source: string;
  total: number;
  new: number;
  fresh: number;
  last_seen?: string | null;
}

export interface WorkspaceOverview {
  generated_at: string;
  totals: {
    all: number;
    new: number;
    scored: number;
    offers_ready: number;
    sent: number;
    replied: number;
    negotiation: number;
    won: number;
    archived: number;
  };
  today: {
    new_leads: number;
    offers_created: number;
    sent: number;
    responses: number;
  };
  mrr: {
    current: number;
    target: number;
    clients: number;
    target_clients: number;
    monthly_rate: number;
  };
  sources: SourceHealth[];
  attention: {
    needs_offer: LeadBrief[];
    ready_to_send: LeadBrief[];
    follow_ups: LeadBrief[];
    replied: LeadBrief[];
    stale: LeadBrief[];
  };
  recent_events: LeadFeedEvent[];
}

export interface KnowledgeBaseItem {
  id: number;
  title: string;
  category: 'case_study' | 'stack' | 'tone_of_voice' | 'about_me' | string;
  content: string;
  tags?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SystemSettings {
  TARGET_CLIENTS_COUNT?: string;
  TARGET_MONTHLY_RATE?: string;
  HH_AUTO_APPLY_ENABLED?: string;
  TG_AUTO_NOTIFY_ENABLED?: string;
  MIN_MATCH_SCORE_THRESHOLD?: string;
  OPENROUTER_CONFIGURED?: boolean;
  HH_CONFIGURED?: boolean;
  TG_CONFIGURED?: boolean;
  HH_ACCOUNT_PROFILE_READY?: boolean;
  HH_ACCOUNT_SYNC_ENABLED?: string;
  HH_ACCOUNT_SYNC_INTERVAL_MIN?: string;
  HH_ACCOUNT_BASE_URL?: string;
  HH_ACCOUNT_OPEN_CHAT_DETAILS?: string;
  HH_ACCOUNT_MAX_CHATS_TO_OPEN?: string;
  HH_ACCOUNT_ALERT_ON_REPLY?: string;
  [key: string]: unknown;
}

export interface AccountPlatform {
  platform: string;
  label?: string | null;
  enabled: boolean;
  interval_minutes: number;
  session_ok: boolean;
  profile_ready: boolean;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  last_stats?: Record<string, unknown> | null;
  base_url?: string | null;
  open_chat_details?: boolean | null;
  max_chats_to_open?: number | null;
  alert_on_reply?: boolean | null;
  login_hint?: string | null;
  is_running?: boolean;
}

export interface AccountChat {
  id: number;
  platform: string;
  external_chat_id: string;
  chat_url?: string | null;
  vacancy_external_id?: string | null;
  vacancy_url?: string | null;
  title?: string | null;
  counterpart?: string | null;
  time_label?: string | null;
  last_message_preview?: string | null;
  has_reply: boolean;
  unread: boolean;
  message_count: number;
  lead_id?: number | null;
  reply_detected_at?: string | null;
  last_synced_at?: string | null;
  updated_at?: string | null;
}

export interface AccountPlatformPatch {
  enabled?: boolean;
  interval_minutes?: number;
  base_url?: string;
  open_chat_details?: boolean;
  max_chats_to_open?: number;
  alert_on_reply?: boolean;
}

export interface ScraperStatus {
  is_running: boolean;
  last_run: string | null;
  last_result: Record<string, unknown> | null;
}

export type ScraperKey = 'hh' | 'tg' | 'freelance' | 'avito';

/** Legacy shape kept for older dashboard components. */
export interface SystemStats {
  total_leads: number;
  new_leads: number;
  scored_leads: number;
  offers_ready: number;
  sent_outreach: number;
  responses_received: number;
  active_deals: number;
  target_clients: number;
  current_clients: number;
  current_mrr: number;
  target_mrr: number;
  conversion_rate: number;
  sources_breakdown: Record<string, number>;
}

