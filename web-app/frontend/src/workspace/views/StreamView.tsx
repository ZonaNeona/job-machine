import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Inbox, PenLine, Search, SlidersHorizontal } from 'lucide-react';
import { Lead, LeadCategory, LeadStatus } from '../../types';
import { CATEGORIES, SOURCES, STAGE_MAP, STAGES, formatSalary, plural, relativeTime } from '../lib';
import { CategoryBadge, DealTypeBadge, DueLabel, EmptyState, ScoreRing, SourceBadge, UrgencyTrafficLight } from '../components/ui';

interface StreamViewProps {
  leads: Lead[];
  loading: boolean;
  onOpenLead: (id: number) => void;
  onStudio: (id: number) => void;
  onChangeStatus: (lead: Lead, status: LeadStatus) => void;
}

type SortMode = 'score' | 'newest' | 'updated';
type StreamSlice = 'all' | 'hot' | 'ai' | 'quick' | 'retainer' | 'bots' | 'web' | 'cms' | 'replied';

export function StreamView({ leads, loading, onOpenLead, onStudio, onChangeStatus }: StreamViewProps) {
  const [slice, setSlice] = useState<StreamSlice>('all');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [stage, setStage] = useState('all');
  const [category, setCategory] = useState('all');
  const [minScore, setMinScore] = useState('0');
  const [sort, setSort] = useState<SortMode>('score');
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  // Live slice counters
  const sliceCounts = useMemo(() => {
    return {
      all: leads.length,
      hot: leads.filter((l) => l.urgency === 'hot').length,
      ai: leads.filter((l) => l.category === 'ai').length,
      quick: leads.filter((l) => l.deal_type === 'quick').length,
      retainer: leads.filter((l) => l.deal_type === 'retainer').length,
      bots: leads.filter((l) => l.category === 'bots_parsers').length,
      web: leads.filter((l) => l.category === 'web').length,
      cms: leads.filter((l) => l.category === 'cms').length,
      replied: leads.filter((l) => l.status === 'replied').length,
    };
  }, [leads]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoreFloor = Number(minScore);
    return leads
      .filter((lead) => {
        // Fast slices filter
        if (slice === 'hot' && lead.urgency !== 'hot') return false;
        if (slice === 'ai' && lead.category !== 'ai') return false;
        if (slice === 'bots' && lead.category !== 'bots_parsers') return false;
        if (slice === 'web' && lead.category !== 'web') return false;
        if (slice === 'cms' && lead.category !== 'cms') return false;
        if (slice === 'quick' && lead.deal_type !== 'quick') return false;
        if (slice === 'retainer' && lead.deal_type !== 'retainer') return false;
        if (slice === 'replied' && lead.status !== 'replied') return false;

        if (query) {
          const haystack = [lead.title, lead.company, lead.tags, lead.description, lead.contact_info]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (source !== 'all' && lead.source !== source) return false;
        if (stage !== 'all' && lead.status !== stage) return false;
        if (category !== 'all' && lead.category !== category) return false;
        if (lead.match_score < scoreFloor) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'newest') return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
        if (sort === 'updated') return (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0);
        return (b.match_score || 0) - (a.match_score || 0)
          || (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
      });
  }, [leads, slice, search, source, stage, category, minScore, sort]);

  useEffect(() => { setCursor(0); }, [slice, search, source, stage, category, minScore, sort]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target ? ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) : false;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) {
        if (event.key === 'Escape') {
          (target as HTMLInputElement).blur();
          setSearch('');
        }
        return;
      }
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((prev) => Math.min(filtered.length - 1, prev + 1));
      }
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((prev) => Math.max(0, prev - 1));
      }
      if (event.key === 'Enter' && filtered[cursor]) onOpenLead(filtered[cursor].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, cursor, onOpenLead]);

  useEffect(() => {
    tableRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const resetFilters = () => {
    setSlice('all');
    setSearch('');
    setSource('all');
    setStage('all');
    setCategory('all');
    setMinScore('0');
  };

  return (
    <div className="fade-in">
      {/* Stream Slices Bar */}
      <div className="stream-slices" role="tablist" aria-label="Срезы потока">
        <button
          type="button"
          className={`slice-pill ${slice === 'all' ? 'active' : ''}`}
          onClick={() => setSlice('all')}
        >
          <span>Все лиды</span>
          <span className="slice-count">{sliceCounts.all}</span>
        </button>
        <button
          type="button"
          className={`slice-pill ${slice === 'hot' ? 'active' : ''}`}
          onClick={() => setSlice('hot')}
        >
          <span>🔥 Горящие (&lt;2ч)</span>
          <span className="slice-count">{sliceCounts.hot}</span>
        </button>
        <button
          type="button"
          className={`slice-pill ${slice === 'ai' ? 'active' : ''}`}
          onClick={() => setSlice('ai')}
        >
          <span>🟣 AI &amp; LLM</span>
          <span className="slice-count">{sliceCounts.ai}</span>
        </button>
        <button
          type="button"
          className={`slice-pill ${slice === 'retainer' ? 'active' : ''}`}
          onClick={() => setSlice('retainer')}
        >
          <span>💎 Ретейнеры (80к+)</span>
          <span className="slice-count">{sliceCounts.retainer}</span>
        </button>
        <button
          type="button"
          className={`slice-pill ${slice === 'quick' ? 'active' : ''}`}
          onClick={() => setSlice('quick')}
        >
          <span>⚡ Быстрый чек</span>
          <span className="slice-count">{sliceCounts.quick}</span>
        </button>
        <button
          type="button"
          className={`slice-pill ${slice === 'bots' ? 'active' : ''}`}
          onClick={() => setSlice('bots')}
        >
          <span>🔵 Боты &amp; Парсеры</span>
          <span className="slice-count">{sliceCounts.bots}</span>
        </button>
        <button
          type="button"
          className={`slice-pill ${slice === 'web' ? 'active' : ''}`}
          onClick={() => setSlice('web')}
        >
          <span>🟢 Сайты / Web</span>
          <span className="slice-count">{sliceCounts.web}</span>
        </button>
        <button
          type="button"
          className={`slice-pill ${slice === 'cms' ? 'active' : ''}`}
          onClick={() => setSlice('cms')}
        >
          <span>🟠 CMS &amp; CRM</span>
          <span className="slice-count">{sliceCounts.cms}</span>
        </button>
        {sliceCounts.replied > 0 && (
          <button
            type="button"
            className={`slice-pill ${slice === 'replied' ? 'active' : ''}`}
            onClick={() => setSlice('replied')}
          >
            <span>💬 Есть ответ</span>
            <span className="slice-count">{sliceCounts.replied}</span>
          </button>
        )}
      </div>

      <div className="stream-toolbar">
        <div className="input-wrap">
          <Search size={14} />
          <input
            ref={searchRef}
            className="input"
            placeholder="Название, компания, стек…  /"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select className="select" value={category} onChange={(event) => setCategory(event.target.value)} title="Стрим / Направление">
          <option value="all">Все стримы</option>
          {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}
        </select>

        <select className="select" value={source} onChange={(event) => setSource(event.target.value)} title="Источник">
          <option value="all">Все источники</option>
          {SOURCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>

        <select className="select" value={stage} onChange={(event) => setStage(event.target.value)} title="Стадия">
          <option value="all">Все стадии</option>
          {STAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>

        <select className="select" value={minScore} onChange={(event) => setMinScore(event.target.value)} title="Минимальная оценка">
          <option value="0">Любая оценка</option>
          <option value="60">от 60%</option>
          <option value="75">от 75%</option>
          <option value="85">от 85%</option>
        </select>

        <select className="select" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} title="Сортировка">
          <option value="score">Сначала сильные</option>
          <option value="newest">Сначала новые</option>
          <option value="updated">По обновлению</option>
        </select>

        <span className="spacer" />
        <span className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <SlidersHorizontal size={12} /> {filtered.length} из {leads.length}
        </span>
      </div>

      {loading && leads.length === 0 ? (
        <div className="skeleton" style={{ height: 420 }} />
      ) : filtered.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Inbox size={18} />}
            title="Под эти фильтры ничего не подходит"
            hint="Сбрось фильтры или запусти новый сбор — поток обновится."
            action={<button type="button" className="btn btn-sm mt-8" onClick={resetFilters}>Сбросить фильтры</button>}
          />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 64 }}>Мэтч</th>
                  <th>Лид</th>
                  <th className="col-source" style={{ width: 92 }}>Источник</th>
                  <th className="col-money" style={{ width: 150 }}>Бюджет</th>
                  <th style={{ width: 150 }}>Стадия</th>
                  <th className="col-next" style={{ width: 130 }}>След. шаг</th>
                  <th className="col-updated" style={{ width: 106 }}>Активность</th>
                  <th style={{ width: 92 }} />
                </tr>
              </thead>
              <tbody ref={tableRef}>
                {filtered.map((lead, index) => (
                  <tr
                    key={lead.id}
                    data-index={index}
                    onClick={() => onOpenLead(lead.id)}
                    style={index === cursor ? { background: '#f7f6fe' } : undefined}
                  >
                    <td><ScoreRing score={lead.match_score} /></td>
                    <td>
                      <div className="cell-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <UrgencyTrafficLight urgency={lead.urgency} />
                          <span className="row-title">{lead.title}</span>
                        </div>
                        <span className="row-sub">
                          <span className="truncate">{lead.company || 'Без компании'}</span>
                          <span className="sep">·</span>
                          <CategoryBadge category={lead.category} />
                          {lead.deal_type && (
                            <>
                              <span className="sep">·</span>
                              <DealTypeBadge dealType={lead.deal_type} />
                            </>
                          )}
                          {lead.priority === 'high' && (
                            <><span className="sep">·</span><span style={{ color: '#bf3f3f', fontWeight: 600 }}>высокий</span></>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="col-source"><SourceBadge source={lead.source} /></td>
                    <td className="col-money num">{formatSalary(lead)}</td>
                    <td>
                      <select
                        className={`stage-select tone-${STAGE_MAP[lead.status]?.tone ?? 'gray'}`}
                        value={lead.status}
                        title="Сменить стадию"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onChangeStatus(lead, event.target.value as LeadStatus)}
                      >
                        {STAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </td>
                    <td className="col-next">
                      {lead.next_action_at
                        ? <DueLabel value={lead.next_action_at} />
                        : <span className="tiny muted">—</span>}
                    </td>
                    <td className="col-updated">
                      <span className="tiny muted">{relativeTime(lead.updated_at)}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn sm"
                          title="Открыть в студии офферов"
                          onClick={(event) => {
                            event.stopPropagation();
                            onStudio(lead.id);
                          }}
                        >
                          <PenLine size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn sm"
                          title="Открыть оригинал"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (lead.url && lead.url !== '#') window.open(lead.url, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="stream-foot">
            <span>
              <strong>{filtered.length}</strong> {plural(filtered.length, ['лид', 'лида', 'лидов'])} · средний мэтч{' '}
              <strong>{Math.round(filtered.reduce((sum, lead) => sum + lead.match_score, 0) / filtered.length)}%</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <kbd className="kbd">J</kbd><kbd className="kbd">K</kbd> навигация
              <kbd className="kbd">↵</kbd> открыть
            </span>
          </div>
        </>
      )}
    </div>
  );
}
