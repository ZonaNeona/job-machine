import React, { useMemo, useState } from 'react';
import {
  ArrowRight, CircleDollarSign, Clock3, History, Inbox, MessageSquare, PenLine,
  Sparkles, TrendingUp, Zap,
} from 'lucide-react';
import { Lead, LeadBrief, ScraperKey, WorkspaceOverview } from '../../types';
import { PIPELINE_STAGES, SOURCE_MAP, formatMoney, formatTime, parseDate, plural, relativeTime } from '../lib';
import { DueLabel, EmptyState, ScoreRing, SectionHead, Spinner, SourceBadge, StageBadge } from '../components/ui';
import { LeadCard } from '../components/LeadCard';

interface TodayViewProps {
  leads: Lead[];
  overview: WorkspaceOverview | null;
  loading: boolean;
  busy: Record<string, boolean>;
  lastSync: string | null;
  onRunAll: () => void;
  onRunSource: (key: ScraperKey) => void;
  onOpenLead: (id: number) => void;
  onGoStream: () => void;
  onGoFunnel: () => void;
  onGoStudio: (id?: number) => void;
}

type AttentionTab = 'offer' | 'ready' | 'follow' | 'replied' | 'stale';

const isFollowUpDue = (lead: Lead) => {
  if (lead.status !== 'sent') return false;
  const due = parseDate(lead.next_action_at);
  if (due) return due.getTime() <= Date.now() + 86400000;
  const sent = parseDate(lead.sent_at);
  return Boolean(sent && sent.getTime() <= Date.now() - 2 * 86400000);
};

