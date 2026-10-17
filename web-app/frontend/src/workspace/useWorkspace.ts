import { useCallback, useEffect, useRef, useState } from 'react';
import { api, GenerateOfferOptions, LeadPatch, ManualLeadPayload } from '../api';
import {
  AccountChat,
  AccountPlatform,
  AccountPlatformPatch,
  KnowledgeBaseItem,
  Lead,
  ScraperKey,
  ScraperStatus,
  SystemSettings,
  WorkspaceOverview,
} from '../types';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

const SCRAPER_KEYS: ScraperKey[] = ['hh', 'tg', 'freelance', 'avito'];

const SCRAPER_LABELS: Record<ScraperKey, string> = {
  hh: 'hh.ru',
  tg: 'Telegram',
  freelance: 'Хабр и FL.ru',
  avito: 'Авито',
};

export function useWorkspace() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [kb, setKb] = useState<KnowledgeBaseItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [scrapers, setScrapers] = useState<Partial<Record<ScraperKey, ScraperStatus>>>({});
  const [accounts, setAccounts] = useState<AccountPlatform[]>([]);
  const [accountChats, setAccountChats] = useState<AccountChat[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('hh.ru');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const toastId = useRef(0);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4600);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const [nextLeads, nextOverview, nextKb, nextSettings, nextAccounts] = await Promise.all([
        api.getLeads(),
        api.getOverview(),
        api.getKnowledgeBase().catch(() => []),
        api.getSettings().catch(() => null),
        api.getAccounts().catch(() => [] as AccountPlatform[]),
      ]);
      setLeads(nextLeads);
      setOverview(nextOverview);
      setKb(nextKb);
      setSettings(nextSettings);
      setAccounts(nextAccounts);
      setLastSync(new Date().toISOString());
      setError('');

      const platform = selectedAccount || nextAccounts[0]?.platform || 'hh.ru';
      try {
        const chats = await api.getAccountChats(platform, { limit: 150 });
        setAccountChats(chats);
      } catch {
        /* platform may be empty on first boot */
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
      if (!quiet) notify(`Не удалось загрузить данные: ${message}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notify, selectedAccount]);

  const setBusyKey = useCallback((key: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadAccountChats = useCallback(async (platform: string) => {
    try {
      const chats = await api.getAccountChats(platform, { limit: 150 });
      setAccountChats(chats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить чаты';
      notify(message, 'error');
    }
  }, [notify]);

  const selectAccount = useCallback((platform: string) => {
    setSelectedAccount(platform);
    void loadAccountChats(platform);
  }, [loadAccountChats]);

  const saveAccount = useCallback(async (platform: string, patch: AccountPlatformPatch) => {
    setBusyKey(`account-save-${platform}`, true);
    try {
      const updated = await api.updateAccount(platform, patch);
      setAccounts((prev) => prev.map((item) => (item.platform === platform ? updated : item)));
      notify('Настройки аккаунта сохранены');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить';
      notify(message, 'error');
    } finally {
      setBusyKey(`account-save-${platform}`, false);
    }
  }, [notify, setBusyKey]);

  const pollAccountSync = useCallback((platform: string) => {
    const startedAt = Date.now();
    const timer = window.setInterval(async () => {
      try {
        const status = await api.getAccountSyncStatus(platform);
        setAccounts((prev) => prev.map((item) => (
          item.platform === platform
            ? { ...item, is_running: status.is_running, session_ok: status.session_ok ?? item.session_ok }
            : item
        )));
        if (!status.is_running) {
          window.clearInterval(timer);
          const result = (status.last_result || {}) as Record<string, unknown>;
          const seen = result.chats_seen ?? result.chats_upserted;
          const replies = result.new_replies;
          notify(
            `${platform}: синк готов`
            + (seen !== undefined ? `, чатов ${seen}` : '')
            + (replies ? `, новых ответов ${replies}` : ''),
          );
          void refresh(true);
          void loadAccountChats(platform);
        } else if (Date.now() - startedAt > 240000) {
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 3000);
  }, [loadAccountChats, notify, refresh]);

  const syncAccount = useCallback(async (platform: string) => {
    setBusyKey(`account-${platform}`, true);
    try {
      const result = await api.triggerAccountSync(platform);
      notify(result.message || `${platform}: синхронизация запущена`);
      pollAccountSync(platform);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось запустить синк';
      notify(message, 'error');
    } finally {
      setBusyKey(`account-${platform}`, false);
    }
  }, [notify, pollAccountSync, setBusyKey]);

  const importAccountSample = useCallback(async (platform: string) => {
    setBusyKey(`account-sample-${platform}`, true);
    try {
      await api.importAccountSample(platform);
      notify(`Сэмпл ${platform} успешно загружен`);
      void refresh(true);
      void loadAccountChats(platform);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить сэмпл';
      notify(message, 'error');
    } finally {
      setBusyKey(`account-sample-${platform}`, false);
    }
  }, [loadAccountChats, notify, refresh, setBusyKey]);

  const markChatRead = useCallback(async (platform: string, chatId: string) => {
    try {
      await api.markAccountChatRead(platform, chatId);
      setAccountChats((prev) => prev.map((chat) => (
        chat.external_chat_id === chatId ? { ...chat, unread: false } : chat
      )));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось отметить';
      notify(message, 'error');
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    SCRAPER_KEYS.forEach((key) => {
      api.getScraperStatus(key)
        .then((status) => setScrapers((prev) => ({ ...prev, [key]: status })))
        .catch(() => undefined);
    });
  }, []);

  const patchLead = useCallback(async (lead: Lead, changes: LeadPatch, options?: { silent?: boolean; message?: string }) => {
    const snapshot = leads;
    setLeads((prev) => prev.map((item) => (
      item.id === lead.id ? { ...item, ...changes, updated_at: new Date().toISOString() } as Lead : item
    )));
    try {
      const updated = await api.updateLead(lead.id, changes);
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? updated : item)));
      void api.getOverview().then(setOverview).catch(() => undefined);
      if (!options?.silent) notify(options?.message || 'Сохранено');
      return updated;
    } catch (err) {
      setLeads(snapshot);
      const message = err instanceof Error ? err.message : 'Не удалось сохранить';
      notify(message, 'error');
      throw err;
    }
  }, [leads, notify]);

  const changeStatus = useCallback(async (lead: Lead, status: Lead['status']) => {
    if (lead.status === status) return undefined;
    return patchLead(lead, { status }, { message: 'Стадия обновлена' });
  }, [patchLead]);

  const generateOffer = useCallback(async (lead: Lead, options: GenerateOfferOptions) => {
    const key = `generate-${lead.id}`;
    setBusyKey(key, true);
    try {
      const result = await api.generateOffer(lead.id, options);
      const updated = await api.getLead(lead.id);
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? updated : item)));
      void api.getOverview().then(setOverview).catch(() => undefined);
      if (result.fallback) {
        notify('LLM не подключён: это каркас. Допиши факты и цифры вручную.', 'info');
      } else {
        notify('Черновик готов. Теперь вычитай его как человек.');
      }
      return result.offer;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Генерация не удалась';
      notify(message, 'error');
      throw err;
    } finally {
      setBusyKey(key, false);
    }
  }, [notify, setBusyKey]);

  const dispatchOffer = useCallback(async (
    lead: Lead,
    payload: { offer_text: string; channel?: string; follow_up_days?: number },
  ) => {
    const key = `dispatch-${lead.id}`;
    setBusyKey(key, true);
    try {
      await api.dispatchOffer(lead.id, { ...payload, confirmed_by_human: true });
      const updated = await api.getLead(lead.id);
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? updated : item)));
      void api.getOverview().then(setOverview).catch(() => undefined);
      notify('Отправка зафиксирована. Follow-up поставлен автоматически.');
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось зафиксировать отправку';
      notify(message, 'error');
      throw err;
    } finally {
      setBusyKey(key, false);
    }
  }, [notify, setBusyKey]);

  const createLead = useCallback(async (payload: ManualLeadPayload) => {
    setBusyKey('create-lead', true);
    try {
      const created = await api.createLead(payload);
      setLeads((prev) => [created, ...prev]);
      void api.getOverview().then(setOverview).catch(() => undefined);
      notify('Лид добавлен в поток');
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось добавить лид';
      notify(message, 'error');
      throw err;
    } finally {
      setBusyKey('create-lead', false);
    }
  }, [notify, setBusyKey]);

  const addKbItem = useCallback(async (item: Omit<KnowledgeBaseItem, 'id' | 'created_at'>) => {
    const created = await api.createKnowledgeBaseItem(item);
    setKb((prev) => [...prev, created]);
    notify('Кейс добавлен в базу знаний');
    return created;
  }, [notify]);

  const removeKbItem = useCallback(async (id: number) => {
    try {
      await api.deleteKnowledgeBaseItem(id);
      setKb((prev) => prev.filter((item) => item.id !== id));
      notify('Кейс удалён');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить кейс';
      notify(message, 'error');
    }
  }, [notify]);

  const saveSettings = useCallback(async (next: Partial<SystemSettings>) => {
    setBusyKey('settings', true);
    try {
      await api.updateSettings(next);
      setSettings(await api.getSettings());
      notify('Настройки сохранены');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить настройки';
      notify(message, 'error');
    } finally {
      setBusyKey('settings', false);
    }
  }, [notify, setBusyKey]);

  const pollScraper = useCallback((key: ScraperKey) => {
    const startedAt = Date.now();
    const timer = window.setInterval(async () => {
      try {
        const status = await api.getScraperStatus(key);
        setScrapers((prev) => ({ ...prev, [key]: status }));
        if (!status.is_running) {
          window.clearInterval(timer);
          const result = (status.last_result || {}) as Record<string, unknown>;
          const found = result.leads_found ?? result.found ?? result.saved ?? result.total;
          notify(`${SCRAPER_LABELS[key]}: сбор завершён${found ? `, найдено ${found}` : ''}`);
          void refresh(true);
        } else if (Date.now() - startedAt > 180000) {
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 3000);
  }, [notify, refresh]);

  const runScraper = useCallback(async (key: ScraperKey) => {
    setBusyKey(`scraper-${key}`, true);
    try {
      const result = await api.triggerScraper(key);
      notify(result.message || `${SCRAPER_LABELS[key]}: сбор запущен`);
      pollScraper(key);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось запустить сбор';
      notify(message, 'error');
    } finally {
      setBusyKey(`scraper-${key}`, false);
    }
  }, [notify, pollScraper, setBusyKey]);

  const runAllScrapers = useCallback(async () => {
    setBusyKey('scraper-all', true);
    try {
      const results = await Promise.allSettled(SCRAPER_KEYS.map((key) => api.triggerScraper(key)));
      const failed = results.filter((result) => result.status === 'rejected').length;
      if (failed === 0) notify('Сбор запущен на всех источниках');
      else notify(`Запущено, но ${failed} источник(ов) не ответили`, 'info');
      SCRAPER_KEYS.forEach((key) => pollScraper(key));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось запустить сбор';
      notify(message, 'error');
    } finally {
      setBusyKey('scraper-all', false);
    }
  }, [notify, pollScraper, setBusyKey]);


  return {
    leads,
    overview,
    kb,
    settings,
    loading,
    refreshing,
    error,
    toasts,
    busy,
    scrapers,
    accounts,
    accountChats,
    selectedAccount,
    lastSync,
    notify,
    dismissToast,
    refresh,
    patchLead,
    changeStatus,
    generateOffer,
    dispatchOffer,
    createLead,
    addKbItem,
    removeKbItem,
    saveSettings,
    runScraper,
    runAllScrapers,
    selectAccount,
    saveAccount,
    syncAccount,
    importAccountSample,
    markChatRead,
    loadAccountChats,
  };
}
