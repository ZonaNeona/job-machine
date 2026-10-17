
import {
  AccountChat,
  AccountPlatform,
  AccountPlatformPatch,
  KnowledgeBaseItem,
  Lead,
  LeadEvent,
  OfferAngle,
  OfferLength,
  ScraperKey,
  ScraperStatus,
  SystemSettings,
  WorkspaceOverview,
} from './types';

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail ?? body);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(detail || `Запрос ${path} завершился с кодом ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export interface LeadPatch {
  title?: string;
  company?: string | null;
  status?: Lead['status'];
  match_score?: number;
  scoring_reason?: string | null;
  generated_offer?: string | null;
  custom_notes?: string | null;
  tags?: string | null;
  contact_info?: string | null;
  url?: string | null;
  salary_raw?: string | null;
  location?: string | null;
  job_type?: string | null;
  description?: string;
  priority?: string;
  next_action_at?: string | null;
  category?: string | null;
  deal_type?: string | null;
  urgency?: string | null;
}

export interface ManualLeadPayload {
  title: string;
  company?: string;
  source?: string;
  url?: string;
  salary_raw?: string;
  contact_info?: string;
  description?: string;
  tags?: string;
  match_score?: number;
  priority?: string;
  next_action_at?: string | null;
  category?: string | null;
  deal_type?: string | null;
}

export interface GenerateOfferOptions {
  angle?: OfferAngle;
  length?: OfferLength;
  instructions?: string;
  model?: string;
  variation?: number;
}

const SCRAPER_PATHS: Record<ScraperKey, string> = {
  hh: '/scrapers/hh',
  tg: '/scrapers/tg',
  freelance: '/scrapers/freelance',
  avito: '/scrapers/avito',
};

export const api = {
  getOverview: () => request<WorkspaceOverview>('/workspace/overview'),

  getLeads: (filters?: { status?: string; source?: string; search?: string; min_score?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.source && filters.source !== 'all') params.append('source', filters.source);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.min_score !== undefined) params.append('min_score', String(filters.min_score));
    if (filters?.limit) params.append('limit', String(filters.limit));
    const query = params.toString();
    return request<Lead[]>(`/leads${query ? `?${query}` : ''}`);
  },

  getLead: (id: number) => request<Lead>(`/leads/${id}`),

  createLead: (payload: ManualLeadPayload) => request<Lead>('/leads', json(payload)),

  updateLead: (id: number, patch: LeadPatch) =>
    request<Lead>(`/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  getLeadEvents: (id: number) => request<LeadEvent[]>(`/leads/${id}/events`),

  generateOffer: (id: number, options: GenerateOfferOptions = {}) =>
    request<{ status: string; offer: string; lead_id: number; fallback?: boolean }>(
      `/leads/${id}/generate-offer`,
      json({
        model: options.model ?? 'anthropic/claude-3.5-sonnet',
        custom_instructions: options.instructions || null,
        angle: options.angle ?? 'pain',
        length: options.length ?? 'short',
        variation: options.variation ?? Math.floor(Math.random() * 997),
      }),
    ),

  dispatchOffer: (
    id: number,
    payload: { offer_text: string; channel?: string; follow_up_days?: number; confirmed_by_human: boolean },
  ) => request<Record<string, unknown>>(`/leads/${id}/dispatch`, json({ ...payload, dry_run: true })),

  getKnowledgeBase: () => request<KnowledgeBaseItem[]>('/knowledge-base'),

  createKnowledgeBaseItem: (item: Omit<KnowledgeBaseItem, 'id' | 'created_at'>) =>
    request<KnowledgeBaseItem>('/knowledge-base', json(item)),

  deleteKnowledgeBaseItem: (id: number) =>
    request<{ status: string }>(`/knowledge-base/${id}`, { method: 'DELETE' }),

  getSettings: () => request<SystemSettings>('/settings'),

  updateSettings: (settings: Partial<SystemSettings>) =>
    request<{ status: string }>('/settings', json(settings)),

  triggerScraper: (key: ScraperKey) =>
    request<{ status: string; message: string }>(`${SCRAPER_PATHS[key]}/trigger`, { method: 'POST' }),

  getScraperStatus: (key: ScraperKey) => request<ScraperStatus>(`${SCRAPER_PATHS[key]}/status`),

  testAlert: () => request<Record<string, unknown>>('/alerts/test', { method: 'POST' }),

  testOpenRouter: (model?: string) =>
    request<{ status: string; message: string; model?: string; latency_ms?: number }>(
      '/settings/test-openrouter',
      json({ model })
    ),

  getAccounts: () => request<AccountPlatform[]>('/accounts'),

  getAccount: (platform: string) => request<AccountPlatform>(`/accounts/${encodeURIComponent(platform)}`),

  updateAccount: (platform: string, patch: AccountPlatformPatch) =>
    request<AccountPlatform>(`/accounts/${encodeURIComponent(platform)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  getAccountChats: (platform: string, opts?: { unread_only?: boolean; has_reply?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.unread_only) params.append('unread_only', 'true');
    if (opts?.has_reply !== undefined) params.append('has_reply', String(opts.has_reply));
    if (opts?.limit) params.append('limit', String(opts.limit));
    const q = params.toString();
    return request<AccountChat[]>(`/accounts/${encodeURIComponent(platform)}/chats${q ? `?${q}` : ''}`);
  },

  triggerAccountSync: (platform: string) =>
    request<{ status: string; message: string }>(`/accounts/${encodeURIComponent(platform)}/sync`, { method: 'POST' }),

  getAccountSyncStatus: (platform: string) =>
    request<ScraperStatus & { session_ok?: boolean; last_status?: string; last_error?: string | null }>(
      `/accounts/${encodeURIComponent(platform)}/status`,
    ),

  importAccountSample: (platform: string) =>
    request<{ status: string; stats: Record<string, unknown> }>(
      `/accounts/${encodeURIComponent(platform)}/import-sample`,
      { method: 'POST' },
    ),

  markAccountChatRead: (platform: string, chatId: string) =>
    request<{ status: string }>(
      `/accounts/${encodeURIComponent(platform)}/chats/${encodeURIComponent(chatId)}/read`,
      { method: 'POST' },
    ),
};

export { SCRAPER_PATHS };

