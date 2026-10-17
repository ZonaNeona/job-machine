
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, Sparkles, Zap } from 'lucide-react';
import { api } from './api';
import { Lead, LeadStatus, OfferAngle, OfferLength } from './types';
import { useWorkspace } from './workspace/useWorkspace';
import { contactTarget } from './workspace/lib';
import { Sidebar, WorkspaceView } from './workspace/components/Sidebar';
import { TopBar } from './workspace/components/TopBar';
import { ToastStack } from './workspace/components/ToastStack';
import { LeadDrawer } from './workspace/components/LeadDrawer';
import { CommandPalette } from './workspace/components/CommandPalette';
import { ManualLeadModal } from './workspace/components/ManualLeadModal';
import { DispatchModal } from './workspace/components/DispatchModal';
import { TodayView } from './workspace/views/TodayView';
import { StreamView } from './workspace/views/StreamView';
import { FunnelView } from './workspace/views/FunnelView';
import { StudioView } from './workspace/views/StudioView';
import { KnowledgeView } from './workspace/views/KnowledgeView';
import { SettingsView } from './workspace/views/SettingsView';
import { AccountsView } from './workspace/views/AccountsView';

const VIEW_TITLE: Record<WorkspaceView, string> = {
  today: 'Сегодня',
  stream: 'Поток лидов',
  funnel: 'Воронка',
  studio: 'Студия офферов',
  knowledge: 'База знаний',
  accounts: 'Аккаунты',
  settings: 'Источники',
};

const VIEWS: WorkspaceView[] = ['today', 'stream', 'funnel', 'studio', 'knowledge', 'accounts', 'settings'];

function viewFromHash(): WorkspaceView {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (VIEWS as string[]).includes(raw) ? (raw as WorkspaceView) : 'today';
}

