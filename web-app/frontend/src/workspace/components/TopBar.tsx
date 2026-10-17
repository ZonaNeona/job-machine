import React from 'react';
import { ChevronRight, Command, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { MOD_LABEL } from '../lib';
import { Spinner } from './ui';

interface TopBarProps {
  title: string;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onAddLead: () => void;
}

export function TopBar({ title, refreshing, onRefresh, onOpenPalette, onOpenSettings, onAddLead }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="crumbs">
        <span>Рабочее пространство</span>
        <ChevronRight size={13} />
        <span className="crumb-current">{title}</span>
      </div>

      <button type="button" className="search-trigger" onClick={onOpenPalette}>
        <Command size={14} />
        <span>Найти лид или действие…</span>
        <kbd className="kbd">{MOD_LABEL} K</kbd>
      </button>

      <div className="topbar-actions">
        <button type="button" className="icon-btn" title="Добавить лид вручную" onClick={onAddLead}>
          <Plus size={16} />
        </button>
        <button type="button" className="icon-btn" title="Обновить данные" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Spinner size={15} /> : <RefreshCw size={15} />}
        </button>
        <button type="button" className="icon-btn" title="Источники и настройки" onClick={onOpenSettings}>
          <Settings2 size={16} />
        </button>
        <span className="avatar" title="Игорь · личное пространство">И</span>
      </div>
    </header>
  );
}
