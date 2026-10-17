import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Ban, Bot, Check, Copy, ExternalLink, FileText, LoaderCircle, Mail, PenLine, Send, Sparkles, X,
} from 'lucide-react';
import { api, LeadPatch } from '../../api';
import { Lead, LeadEvent, LeadStatus } from '../../types';
import {
  CATEGORIES, DEAL_TYPES, SOURCE_MAP, STAGES, STAGE_MAP, contactTarget, formatDateTime, formatSalary, parseDate, parseTags, relativeTime,
} from '../lib';
import { CategoryBadge, DealTypeBadge, DirectContactsBadge, DueLabel, PriorityBadge, ScoreRing, SourceBadge, SweetSpotBadge, UrgencyTrafficLight } from '../components/ui';

interface LeadDrawerProps {
  lead: Lead;
  onClose: () => void;
  onSave: (lead: Lead, patch: LeadPatch) => Promise<unknown>;
  onChangeStatus: (lead: Lead, status: LeadStatus) => void;
  onStudio: (id: number) => void;
  onOpenCopilot?: (leadId: number) => void;
  notify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type DrawerTab = 'overview' | 'offer' | 'history';

const EVENT_LABEL: Record<string, string> = {
  created: 'Лид добавлен',
  status_changed: 'Смена стадии',
  offer_generated: 'Оффер сгенерирован',
  offer_saved: 'Черновик сохранён',
  dispatched: 'Отправка зафиксирована',
  field_updated: 'Обновлены поля',
  score_changed: 'Изменена оценка',
};

const toDateInput = (value?: string | null) => {
  const date = parseDate(value);
  if (!date) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export function LeadDrawer({ lead, onClose, onSave, onChangeStatus, onStudio, notify }: LeadDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [events, setEvents] = useState<LeadEvent[] | null>(null);
  const [form, setForm] = useState({
    contact_info: lead.contact_info ?? '',
    salary_raw: lead.salary_raw ?? '',
    priority: lead.priority ?? 'normal',
    category: lead.category ?? 'ai',
    deal_type: lead.deal_type ?? 'retainer',
    next_action_at: toDateInput(lead.next_action_at),
    custom_notes: lead.custom_notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      contact_info: lead.contact_info ?? '',
      salary_raw: lead.salary_raw ?? '',
      priority: lead.priority ?? 'normal',
      category: lead.category ?? 'ai',
      deal_type: lead.deal_type ?? 'retainer',
      next_action_at: toDateInput(lead.next_action_at),
      custom_notes: lead.custom_notes ?? '',
    });
  }, [lead.id, lead.contact_info, lead.salary_raw, lead.priority, lead.category, lead.deal_type, lead.next_action_at, lead.custom_notes]);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    api.getLeadEvents(lead.id)
      .then((rows) => { if (!cancelled) setEvents(rows); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [lead.id, lead.updated_at]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const directContacts = useMemo(() => {
    if (!lead.direct_contacts_json) return null;
    try {
      return JSON.parse(lead.direct_contacts_json);
    } catch {
      return null;
    }
  }, [lead.direct_contacts_json]);

  const handleBlacklist = async () => {
    if (!lead.company) return;
    if (!window.confirm(`Заблокировать заказчика "${lead.company}" (${lead.source})? Все его будущие заказы будут автоматически скрыты.`)) return;
    try {
      await api.blacklistEmployer(lead.source, lead.company, lead.company, 'Заблокирован пользователем из карточки лида');
      notify(`Заказчик "${lead.company}" добавлен в черный список`, 'info');
    } catch {
      notify('Не удалось добавить в черный список', 'error');
    }
  };

  const contact = contactTarget(lead);
  const tags = parseTags(lead.tags);
  const stageIndex = STAGES.findIndex((stage) => stage.id === lead.status);

  const dirty = useMemo(() => (
    form.contact_info !== (lead.contact_info ?? '')
    || form.salary_raw !== (lead.salary_raw ?? '')
    || form.priority !== (lead.priority ?? 'normal')
    || form.category !== (lead.category ?? 'ai')
    || form.deal_type !== (lead.deal_type ?? 'retainer')
    || form.next_action_at !== toDateInput(lead.next_action_at)
    || form.custom_notes !== (lead.custom_notes ?? '')
  ), [form, lead]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(lead, {
        contact_info: form.contact_info || null,
        salary_raw: form.salary_raw || null,
        priority: form.priority,
        category: form.category,
        deal_type: form.deal_type,
        next_action_at: form.next_action_at ? new Date(`${form.next_action_at}T09:00:00`).toISOString() : null,
        custom_notes: form.custom_notes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const copyContact = async () => {
    if (!lead.contact_info) return;
    try {
      await navigator.clipboard.writeText(lead.contact_info);
      notify('Контакт скопирован');
    } catch {
      notify('Браузер не дал доступ к буферу', 'error');
    }
  };

  const copyOffer = async () => {
    if (!lead.generated_offer) return;
    try {
      await navigator.clipboard.writeText(lead.generated_offer);
      notify('Текст оффера скопирован');
    } catch {
      notify('Браузер не дал доступ к буферу', 'error');
    }
  };

  return (
    <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={lead.title}>
        <div className="drawer-head">
          <div className="drawer-head-top">
            <div style={{ minWidth: 0 }}>
              <div className="drawer-eyebrow">
                <ScoreRing score={lead.match_score} />
                <span>#{lead.id}</span>
                <span>·</span>
                <SourceBadge source={lead.source} />
              </div>
              <h2 className="drawer-title">{lead.title}</h2>
              <div className="drawer-company">
                {lead.company || 'Компания не указана'} · {formatSalary(lead)}
              </div>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть"><X size={16} /></button>
          </div>

          <div className="drawer-badges">
            <UrgencyTrafficLight urgency={lead.urgency} />
            <SweetSpotBadge score={lead.sweet_spot_score} hours={lead.estimated_hours} />
            <DirectContactsBadge contactsJson={lead.direct_contacts_json} />
            <CategoryBadge category={lead.category} full />
            <DealTypeBadge dealType={lead.deal_type} />
            <span className={`badge badge-stage tone-${STAGE_MAP[lead.status]?.tone ?? 'gray'}`}>
              {STAGE_MAP[lead.status]?.label ?? lead.status}
            </span>
            <PriorityBadge priority={lead.priority} />
            <span className="badge">{relativeTime(lead.updated_at)}</span>
            {lead.next_action_at && <DueLabel value={lead.next_action_at} />}
          </div>
        </div>

        <div className="drawer-tabs">
          <button type="button" className={`drawer-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            Обзор
          </button>
          <button type="button" className={`drawer-tab ${tab === 'offer' ? 'active' : ''}`} onClick={() => setTab('offer')}>
            Оффер
          </button>
          <button type="button" className={`drawer-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            История
          </button>
        </div>

        <div className="drawer-body">
          {tab === 'overview' && (
            <>
              <div className="stepper">
                {STAGES.map((stage, index) => (
                  <button
                    key={stage.id}
                    type="button"
                    className={`step ${stage.id === lead.status ? 'current' : index < stageIndex ? 'done' : ''}`}
                    onClick={() => onChangeStatus(lead, stage.id)}
                  >
                    {stage.short}
                  </button>
                ))}
              </div>

              {directContacts && (directContacts.telegram?.length > 0 || directContacts.email?.length > 0 || directContacts.phone?.length > 0) && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#166534', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚡ Прямой контакт в обход биржи</span>
                    </span>
                    <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Без комиссии</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {directContacts.telegram?.map((tg: string) => (
                      <a
                        key={tg}
                        href={`https://t.me/${tg.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-primary"
                        style={{ height: 30, fontSize: 12, textDecoration: 'none' }}
                      >
                        ✈️ Telegram {tg}
                      </a>
                    ))}
                    {directContacts.email?.map((em: string) => (
                      <a
                        key={em}
                        href={`mailto:${em}`}
                        className="btn btn-sm"
                        style={{ height: 30, fontSize: 12, textDecoration: 'none' }}
                      >
                        ✉️ Email {em}
                      </a>
                    ))}
                    {directContacts.phone?.map((ph: string) => (
                      <a
                        key={ph}
                        href={`tel:${ph}`}
                        className="btn btn-sm"
                        style={{ height: 30, fontSize: 12, textDecoration: 'none' }}
                      >
                        📞 {ph}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {onOpenCopilot && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ flex: 1, height: 34, fontSize: 12, background: '#f8fafc', borderColor: '#cbd5e1' }}
                    onClick={() => onOpenCopilot(lead.id)}
                  >
                    <Bot size={14} color="#0284c7" /> Спросить Копилота о лиде
                  </button>
                )}
                {lead.company && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ height: 34, fontSize: 12, color: '#991b1b', borderColor: '#fecaca', background: '#fff' }}
                    title="Заблокировать заказчика на этой площадке"
                    onClick={handleBlacklist}
                  >
                    <Ban size={13} /> В бан
                  </button>
                )}
              </div>

              <div className="ctx-block">
                <div className="ctx-label">Параметры</div>
                <div className="ctx-facts">
                  <div className="ctx-fact"><span>Добавлен</span><strong>{formatDateTime(lead.created_at)}</strong></div>
                  <div className="ctx-fact"><span>Обновлён</span><strong>{formatDateTime(lead.updated_at)}</strong></div>
                  <div className="ctx-fact"><span>Формат</span><strong>{lead.job_type || 'Не указан'}</strong></div>
                  <div className="ctx-fact"><span>Локация</span><strong>{lead.location || 'Не указана'}</strong></div>
                </div>
              </div>

              <div className="ctx-block">
                <div className="ctx-label">Твои поля</div>
                <div className="field-grid">
                  <div className="field">
                    <label className="field-label">Контакт</label>
                    <div className="input-wrap">
                      <Mail size={13} />
                      <input
                        className="input sm"
                        value={form.contact_info}
                        placeholder="@username, email или ссылка"
                        onChange={(event) => setForm({ ...form, contact_info: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Бюджет</label>
                    <input
                      className="input sm"
                      value={form.salary_raw}
                      placeholder="80 000 ₽ / мес"
                      onChange={(event) => setForm({ ...form, salary_raw: event.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Приоритет</label>
                    <select
                      className="select sm"
                      value={form.priority}
                      onChange={(event) => setForm({ ...form, priority: event.target.value })}
                    >
                      <option value="high">Высокий</option>
                      <option value="normal">Обычный</option>
                      <option value="low">Низкий</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Стрим (направление)</label>
                    <select
                      className="select sm"
                      value={form.category}
                      onChange={(event) => setForm({ ...form, category: event.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Тип чека</label>
                    <select
                      className="select sm"
                      value={form.deal_type}
                      onChange={(event) => setForm({ ...form, deal_type: event.target.value })}
                    >
                      {DEAL_TYPES.map((d) => (
                        <option key={d.id} value={d.id}>{d.badge}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Следующий шаг</label>
                    <input
                      className="input sm"
                      type="date"
                      value={form.next_action_at}
                      onChange={(event) => setForm({ ...form, next_action_at: event.target.value })}
                    />
                  </div>
                  <div className="field full">
                    <label className="field-label">Заметки <span>только для тебя</span></label>
                    <textarea
                      className="textarea"
                      rows={3}
                      style={{ minHeight: 70 }}
                      value={form.custom_notes}
                      placeholder="Что важно помнить: имя, контекст, обещания…"
                      onChange={(event) => setForm({ ...form, custom_notes: event.target.value })}
                    />
                  </div>
                </div>

                <div className="row wrap" style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || saving}>
                    {saving ? <LoaderCircle size={12} className="spin" /> : <Check size={12} />} Сохранить поля
                  </button>
                  {contact.href && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => window.open(contact.href, '_blank', 'noopener,noreferrer')}
                    >
                      {contact.kind === 'telegram' ? <Send size={12} /> : <ExternalLink size={12} />} {contact.label}
                    </button>
                  )}
                  {lead.contact_info && (
                    <button type="button" className="icon-btn sm" title="Скопировать контакт" onClick={copyContact}>
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </div>

              {lead.scoring_reason && (
                <div className="ctx-block">
                  <div className="ctx-label">Почему подходит</div>
                  <div className="ctx-note"><FileText size={13} /><span>{lead.scoring_reason}</span></div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="ctx-block">
                  <div className="ctx-label">Теги</div>
                  <div className="ctx-tags">{tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
                </div>
              )}

              <div className="ctx-block">
                <div className="ctx-label">Описание задачи</div>
                <div className="ctx-desc" style={{ maxHeight: 'none' }}>{lead.description || 'Описание отсутствует.'}</div>
              </div>
            </>
          )}

          {tab === 'offer' && (
            lead.generated_offer?.trim() ? (
              <>
                <div className="row between mb-12">
                  <span className="ctx-label" style={{ margin: 0 }}>Черновик предложения</span>
                  <button type="button" className="btn btn-sm" onClick={copyOffer}>
                    <Copy size={12} /> Копировать
                  </button>
                </div>
                <div className="offer-preview">{lead.generated_offer}</div>
                <div className="row mt-12">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onStudio(lead.id)}>
                    <PenLine size={12} /> Редактировать в студии
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <div className="empty-icon"><FileText size={17} /></div>
                <strong>Оффера ещё нет</strong>
                <span>Открой студию: контекст задачи уже под рукой.</span>
                <button type="button" className="btn btn-primary btn-sm mt-8" onClick={() => onStudio(lead.id)}>
                  <PenLine size={12} /> Открыть в студии
                </button>
              </div>
            )
          )}

          {tab === 'history' && (
            <div className="event-list">
              <div className="event-row">
                <span className="event-dot" />
                <div className="event-main">
                  <div className="event-text"><strong>Лид появился в системе</strong> · {SOURCE_MAP[lead.source]?.label ?? lead.source}</div>
                  <div className="event-time">{formatDateTime(lead.created_at)}</div>
                </div>
              </div>
              {events === null && (
                <div className="event-row">
                  <span className="event-dot" />
                  <div className="event-main">
                    <div className="skeleton" style={{ height: 12, width: 220 }} />
                    <div className="skeleton" style={{ height: 9, width: 90, marginTop: 6 }} />
                  </div>
                </div>
              )}
              {events?.map((event) => (
                <div className="event-row" key={event.id}>
                  <span className={`event-dot ${event.kind}`} />
                  <div className="event-main">
                    <div className="event-text">
                      <strong>{EVENT_LABEL[event.kind] ?? event.kind}</strong>
                      {event.message ? ` · ${event.message}` : ''}
                    </div>
                    <div className="event-time">{formatDateTime(event.created_at)}</div>
                  </div>
                </div>
              ))}
              {events?.length === 0 && (
                <div className="tiny muted" style={{ padding: '10px 0' }}>
                  Журнал начнёт заполняться, как только ты изменишь стадию или сохранишь оффер.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <button type="button" className="btn btn-primary" onClick={() => onStudio(lead.id)}>
            <PenLine size={13} /> Открыть в студии
          </button>
          <span className="grow" />
          {lead.url && lead.url !== '#' && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.open(lead.url as string, '_blank', 'noopener,noreferrer')}
            >
              Оригинал <ExternalLink size={12} />
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Закрыть</button>
        </div>
      </aside>
    </div>
  );
}
