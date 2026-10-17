import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Archive, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen,
  Bot, Building2, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Command,
  Copy, ExternalLink, FileText, Filter, Inbox, Layers3, ListFilter, LoaderCircle,
  MessageCircle, MoreHorizontal, Plus, RefreshCw, Search, Send, Settings2,
  SlidersHorizontal, Sparkles, Target, TrendingUp, Users, Workflow, X, Zap
} from 'lucide-react';
import { api } from './api';
import { Lead, SystemStats, KnowledgeBaseItem, SystemSettings } from './types';
import { KnowledgeBaseTab } from './components/KnowledgeBaseTab';
import { SettingsTab } from './components/SettingsTab';

type WorkspaceTab = 'inbox' | 'funnel' | 'studio' | 'knowledge' | 'settings';
type ViewMode = 'list' | 'board';

const NAV_ITEMS: { id: WorkspaceTab; label: string; icon: React.ElementType }[] = [
  { id: 'inbox', label: 'Мой поток', icon: Inbox },
  { id: 'funnel', label: 'Воронка', icon: Workflow },
  { id: 'studio', label: 'Студия офферов', icon: Send },
  { id: 'knowledge', label: 'База знаний', icon: BookOpen },
  { id: 'settings', label: 'Источники и настройки', icon: Settings2 },
];

const STAGES: { id: Lead['status']; label: string; dot: string }[] = [
  { id: 'new', label: 'Входящие', dot: 'bg-slate-400' },
  { id: 'ai_scored', label: 'На оценке', dot: 'bg-sky-500' },
  { id: 'offer_generated', label: 'Оффер готов', dot: 'bg-violet-500' },
  { id: 'approved', label: 'Готов к отправке', dot: 'bg-amber-500' },
  { id: 'sent', label: 'Ожидаем ответ', dot: 'bg-blue-500' },
  { id: 'replied', label: 'Ответ получен', dot: 'bg-emerald-500' },
  { id: 'in_negotiation', label: 'Переговоры', dot: 'bg-orange-500' },
  { id: 'closed_won', label: 'Сделка', dot: 'bg-green-600' },
  { id: 'archived', label: 'Архив', dot: 'bg-slate-300' },
];

const SOURCE_LABELS: Record<string, string> = {
  'hh.ru': 'hh.ru', telegram: 'Telegram', habr_freelance: 'Хабр', fl_ru: 'FL.ru',
  kwork: 'Kwork', avito: 'Авито', direct: 'Вручную',
};

const STATUS_LABELS: Record<string, string> = Object.fromEntries(STAGES.map((stage) => [stage.id, stage.label]));

function formatDate(value?: string) {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
}

function relativeTime(value?: string) {
  if (!value) return 'Без даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Без даты';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  return formatDate(value);
}

function sourceTone(source: string) {
  const tones: Record<string, string> = {
    'hh.ru': 'source-hh', telegram: 'source-telegram', habr_freelance: 'source-habr',
    fl_ru: 'source-fl', kwork: 'source-kwork', avito: 'source-avito',
  };
  return tones[source] || 'source-default';
}

function scoreTone(score: number) {
  if (score >= 85) return 'score-high';
  if (score >= 70) return 'score-mid';
  return 'score-low';
}

