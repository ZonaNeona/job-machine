import React, { useState } from 'react';
import { AlertCircle, Send, X } from 'lucide-react';
import { Lead } from '../../types';
import { SOURCE_MAP, contactTarget, formatSalary } from '../lib';
import { ScoreRing, Spinner } from './ui';

interface DispatchModalProps {
  lead: Lead;
  text: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: { channel: string; followUpDays: number }) => Promise<void>;
}

const FOLLOW_UP_OPTIONS = [1, 2, 3, 5, 7];

export function DispatchModal({ lead, text, busy, onClose, onConfirm }: DispatchModalProps) {
  const contact = contactTarget(lead);
  const [channel, setChannel] = useState(
    contact.kind !== 'none' ? contact.label : SOURCE_MAP[lead.source]?.label ?? lead.source,
  );
  const [followUp, setFollowUp] = useState(2);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const submit = async () => {
    await onConfirm({ channel, followUpDays: followUp });
  };

  return (
    <div className="overlay center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Подтверждение отправки">
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="modal-title">Зафиксировать отправку</div>
            <div className="modal-sub">{lead.title}</div>
          </div>
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Закрыть"><X size={14} /></button>
        </div>

        <div className="modal-body">
          <div className="row between" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 9, padding: '10px 12px' }}>
            <div className="row" style={{ gap: 9 }}>
              <ScoreRing score={lead.match_score} />
              <div>
                <div className="small" style={{ fontWeight: 600 }}>{lead.company || 'Без компании'}</div>
                <div className="tiny muted">{formatSalary(lead)} · {SOURCE_MAP[lead.source]?.label ?? lead.source}</div>
              </div>
            </div>
            <span className="status-pill warn">ручная отправка</span>
          </div>

          <div className="field">
            <label className="field-label">Черновик, который ты отправил</label>
            <div className="offer-preview" style={{ maxHeight: 220 }}>
              {text.trim() || 'Текст пуст — вернись в студию.'}
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label className="field-label">Канал</label>
              <input className="input" value={channel} onChange={(event) => setChannel(event.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Follow-up через</label>
              <select className="select" value={followUp} onChange={(event) => setFollowUp(Number(event.target.value))}>
                {FOLLOW_UP_OPTIONS.map((days) => (
                  <option key={days} value={days}>{days} дн.</option>
                ))}
              </select>
            </div>
          </div>

          <div className="ctx-note">
            <AlertCircle size={14} />
            <span>
              Система не отправляет сообщения сама. Она фиксирует факт отправки, ставит дату follow-up
              и записывает событие в журнал лида. Убедись, что текст уже ушёл заказчику.
            </span>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !text.trim()}>
            {busy ? <Spinner size={13} /> : <Send size={13} />} Подтвердить отправку
          </button>
        </div>
      </div>
    </div>
  );
}
