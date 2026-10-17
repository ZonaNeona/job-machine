import React, { useMemo, useState } from 'react';
import { Archive, Columns3, PenLine, Search } from 'lucide-react';
import { Lead, LeadStatus } from '../../types';
import { SOURCES, STAGES, relativeTime, scoreTone } from '../lib';
import { DueLabel, SourceBadge } from '../components/ui';

interface FunnelViewProps {
  leads: Lead[];
  onOpenLead: (id: number) => void;
  onStudio: (id: number) => void;
  onChangeStatus: (lead: Lead, status: LeadStatus) => void;
}

export function FunnelView({ leads, onOpenLead, onStudio, onChangeStatus }: FunnelViewProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [showArchive, setShowArchive] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (source !== 'all' && lead.source !== source) return false;
      if (!query) return true;
      return `${lead.title} ${lead.company ?? ''} ${lead.tags ?? ''}`.toLowerCase().includes(query);
    });
  }, [leads, search, source]);

  const columns = showArchive ? STAGES : STAGES.filter((stage) => stage.id !== 'archived');
  const draggingLead = leads.find((lead) => lead.id === dragging) ?? null;

  const handleDrop = (status: LeadStatus) => {
    setOverStage(null);
    if (!draggingLead || draggingLead.status === status) {
      setDragging(null);
      return;
    }
    onChangeStatus(draggingLead, status);
    setDragging(null);
  };

  return (
    <div className="fade-in">
      <div className="stream-toolbar">
        <div className="input-wrap">
          <Search size={14} />
          <input
            className="input"
            placeholder="Найти в воронке…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">Все источники</option>
          {SOURCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>

        <button
          type="button"
          className={`chip ${showArchive ? 'active' : ''}`}
          onClick={() => setShowArchive((prev) => !prev)}
        >
          <Archive size={12} /> Архив
        </button>

        <span className="spacer" />
        <span className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Columns3 size={12} /> Перетащи карточку, чтобы сменить стадию
        </span>
      </div>

      <div className="kanban">
        {columns.map((stage) => {
          const items = filtered
            .filter((lead) => lead.status === stage.id)
            .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
          const avg = items.length
            ? Math.round(items.reduce((sum, lead) => sum + lead.match_score, 0) / items.length)
            : 0;
          return (
            <section
              key={stage.id}
              className={`kanban-col ${overStage === stage.id ? 'over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((prev) => (prev === stage.id ? null : prev))}
              onDrop={() => handleDrop(stage.id)}
            >
              <div className="kanban-head">
                <span className={`kanban-dot tone-${stage.tone}`} />
                <span className="kanban-title">{stage.label}</span>
                <span className="kanban-count">{items.length}</span>
                {items.length > 0 && <span className="kanban-sum">ср. {avg}%</span>}
              </div>

              <div className="kanban-body">
                {items.length === 0 ? (
                  <div className="kanban-empty">Перетащи сюда</div>
                ) : items.map((lead) => (
                  <article
                    key={lead.id}
                    className={`kanban-card ${dragging === lead.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => { setDragging(null); setOverStage(null); }}
                    onClick={() => onOpenLead(lead.id)}
                  >
                    <div className="row between" style={{ alignItems: 'flex-start' }}>
                      <div className="kanban-card-title">{lead.title}</div>
                      <span className={`score-num ${scoreTone(lead.match_score)}`} style={{ marginLeft: 6, flexShrink: 0 }}>
                        {lead.match_score}
                      </span>
                    </div>
                    <div className="kanban-card-sub truncate">{lead.company || 'Без компании'}</div>
                    <div className="kanban-card-meta">
                      <SourceBadge source={lead.source} />
                      {lead.priority === 'high' && <span className="badge badge-priority high">Высокий</span>}
                    </div>
                    <div className="kanban-card-foot">
                      <span>{lead.next_action_at ? <DueLabel value={lead.next_action_at} /> : relativeTime(lead.updated_at)}</span>
                      <button
                        type="button"
                        className="icon-btn sm"
                        title="Открыть в студии"
                        onClick={(event) => {
                          event.stopPropagation();
                          onStudio(lead.id);
                        }}
                      >
                        <PenLine size={12} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