export function TodayView({
  leads, overview, loading, busy, lastSync,
  onRunAll, onRunSource, onOpenLead, onGoStream, onGoFunnel, onGoStudio,
}: TodayViewProps) {
  const [tab, setTab] = useState<AttentionTab>('offer');

  const needsOffer = useMemo(
    () => leads.filter((lead) => lead.status === 'new' || lead.status === 'ai_scored'),
    [leads],
  );
  const ready = useMemo(
    () => leads.filter((lead) => (lead.status === 'offer_generated' || lead.status === 'approved') && lead.generated_offer?.trim()),
    [leads],
  );
  const followUps = useMemo(() => leads.filter(isFollowUpDue), [leads]);
  const replied = useMemo(() => leads.filter((lead) => lead.status === 'replied'), [leads]);
  const stale = useMemo(() => leads.filter(
    (lead) => ['new', 'ai_scored', 'offer_generated', 'approved'].includes(lead.status)
      && parseDate(lead.updated_at) !== null
      && Date.now() - (parseDate(lead.updated_at)?.getTime() ?? Date.now()) > 7 * 86400000,
  ), [leads]);

  const totals = overview?.totals;
  const attention = overview?.attention;
  const today = overview?.today;

  const fresh = useMemo(
    () => [...leads]
      .filter((lead) => !['sent', 'replied', 'closed_won', 'archived'].includes(lead.status))
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, 6),
    [leads],
  );

  const tabs: { id: AttentionTab; label: string; count: number; items: LeadBrief[] }[] = [
    { id: 'offer', label: 'Ждут оффера', count: needsOffer.length, items: attention?.needs_offer ?? [] },
    { id: 'ready', label: 'К отправке', count: ready.length, items: attention?.ready_to_send ?? [] },
    { id: 'follow', label: 'Follow-up', count: followUps.length, items: attention?.follow_ups ?? [] },
    { id: 'replied', label: 'Ответили', count: replied.length, items: attention?.replied ?? [] },
    { id: 'stale', label: 'Зависли', count: stale.length, items: attention?.stale ?? [] },
  ];
  const active = tabs.find((item) => item.id === tab) ?? tabs[0];

  const sources = overview?.sources ?? [];
  const totalNewToday = today?.new_leads ?? 0;
  const activeSources = sources.filter((source) => source.fresh > 0).length;

  if (loading && !overview) {
    return (
      <div>
        <div className="skeleton" style={{ height: 78, marginBottom: 16 }} />
        <div className="kpis">
          {[1, 2, 3, 4].map((key) => <div key={key} className="skeleton" style={{ height: 96 }} />)}
        </div>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="collect-bar">
        <div className="collect-icon"><Sparkles size={19} strokeWidth={2} /></div>
        <div className="collect-copy">
          <div className="collect-title">Собрать свежие офферы</div>
          <div className="collect-sub">
            За сутки пришло <strong>{totalNewToday}</strong> · синхронизация {formatTime(lastSync)}
          </div>
        </div>
        <div className="collect-sources">
          {sources.filter((source) => source.source !== 'direct').map((source) => {
            const meta = SOURCE_MAP[source.source];
            const scraperKey: ScraperKey =
              source.source === 'hh.ru' ? 'hh'
                : source.source === 'telegram' ? 'tg'
                  : source.source === 'avito' ? 'avito'
                    : 'freelance';
            const running = Boolean(busy[`scraper-${scraperKey}`]);
            return (
              <button
                key={source.source}
                type="button"
                className={`source-pill ${running ? 'running' : ''}`}
                onClick={() => onRunSource(scraperKey)}
                disabled={running}
                title={`Запустить сбор: ${meta?.label ?? source.source}`}
              >
                <span className={`source-dot ${meta?.tone ?? 'direct'}`} />
                {meta?.label ?? source.source}
                {running
                  ? <Spinner size={11} />
                  : source.fresh > 0
                    ? <b>+{source.fresh}</b>
                    : <b style={{ color: '#b3b6c1' }}>0</b>}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={onRunAll} disabled={Boolean(busy['scraper-all'])}>
          {busy['scraper-all'] ? <Spinner size={14} /> : <Zap size={15} />}
          Собрать всё
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Пришло за сутки</span>
            <span className="kpi-icon sky"><Inbox size={13} /></span>
          </div>
          <div className="kpi-value">{totalNewToday}</div>
          <div className="kpi-foot">
            <span>{totals?.all ?? leads.length} в потоке</span>
            <span>·</span>
            <span>
              {activeSources} {plural(activeSources, ['источник', 'источника', 'источников'])}{' '}
              {activeSources === 1 ? 'активен' : 'активны'}
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Ждут предложения</span>
            <span className="kpi-icon violet"><PenLine size={13} /></span>
          </div>
          <div className="kpi-value">{needsOffer.length}</div>
          <div className="kpi-foot">
            <span className="warn">{needsOffer.filter((lead) => lead.match_score >= 80).length} с высокой оценкой</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Офферы готовы</span>
            <span className="kpi-icon emerald"><MessageSquare size={13} /></span>
          </div>
          <div className="kpi-value">{ready.length}</div>
          <div className="kpi-foot">
            <span>к отправке: {ready.filter((lead) => lead.status === 'approved').length}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-label">Follow-up</span>
            <span className="kpi-icon amber"><Clock3 size={13} /></span>
          </div>
          <div className="kpi-value">{followUps.length}</div>
          <div className="kpi-foot">
            <span>{followUps.length > 0 ? 'пора напомнить о себе' : 'всё под контролем'}</span>
          </div>
        </div>
      </div>

      <div className="today-grid">
        <section className="panel">
          <div className="attention-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`att-tab ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                <span className="n">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="att-list">
            {active.items.length === 0 && (
              <EmptyState
                icon={<Sparkles size={17} />}
                title={tab === 'offer' ? 'Все лиды разобраны' : 'Здесь пока пусто'}
                hint={tab === 'offer'
                  ? 'Запусти утренний сбор — новые возможности появятся здесь.'
                  : 'Как только появится движение, оно окажется в этой вкладке.'}
              />
            )}
            {active.items.map((item) => (
              <div
                key={item.id}
                className="att-row"
                role="button"
                tabIndex={0}
                onClick={() => onOpenLead(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenLead(item.id);
                  }
                }}
              >
                <ScoreRing score={item.match_score} />
                <span className="att-main">
                  <span className="att-title">{item.title}</span>
                  <span className="att-meta">
                    <span className="truncate">{item.company || 'Без компании'}</span>
                    <span className="sep">·</span>
                    <SourceBadge source={item.source} />
                    <span className="sep">·</span>
                    <span>{relativeTime(item.sent_at || item.created_at)}</span>
                  </span>
                </span>
                <span className="att-side">
                  {item.priority === 'high' && <span className="badge badge-priority high">Высокий</span>}
                  {tab === 'offer' && (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm att-cta"
                      onClick={(event) => {
                        event.stopPropagation();
                        onGoStudio(item.id);
                      }}
                    >
                      Написать <ArrowRight size={12} />
                    </button>
                  )}
                  {tab === 'ready' && <StageBadge status={item.status} />}
                  {tab === 'follow' && <DueLabel value={item.next_action_at || item.sent_at} />}
                  {tab === 'replied' && <StageBadge status={item.status} />}
                  {tab === 'stale' && <span className="tiny muted">{relativeTime(item.updated_at)}</span>}
                </span>
              </div>
            ))}
          </div>

          <div className="row between" style={{ padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
            <span className="tiny muted">Показаны {active.items.length} из {active.count}</span>
            <button type="button" className="panel-link" onClick={onGoStream}>
              Весь поток <ArrowRight size={12} />
            </button>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title"><TrendingUp size={14} /> Движение воронки</div>
                <div className="panel-sub">Где стоят лиды прямо сейчас</div>
              </div>
              <button type="button" className="panel-link" onClick={onGoFunnel}>Открыть</button>
            </div>
            <div className="panel-body">
              <div className="funnel-bars">
                {PIPELINE_STAGES.filter((stage) => stage.id !== 'archived').map((stage) => {
                  const count = leads.filter((lead) => lead.status === stage.id).length;
                  const width = Math.round((count / Math.max(1, leads.length)) * 100);
                  return (
                    <div className="funnel-row" key={stage.id}>
                      <span className="funnel-label">
                        <span className={`kanban-dot tone-${stage.tone}`} />
                        {stage.short}
                      </span>
                      <span className="funnel-track">
                        <span
                          className={`funnel-fill tone-${stage.tone}`}
                          style={{ width: `${count > 0 ? Math.max(width, 3) : 0}%` }}
                        />
                      </span>
                      <span className="funnel-value">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title"><CircleDollarSign size={14} /> Доход</div>
                <div className="panel-sub">Спокойный ориентир, не гонка</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="mrr-value">{formatMoney(overview?.mrr.current ?? 0)}</div>
              <div className="mrr-line">
                <span>
                  из {formatMoney(overview?.mrr.target ?? 0)} · {overview?.mrr.clients ?? 0} из {overview?.mrr.target_clients ?? 6} клиентов
                </span>
              </div>
              <div className="progress">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, Math.round(((overview?.mrr.current ?? 0) / Math.max(1, overview?.mrr.target ?? 1)) * 100))}%` }}
                />
              </div>
              <div className="mrr-foot">
                <span>Средний чек: {formatMoney(overview?.mrr.monthly_rate ?? 0)}</span>
                <span>Цель MRR</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div className="panel-title"><History size={14} /> Последние действия</div>
            </div>
            <div className="panel-body">
              {overview?.recent_events.length ? (
                <div className="event-list">
                  {overview.recent_events.slice(0, 6).map((event) => (
                    <div className="event-row" key={event.id}>
                      <span className={`event-dot ${event.kind}`} />
                      <div className="event-main">
                        <div className="event-text"><strong>{event.lead_title}</strong> · {event.message}</div>
                        <div className="event-time">{relativeTime(event.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<History size={16} />}
                  title="Журнал пока пуст"
                  hint="Здесь появятся смены стадий, сохранения офферов и отправки."
                />
              )}
            </div>
          </section>
        </div>
      </div>

      <SectionHead
        title="Свежие лиды"
        count={leads.length}
        sub="Отсортированы по соответствию профилю — начни с верхних"
        action={<button type="button" className="btn btn-sm" onClick={onGoStream}>Открыть поток <ArrowRight size={12} /></button>}
      />
      <div className="fresh-grid">
        {fresh.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onOpen={(item) => onOpenLead(item.id)}
            onStudio={(item) => onGoStudio(item.id)}
          />
        ))}
      </div>
    </div>
  );
}