export default function App() {
  const [tab, setTab] = useState<WorkspaceTab>('inbox');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [kbItems, setKbItems] = useState<KnowledgeBaseItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'priority' | 'newest'>('priority');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [offerDraft, setOfferDraft] = useState('');
  const [offerInstructions, setOfferInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [scraping, setScraping] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setErrorMessage('');
    try {
      const [nextStats, nextLeads, nextKb, nextSettings] = await Promise.all([
        api.getStats().catch(() => null),
        api.getLeads().catch((error) => { throw error; }),
        api.getKnowledgeBase().catch(() => []),
        api.getSettings().catch(() => null),
      ]);
      setStats(nextStats);
      setLeads(nextLeads);
      setKbItems(nextKb);
      setSettings(nextSettings);
    } catch (error) {
      console.error('Unable to load workspace data', error);
      setErrorMessage('Не удалось загрузить лиды. Проверь соединение с backend и попробуй обновить данные.');
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    return leads.filter((lead) => {
      const searchable = [lead.title, lead.company, lead.description, lead.tags, lead.source, lead.contact_info]
        .filter(Boolean).join(' ').toLocaleLowerCase('ru');
      if (query && !searchable.includes(query)) return false;
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (tab === 'studio' && !lead.generated_offer) return false;
      return true;
    }).sort((a, b) => sortBy === 'priority'
      ? b.match_score - a.match_score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [leads, search, sourceFilter, statusFilter, sortBy, tab]);

  const selectedFresh = selectedLead ? leads.find((lead) => lead.id === selectedLead.id) || selectedLead : null;
  const newCount = leads.filter((lead) => lead.status === 'new' || lead.status === 'ai_scored').length;
  const offerCount = leads.filter((lead) => Boolean(lead.generated_offer) && !['sent', 'replied', 'in_negotiation', 'closed_won', 'archived'].includes(lead.status)).length;
  const attentionCount = leads.filter((lead) => lead.status === 'replied' || lead.status === 'in_negotiation').length;

  const openLead = (lead: Lead) => {
    setSelectedLead(lead);
    setOfferDraft(lead.generated_offer || '');
    setOfferInstructions('');
  };

  const updateLeadLocal = (id: number, patch: Partial<Lead>) => {
    setLeads((previous) => previous.map((lead) => lead.id === id ? { ...lead, ...patch } : lead));
    setSelectedLead((previous) => previous?.id === id ? { ...previous, ...patch } : previous);
  };

  const changeStatus = async (lead: Lead, status: Lead['status']) => {
    try {
      const updated = await api.updateLead(lead.id, { status });
      updateLeadLocal(lead.id, { status: updated.status || status, updated_at: updated.updated_at || new Date().toISOString() });
      setToast(`Стадия обновлена: ${STATUS_LABELS[status] || status}`);
      void api.getStats().then(setStats).catch(() => {});
    } catch (error) {
      console.error(error);
      setToast('Не удалось изменить стадию');
    }
  };

  const generateOffer = async () => {
    if (!selectedFresh) return;
    setIsGenerating(true);
    try {
      const result = await api.generateOffer(selectedFresh.id, undefined, offerInstructions || undefined);
      setOfferDraft(result.offer);
      const nextStatus = ['new', 'ai_scored'].includes(selectedFresh.status) ? 'offer_generated' : selectedFresh.status;
      updateLeadLocal(selectedFresh.id, { generated_offer: result.offer, status: nextStatus });
      setToast('Черновик оффера подготовлен. Проверь факты и отредактируй текст перед отправкой.');
      void api.getStats().then(setStats).catch(() => {});
    } catch (error) {
      console.error(error);
      setToast('Не удалось подготовить оффер. Проверь настройки модели и backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveOffer = async () => {
    if (!selectedFresh) return;
    setIsSaving(true);
    try {
      await api.updateLead(selectedFresh.id, { generated_offer: offerDraft, status: offerDraft.trim() ? 'offer_generated' : selectedFresh.status });
      updateLeadLocal(selectedFresh.id, { generated_offer: offerDraft, status: offerDraft.trim() ? 'offer_generated' : selectedFresh.status });
      setToast('Черновик сохранён');
    } catch (error) {
      console.error(error);
      setToast('Не удалось сохранить черновик');
    } finally {
      setIsSaving(false);
    }
  };

  const copyOffer = async () => {
    if (!offerDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(offerDraft);
      setToast('Текст скопирован. Отправка ещё не зафиксирована.');
    } catch {
      setToast('Браузер не разрешил доступ к буферу обмена');
    }
  };

  const openSource = (lead: Lead) => {
    if (lead.url && lead.url !== '#') window.open(lead.url, '_blank', 'noopener,noreferrer');
    else setToast('У этого лида нет ссылки на оригинал');
  };

  const collectSource = async (source: 'hh' | 'tg' | 'freelance' | 'avito') => {
    const setBusy = (busy: boolean) => setScraping((previous) => ({ ...previous, [source]: busy }));
    setBusy(true);
    try {
      if (source === 'hh') await api.triggerHHScraper();
      if (source === 'tg') await api.triggerTGScraper();
      if (source === 'freelance') await api.triggerFreelanceScraper();
      if (source === 'avito') await api.triggerAvitoScraper();
      setToast('Сбор запущен. Поток обновится через несколько секунд; статус сборщика можно проверить в настройках.');
      window.setTimeout(() => { void loadData(true); setBusy(false); }, 5000);
    } catch (error) {
      console.error(error);
      setBusy(false);
      setToast('Не удалось запустить сборщик. Открой настройки источников для диагностики.');
    }
  };

  const collectAll = async () => {
    setIsCollecting(true);
    const jobs: { key: 'hh' | 'tg' | 'freelance' | 'avito'; run: () => Promise<unknown> }[] = [
      { key: 'hh', run: api.triggerHHScraper },
      { key: 'tg', run: api.triggerTGScraper },
      { key: 'freelance', run: api.triggerFreelanceScraper },
      { key: 'avito', run: api.triggerAvitoScraper },
    ];
    setScraping({ hh: true, tg: true, freelance: true, avito: true });
    const results = await Promise.allSettled(jobs.map((job) => job.run()));
    const failed = results.filter((result) => result.status === 'rejected').length;
    const nextBusy = { hh: false, tg: false, freelance: false, avito: false };
    results.forEach((result, index) => { if (result.status === 'rejected') nextBusy[jobs[index].key] = false; });
    setToast(failed === 0 ? 'Сбор запущен на всех подключённых источниках' : `Запущено не всё: ошибок источников — ${failed}. Проверь статусы в настройках.`);
    window.setTimeout(() => { void loadData(true); setScraping(nextBusy); setIsCollecting(false); }, 6000);
  };

  const addKbItem = async (item: Omit<KnowledgeBaseItem, 'id' | 'created_at'>) => {
    const created = await api.createKnowledgeBaseItem(item);
    setKbItems((previous) => [created, ...previous]);
  };

  const deleteKbItem = async (id: number) => {
    await api.deleteKnowledgeBaseItem(id);
    setKbItems((previous) => previous.filter((item) => item.id !== id));
  };

  const updateSettings = async (nextSettings: Partial<SystemSettings>) => {
    await api.updateSettings(nextSettings);
    setSettings(await api.getSettings());
    setToast('Настройки сохранены');
  };

  const currentNav = NAV_ITEMS.find((item) => item.id === tab);
  const title = tab === 'inbox' ? 'Мой поток' : tab === 'funnel' ? 'Воронка' : tab === 'studio' ? 'Студия офферов' : tab === 'knowledge' ? 'База знаний' : 'Источники и настройки';
  const subtitle = tab === 'inbox'
    ? 'Все возможности из источников — в одном рабочем пространстве.'
    : tab === 'funnel'
      ? 'Понимай, на какой стадии находится каждый контакт.'
      : tab === 'studio'
        ? 'Персональные предложения, которые звучат по-человечески.'
        : tab === 'knowledge'
          ? 'Кейсы и факты, на которые можно опираться в предложениях.'
          : 'Состояние сборщиков, подключений и правила обработки.';

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Bot size={20} strokeWidth={2.2} /></div>
          <div className="brand-copy"><strong>job machine</strong><span>PERSONAL WORKSPACE</span></div>
          <button className="icon-button sidebar-more" title="Ещё"><MoreHorizontal size={18} /></button>
        </div>

        <button className="workspace-switcher">
          <div className="workspace-avatar">И</div>
          <span><strong>Моя студия</strong><small>Персональное пространство</small></span>
          <ChevronDown size={15} />
        </button>

        <div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="primary-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const count = item.id === 'inbox' ? newCount : item.id === 'studio' ? offerCount : item.id === 'funnel' ? leads.length : undefined;
            return (
              <button key={item.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => setTab(item.id)}>
                <Icon size={17} strokeWidth={1.9} />
                <span>{item.label}</span>
                {count !== undefined && <small>{count}</small>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-label sources-label">ИСТОЧНИКИ</div>
        <div className="source-shortcuts">
          {([
            ['hh', 'hh.ru', 'source-hh'],
            ['tg', 'Telegram', 'source-telegram'],
            ['freelance', 'Фриланс-площадки', 'source-habr'],
            ['avito', 'Авито Работа', 'source-avito'],
          ] as const).map(([key, label, tone]) => (
            <button key={key} className="source-shortcut" onClick={() => void collectSource(key)} disabled={Boolean(scraping[key])}>
              <span className={`source-dot ${tone}`} />
              <span>{label}</span>
              {scraping[key] ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} className="source-add" />}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="goal-card">
            <div className="goal-card-head"><Target size={15} /><span>Цель по клиентам</span></div>
            <div className="goal-number"><strong>{stats?.current_clients ?? 0}</strong><span>/ {stats?.target_clients ?? 5} клиентов</span></div>
            <div className="goal-track"><span style={{ width: `${Math.min(100, ((stats?.current_clients || 0) / Math.max(1, stats?.target_clients || 5)) * 100)}%` }} /></div>
            <small>Регулярное сопровождение</small>
          </div>
          <button className="user-profile" onClick={() => setTab('settings')}>
            <div className="user-avatar">И</div><span><strong>Мой аккаунт</strong><small>Настройки рабочего места</small></span><MoreHorizontal size={16} />
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Рабочее пространство</span><span className="crumb-slash">/</span><strong>{currentNav?.label || title}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по лидам..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button" title="Уведомления" onClick={() => setToast('Уведомления появятся здесь, когда будут подключены события и напоминания.')}><Bell size={17} /><span className="notification-dot" /></button>
            <div className="top-avatar">И</div>
          </div>
        </header>

        <div className="page-scroll">
          <div className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><span className="live-dot" /> ЛИЧНЫЙ КОМАНДНЫЙ ЦЕНТР</div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              <div className="heading-actions">
                <button className="button button-secondary" onClick={() => void loadData()} disabled={isLoading}><RefreshCw size={15} className={isLoading ? 'spin' : ''} /> Обновить</button>
                <button className="button button-primary" onClick={() => void collectAll()} disabled={isCollecting}><Zap size={15} /> {isCollecting ? 'Запускаю сбор…' : 'Собрать офферы'} <ChevronDown size={14} /></button>
              </div>
            </div>

            {errorMessage && <div className="error-banner"><CircleHelp size={17} /><span>{errorMessage}</span><button onClick={() => void loadData()}>Повторить</button></div>}

            {(tab === 'inbox' || tab === 'funnel' || tab === 'studio') && (
              <>
                <section className="metric-grid">
                  <MetricCard label="Новые возможности" value={newCount} hint="Входящие лиды" icon={Inbox} accent="blue" />
                  <MetricCard label="Офферы готовы" value={offerCount} hint="Можно проверить и отправить" icon={FileText} accent="violet" />
                  <MetricCard label="Активные диалоги" value={attentionCount} hint="Ответы и переговоры" icon={MessageCircle} accent="green" />
                  <MetricCard label="Конверсия в ответ" value={stats ? `${Math.round(stats.conversion_rate)}%` : '—'} hint={stats ? `${stats.sent_outreach} зафиксировано как отправленные` : 'Появится после загрузки статистики'} icon={TrendingUp} accent="amber" />
                </section>

                <section className="source-health">
                  <div className="source-health-title"><div><span className="live-dot" /><strong>Источники</strong><span className="muted">· быстрый сбор</span></div><button className="text-button" onClick={() => setTab('settings')}>Настроить <ArrowRight size={14} /></button></div>
                  <div className="source-health-grid">
                    <SourceCard name="hh.ru" caption="Вакансии и контракты" tone="hh" busy={Boolean(scraping.hh)} onClick={() => void collectSource('hh')} />
                    <SourceCard name="Telegram" caption="Каналы и сообщества" tone="telegram" busy={Boolean(scraping.tg)} onClick={() => void collectSource('tg')} />
                    <SourceCard name="Фриланс" caption="Хабр · FL.ru · Kwork" tone="freelance" busy={Boolean(scraping.freelance)} onClick={() => void collectSource('freelance')} />
                    <SourceCard name="Авито Работа" caption="Вакансии и проекты" tone="avito" busy={Boolean(scraping.avito)} onClick={() => void collectSource('avito')} />
                  </div>
                </section>

                {tab !== 'funnel' && (
                  <section className="focus-strip">
                    <div className="focus-icon"><Sparkles size={17} /></div>
                    <div className="focus-copy"><strong>{tab === 'studio' ? 'Работа с офферами' : 'Фокус на сегодня'}</strong><span>{tab === 'studio' ? 'Открой черновик, проверь факты и доведи сообщение до готовности.' : `${newCount} лидов ждут оценки · ${offerCount} черновиков требуют твоего взгляда.`}</span></div>
                    <button className="text-button" onClick={() => setTab(tab === 'studio' ? 'inbox' : 'studio')}>{tab === 'studio' ? 'Все лиды' : 'Открыть студию'} <ArrowRight size={14} /></button>
                  </section>
                )}

                <section className="leads-section">
                  <div className="section-heading">
                    <div><h2>{tab === 'funnel' ? 'Стадии работы' : tab === 'studio' ? 'Черновики офферов' : 'Поток возможностей'}</h2><p>{filteredLeads.length} {filteredLeads.length === 1 ? 'лид' : 'лидов'} · данные из подключённых источников</p></div>
                    <div className="section-controls">
                      {tab === 'inbox' && <div className="segmented-control"><button className={viewMode === 'list' ? 'selected' : ''} onClick={() => setViewMode('list')}><ListFilter size={14} /> Список</button><button className={viewMode === 'board' ? 'selected' : ''} onClick={() => setViewMode('board')}><Layers3 size={14} /> Карточки</button></div>}
                      <label className="select-wrap"><Filter size={14} /><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">Все источники</option>{Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={13} /></label>
                      <label className="select-wrap"><SlidersHorizontal size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Все стадии</option>{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><ChevronDown size={13} /></label>
                    </div>
                  </div>

                  {tab === 'funnel' ? (
                    <div className="funnel-board">
                      {STAGES.filter((stage) => stage.id !== 'archived').map((stage) => {
                        const stageLeads = filteredLeads.filter((lead) => lead.status === stage.id);
                        return <div className="funnel-column" key={stage.id}><div className="funnel-column-head"><span className={`stage-dot ${stage.dot}`} /><strong>{stage.label}</strong><small>{stageLeads.length}</small></div><div className="funnel-column-body">{stageLeads.map((lead) => <LeadMiniCard key={lead.id} lead={lead} onOpen={() => openLead(lead)} />)}{stageLeads.length === 0 && <div className="empty-stage">Пока пусто</div>}</div></div>;
                      })}
                    </div>
                  ) : viewMode === 'board' && tab === 'inbox' ? (
                    <div className="lead-card-grid">{filteredLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={() => openLead(lead)} onGenerate={() => { openLead(lead); }} />)}</div>
                  ) : (
                    <LeadTable leads={filteredLeads} onOpen={openLead} onSource={openSource} />
                  )}
                  {filteredLeads.length === 0 && <div className="empty-state"><div className="empty-state-icon"><Inbox size={22} /></div><strong>{isLoading ? 'Загружаем поток…' : 'Пока ничего не найдено'}</strong><span>{search || sourceFilter !== 'all' || statusFilter !== 'all' ? 'Измени фильтры или поисковый запрос.' : 'Запусти сбор источников — новые возможности появятся здесь.'}</span>{!search && sourceFilter === 'all' && statusFilter === 'all' && <button className="button button-primary" onClick={() => void collectAll()}><Zap size={15} /> Собрать офферы</button>}</div>}
                </section>
              </>
            )}

            {tab === 'knowledge' && <div className="settings-content"><KnowledgeBaseTab items={kbItems} onAddItem={addKbItem} onDeleteItem={deleteKbItem} /></div>}
            {tab === 'settings' && <div className="settings-content"><SettingsTab settings={settings} onUpdateSettings={updateSettings} /></div>}
          </div>
        </div>
      </main>

      {selectedFresh && <LeadDrawer
        lead={selectedFresh}
        offerDraft={offerDraft}
        onOfferChange={setOfferDraft}
        instructions={offerInstructions}
        onInstructionsChange={setOfferInstructions}
        onClose={() => setSelectedLead(null)}
        onGenerate={generateOffer}
        onSave={saveOffer}
        onCopy={copyOffer}
        onOpenSource={() => openSource(selectedFresh)}
        onChangeStatus={(status) => void changeStatus(selectedFresh, status)}
        isGenerating={isGenerating}
        isSaving={isSaving}
      />}

      {toast && <div className="workspace-toast"><CheckCircle2 size={17} /><span>{toast}</span><button onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  );
}

function MetricCard({ label, value, hint, icon: Icon, accent }: { label: string; value: string | number; hint: string; icon: React.ElementType; accent: string }) {
  return <div className="metric-card"><div className={`metric-icon ${accent}`}><Icon size={18} /></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-hint">{hint}</div></div>;
}

function SourceCard({ name, caption, tone, busy, onClick }: { name: string; caption: string; tone: string; busy: boolean; onClick: () => void }) {
  return <button className="source-health-card" onClick={onClick} disabled={busy}><span className={`source-logo ${tone}`}>{tone === 'hh' ? 'hh' : tone === 'telegram' ? <Send size={16} /> : tone === 'freelance' ? <Layers3 size={16} /> : <Building2 size={16} />}</span><span className="source-health-copy"><strong>{name}</strong><small>{busy ? 'Сбор запущен…' : caption}</small></span>{busy ? <LoaderCircle size={15} className="spin" /> : <ArrowUpRight size={15} className="source-arrow" />}</button>;
}

function LeadTable({ leads, onOpen, onSource }: { leads: Lead[]; onOpen: (lead: Lead) => void; onSource: (lead: Lead) => void }) {
  return <div className="table-wrap"><table className="lead-table"><thead><tr><th>Возможность</th><th>Источник</th><th>Оценка</th><th>Стадия</th><th>Обновлено</th><th><span className="sr-only">Действия</span></th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} onClick={() => onOpen(lead)} className="lead-row"><td><div className="lead-title-cell"><span className="company-avatar">{(lead.company || lead.title || '?').slice(0, 1).toLocaleUpperCase('ru')}</span><span className="lead-title-copy"><strong>{lead.title}</strong><small><Building2 size={12} /> {lead.company || 'Заказчик не указан'} <span className="meta-dot">·</span> {lead.salary_raw || 'Бюджет не указан'}</small></span></div></td><td><span className={`source-pill ${sourceTone(lead.source)}`}>{SOURCE_LABELS[lead.source] || lead.source}</span></td><td><span className={`score-pill ${scoreTone(lead.match_score)}`}>{lead.match_score}<small>/100</small></span></td><td><span className="status-cell"><span className={`stage-dot ${STAGES.find((stage) => stage.id === lead.status)?.dot || 'bg-slate-300'}`} />{STATUS_LABELS[lead.status] || lead.status}</span></td><td className="updated-cell">{relativeTime(lead.updated_at || lead.created_at)}</td><td><div className="row-actions"><button className="icon-button tiny" title="Открыть оффер" onClick={(event) => { event.stopPropagation(); onOpen(lead); }}><FileText size={15} /></button><button className="icon-button tiny" title="Открыть оригинал" onClick={(event) => { event.stopPropagation(); onSource(lead); }}><ExternalLink size={15} /></button></div></td></tr>)}</tbody></table></div>;
}

function LeadMiniCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  return <button className="lead-mini-card" onClick={onOpen}><div className="mini-card-top"><span className={`source-pill ${sourceTone(lead.source)}`}>{SOURCE_LABELS[lead.source] || lead.source}</span><span className={`score-pill ${scoreTone(lead.match_score)}`}>{lead.match_score}</span></div><strong>{lead.title}</strong><small>{lead.company || 'Заказчик не указан'}</small><div className="mini-card-bottom"><span>{lead.salary_raw || 'Бюджет не указан'}</span><ArrowUpRight size={14} /></div></button>;
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void; onGenerate: () => void }) {
  return <button className="lead-board-card" onClick={onOpen}><div className="mini-card-top"><span className={`source-pill ${sourceTone(lead.source)}`}>{SOURCE_LABELS[lead.source] || lead.source}</span><span className={`score-pill ${scoreTone(lead.match_score)}`}>{lead.match_score}/100</span></div><strong>{lead.title}</strong><small>{lead.company || 'Заказчик не указан'}</small><p>{(lead.description || '').slice(0, 150)}{(lead.description || '').length > 150 ? '…' : ''}</p><div className="mini-card-bottom"><span>{lead.salary_raw || 'Бюджет не указан'}</span><ArrowRight size={14} /></div></button>;
}

function LeadDrawer({ lead, offerDraft, onOfferChange, instructions, onInstructionsChange, onClose, onGenerate, onSave, onCopy, onOpenSource, onChangeStatus, isGenerating, isSaving }: {
  lead: Lead; offerDraft: string; onOfferChange: (value: string) => void; instructions: string; onInstructionsChange: (value: string) => void;
  onClose: () => void; onGenerate: () => void; onSave: () => void; onCopy: () => void; onOpenSource: () => void;
  onChangeStatus: (status: Lead['status']) => void; isGenerating: boolean; isSaving: boolean;
}) {
  const [detailsTab, setDetailsTab] = useState<'overview' | 'offer' | 'activity'>('overview');
  useEffect(() => { setDetailsTab(lead.generated_offer ? 'offer' : 'overview'); }, [lead.id]);
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="lead-drawer"><div className="drawer-header"><div className="drawer-header-copy"><span className="eyebrow">ЛИД #{lead.id} <span className={`source-pill ${sourceTone(lead.source)}`}>{SOURCE_LABELS[lead.source] || lead.source}</span></span><h2>{lead.title}</h2><p>{lead.company || 'Заказчик не указан'} · {lead.salary_raw || 'Бюджет не указан'}</p></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></div>
    <div className="drawer-toolbar"><button className="button button-secondary" onClick={onOpenSource}><ExternalLink size={14} /> Оригинал</button><label className="status-select"><span>Стадия</span><select value={lead.status} onChange={(event) => onChangeStatus(event.target.value as Lead['status'])}>{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><ChevronDown size={13} /></label></div>
    <div className="drawer-tabs"><button className={detailsTab === 'overview' ? 'active' : ''} onClick={() => setDetailsTab('overview')}>Обзор</button><button className={detailsTab === 'offer' ? 'active' : ''} onClick={() => setDetailsTab('offer')}>Оффер {offerDraft.trim() && <span className="tab-indicator" />}</button><button className={detailsTab === 'activity' ? 'active' : ''} onClick={() => setDetailsTab('activity')}>История</button></div>
    <div className="drawer-body">
      {detailsTab === 'overview' && <div className="drawer-section-stack"><div className="drawer-score-row"><div className={`drawer-score ${scoreTone(lead.match_score)}`}><strong>{lead.match_score}</strong><span>/100</span></div><div><strong>Релевантность</strong><p>{lead.scoring_reason || 'Обоснование оценки пока не заполнено.'}</p></div></div><div className="detail-grid"><div><span>Источник</span><strong>{SOURCE_LABELS[lead.source] || lead.source}</strong></div><div><span>Обнаружен</span><strong>{formatDate(lead.created_at)}</strong></div><div><span>Локация</span><strong>{lead.location || 'Не указана'}</strong></div><div><span>Контакт</span><strong>{lead.contact_info || 'Не найден'}</strong></div></div>{lead.tags && <div className="detail-block"><h3>Навыки и теги</h3><div className="tag-list">{lead.tags.split(',').map((tag) => <span key={tag}>{tag.trim()}</span>)}</div></div>}<div className="detail-block"><div className="detail-block-head"><h3>Описание возможности</h3><button className="text-button" onClick={onOpenSource}>Оригинал <ExternalLink size={13} /></button></div><p className="description-text">{lead.description || 'Описание отсутствует.'}</p></div><button className="button button-primary full-width" onClick={() => setDetailsTab('offer')}><Sparkles size={15} /> Подготовить персональный оффер</button></div>}
      {detailsTab === 'offer' && <div className="offer-editor"><div className="offer-editor-intro"><div className="offer-editor-icon"><Sparkles size={17} /></div><div><h3>Персональное предложение</h3><p>Черновик — не отправлен. Проверь факты и адаптируй текст под заказчика.</p></div></div><label className="field-label">Контекст для генерации <span>необязательно</span><textarea value={instructions} onChange={(event) => onInstructionsChange(event.target.value)} placeholder="Например: без формального вступления, сначала предложить короткий аудит…" rows={3} /></label><div className="editor-toolbar"><span><FileText size={14} /> Текст отклика</span><span>{offerDraft.trim() ? offerDraft.trim().split(/\s+/).length : 0} слов</span></div><textarea className="offer-textarea" value={offerDraft} onChange={(event) => onOfferChange(event.target.value)} placeholder="Подготовь оффер на основе задачи и подтверждённых кейсов…" rows={14} /><div className="editor-note"><CheckCircle2 size={14} /> Перед отправкой проверь конкретику, тон и все утверждения о своём опыте.</div><div className="offer-actions"><button className="button button-secondary" onClick={onCopy} disabled={!offerDraft.trim()}><Copy size={14} /> Копировать</button><button className="button button-secondary" onClick={onSave} disabled={isSaving}>{isSaving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Сохранить</button><button className="button button-primary" onClick={onGenerate} disabled={isGenerating}>{isGenerating ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} {isGenerating ? 'Готовлю…' : offerDraft.trim() ? 'Перегенерировать' : 'Создать черновик'}</button></div><div className="safe-send-note"><Activity size={15} /><span><strong>Отправка вручную.</strong> На этом этапе кнопки генерации и сохранения не отправляют сообщение заказчику.</span></div></div>}
      {detailsTab === 'activity' && <div className="activity-list"><div className="activity-item"><span className="activity-marker"><Inbox size={14} /></span><div><strong>Лид появился в системе</strong><p>{formatDate(lead.created_at)} · {SOURCE_LABELS[lead.source] || lead.source}</p></div></div><div className="activity-item"><span className="activity-marker"><Activity size={14} /></span><div><strong>Текущая стадия: {STATUS_LABELS[lead.status] || lead.status}</strong><p>Последнее обновление: {formatDate(lead.updated_at)}</p></div></div>{lead.generated_offer && <div className="activity-item"><span className="activity-marker"><FileText size={14} /></span><div><strong>Есть черновик оффера</strong><p>История версий и журнал действий будут отдельным слоем данных.</p></div></div>}<div className="activity-placeholder"><Clock3 size={16} /> Детальная история действий появится после внедрения журнала событий.</div></div>}
    </div>
    <div className="drawer-footer"><div className="footer-status"><span className={`stage-dot ${STAGES.find((stage) => stage.id === lead.status)?.dot || 'bg-slate-300'}`} />{STATUS_LABELS[lead.status] || lead.status}</div><button className="button button-secondary" onClick={onClose}>Закрыть карточку</button></div></aside></div>;
}
