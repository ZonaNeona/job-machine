import React, { useEffect, useState } from 'react';
import {
  AlertCircle, Bot, CheckCircle2, Database, KeyRound, RefreshCw, Send, Target,
} from 'lucide-react';
import { ScraperKey, ScraperStatus, SystemSettings, WorkspaceOverview } from '../../types';
import { SOURCES, formatDate, formatMoney, relativeTime } from '../lib';
import { Spinner } from '../components/ui';

interface SettingsViewProps {
  overview: WorkspaceOverview | null;
  settings: SystemSettings | null;
  scrapers: Partial<Record<ScraperKey, ScraperStatus>>;
  busy: Record<string, boolean>;
  saving: boolean;
  onRunSource: (key: ScraperKey) => void;
  onRunAll: () => void;
  onSave: (next: Partial<SystemSettings>) => void;
  onTestAlert: () => void;
}

const SCRAPER_FOR_SOURCE: Record<string, ScraperKey | null> = {
  'hh.ru': 'hh',
  telegram: 'tg',
  habr_freelance: 'freelance',
  fl_ru: 'freelance',
  kwork: 'freelance',
  avito: 'avito',
  direct: null,
};

const SCRAPER_TITLE: Record<ScraperKey, string> = {
  hh: 'hh.ru',
  tg: 'Telegram-каналы',
  freelance: 'Хабр + FL.ru + Kwork',
  avito: 'Авито Работа',
};

