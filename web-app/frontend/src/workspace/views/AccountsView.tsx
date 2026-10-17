import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ExternalLink, KeyRound, MessageSquare,
  RefreshCw, ShieldCheck,
} from 'lucide-react';
import { AccountChat, AccountPlatform, AccountPlatformPatch } from '../../types';
import { formatDate, relativeTime } from '../lib';
import { Spinner } from '../components/ui';

interface AccountsViewProps {
  platforms: AccountPlatform[];
  chats: AccountChat[];
  selectedPlatform: string;
  busy: Record<string, boolean>;
  onSelectPlatform: (platform: string) => void;
  onSync: (platform: string) => void;
  onImportSample?: (platform: string) => void;
  onSave: (platform: string, patch: AccountPlatformPatch) => void;
  onOpenLead?: (leadId: number) => void;
  onMarkRead: (platform: string, chatId: string) => void;
  onRefresh: () => void;
}

export function AccountsView({
  platforms,
  chats,
  selectedPlatform,
  busy,
  onSelectPlatform,
  onSync,
  onImportSample,
  onSave,
  onOpenLead,
  onMarkRead,
  onRefresh,
}: AccountsViewProps) {
  const current = platforms.find((p) => p.platform === selectedPlatform) ?? platforms[0] ?? null;

  const [enabled, setEnabled] = useState(true);
  const [intervalMin, setIntervalMin] = useState('60');
  const [baseUrl, setBaseUrl] = useState('https://hh.ru');
  const [openDetails, setOpenDetails] = useState(true);
  const [maxOpen, setMaxOpen] = useState('12');
  const [alertOnReply, setAlertOnReply] = useState(true);
  const [filter, setFilter] = useState<'all' | 'replies' | 'unread'>('all');

  useEffect(() => {
    if (!current) return;
    setEnabled(Boolean(current.enabled));
    setIntervalMin(String(current.interval_minutes ?? 60));
    setBaseUrl(current.base_url || 'https://hh.ru');
    setOpenDetails(current.open_chat_details !== false);
    setMaxOpen(String(current.max_chats_to_open ?? 12));
    setAlertOnReply(current.alert_on_reply !== false);
  }, [current]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return chats.filter((c) => c.unread);
    if (filter === 'replies') return chats.filter((c) => c.has_reply);
    return chats;
  }, [chats, filter]);

  const syncing = Boolean(current && (busy[`account-${current.platform}`] || current.is_running));
  const saving = Boolean(current && busy[`account-save-${current.platform}`]);

  const save = () => {
    if (!current) return;
    onSave(current.platform, {
      enabled,
      interval_minutes: Number(intervalMin) || 60,
      base_url: baseUrl.trim() || 'https://hh.ru',
      open_chat_details: openDetails,
      max_chats_to_open: Number(maxOpen) || 12,
      alert_on_reply: alertOnReply,
    });
  };

  if (!platforms.length) {
    return (
      <div className="panel">
        <div className="panel-body">
          <div className="empty-soft">Площадки ещё не заведены. Перезапусти backend.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in accounts-layout">
      <aside className="panel accounts-nav">
        <div className="panel-head bordered">
          <div>
            <div className="panel-title"><ShieldCheck size={14} /> Аккаунты</div>
            <div className="panel-sub">Сессии и мониторинг личных кабинетов</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onRefresh} title="Обновить">
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="panel-body">
          {platforms.map((p) => {
            const active = p.platform === (current?.platform);
            return (
              <button
                key={p.platform}
                type="button"
                className={`account-platform-row ${active ? 'active' : ''}`}
                onClick={() => onSelectPlatform(p.platform)}
              >
                <span className={`source-dot ${p.platform === 'hh.ru' ? 'hh' : 'direct'}`} />
                <span className="account-platform-main">
                  <strong>{p.label || p.platform}</strong>
                  <small>
                    {p.session_ok ? 'сессия ок' : p.profile_ready ? 'нужна проверка' : 'нет логина'}
                    {p.last_run_at ? ` · ${relativeTime(p.last_run_at)}` : ''}
                  </small>
                </span>
                {p.is_running ? <Spinner size={12} /> : (
                  <span className={`status-pill ${p.enabled ? 'ok' : 'off'}`}>
                    {p.enabled ? 'on' : 'off'}
                  </span>
                )}
              </button>
            );
          })}
          <div className="account-soon">
            <div className="account-soon-title">Далее по порядку</div>
            <div className="account-soon-list">Habr · FL.ru · Kwork · Avito</div>
          </div>
        </div>
      </aside>

      <div className="accounts-main">
        {current && (
          <section className="panel">
            <div className="panel-head bordered">
              <div>
                <div className="panel-title">{current.label || current.platform}</div>
                <div className="panel-sub">
                  Парсер личного кабинета · чаты живут на /chat/&#123;id&#125; (≠ id вакансии)
                </div>
              </div>
              <div className="head-actions" style={{ margin: 0, display: 'flex', gap: 8 }}>
                {onImportSample && current.platform === 'hh.ru' && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={Boolean(busy[`account-sample-${current.platform}`])}
                    onClick={() => onImportSample(current.platform)}
                    title="Загрузить локальные HTML-дампы чатов (Чаты.html) в базу"
                  >
                    {busy[`account-sample-${current.platform}`] ? <Spinner size={12} /> : null}
                    Импорт сэмпла
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={syncing}
                  onClick={() => onSync(current.platform)}
                >
                  {syncing ? <Spinner size={12} /> : <RefreshCw size={12} />}
                  Синхронизировать
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="account-status-row">
                <div className="account-stat">
                  <span>Профиль Playwright</span>
                  <strong className={current.profile_ready ? 'ok-text' : 'warn-text'}>
                    {current.profile_ready ? 'есть' : 'нет'}
                  </strong>
                </div>
                <div className="account-stat">
                  <span>Сессия</span>
                  <strong className={current.session_ok ? 'ok-text' : 'warn-text'}>
                    {current.session_ok ? 'валидна' : 'не подтверждена'}
                  </strong>
                </div>
                <div className="account-stat">
                  <span>Последний синк</span>
                  <strong>{current.last_run_at ? formatDate(current.last_run_at) : '—'}</strong>
                </div>
                <div className="account-stat">
                  <span>Статус</span>
                  <strong>{current.last_status || 'idle'}</strong>
                </div>
              </div>

              {!current.profile_ready && (
                <div className="ctx-note" style={{ marginTop: 12 }}>
                  <KeyRound size={14} />
                  <span>
                    Один раз сохраните cookies: в терминале выполните
                    {' '}<code>{current.login_hint || 'py account-parsing/hh/auth_session.py'}</code>
                    , войдите в hh и дождитесь страницы чатов.
                  </span>
                </div>
              )}

              {current.last_error && (
                <div className="ctx-note" style={{ marginTop: 12, borderColor: '#f0d4d4', background: '#fffafa' }}>
                  <AlertCircle size={14} />
                  <span>{current.last_error}</span>
                </div>
              )}

              <div className="account-settings-grid">
                <label className="field">
                  <span>Мониторинг</span>
                  <button
                    type="button"
                    className={`toggle ${enabled ? 'on' : ''}`}
                    onClick={() => setEnabled((v) => !v)}
                  >
                    {enabled ? 'включён' : 'выключен'}
                  </button>
                </label>
                <label className="field">
                  <span>Интервал, мин</span>
                  <input value={intervalMin} onChange={(e) => setIntervalMin(e.target.value)} />
                </label>
                <label className="field">
                  <span>Base URL</span>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                </label>
                <label className="field">
                  <span>Открывать чаты (vacancy id)</span>
                  <button
                    type="button"
                    className={`toggle ${openDetails ? 'on' : ''}`}
                    onClick={() => setOpenDetails((v) => !v)}
                  >
                    {openDetails ? 'да' : 'нет'}
                  </button>
                </label>
                <label className="field">
                  <span>Макс. открытий за проход</span>
                  <input value={maxOpen} onChange={(e) => setMaxOpen(e.target.value)} />
                </label>
                <label className="field">
                  <span>Telegram при ответе</span>
                  <button
                    type="button"
                    className={`toggle ${alertOnReply ? 'on' : ''}`}
                    onClick={() => setAlertOnReply((v) => !v)}
                  >
                    {alertOnReply ? 'да' : 'нет'}
                  </button>
                </label>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
                  {saving ? <Spinner size={12} /> : <CheckCircle2 size={12} />}
                  Сохранить настройки
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head bordered">
            <div>
              <div className="panel-title"><MessageSquare size={14} /> Чаты аккаунта</div>
              <div className="panel-sub">
                {filtered.length} из {chats.length} · синк подтягивает статусы и превью сообщений
              </div>
            </div>
            <div className="filter-pills">
              {([
                ['all', 'Все'],
                ['replies', 'С ответом'],
                ['unread', 'Непрочит.'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`pill ${filter === id ? 'active' : ''}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 4 }}>
            {!filtered.length ? (
              <div className="empty-soft" style={{ padding: '28px 8px' }}>
                {current?.profile_ready
                  ? 'Чатов пока нет — нажмите «Синхронизировать».'
                  : 'Сначала сохраните сессию hh.ru, затем синхронизируйте.'}
              </div>
            ) : (
              filtered.map((chat) => (
                <div className={`account-chat-row ${chat.unread ? 'unread' : ''}`} key={chat.id}>
                  <div className="account-chat-main">
                    <div className="account-chat-title">
                      {chat.unread && <span className="unread-dot" />}
                      {chat.title || `Чат ${chat.external_chat_id}`}
                      {chat.has_reply && <span className="badge reply">ответ</span>}
                    </div>
                    <div className="account-chat-sub">
                      {chat.counterpart || '—'}
                      {chat.time_label ? ` · ${chat.time_label}` : ''}
                      {chat.vacancy_external_id ? ` · ${chat.vacancy_external_id}` : ''}
                    </div>
                    {chat.last_message_preview && (
                      <div className="account-chat-preview">{chat.last_message_preview}</div>
                    )}
                  </div>
                  <div className="account-chat-side">
                    {chat.chat_url && (
                      <a className="btn btn-sm" href={chat.chat_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={12} /> hh
                      </a>
                    )}
                    {chat.lead_id && onOpenLead && (
                      <button type="button" className="btn btn-sm" onClick={() => onOpenLead(chat.lead_id!)}>
                        Лид #{chat.lead_id}
                      </button>
                    )}
                    {chat.unread && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onMarkRead(chat.platform, chat.external_chat_id)}
                      >
                        Прочитано
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