const VIEW_HEAD: Record<WorkspaceView, { title: string; sub: string }> = {
  today: {
    title: 'Доброе утро, Игорь',
    sub: 'Свежие возможности, очередь на офферы и всё, что требует внимания сегодня.',
  },
  stream: {
    title: 'Поток лидов',
    sub: 'Все возможности из подключённых площадок — с оценкой, стадией и следующим шагом.',
  },
  funnel: {
    title: 'Воронка',
    sub: 'Перетаскивай карточки между стадиями: журнал и follow-up обновятся автоматически.',
  },
  studio: {
    title: 'Студия офферов',
    sub: 'Один лид — одно уникальное предложение. Без шаблонов, воды и ИИ-стиля.',
  },
  knowledge: {
    title: 'База знаний',
    sub: 'Кейсы и факты, на которые опираются офферы. Всё проверяемое и твоё.',
  },
  accounts: {
    title: 'Аккаунты площадок',
    sub: 'Сессии личных кабинетов, синк чатов и быстрая обратная связь по ответам.',
  },
  settings: {
    title: 'Источники и подключения',
    sub: 'Что подключено, когда последний сбор и какие правила работают без тебя.',
  },
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export default function App() {
  const ws = useWorkspace();

  const [view, setView] = useState<WorkspaceView>(viewFromHash);
  const [drawerLeadId, setDrawerLeadId] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<Lead | null>(null);

  const [studioId, setStudioId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [draftLeadId, setDraftLeadId] = useState<number | null>(null);
  const [instructions, setInstructions] = useState('');
  const [angle, setAngle] = useState<OfferAngle>('pain');
  const [length, setLength] = useState<OfferLength>('short');
  const [savingOffer, setSavingOffer] = useState(false);

  const leads = ws.leads;
  const drawerLead = useMemo(
    () => leads.find((lead) => lead.id === drawerLeadId) ?? null,
    [leads, drawerLeadId],
  );
  const studioLead = useMemo(
    () => leads.find((lead) => lead.id === studioId) ?? null,
    [leads, studioId],
  );

  useEffect(() => {
    if (!studioLead) {
      if (leads.length > 0) setStudioId(leads[0].id);
      return;
    }
    if (studioLead.id !== draftLeadId) {
      setDraftLeadId(studioLead.id);
      setDraft(studioLead.generated_offer ?? '');
      setInstructions('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioLead?.id, leads.length]);

  const navigate = useCallback((next: WorkspaceView) => {
    setView(next);
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const goStudio = useCallback((id?: number) => {
    if (id) setStudioId(id);
    navigate('studio');
  }, [navigate]);

  const openLead = useCallback((id: number) => setDrawerLeadId(id), []);

  const changeStatus = useCallback(async (lead: Lead, status: LeadStatus) => {
    try {
      await ws.changeStatus(lead, status);
    } catch {
      /* toast is shown by the hook */
    }
  }, [ws]);

  const generate = useCallback(async () => {
    if (!studioLead) return;
    try {
      const text = await ws.generateOffer(studioLead, { angle, length, instructions });
      setDraft(text);
    } catch {
      /* toast is shown by the hook */
    }
  }, [studioLead, ws, angle, length, instructions]);

  const saveDraft = useCallback(async () => {
    if (!studioLead) return;
    setSavingOffer(true);
    try {
      const nextStatus: LeadStatus = draft.trim() && ['new', 'ai_scored'].includes(studioLead.status)
        ? 'offer_generated'
        : studioLead.status;
      await ws.patchLead(studioLead, { generated_offer: draft, status: nextStatus }, { message: 'Черновик сохранён' });
    } catch {
      /* toast is shown by the hook */
    } finally {
      setSavingOffer(false);
    }
  }, [studioLead, draft, ws]);

  const copyDraft = useCallback(async () => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      ws.notify('Текст скопирован — вставляй в чат');
    } catch {
      ws.notify('Браузер не дал доступ к буферу', 'error');
    }
  }, [draft, ws]);

  const openContact = useCallback((lead: Lead) => {
    const target = contactTarget(lead);
    if (!target.href) {
      ws.notify('У лида нет контакта — открой площадку', 'info');
      return;
    }
    window.open(target.href, '_blank', 'noopener,noreferrer');
  }, [ws]);

  const confirmDispatch = useCallback(async (payload: { channel: string; followUpDays: number }) => {
    if (!dispatchTarget) return;
    const text = draftLeadId === dispatchTarget.id && draft.trim()
      ? draft
      : (dispatchTarget.generated_offer || '');
    try {
      await ws.dispatchOffer(dispatchTarget, {
        offer_text: text,
        channel: payload.channel,
        follow_up_days: payload.followUpDays,
      });
      setDispatchTarget(null);
      setDraft('');
    } catch {
      /* toast is shown by the hook */
    }
  }, [dispatchTarget, draft, draftLeadId, ws]);

  const testAlert = useCallback(async () => {
    try {
      const result = await api.testAlert() as { message?: string };
      ws.notify(result?.message || 'Тестовый алерт отправлен');
    } catch (err) {
      ws.notify(err instanceof Error ? err.message : 'Алерт не ушёл', 'error');
    }
  }, [ws]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const overlayOpen = Boolean(drawerLead || paletteOpen || manualOpen || dispatchTarget);
    document.body.style.overflow = overlayOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerLead, paletteOpen, manualOpen, dispatchTarget]);

  const counts: Record<WorkspaceView, number | undefined> = {
    today: undefined,
    stream: leads.length,
    funnel: leads.length,
    studio: leads.filter((lead) => lead.status === 'new' || lead.status === 'ai_scored').length,
    knowledge: ws.kb.length,
    accounts: ws.accountChats.filter((chat) => chat.unread || chat.has_reply).length || undefined,
    settings: undefined,
  };

  const head = view === 'today' ? { ...VIEW_HEAD.today, title: `${greeting()}, Игорь` } : VIEW_HEAD[view];

  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={navigate}
        counts={counts}
        overview={ws.overview}
        busy={ws.busy}
        onRunSource={ws.runScraper}
      />

      <div className="main">
        <TopBar
          title={VIEW_TITLE[view]}
          refreshing={ws.refreshing}
          onRefresh={() => ws.refresh(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSettings={() => navigate('settings')}
          onAddLead={() => setManualOpen(true)}
        />

        <main className="page">
          <div className="page-head">
            <div>
              <h1 className="page-title">{head.title}</h1>
              <p className="page-sub">{head.sub}</p>
            </div>
            <div className="head-actions">
              <button type="button" className="btn" onClick={() => setManualOpen(true)}>
                <Plus size={14} /> Добавить лид
              </button>
              {view === 'stream' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={ws.runAllScrapers}
                  disabled={Boolean(ws.busy['scraper-all'])}
                >
                  <Zap size={14} /> Собрать всё
                </button>
              )}
              {view === 'studio' && studioLead && (
                <button type="button" className="btn" onClick={() => setPaletteOpen(true)}>
                  <Sparkles size={14} /> Другой лид
                </button>
              )}
            </div>
          </div>

          {ws.error && (
            <div
              className="ctx-note"
              style={{ marginBottom: 16, borderColor: '#f0d4d4', background: '#fffafa' }}
            >
              <AlertCircle size={14} />
              <span>
                Backend не отвечает: {ws.error}.
                <button type="button" className="panel-link" onClick={() => ws.refresh()}>Повторить</button>
              </span>
            </div>
          )}

          {view === 'today' && (
            <TodayView
              leads={leads}
              overview={ws.overview}
              loading={ws.loading}
              busy={ws.busy}
              lastSync={ws.lastSync}
              onRunAll={ws.runAllScrapers}
              onRunSource={ws.runScraper}
              onOpenLead={openLead}
              onGoStream={() => navigate('stream')}
              onGoFunnel={() => navigate('funnel')}
              onGoStudio={goStudio}
            />
          )}

          {view === 'stream' && (
            <StreamView
              leads={leads}
              loading={ws.loading}
              onOpenLead={openLead}
              onStudio={goStudio}
              onChangeStatus={changeStatus}
            />
          )}

          {view === 'funnel' && (
            <FunnelView
              leads={leads}
              onOpenLead={openLead}
              onStudio={goStudio}
              onChangeStatus={changeStatus}
            />
          )}

          {view === 'studio' && (
            <StudioView
              leads={leads}
              selectedId={studioLead?.id ?? null}
              onSelect={setStudioId}
              draft={draft}
              onDraftChange={setDraft}
              instructions={instructions}
              onInstructionsChange={setInstructions}
              angle={angle}
              length={length}
              onAngleChange={setAngle}
              onLengthChange={setLength}
              generating={Boolean(studioLead && ws.busy[`generate-${studioLead.id}`])}
              saving={savingOffer}
              onGenerate={generate}
              onSave={saveDraft}
              onCopy={copyDraft}
              onOpenContact={openContact}
              onRequestSend={setDispatchTarget}
              onChangeStatus={changeStatus}
              onOpenLead={openLead}
            />
          )}

          {view === 'knowledge' && (
            <KnowledgeView
              items={ws.kb}
              busy={Boolean(ws.busy['kb'])}
              onAdd={ws.addKbItem}
              onRemove={ws.removeKbItem}
            />
          )}

          {view === 'accounts' && (
            <AccountsView
              platforms={ws.accounts}
              chats={ws.accountChats}
              selectedPlatform={ws.selectedAccount}
              busy={ws.busy}
              onSelectPlatform={ws.selectAccount}
              onSync={ws.syncAccount}
              onImportSample={ws.importAccountSample}
              onSave={ws.saveAccount}
              onOpenLead={openLead}
              onMarkRead={ws.markChatRead}
              onRefresh={() => ws.refresh(true)}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              overview={ws.overview}
              settings={ws.settings}
              scrapers={ws.scrapers}
              busy={ws.busy}
              saving={Boolean(ws.busy.settings)}
              onRunSource={ws.runScraper}
              onRunAll={ws.runAllScrapers}
              onSave={ws.saveSettings}
              onTestAlert={testAlert}
            />
          )}
        </main>
      </div>

      {drawerLead && (
        <LeadDrawer
          lead={drawerLead}
          onClose={() => setDrawerLeadId(null)}
          onSave={(lead, patch) => ws.patchLead(lead, patch, { message: 'Поля лида сохранены' })}
          onChangeStatus={changeStatus}
          onStudio={(id) => { setDrawerLeadId(null); goStudio(id); }}
          notify={ws.notify}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        leads={leads}
        onNavigate={navigate}
        onOpenLead={(id) => { setPaletteOpen(false); openLead(id); }}
        onRunAll={ws.runAllScrapers}
        onAddLead={() => { setPaletteOpen(false); setManualOpen(true); }}
      />

      {manualOpen && (
        <ManualLeadModal
          busy={Boolean(ws.busy['create-lead'])}
          onClose={() => setManualOpen(false)}
          onCreate={ws.createLead}
        />
      )}

      {dispatchTarget && (
        <DispatchModal
          lead={dispatchTarget}
          text={draftLeadId === dispatchTarget.id ? draft : (dispatchTarget.generated_offer || '')}
          busy={Boolean(ws.busy[`dispatch-${dispatchTarget.id}`])}
          onClose={() => setDispatchTarget(null)}
          onConfirm={confirmDispatch}
        />
      )}

      <ToastStack toasts={ws.toasts} onDismiss={ws.dismissToast} />
    </div>
  );
}

