import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ManualLeadPayload } from '../../api';
import { SOURCES } from '../lib';
import { Spinner } from './ui';

interface ManualLeadModalProps {
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: ManualLeadPayload) => Promise<unknown>;
}

const EMPTY = {
  title: '',
  company: '',
  source: 'direct',
  contact_info: '',
  salary_raw: '',
  url: '',
  description: '',
  priority: 'normal',
};

export function ManualLeadModal({ busy, onClose, onCreate }: ManualLeadModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        title: form.title.trim(),
        company: form.company.trim() || undefined,
        source: form.source,
        contact_info: form.contact_info.trim() || undefined,
        salary_raw: form.salary_raw.trim() || undefined,
        url: form.url.trim() || undefined,
        description: form.description.trim() || 'Добавлено вручную, без описания.',
        priority: form.priority,
        match_score: 65,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Новый лид">
        <div className="modal-head">
          <div>
            <div className="modal-title">Добавить лид вручную</div>
            <div className="modal-sub">Тёплый контакт, реферал, чат, знакомый фаундер</div>
          </div>
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Закрыть"><X size={14} /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label className="field-label">Что нужно сделать <span>обязательно</span></label>
            <input
              className="input"
              placeholder="Например: Telegram-бот с оплатой для сети кофеен"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              autoFocus
            />
          </div>

          <div className="field-grid">
            <div className="field">
              <label className="field-label">Компания / имя</label>
              <input className="input" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
            </div>
            <div className="field">
              <label className="field-label">Источник</label>
              <select className="select" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
                {SOURCES.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Контакт</label>
              <input
                className="input"
                placeholder="@username, email, телефон"
                value={form.contact_info}
                onChange={(event) => setForm({ ...form, contact_info: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">Бюджет</label>
              <input
                className="input"
                placeholder="85 000 ₽ / мес"
                value={form.salary_raw}
                onChange={(event) => setForm({ ...form, salary_raw: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">Ссылка</label>
              <input
                className="input"
                placeholder="https://…"
                value={form.url}
                onChange={(event) => setForm({ ...form, url: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">Приоритет</label>
              <select className="select" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option value="high">Высокий</option>
                <option value="normal">Обычный</option>
                <option value="low">Низкий</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Контекст задачи <span>что известно из переписки</span></label>
            <textarea
              className="textarea"
              rows={5}
              placeholder="Задача, стек, сроки, ожидания. Чем больше деталей — тем точнее оффер."
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={saving || busy || !form.title.trim()}
          >
            {saving ? <Spinner size={13} /> : <Plus size={13} />} Добавить в поток
          </button>
        </div>
      </div>
    </div>
  );
}