export function SettingsView({
  overview, settings, scrapers, busy, saving, onRunSource, onRunAll, onSave, onTestAlert,
}: SettingsViewProps) {
  const [clients, setClients] = useState('6');
  const [rate, setRate] = useState('85000');
  const [minScore, setMinScore] = useState('70');

  useEffect(() => {
    setClients(settings?.TARGET_CLIENTS_COUNT ?? '6');
    setRate(settings?.TARGET_MONTHLY_RATE ?? '85000');
    setMinScore(settings?.MIN_MATCH_SCORE_THRESHOLD ?? '70');
  }, [settings]);

  const configured = {
    llm: Boolean(settings?.OPENROUTER_CONFIGURED),
    hh: Boolean(settings?.HH_CONFIGURED),
    tg: Boolean(settings?.TG_CONFIGURED),
  };

  const scraperError = (key: ScraperKey) => {
    const result = scrapers[key]?.last_result;
    return Boolean(result && typeof result === 'object' && 'error' in result);
  };

  return (
    <div className="fade-in">
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head bordered">
            <div>
              <div className="panel-title"><Database size={14} /> Источники сбора</div>
              <div className="panel-sub">Запускай утром — или точечно, когда нужен свежий срез</div>
            </div>
            <button type="button" className="btn btn-sm" onClick={onRunAll} disabled={Boolean(busy['scraper-all'])}>
              {busy['scraper-all'] ? <Spinner size={12} /> : <RefreshCw size={12} />} Собрать всё
            </button>
          </div>
          <div className="panel-body">
            {SOURCES.map((source) => {
              const health = overview?.sources.find((item) => item.source === source.id);
              const key = SCRAPER_FOR_SOURCE[source.id];
              const status = key ? scrapers[key] : undefined;
              const running = Boolean(key && (busy[`scraper-${key}`] || status?.is_running));
              const failed = key ? scraperError(key) : false;
              return (
                <div className="source-row" key={source.id}>
                  <span className="source-row-icon">
                    <span className={`source-dot ${source.tone}`} style={{ width: 9, height: 9 }} />
                  </span>
                  <div className="source-row-main">
                    <div className="source-row-title">
                      {source.label}
                      {Boolean(health?.fresh) && (
                        <span className="badge" style={{ height: 17, fontSize: 9 }}>+{health?.fresh} за 24ч</span>
                      )}
                    </div>
                    <div className="source-row-sub">
                      {health?.total ?? 0} лидов · {health?.new ?? 0} ждут разбора
                      {status?.last_run ? ` · сбор ${relativeTime(status.last_run)}` : ''}
                    </div>
                  </div>
                  <div className="source-row-side">
                    {!key ? (
                      <span className="status-pill off">вручную</span>
                    ) : running ? (
                      <span className="status-pill busy"><Spinner size={10} /> сбор</span>
                    ) : failed ? (
                      <span className="status-pill warn"><AlertCircle size={10} /> ошибка</span>
                    ) : status?.last_run ? (
                      <span className="status-pill ok"><CheckCircle2 size={10} /> ок</span>
                    ) : (
                      <span className="status-pill off">не запускался</span>
                    )}
                    {key && (
                      <button
                        type="button"
                        className="icon-btn sm"
                        title={`Запустить: ${SCRAPER_TITLE[key]}`}
                        onClick={() => onRunSource(key)}
                        disabled={running}
                      >
                        <RefreshCw size={12} className={running ? 'spin' : ''} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="panel">
            <div className="panel-head bordered">
              <div>
                <div className="panel-title"><KeyRound size={14} /> Подключения</div>
                <div className="panel-sub">Ключи живут только в .env на этом компьютере</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="integration-row">
                <span className="integration-icon"><Bot size={15} /></span>
                <div className="integration-main">
                  <div className="integration-title">OpenRouter · LLM</div>
                  <div className="integration-sub">Генерация офферов и скоринг. Без ключа — только заготовка.</div>
                </div>
                <div className="integration-side">
                  <span className={`status-pill ${configured.llm ? 'ok' : 'warn'}`}>
                    {configured.llm ? 'подключено' : 'нет ключа'}
                  </span>
                </div>
              </div>

              <div className="integration-row">
                <span className="integration-icon"><Send size={15} /></span>
                <div className="integration-main">
                  <div className="integration-title">Telegram-алерты</div>
                  <div className="integration-sub">Сообщение, когда заказчик ответил на отклик.</div>
                </div>
                <div className="integration-side">
                  <button type="button" className="btn btn-sm" onClick={onTestAlert}>Проверить</button>
                </div>
              </div>

              <div className="integration-row">
                <span className="integration-icon"><Database size={15} /></span>
                <div className="integration-main">
                  <div className="integration-title">hh.ru API</div>
                  <div className="integration-sub">Токен для откликов и расширенной выдачи.</div>
                </div>
                <div className="integration-side">
                  <span className={`status-pill ${configured.hh ? 'ok' : 'off'}`}>
                    {configured.hh ? 'подключено' : 'не настроено'}
                  </span>
                </div>
              </div>

              <div className="integration-row">
                <span className="integration-icon"><Send size={15} /></span>
                <div className="integration-main">
                  <div className="integration-title">Telegram userbot</div>
                  <div className="integration-sub">Сбор из каналов и чатов через Telethon.</div>
                </div>
                <div className="integration-side">
                  <span className={`status-pill ${configured.tg ? 'ok' : 'off'}`}>
                    {configured.tg ? 'подключено' : 'не настроено'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head bordered">
              <div>
                <div className="panel-title"><Target size={14} /> Цель и отбор</div>
                <div className="panel-sub">Ориентиры, по которым считается прогресс</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="settings-form" style={{ paddingTop: 6 }}>
                <div className="field">
                  <label className="field-label">Клиентов в цель</label>
                  <input className="input" value={clients} onChange={(event) => setClients(event.target.value)} inputMode="numeric" />
                </div>
                <div className="field">
                  <label className="field-label">Средний чек, ₽</label>
                  <input className="input" value={rate} onChange={(event) => setRate(event.target.value)} inputMode="numeric" />
                </div>
                <div className="field full">
                  <label className="field-label">Минимальный мэтч для разбора <span>ниже — в архив</span></label>
                  <input className="input" value={minScore} onChange={(event) => setMinScore(event.target.value)} inputMode="numeric" />
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => onSave({
                      TARGET_CLIENTS_COUNT: clients,
                      TARGET_MONTHLY_RATE: rate,
                      MIN_MATCH_SCORE_THRESHOLD: minScore,
                    })}
                  >
                    {saving ? <Spinner size={13} /> : <CheckCircle2 size={13} />} Сохранить
                  </button>
                </div>
              </div>

              <div className="row between" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f3f7' }}>
                <span className="tiny muted">Прогноз MRR</span>
                <span className="small mono">{formatMoney((Number(clients) || 0) * (Number(rate) || 0))}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head bordered">
          <div>
            <div className="panel-title"><RefreshCw size={14} /> Правила конвейера</div>
            <div className="panel-sub">Всё, что система делает без тебя, должно быть видно здесь</div>
          </div>
        </div>
        <div className="panel-body">
          <div className="row wrap top" style={{ gap: 28 }}>
            <div className="grow" style={{ minWidth: 250 }}>
              <div className="toggle-row">
                <div>
                  <strong>Авто-скоринг новых лидов</strong>
                  <span>Оценка соответствия при появлении в потоке</span>
                </div>
                <span className="status-pill ok">включено</span>
              </div>
              <div className="toggle-row">
                <div>
                  <strong>Авто-отклики на hh.ru</strong>
                  <span>По правилам проекта выключено — только ручное подтверждение</span>
                </div>
                <span className="status-pill off">выключено</span>
              </div>
              <div className="toggle-row">
                <div>
                  <strong>Telegram-алерты об ответах</strong>
                  <span>Моментальное уведомление, когда заказчик ответил</span>
                </div>
                <span className={`status-pill ${settings?.TG_AUTO_NOTIFY_ENABLED === 'true' ? 'ok' : 'off'}`}>
                  {settings?.TG_AUTO_NOTIFY_ENABLED === 'true' ? 'включено' : 'выключено'}
                </span>
              </div>
            </div>
            <div className="grow" style={{ minWidth: 250 }}>
              <div className="ctx-note" style={{ marginBottom: 10 }}>
                <AlertCircle size={14} />
                <span>
                  Human-in-the-loop: кнопка «Отправить» только фиксирует факт отправки в журнале.
                  Сообщение всегда уходит из твоего аккаунта вручную.
                </span>
              </div>
              <div className="row between" style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                <span>Последняя синхронизация</span>
                <span>{overview?.generated_at ? formatDate(overview.generated_at) : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
