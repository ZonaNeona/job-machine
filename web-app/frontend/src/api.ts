import { Lead, SystemStats, KnowledgeBaseItem, SystemSettings } from './types';

const API_BASE = '/api';

export const api = {
  async getStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Ошибка получения статистики');
    return res.json();
  },

  async getLeads(filters?: { status?: string; source?: string; search?: string; min_score?: number }): Promise<Lead[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.source && filters.source !== 'all') params.append('source', filters.source);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.min_score !== undefined) params.append('min_score', filters.min_score.toString());

    const url = `${API_BASE}/leads${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Ошибка получения лидов');
    return res.json();
  },

  async getLead(id: number): Promise<Lead> {
    const res = await fetch(`${API_BASE}/leads/${id}`);
    if (!res.ok) throw new Error('Ошибка получения данных лида');
    return res.json();
  },

  async updateLead(id: number, data: Partial<Lead>): Promise<Lead> {
    const res = await fetch(`${API_BASE}/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка обновления лида');
    return res.json();
  },

  async generateOffer(leadId: number, model: string = 'anthropic/claude-3.5-sonnet', customInstructions?: string): Promise<{ offer: string }> {
    const res = await fetch(`${API_BASE}/leads/${leadId}/generate-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, custom_instructions: customInstructions }),
    });
    if (!res.ok) throw new Error('Ошибка генерации оффера');
    return res.json();
  },

  async sendOffer(leadId: number, offerText: string): Promise<any> {
    const res = await fetch(`${API_BASE}/leads/${leadId}/send-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_text: offerText }),
    });
    if (!res.ok) throw new Error('Ошибка отправки оффера');
    return res.json();
  },

  async dispatchOffer(leadId: number, data: { offer_text: string; confirmed_by_human: boolean; channel?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/leads/${leadId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Ошибка отправки отклика');
    }
    return res.json();
  },

  async getKnowledgeBase(): Promise<KnowledgeBaseItem[]> {
    const res = await fetch(`${API_BASE}/knowledge-base`);
    if (!res.ok) throw new Error('Ошибка получения базы знаний');
    return res.json();
  },

  async createKnowledgeBaseItem(item: Omit<KnowledgeBaseItem, 'id' | 'created_at'>): Promise<KnowledgeBaseItem> {
    const res = await fetch(`${API_BASE}/knowledge-base`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error('Ошибка сохранения кейса');
    return res.json();
  },

  async deleteKnowledgeBaseItem(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/knowledge-base/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Ошибка удаления кейса');
  },

  async getSettings(): Promise<SystemSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Ошибка получения настроек');
    return res.json();
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<void> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Ошибка обновления настроек');
  },

  async triggerHHScraper(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/scrapers/hh/trigger`, { method: 'POST' });
    if (!res.ok) throw new Error('Ошибка запуска сбора hh.ru');
    return res.json();
  },

  async getHHScraperStatus(): Promise<{ is_running: boolean; last_run: string | null; last_result: any }> {
    const res = await fetch(`${API_BASE}/scrapers/hh/status`);
    if (!res.ok) throw new Error('Ошибка получения статуса скрапера');
    return res.json();
  },

  async triggerTGScraper(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/scrapers/tg/trigger`, { method: 'POST' });
    if (!res.ok) throw new Error('Ошибка запуска сбора Telegram');
    return res.json();
  },

  async getTGScraperStatus(): Promise<{ is_running: boolean; last_run: string | null; last_result: any }> {
    const res = await fetch(`${API_BASE}/scrapers/tg/status`);
    if (!res.ok) throw new Error('Ошибка получения статуса Telegram скрапера');
    return res.json();
  },

  async triggerFreelanceScraper(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/scrapers/freelance/trigger`, { method: 'POST' });
    if (!res.ok) throw new Error('Ошибка запуска сбора с фриланс-площадок');
    return res.json();
  },

  async getFreelanceScraperStatus(): Promise<{ is_running: boolean; last_run: string | null; last_result: any }> {
    const res = await fetch(`${API_BASE}/scrapers/freelance/status`);
    if (!res.ok) throw new Error('Ошибка получения статуса фриланс скрапера');
    return res.json();
  },

  async triggerAvitoScraper(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/scrapers/avito/trigger`, { method: 'POST' });
    if (!res.ok) throw new Error('Ошибка запуска сбора с Авито Работы');
    return res.json();
  },

  async getAvitoScraperStatus(): Promise<{ is_running: boolean; last_run: string | null; last_result: any }> {
    const res = await fetch(`${API_BASE}/scrapers/avito/status`);
    if (!res.ok) throw new Error('Ошибка получения статуса скрапера Авито');
    return res.json();
  }
};
