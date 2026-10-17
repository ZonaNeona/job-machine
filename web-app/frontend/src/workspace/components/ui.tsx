import React from 'react';
import { LeadStatus, Priority } from '../../types';
import { SOURCE_MAP, STAGE_MAP, formatDue, scoreTone } from '../lib';

export function ScoreRing({ score, size = 24 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <span className="score" title={`Соответствие профилю: ${score}%`}>
      <svg className={`score-ring ${tone}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={`score-num ${tone}`}>{score}</span>
    </span>
  );
}

export function SourceBadge({ source, full = false }: { source: string; full?: boolean }) {
  const meta = SOURCE_MAP[source] ?? { label: source, short: source, tone: 'direct' };
  return <span className={`badge badge-source tone-${meta.tone}`}>{full ? meta.label : meta.short}</span>;
}

export function StageBadge({ status }: { status: LeadStatus }) {
  const meta = STAGE_MAP[status] ?? STAGE_MAP.new;
  return (
    <span className={`badge badge-stage tone-${meta.tone}`}>
      <span className="dot" />
      {meta.short}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority || priority === 'normal') return null;
  return (
    <span className={`badge badge-priority ${priority}`}>
      {priority === 'high' ? 'Высокий' : 'Низкий'}
    </span>
  );
}

export function DueLabel({ value }: { value?: string | null }) {
  const due = formatDue(value);
  return (
    <span className={`due ${due.overdue ? 'overdue' : due.soon ? 'soon' : ''}`}>
      {due.label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}

export function SectionHead({
  title,
  count,
  sub,
  action,
}: {
  title: string;
  count?: number;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <div className="section-title">
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </div>
        {sub && <div className="section-sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" />
    </svg>
  );
}

export const PRIORITY_LABEL: Record<string, string> = { high: 'Высокий', normal: 'Обычный', low: 'Низкий' };
export const PRIORITY_TONE: Record<string, string> = { high: 'high', normal: 'normal', low: 'low' };
