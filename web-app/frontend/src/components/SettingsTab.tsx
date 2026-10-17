import React, { useState } from 'react';
import { 
  Settings, 
  Target, 
  DollarSign, 
  Shield, 
  Key, 
  Check, 
  Save, 
  Sliders, 
  Send, 
  Radio, 
  ExternalLink,
  Info
} from 'lucide-react';
import { SystemSettings } from '../types';

interface SettingsTabProps {
  settings: SystemSettings | null;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings
}) => {
  const [targetClients, setTargetClients] = useState(settings?.TARGET_CLIENTS_COUNT || '6');
  const [targetRate, setTargetRate] = useState(settings?.TARGET_MONTHLY_RATE || '85000');
  const [minScore, setMinScore] = useState(settings?.MIN_MATCH_SCORE_THRESHOLD || '75');
  const [autoApply, setAutoApply] = useState(settings?.HH_AUTO_APPLY_ENABLED === 'true');
  const [tgNotify, setTgNotify] = useState(settings?.TG_AUTO_NOTIFY_ENABLED === 'true');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const targetMRR = parseInt(targetClients || '0') * parseInt(targetRate || '0');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings({
        TARGET_CLIENTS_COUNT: targetClients,
        TARGET_MONTHLY_RATE: targetRate,
        MIN_MATCH_SCORE_THRESHOLD: minScore,
        HH_AUTO_APPLY_ENABLED: autoApply ? 'true' : 'false',
        TG_AUTO_NOTIFY_ENABLED: tgNotify ? 'true' : 'false',
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-6 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between card-shadow">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-['Inter']">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Параметры системы и финансовые цели
          </h2>
          <p className="text-xs text-slate-500">
            Управление параметрами автоотклика, финансовой планкой и интеграциями с внешними площадками.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
        >
          {isSaved ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
          <span>{isSaved ? 'Сохранено!' : isSaving ? 'Сохранение...' : 'Сохранить изменения'}</span>
        </button>
      </div>

      {/* Financial Target Goals */}
      <div className="p-6 bg-white border border-slate-200/80 rounded-2xl space-y-5 card-shadow">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-['Inter']">
          <Target className="w-4 h-4 text-emerald-600" />
          Финансовые цели конвейера (Retainer)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-600 font-medium">Количество постоянных клиентов:</label>
            <input
              type="number"
              value={targetClients}
              onChange={(e) => setTargetClients(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold"
            />
            <span className="text-[11px] text-slate-500 block">Рекомендуется: 5–7 клиентов на подряде</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-600 font-medium">Ежемесячная ставка с одного (руб.):</label>
            <input
              type="number"
              value={targetRate}
              onChange={(e) => setTargetRate(e.target.value)}
              step="5000"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-emerald-700 font-bold focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <span className="text-[11px] text-slate-500 block">Ориентир: 80 000 – 90 000 ₽ / мес</span>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/70 flex flex-col justify-center">
            <span className="text-[11px] text-emerald-900 font-medium">Целевой ежемесячный доход (MRR):</span>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-1">
              {targetMRR.toLocaleString()} ₽ / мес
            </span>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5">~{(targetMRR * 12).toLocaleString()} ₽ в год</span>
          </div>
        </div>
      </div>

      {/* Automation & Safety Settings */}
      <div className="p-6 bg-white border border-slate-200/80 rounded-2xl space-y-5 card-shadow">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-['Inter']">
          <Shield className="w-4 h-4 text-indigo-600" />
          Автоматизация и безопасность (Антибан & Human-in-the-Loop)
        </div>

        <div className="space-y-4 divide-y divide-slate-100">
          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-semibold text-slate-900">Ручной апрув перед отправкой (Рекомендуется)</span>
              <p className="text-[11px] text-slate-500">
                ИИ генерирует персонализированный отклик, но отправка происходит только после вашего клика «Одобрить».
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!autoApply}
                onChange={() => setAutoApply(!autoApply)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-semibold text-slate-900">Минимальный Match Score для генерации оффера</span>
              <p className="text-[11px] text-slate-500">
                Вакансии со скором ниже этого значения не будут расходовать токены генерации оффера.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="50"
                max="95"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="w-16 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-indigo-700 text-center font-bold focus:outline-none focus:bg-white focus:border-indigo-500"
              />
              <span className="text-xs font-mono text-slate-500">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-semibold text-slate-900">Мгновенные алерты в Telegram при ответе заказчика</span>
              <p className="text-[11px] text-slate-500">
                При получении нового отклика бот отправляет уведомление прямо в ваш личный Telegram для быстрого созвона.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tgNotify}
                onChange={() => setTgNotify(!tgNotify)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Credentials Status info */}
      <div className="p-6 bg-white border border-slate-200/80 rounded-2xl space-y-4 card-shadow">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-['Inter']">
          <Key className="w-4 h-4 text-indigo-600" />
          Статус внешних подключений (.env)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-slate-800">OpenRouter API</span>
              <span className={`w-2.5 h-2.5 rounded-full ${settings?.OPENROUTER_CONFIGURED ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
            </div>
            <p className="text-[11px] text-slate-500">
              {settings?.OPENROUTER_CONFIGURED ? 'Ключ активен' : 'Ожидает ключ в .env'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-slate-800">HeadHunter</span>
              <span className={`w-2.5 h-2.5 rounded-full ${settings?.HH_CONFIGURED ? 'bg-emerald-500' : 'bg-emerald-500'}`} />
            </div>
            <p className="text-[11px] text-slate-500">
              Парсер активен (52 вакансии)
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-slate-800">Telegram Telethon</span>
              <span className={`w-2.5 h-2.5 rounded-full ${settings?.TG_CONFIGURED ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </div>
            <p className="text-[11px] text-slate-500">
              {settings?.TG_CONFIGURED ? 'Клиент активен' : 'Готов к авторизации'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/60 flex items-start gap-2.5 text-xs text-indigo-900 mt-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            Конфигурационный файл находится в <code className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 font-mono text-[11px] text-indigo-900">web-app/.env</code>. 
            Там задаются секретные ключи для OpenRouter, hh.ru и Telegram.
          </span>
        </div>
      </div>
    </div>
  );
};
