export interface Lead {
  id: number;
  external_id?: string;
  title: string;
  company?: string;
  source: 'hh.ru' | 'telegram' | 'habr_freelance' | 'fl_ru' | 'kwork' | 'avito' | 'direct';
  url?: string;
  salary_raw?: string;
  salary_min?: number;
  salary_max?: number;
  contact_info?: string;
  location?: string;
  job_type?: string;
  description: string;
  tags?: string;
  status: 'new' | 'ai_scored' | 'offer_generated' | 'approved' | 'sent' | 'replied' | 'in_negotiation' | 'closed_won' | 'archived';
  match_score: number;
  scoring_reason?: string;
  generated_offer?: string;
  custom_notes?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  replied_at?: string;
}

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

export interface KnowledgeBaseItem {
  id: number;
  title: string;
  category: 'case_study' | 'stack' | 'tone_of_voice' | 'about_me';
  content: string;
  tags?: string;
  is_active: boolean;
  created_at: string;
}

export interface SystemSettings {
  TARGET_CLIENTS_COUNT: string;
  TARGET_MONTHLY_RATE: string;
  HH_AUTO_APPLY_ENABLED: string;
  TG_AUTO_NOTIFY_ENABLED: string;
  MIN_MATCH_SCORE_THRESHOLD: string;
  OPENROUTER_CONFIGURED?: boolean;
  HH_CONFIGURED?: boolean;
  TG_CONFIGURED?: boolean;
  [key: string]: any;
}
