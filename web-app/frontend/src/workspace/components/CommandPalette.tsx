import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BookOpen, Columns3, Inbox, PenLine, Plug, Plus, Search, Sunrise, Zap,
} from 'lucide-react';
import { Lead } from '../../types';
import { SOURCE_MAP, formatSalary } from '../lib';
import type { WorkspaceView } from './Sidebar';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  onNavigate: (view: WorkspaceView) => void;
  onOpenLead: (id: number) => void;
  onRunAll: () => void;
  onAddLead: () => void;
}

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  open, onClose, leads, onNavigate, onOpenLead, onRunAll, onAddLead,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      { id: 'collect', group: 'Действия', label: 'Собрать свежие офферы', sub: 'Запустить все источники', icon: <Zap size={14} />, run: onRunAll },
      { id: 'add', group: 'Действия', label: 'Добавить лид вручную', sub: 'Тёплый контакт, реферал, переписка', icon: <Plus size={14} />, run: onAddLead },
      { id: 'studio', group: 'Действия', label: 'Открыть студию офферов', sub: 'Написать следующее предложение', icon: <PenLine size={14} />, run: () => onNavigate('studio') },
      { id: 'today', group: 'Перейти', label: 'Сегодня', icon: <Sunrise size={14} />, run: () => onNavigate('today') },
      { id: 'stream', group: 'Перейти', label: 'Поток лидов', icon: <Inbox size={14} />, run: () => onNavigate('stream') },
      { id: 'funnel', group: 'Перейти', label: 'Воронка', icon: <Columns3 size={14} />, run: () => onNavigate('funnel') },
      { id: 'knowledge', group: 'Перейти', label: 'База знаний', icon: <BookOpen size={14} />, run: () => onNavigate('knowledge') },
      { id: 'settings', group: 'Перейти', label: 'Источники и настройки', icon: <Plug size={14} />, run: () => onNavigate('settings') },
    ];

    const normalized = query.trim().toLowerCase();
    if (!normalized) return actions;

    const foundActions = actions.filter((item) => `${item.label} ${item.sub ?? ''}`.toLowerCase().includes(normalized));
    const foundLeads: PaletteItem[] = leads
      .filter((lead) => `${lead.title} ${lead.company ?? ''} ${lead.tags ?? ''}`.toLowerCase().includes(normalized))
      .slice(0, 6)
      .map((lead) => ({
        id: `lead-${lead.id}`,
        group: 'Лиды',
        label: lead.title,
        sub: `${lead.company || SOURCE_MAP[lead.source]?.label || lead.source} · ${formatSalary(lead)} · мэтч ${lead.match_score}%`,
        icon: <ArrowRight size={14} />,
        run: () => onOpenLead(lead.id),
      }));

    return [...foundActions, ...foundLeads];
  }, [query, leads, onNavigate, onOpenLead, onRunAll, onAddLead]);

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((prev) => Math.min(items.length - 1, prev + 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((prev) => Math.max(0, prev - 1));
      }
      if (event.key === 'Enter' && items[cursor]) {
        event.preventDefault();
        items[cursor].run();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, items, cursor, onClose]);

  if (!open) return null;

  return (
    <div className="overlay center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Командная палитра">
        <div className="palette-input-wrap">
          <Search size={16} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Найти лид, экран или действие…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd className="kbd">esc</kbd>
        </div>

        <div className="palette-list">
          {items.length === 0 && (
            <div className="empty" style={{ padding: '26px 12px' }}>
              <strong>Ничего не нашлось</strong>
              <span>Попробуй компанию, стек или название экрана.</span>
            </div>
          )}
          {items.map((item, index) => {
            const showGroup = index === 0 || items[index - 1].group !== item.group;
            return (
              <React.Fragment key={item.id}>
                {showGroup && <div className="palette-group">{item.group}</div>}
                <button
                  type="button"
                  className={`palette-item ${index === cursor ? 'active' : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => { item.run(); onClose(); }}
                >
                  {item.icon}
                  <span className="pi-main">
                    <strong>{item.label}</strong>
                    {item.sub && <span>{item.sub}</span>}
                  </span>
                  <span className="pi-side">{index === cursor ? '↵' : ''}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="palette-foot">
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> выбор</span>
          <span><kbd className="kbd">↵</kbd> открыть</span>
          <span><kbd className="kbd">esc</kbd> закрыть</span>
        </div>
      </div>
    </div>
  );
}
