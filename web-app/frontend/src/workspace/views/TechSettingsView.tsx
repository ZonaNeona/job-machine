import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  KeyRound,
  Play,
  Power,
  RefreshCw,
  Send,
  Sliders,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { api } from '../../api';
import { SystemSettings } from '../../types';
import { Spinner } from '../components/ui';

interface TechSettingsViewProps {
  settings: SystemSettings | null;
  busy: Record<string, boolean>;
  saving: boolean;
  onSave: (next: Partial<SystemSettings>) => void;
  notify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

const OPENROUTER_MODELS = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet',
    tag: '⭐ Рекомендуется для офферов',
    provider: 'Anthropic',
    hint: 'Живой человеческий русский язык, строгий факт-чекинг, полное отсутствие AI-штампов',
  },
  {
    id: 'deepseek/deepseek-chat',
    label: 'DeepSeek V3 (Chat)',
    tag: '⚡ Быстро и экономно',
    provider: 'DeepSeek',
    hint: 'Отличный русский, в 10 раз дешевле GPT-4o, молниеносные ответы',
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1 (Reasoning)',
    tag: '🧠 Глубокий анализ',
    provider: 'DeepSeek',
    hint: 'Разбор сложного ТЗ, выявление скрытых архитектурных рисков',
  },
  {
    id: 'openai/gpt-4o',
    label: 'OpenAI GPT-4o',
    tag: 'Флагман OpenAI',
    provider: 'OpenAI',
    hint: 'Универсальная точность в формулировках и коде',
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'OpenAI GPT-4o Mini',
    tag: 'Легкий драфт',
    provider: 'OpenAI',
    hint: 'Для быстрого чернового драфта',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B Instruct',
    tag: 'Open Source',
    provider: 'Meta',
    hint: 'Открытая флагманская модель',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash (Free)',
    tag: 'Бесплатно / Тест',
    provider: 'Google',
    hint: 'Экспериментальный бесплатный эндпоинт OpenRouter',
  },
];

const SCORING_MODELS = [
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (Рекомендуется)', hint: 'Минимальная стоимость оценки сотен входящих лидов' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', hint: 'Стабильный скоринг по чек-листу' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', hint: 'Строгий отбор технических требований' },
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)', hint: 'Бесплатный тариф' },
];

const CRON_PRESETS = [
  { label: '15 мин', value: '15', desc: 'Агрессивный перехват' },
  { label: '30 мин', value: '30', desc: 'Частая проверка' },
  { label: '60 мин', value: '60', desc: '1 раз в час (Рекомендуется)' },
  { label: '2 часа', value: '120', desc: 'Экономный режим' },
  { label: '6 часов', value: '360', desc: 'Несколько раз в день' },
  { label: '1 сутки', value: '1440', desc: 'Раз в день утром' },
];

