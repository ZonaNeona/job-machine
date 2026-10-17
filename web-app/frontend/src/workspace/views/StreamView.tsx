import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Inbox, PenLine, Search, SlidersHorizontal } from 'lucide-react';
import { Lead, LeadStatus } from '../../types';
import { SOURCES, STAGE_MAP, STAGES, formatSalary, plural, relativeTime } from '../lib';
import { DueLabel, EmptyState, ScoreRing, SourceBadge } from '../components/ui';

interface StreamViewProps {
  leads: Lead[];
  loading: boolean;
  onOpenLead: (id: number) => void;
  onStudio: (id: number) => void;
  onChangeStatus: (lead: Lead, status: LeadStatus) => void;
}

type SortMode = 'score' | 'newest' | 'updated';

export function StreamView({ leads, loading, onOpenLead, onStudio, onChangeStatus }: StreamViewProps) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [stage, setStage] = useState('all');
  const [minScore, setMinScore] = useState('0');
  const [sort, setSort] = useState<SortMode>('score');
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoreFloor = Number(minScore);
    return leads
      .filter((lead) => {
        if (query) {
          const haystack = [lead.title, lead.company, lead.tags, lead.description, lead.contact_info]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (source !== 'all' && lead.source !== source) return false;
        if (stage !== 'all' && lead.status !== stage) return false;
        if (lead.match_score < scoreFloor) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'newest') return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
        if (sort === 'updated') return (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0);
        return (b.match_score || 0) - (a.match_score || 0)
          || (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
      });
  }, [leads, search, source, stage, minScore, sort]);

  useEffect(() => { setCursor(0); }, [search, source, stage, minScore, sort]);

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
    setSearch('');
    setSource('all');
    setStage('all');
    setMinScore('0');
  };

  return (
    <div className="fade-in">
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
                        <span className="row-title">{lead.title}</span>
                        <span className="row-sub">
                          <span className="truncate">{lead.company || 'Без компании'}</span>
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
