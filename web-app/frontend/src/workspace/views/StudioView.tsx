import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCopy, ExternalLink, FileText,
  Info, LoaderCircle, PenLine, Search, Send, Sparkles, Target,
} from 'lucide-react';
import { Lead, LeadStatus, OfferAngle, OfferLength } from '../../types';
import {
  ANGLES, LENGTHS, MOD_LABEL, SOURCE_MAP, STAGE_MAP, contactTarget, formatSalary, parseTags, relativeTime,
} from '../lib';
import { analyzeOffer } from '../offerReview';
import { ScoreRing, Spinner } from '../components/ui';

interface StudioViewProps {
  leads: Lead[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  angle: OfferAngle;
  length: OfferLength;
  onAngleChange: (value: OfferAngle) => void;
  onLengthChange: (value: OfferLength) => void;
  generating: boolean;
  saving: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onCopy: () => void;
  onOpenContact: (lead: Lead) => void;
  onRequestSend: (lead: Lead) => void;
  onChangeStatus: (lead: Lead, status: LeadStatus) => void;
  onOpenLead: (id: number) => void;
}

type QueueTab = 'offer' | 'drafts' | 'all';

export function StudioView(props: StudioViewProps) {
  const {
    leads, selectedId, onSelect, draft, onDraftChange, instructions, onInstructionsChange,
    angle, length, onAngleChange, onLengthChange, generating, saving,
    onGenerate, onSave, onCopy, onOpenContact, onRequestSend, onChangeStatus, onOpenLead,
  } = props;

  const [queueTab, setQueueTab] = useState<QueueTab>('offer');
  const [queueSearch, setQueueSearch] = useState('');

  const queues = useMemo(() => ({
    offer: leads.filter((lead) => lead.status === 'new' || lead.status === 'ai_scored'),
    drafts: leads.filter((lead) => (lead.status === 'offer_generated' || lead.status === 'approved') && lead.generated_offer?.trim()),
    all: leads.filter((lead) => lead.status !== 'archived'),
  }), [leads]);

  const inQueue = (lead: Lead | null) => {
    if (!lead) return false;
    if (queueTab === 'offer') return lead.status === 'new' || lead.status === 'ai_scored';
    if (queueTab === 'drafts') return Boolean(lead.generated_offer?.trim());
    return lead.status !== 'archived';
  };

  const queue = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    return queues[queueTab]
      .filter((lead) => !query || `${lead.title} ${lead.company ?? ''}`.toLowerCase().includes(query))
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
  }, [queues, queueTab, queueSearch]);

  const selected = leads.find((lead) => lead.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected || !inQueue(selected)) {
      if (queue.length > 0) onSelect(queue[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueTab, queue.length, selectedId]);

  const review = useMemo(
    () => (selected ? analyzeOffer(draft, selected, leads) : null),
    [draft, selected, leads],
  );

  const contact = selected ? contactTarget(selected) : null;
  const tags = selected ? parseTags(selected.tags) : [];
  const stage = selected ? STAGE_MAP[selected.status] : null;

  return (
    <div className="studio fade-in">
      {/* -------------------------------- queue -------------------------------- */}
      <section className="studio-pane studio-queue">
        <div className="pane-head">
          <div className="pane-title">
            <PenLine size={13} /> Очередь <span className="n">{queue.length}</span>
          </div>
          <div className="pane-sub">Кому пишем следующим</div>
          <div className="queue-tabs">
            <button type="button" className={`queue-tab ${queueTab === 'offer' ? 'active' : ''}`} onClick={() => setQueueTab('offer')}>
              Без оффера
            </button>
            <button type="button" className={`queue-tab ${queueTab === 'drafts' ? 'active' : ''}`} onClick={() => setQueueTab('drafts')}>
              Черновики
            </button>
            <button type="button" className={`queue-tab ${queueTab === 'all' ? 'active' : ''}`} onClick={() => setQueueTab('all')}>
              Все
            </button>
          </div>
          <div className="queue-search input-wrap">
            <Search size={12} />
            <input
              className="input"
              placeholder="Поиск…"
              value={queueSearch}
              onChange={(event) => setQueueSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="queue-list">
          {queue.length === 0 && (
            <div className="empty" style={{ padding: '28px 10px' }}>
              <div className="empty-icon"><CheckCircle2 size={16} /></div>
              <strong>Очередь пуста</strong>
              <span>Запусти сбор или посмотри черновики.</span>
            </div>
          )}
          {queue.map((lead) => (
            <button
              key={lead.id}
              type="button"
              className={`queue-item ${lead.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(lead.id)}
            >
              <span className="queue-item-title">{lead.title}</span>
              <span className="queue-item-sub">
                <span className={`score-num ${lead.match_score >= 85 ? 'high' : lead.match_score >= 65 ? 'mid' : 'low'}`}>
                  {lead.match_score}%
                </span>
                <span className="sep">·</span>
                <span className="truncate">{lead.company || SOURCE_MAP[lead.source]?.label || lead.source}</span>
                {lead.generated_offer?.trim() && <FileText size={10} />}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ------------------------------- context ------------------------------- */}
      <section className="studio-pane studio-context-pane">
        {!selected ? (
          <div className="studio-empty">
            <div className="empty-icon"><Target size={18} /></div>
            <strong>Выбери лид слева</strong>
            <span>Покажу задачу, бюджет и контакт — и подготовим предложение.</span>
          </div>
        ) : (
          <>
            <div className="pane-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="pane-title"><FileText size={13} /> Контекст задачи</div>
                <div className="pane-sub">Только факты из объявления</div>
              </div>
              <ScoreRing score={selected.match_score} />
            </div>

            <div className="ctx">
              <div className="ctx-title">{selected.title}</div>
              <div className="ctx-company">
                <span>{selected.company || 'Компания не указана'}</span>
                <span>·</span>
                <span>{relativeTime(selected.created_at)}</span>
              </div>

              <div className="ctx-badges">
                <span className={`badge badge-source tone-${SOURCE_MAP[selected.source]?.tone ?? 'direct'}`}>
                  {SOURCE_MAP[selected.source]?.label ?? selected.source}
                </span>
                {stage && <span className={`badge badge-stage tone-${stage.tone}`}>{stage.label}</span>}
                {selected.priority === 'high' && <span className="badge badge-priority high">Высокий приоритет</span>}
              </div>

              <div className="ctx-block">
                <div className="ctx-label">Параметры</div>
                <div className="ctx-facts">
                  <div className="ctx-fact"><span>Бюджет</span><strong>{formatSalary(selected)}</strong></div>
                  <div className="ctx-fact"><span>Формат</span><strong>{selected.job_type || 'Не указан'}</strong></div>
                  <div className="ctx-fact"><span>Локация</span><strong>{selected.location || 'Не указана'}</strong></div>
                  <div className="ctx-fact">
                    <span>Контакт</span>
                    <strong>
                      {contact && contact.kind !== 'none' && contact.href ? (
                        <button
                          type="button"
                          className="panel-link"
                          style={{ padding: 0, fontSize: 11 }}
                          onClick={() => onOpenContact(selected)}
                        >
                          {contact.label} <ExternalLink size={10} />
                        </button>
                      ) : (
                        <span style={{ color: '#a3a6b3' }}>Не найден</span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {selected.scoring_reason && (
                <div className="ctx-block">
                  <div className="ctx-label">Почему подходит</div>
                  <div className="ctx-note">
                    <Target size={13} />
                    <span>{selected.scoring_reason}</span>
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="ctx-block">
                  <div className="ctx-label">Стек и теги</div>
                  <div className="ctx-tags">
                    {tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                  </div>
                </div>
              )}

              <div className="ctx-block">
                <div className="ctx-label">Описание задачи</div>
                <div className="ctx-desc">{selected.description || 'Описание отсутствует.'}</div>
              </div>

              <div className="ctx-actions">
                <button type="button" className="btn btn-sm" onClick={() => onOpenLead(selected.id)}>
                  Открыть карточку <ArrowRight size={12} />
                </button>
                {selected.url && selected.url !== '#' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => window.open(selected.url as string, '_blank', 'noopener,noreferrer')}
                  >
                    Оригинал <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* -------------------------------- editor ------------------------------- */}
      <section className="studio-pane studio-editor-pane">
        <div className="editor-head">
          <div>
            <div className="editor-head-title"><Sparkles size={13} /> Персональное предложение</div>
            <div className="editor-head-sub">
              {selected ? `Для «${selected.company || selected.title}»` : 'Выбери лид из очереди'}
            </div>
          </div>
          {selected && stage && <span className={`badge badge-stage tone-${stage.tone}`}>{stage.label}</span>}
        </div>

        {!selected ? (
          <div className="studio-empty">
            <div className="empty-icon"><PenLine size={18} /></div>
            <strong>Здесь появится редактор</strong>
            <span>Слева — очередь, в центре — контекст задачи.</span>
          </div>
        ) : (
          <div className="editor">
            <div className="editor-body">
              <div className="field">
                <div className="field-label">
                  Угол подачи <span>{ANGLES.find((item) => item.id === angle)?.hint}</span>
                </div>
                <div className="angle-grid">
                  {ANGLES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`angle-option ${angle === item.id ? 'active' : ''}`}
                      onClick={() => onAngleChange(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="editor-row">
                <div className="segmented">
                  {LENGTHS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`seg ${length === item.id ? 'active' : ''}`}
                      onClick={() => onLengthChange(item.id)}
                      title={item.hint}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="tiny muted">Без ИИ-стиля · только свои факты</span>
              </div>

              <details>
                <summary className="tiny muted" style={{ cursor: 'pointer', padding: '2px 0' }}>
                  Пожелания к тексту (необязательно)
                </summary>
                <textarea
                  className="textarea"
                  style={{ marginTop: 6, minHeight: 62 }}
                  rows={2}
                  placeholder="Например: без приветствия, сразу к сути; упомянуть опыт с pgvector…"
                  value={instructions}
                  onChange={(event) => onInstructionsChange(event.target.value)}
                />
              </details>

              <textarea
                className="offer-textarea"
                value={draft}
                placeholder="Здесь будет черновик. Нажми «Сгенерировать» — или напиши сам, если хочешь полностью свой голос."
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    onGenerate();
                  }
                }}
              />

              <div className="editor-meta">
                <span>
                  {draft.trim()
                    ? `${draft.trim().length} знаков · ${draft.trim().split(/\s+/).length} слов`
                    : 'Черновик пуст'}
                </span>
                <span>{selected.status === 'sent' ? 'Отправлен' : 'Не отправлено'} · {MOD_LABEL}+↵ генерировать</span>
              </div>

              {review && draft.trim() && (
                <div className="quality">
                  <div className="quality-head">
                    <span className="quality-label"><Sparkles size={11} /> Проверка на человечность</span>
                    <span className={`quality-score ${review.verdict}`}>{review.score}</span>
                  </div>
                  <div className="quality-bar">
                    <div className={review.verdict} style={{ width: `${review.score}%` }} />
                  </div>
                  {review.issues.length === 0 ? (
                    <div className="quality-ok">
                      <CheckCircle2 size={13} /> Чисто: без штампов, воды и следов ИИ. Можно отправлять.
                    </div>
                  ) : (
                    <div className="quality-list">
                      {review.issues.slice(0, 6).map((issue, index) => (
                        <div className={`quality-item ${issue.level}`} key={`${issue.label}-${index}`}>
                          {issue.level === 'low' ? <Info size={12} /> : <AlertTriangle size={12} />}
                          <span>{issue.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="editor-actions">
                <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={generating}>
                  {generating ? <Spinner size={13} /> : <Sparkles size={14} />}
                  {draft.trim() ? 'Перегенерировать' : 'Сгенерировать'}
                </button>
                <button type="button" className="btn" onClick={onSave} disabled={!draft.trim() || saving}>
                  {saving ? <Spinner size={13} /> : <CheckCircle2 size={14} />}
                  Сохранить
                </button>
                <button type="button" className="btn btn-ghost" onClick={onCopy} disabled={!draft.trim()}>
                  <ClipboardCopy size={14} /> Копировать
                </button>
              </div>

              <div className="editor-actions" style={{ justifyContent: 'flex-end' }}>
                <span className="tiny muted" style={{ marginRight: 'auto' }}>Отправка фиксируется вручную</span>
                {selected.status === 'offer_generated' && (
                  <button type="button" className="btn" onClick={() => onChangeStatus(selected, 'approved')}>
                    В апрув
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => onRequestSend(selected)}
                  disabled={!draft.trim()}
                >
                  <Send size={14} /> Отправить
                </button>
              </div>

              <div className="editor-hint">
                <Info size={13} />
                <span>
                  Генерация и сохранение не отправляют сообщение. Отправка фиксируется вручную:
                  {contact && contact.kind === 'telegram'
                    ? ` сначала скопируй текст и открой ${contact.label}.`
                    : contact && contact.kind === 'email'
                      ? ` сначала скопируй текст и напиши на ${contact.label}.`
                      : ' сначала скопируй текст и открой площадку.'}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