export function TechSettingsView({
  settings,
  busy,
  saving,
  onSave,
  notify,
}: TechSettingsViewProps) {
  // 1. Bot activity & switches
  const [botEnabled, setBotEnabled] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [tgNotify, setTgNotify] = useState(true);
  const [alertOnReply, setAlertOnReply] = useState(true);

  // 2. Cron & limits
  const [intervalMin, setIntervalMin] = useState('60');
  const [maxOpen, setMaxOpen] = useState('12');
  const [baseUrl, setBaseUrl] = useState('https://hh.ru');
  const [openDetails, setOpenDetails] = useState(true);

  // 3. OpenRouter Models
  const [defaultModel, setDefaultModel] = useState('anthropic/claude-3.5-sonnet');
  const [scoringModel, setScoringModel] = useState('deepseek/deepseek-chat');
  const [customModel, setCustomModel] = useState('');
  const [temperature, setTemperature] = useState('0.7');

  // 4. Business thresholds
  const [clients, setClients] = useState('6');
  const [rate, setRate] = useState('85000');
  const [minScore, setMinScore] = useState('70');

  // OpenRouter test connection state
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; message: string; latency_ms?: number } | null>(null);

  useEffect(() => {
    if (!settings) return;
    const isEn = String(settings.HH_ACCOUNT_SYNC_ENABLED).toLowerCase();
    setBotEnabled(isEn === 'true' || isEn === '1');

    setAutoApply(String(settings.HH_AUTO_APPLY_ENABLED).toLowerCase() === 'true');
    setTgNotify(String(settings.TG_AUTO_NOTIFY_ENABLED ?? 'true').toLowerCase() !== 'false');
    setAlertOnReply(String(settings.HH_ACCOUNT_ALERT_ON_REPLY ?? 'true').toLowerCase() !== 'false');

    setIntervalMin(String(settings.HH_ACCOUNT_SYNC_INTERVAL_MIN ?? '60'));
    setMaxOpen(String(settings.HH_ACCOUNT_MAX_CHATS_TO_OPEN ?? '12'));
    setBaseUrl(String(settings.HH_ACCOUNT_BASE_URL ?? 'https://hh.ru'));
    setOpenDetails(String(settings.HH_ACCOUNT_OPEN_CHAT_DETAILS ?? 'true').toLowerCase() !== 'false');

    const defM = String(settings.OPENROUTER_DEFAULT_MODEL ?? 'anthropic/claude-3.5-sonnet');
    setDefaultModel(defM);
    if (!OPENROUTER_MODELS.some((m) => m.id === defM)) {
      setCustomModel(defM);
    }
    setScoringModel(String(settings.OPENROUTER_SCORING_MODEL ?? 'deepseek/deepseek-chat'));
    setTemperature(String(settings.OPENROUTER_TEMPERATURE ?? '0.7'));

    setClients(String(settings.TARGET_CLIENTS_COUNT ?? '6'));
    setRate(String(settings.TARGET_MONTHLY_RATE ?? '85000'));
    setMinScore(String(settings.MIN_MATCH_SCORE_THRESHOLD ?? '70'));
  }, [settings]);

  const handleTestOpenRouter = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const activeModel = customModel.trim() || defaultModel;
      const res = await api.testOpenRouter(activeModel);
      setTestResult(res);
      if (res.status === 'success') {
        notify(res.message, 'success');
      } else {
        notify(res.message, 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка подключения';
      setTestResult({ status: 'error', message: msg });
      notify(msg, 'error');
    } finally {
      setTestingModel(false);
    }
  };

  const saveAll = () => {
    const finalModel = customModel.trim() || defaultModel;
    onSave({
      HH_ACCOUNT_SYNC_ENABLED: botEnabled ? 'true' : 'false',
      HH_AUTO_APPLY_ENABLED: autoApply ? 'true' : 'false',
      TG_AUTO_NOTIFY_ENABLED: tgNotify ? 'true' : 'false',
      HH_ACCOUNT_ALERT_ON_REPLY: alertOnReply ? 'true' : 'false',
      HH_ACCOUNT_SYNC_INTERVAL_MIN: intervalMin,
      HH_ACCOUNT_MAX_CHATS_TO_OPEN: maxOpen,
      HH_ACCOUNT_BASE_URL: baseUrl.trim() || 'https://hh.ru',
      HH_ACCOUNT_OPEN_CHAT_DETAILS: openDetails ? 'true' : 'false',
      OPENROUTER_DEFAULT_MODEL: finalModel,
      OPENROUTER_SCORING_MODEL: scoringModel,
      OPENROUTER_TEMPERATURE: temperature,
      TARGET_CLIENTS_COUNT: clients,
      TARGET_MONTHLY_RATE: rate,
      MIN_MATCH_SCORE_THRESHOLD: minScore,
    });
  };

  const toggleBotActivity = (nextState: boolean) => {
    setBotEnabled(nextState);
    // Instant save for safety toggle
    onSave({
      HH_ACCOUNT_SYNC_ENABLED: nextState ? 'true' : 'false',
    });
    if (!nextState) {
      notify('Бот hh.ru временно отключен: фоновые сессии остановлены', 'info');
    } else {
      notify('Бот hh.ru активирован: синхронизация по расписанию включена', 'success');
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. ГЛАВНЫЙ РУБИЛЬНИК АКТИВНОСТИ БОТА */}
      <section className={`panel ${botEnabled ? 'border-accent' : ''}`} style={{ borderLeft: botEnabled ? '4px solid #10b981' : '4px solid #f59e0b' }}>
        <div className="panel-body" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: botEnabled ? '#ecfdf5' : '#fef3c7',
                  color: botEnabled ? '#059669' : '#d97706',
                }}
              >
                <Power size={22} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Активность бота hh.ru:</span>
                  {botEnabled ? (
                    <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                      🟢 Активен
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                      ⏸️ Временно отключен
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {botEnabled
                    ? 'Бот опрашивает чаты по установленному расписанию (раз в ' + intervalMin + ' мин).'
                    : 'Бот полностью остановлен. Сессии Chromium не запускаются, аккаунт не опрашивается.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`btn ${botEnabled ? 'btn-outline' : 'btn-primary'}`}
              style={{ minWidth: 150, height: 38 }}
              onClick={() => toggleBotActivity(!botEnabled)}
            >
              {botEnabled ? '⏸️ Отключить бота' : '▶️ Включить активность'}
            </button>
          </div>
        </div>
      </section>

      {/* 2. ВЫБОР МОДЕЛЕЙ OPENROUTER */}
      <section className="panel">
        <div className="panel-head bordered">
          <div>
            <div className="panel-title">
              <Bot size={15} /> Модели OpenRouter (Нейросети для офферов и скоринга)
            </div>
            <div className="panel-sub">Выбирай любую модель из каталога openrouter.ai/models</div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleTestOpenRouter}
            disabled={testingModel}
            title="Проверить ответ модели"
          >
            {testingModel ? <Spinner size={12} /> : <Zap size={12} />} Проверить связь
          </button>
        </div>

        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {testResult && (
            <div
              className={`ctx-note ${testResult.status === 'success' ? 'ok' : 'warn'}`}
              style={{
                background: testResult.status === 'success' ? '#f0fdf4' : '#fffbeb',
                borderColor: testResult.status === 'success' ? '#bbf7d0' : '#fef3c7',
                padding: '10px 14px',
                borderRadius: 8,
              }}
            >
              {testResult.status === 'success' ? <CheckCircle2 size={15} style={{ color: '#16a34a' }} /> : <AlertCircle size={15} style={{ color: '#d97706' }} />}
              <span style={{ fontSize: 12 }}>{testResult.message}</span>
            </div>
          )}

          <div className="field">
            <label className="field-label">
              Основная модель для генерации офферов <span>(влияет на тон и стиль)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginTop: 6 }}>
              {OPENROUTER_MODELS.map((m) => {
                const isSelected = defaultModel === m.id && !customModel;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setDefaultModel(m.id);
                      setCustomModel('');
                    }}
                    style={{
                      border: isSelected ? '1.5px solid #6366f1' : '1px solid var(--line)',
                      background: isSelected ? '#f5f3ff' : 'var(--surface)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 13, color: isSelected ? '#4338ca' : 'inherit' }}>{m.label}</strong>
                      <span className="badge" style={{ fontSize: 9 }}>{m.tag}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>{m.hint}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="field" style={{ marginTop: 4 }}>
            <label className="field-label">Кастомный ID модели OpenRouter <span>(если нужна модель не из списка)</span></label>
            <input
              className="input sm"
              placeholder="например: deepseek/deepseek-chat или anthropic/claude-3-opus"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label className="field-label">Модель для AI-скоринга лидов</label>
              <select
                className="select sm"
                value={scoringModel}
                onChange={(e) => setScoringModel(e.target.value)}
              >
                {SCORING_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">
                Температура генерации ({temperature}) <span>{Number(temperature) < 0.4 ? 'точно по фактам' : Number(temperature) > 0.8 ? 'креативно' : 'баланс'}</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. КРОН И РАСПИСАНИЕ БОТА */}
      <section className="panel">
        <div className="panel-head bordered">
          <div>
            <div className="panel-title">
              <Clock size={15} /> Расписание и лимиты бота (Cron Schedule)
            </div>
            <div className="panel-sub">Бережный интервал опроса чатов и лимиты запросов</div>
          </div>
        </div>

        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label className="field-label">Интервал синхронизации чатов (Cron)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {CRON_PRESETS.map((p) => {
                const active = intervalMin === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    className={`slice-pill ${active ? 'active' : ''}`}
                    onClick={() => setIntervalMin(p.value)}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label className="field-label">
                Точный интервал (в минутах)
              </label>
              <input
                className="input sm"
                type="number"
                min="15"
                max="1440"
                value={intervalMin}
                onChange={(e) => setIntervalMin(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">
                Макс. чатов открывать за сеанс <span>(защита от подозрительности)</span>
              </label>
              <input
                className="input sm"
                type="number"
                min="3"
                max="30"
                value={maxOpen}
                onChange={(e) => setMaxOpen(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Базовый URL аккаунта hh.ru</label>
            <input
              className="input sm"
              value={baseUrl}
              placeholder="https://hh.ru"
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={openDetails}
                onChange={(e) => setOpenDetails(e.target.checked)}
              />
              <span>Открывать чаты для извлечения ID вакансии из шапки и текста сообщений</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={alertOnReply}
                onChange={(e) => setAlertOnReply(e.target.checked)}
              />
              <span>Отправлять Telegram push-уведомление при получении ответа от работодателя</span>
            </label>
          </div>
        </div>
      </section>

      {/* 4. ПРАВИЛА БЕЗОПАСНОСТИ И ПОРОГИ */}
      <section className="panel">
        <div className="panel-head bordered">
          <div>
            <div className="panel-title">
              <Target size={15} /> Бизнес-цели и фильтры
            </div>
            <div className="panel-sub">Пороги отбора лидов и целевой чек</div>
          </div>
        </div>

        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="field">
              <label className="field-label">Клиентов в цель</label>
              <input
                className="input sm"
                type="number"
                value={clients}
                onChange={(e) => setClients(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Средний чек (₽/мес)</label>
              <input
                className="input sm"
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Мин. Score для взятия в работу (%)</label>
              <input
                className="input sm"
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* НИЖНЯЯ ПАНЕЛЬ ДЕЙСТВИЙ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 24 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ height: 42, minWidth: 180, fontSize: 13 }}
          disabled={saving}
          onClick={saveAll}
        >
          {saving ? <Spinner size={14} /> : <CheckCircle2 size={14} />} Сохранить все настройки
        </button>
      </div>
    </div>
  );
}
