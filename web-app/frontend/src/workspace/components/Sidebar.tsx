import React from 'react';
import {
  BookOpen, ChevronDown, Columns3, Inbox, KeyRound, PenLine, Plus, Plug, Sparkles, Sunrise,
} from 'lucide-react';
import { ScraperKey, WorkspaceOverview } from '../../types';
import { SOURCE_MAP, formatMoney } from '../lib';
import { Spinner } from './ui';

export type WorkspaceView = 'today' | 'stream' | 'funnel' | 'studio' | 'knowledge' | 'accounts' | 'settings';

const NAV: { id: WorkspaceView; label: string; icon: React.ElementType }[] = [
  { id: 'today', label: 'Сегодня', icon: Sunrise },
  { id: 'stream', label: 'Поток лидов', icon: Inbox },
  { id: 'funnel', label: 'Воронка', icon: Columns3 },
  { id: 'studio', label: 'Студия офферов', icon: PenLine },
  { id: 'knowledge', label: 'База знаний', icon: BookOpen },
  { id: 'accounts', label: 'Аккаунты', icon: KeyRound },
  { id: 'settings', label: 'Источники', icon: Plug },
];

const SOURCE_SCRAPER: Record<string, ScraperKey | null> = {
  'hh.ru': 'hh',
  telegram: 'tg',
  habr_freelance: 'freelance',
  fl_ru: 'freelance',
  kwork: 'freelance',
  avito: 'avito',
  direct: null,
};

interface SidebarProps {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  counts: Record<WorkspaceView, number | undefined>;
  overview: WorkspaceOverview | null;
  busy: Record<string, boolean>;
  onRunSource: (key: ScraperKey) => void;
}

export function Sidebar({ view, onNavigate, counts, overview, busy, onRunSource }: SidebarProps) {
  const mrr = overview?.mrr;
  const progress = mrr && mrr.target > 0 ? Math.min(100, Math.round((mrr.current / mrr.target) * 100)) : 0;
  const sources = overview?.sources ?? [];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo"><Sparkles size={17} strokeWidth={2.2} /></div>
        <div className="brand-text">
          <strong>job machine</strong>
          <span>OFFER CONTROL</span>
        </div>
      </div>

      <button className="workspace-card" type="button" title="Личное пространство">
        <span className="ws-avatar">И</span>
        <span className="ws-copy">
          <strong>Моя студия</strong>
          <span>Личный поток офферов</span>
        </span>
        <ChevronDown size={14} color="#9a9dab" />
      </button>

      <div className="side-scroll">
        <div className="side-label">Рабочее пространство</div>
        <nav className="nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${view === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={16} strokeWidth={1.9} />
                <span>{item.label}</span>
                {count !== undefined && count > 0 && <small className="nav-count">{count}</small>}
              </button>
            );
          })}
        </nav>

        <div className="side-label">Источники</div>
        <div className="side-sources">
          {sources.map((source) => {
            const meta = SOURCE_MAP[source.source] ?? { label: source.source, tone: 'direct' };
            const scraper = SOURCE_SCRAPER[source.source] ?? null;
            const running = scraper ? Boolean(busy[`scraper-${scraper}`]) : false;
            return (
              <button
                key={source.source}
                type="button"
                className="source-item"
                title={scraper ? `Собрать заново: ${meta.label}` : 'Добавляется вручную'}
                onClick={() => scraper && onRunSource(scraper)}
                disabled={!scraper || running}
              >
                <span className={`source-dot ${meta.tone}`} />
                <span className="source-name">{meta.label}</span>
                <span className="source-meta" title={`${source.new} новых`}>
                  {running ? <Spinner size={11} /> : source.total}
                </span>
                {scraper && !running && <Plus size={12} className="source-plus" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="side-footer">
        <div className="goal">
          <div className="goal-head">
            <span>ЦЕЛЬ ПО MRR</span>
            <strong>{progress}%</strong>
          </div>
          <div className="goal-bar">
            <div className="goal-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="goal-foot">
            {formatMoney(mrr?.current)} из {formatMoney(mrr?.target)}
          </div>
        </div>
        <div className="user">
          <span className="avatar">И</span>
          <span className="user-copy">
            <strong>Игорь</strong>
            <span>Основатель · solo</span>
          </span>
          <span className="user-badge">HQ</span>
        </div>
      </div>
    </aside>
  );
}
