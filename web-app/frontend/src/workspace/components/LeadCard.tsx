import React from 'react';
import { Building2, PenLine } from 'lucide-react';
import { Lead } from '../../types';
import { formatSalary, relativeTime } from '../lib';
import { PriorityBadge, ScoreRing, SourceBadge, StageBadge } from './ui';

interface LeadCardProps {
  lead: Lead;
  onOpen: (lead: Lead) => void;
  onStudio?: (lead: Lead) => void;
}

export function LeadCard({ lead, onOpen, onStudio }: LeadCardProps) {
  return (
    <article
      className="lead-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(lead);
        }
      }}
    >
      <div className="lead-card-top">
        <div style={{ minWidth: 0 }}>
          <div className="lead-card-title">{lead.title}</div>
          <div className="lead-card-company">
            <Building2 size={11} />
            <span className="truncate">{lead.company || 'Компания не указана'}</span>
          </div>
        </div>
        <ScoreRing score={lead.match_score} />
      </div>

      <div className="lead-card-meta">
        <SourceBadge source={lead.source} />
        <StageBadge status={lead.status} />
        <PriorityBadge priority={lead.priority} />
      </div>

      <div className="lead-card-foot">
        <span className="money">{formatSalary(lead)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {relativeTime(lead.created_at)}
          {onStudio && lead.status !== 'sent' && (
            <button
              type="button"
              className="icon-btn sm"
              title="Открыть в студии офферов"
              onClick={(event) => {
                event.stopPropagation();
                onStudio(lead);
              }}
            >
              <PenLine size={12} />
            </button>
          )}
        </span>
      </div>
    </article>
  );
}
