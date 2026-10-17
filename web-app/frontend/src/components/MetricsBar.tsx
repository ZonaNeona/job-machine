import React from 'react';
import { 
  Users, 
  Send, 
  MessageSquare, 
  TrendingUp, 
  Sparkles,
  Globe,
  ArrowUpRight
} from 'lucide-react';
import { SystemStats } from '../types';

interface MetricsBarProps {
  stats: SystemStats | null;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ stats }) => {
  if (!stats) return null;

  const mrrProgress = Math.min(100, Math.round((stats.current_mrr / (stats.target_mrr || 1)) * 100));

  return (
    <div className="space-y-4">
      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads & Pipeline */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 card-shadow card-shadow-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Воронка лидов
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-['JetBrains_Mono'] tracking-tight">
              {stats.total_leads}
            </span>
            <span className="text-xs text-slate-500 font-medium">заказов в базе</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span className="font-semibold text-indigo-600">{stats.new_leads} свежих</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="font-semibold text-violet-600">{stats.scored_leads} прошли скоринг</span>
          </div>
        </div>

        {/* Card 2: Outreach Sent */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 card-shadow card-shadow-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Отправлено офферов
            </span>
            <span className="p-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <Send className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-['JetBrains_Mono'] tracking-tight">
              {stats.sent_outreach}
            </span>
            <span className="text-xs text-slate-500 font-medium">откликов ушло</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              Конверсия: {stats.conversion_rate}%
            </span>
            <span className="text-slate-600 font-mono text-[11px]">{stats.offers_ready} на согласовании</span>
          </div>
        </div>

        {/* Card 3: Replies & Active Deals */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 card-shadow card-shadow-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Ответы & Переговоры
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <MessageSquare className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 font-['JetBrains_Mono'] tracking-tight">
              {stats.responses_received}
            </span>
            <span className="text-xs text-slate-500 font-medium">ответов получено</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span className="font-semibold text-slate-900">{stats.active_deals} в активных созвонах</span>
          </div>
        </div>

        {/* Card 4: Monthly Recurring Revenue (MRR) */}
        <div className="bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/30 border border-indigo-100 rounded-2xl p-5 card-shadow card-shadow-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider font-mono">
              Выручка MRR
            </span>
            <span className="px-2 py-0.5 rounded-lg text-xs font-bold font-mono bg-indigo-100/80 text-indigo-700">
              {mrrProgress}% цели
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-slate-900 font-['JetBrains_Mono'] tracking-tight">
              {stats.current_mrr.toLocaleString()} ₽
            </span>
            <span className="text-xs text-slate-500 font-mono">/ {stats.target_mrr.toLocaleString()} ₽</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${mrrProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{stats.current_clients} из {stats.target_clients} постоянных клиентов</span>
              <span>чек ~85к ₽/мес</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sources Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-white border border-slate-200/80 rounded-2xl card-shadow text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <Globe className="w-4 h-4 text-indigo-600" />
          <span>Активность каналов конвейера:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 font-mono font-medium">
            HeadHunter: <strong className="text-rose-900 font-bold">{stats.sources_breakdown['hh.ru'] || 0}</strong>
          </span>
          <span className="px-3 py-1 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/80 font-mono font-medium">
            Telegram: <strong className="text-sky-900 font-bold">{stats.sources_breakdown['telegram'] || 0}</strong>
          </span>
          <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono font-medium">
            Хабр Карьера: <strong className="text-indigo-900 font-bold">{stats.sources_breakdown['habr_freelance'] || 0}</strong>
          </span>
          <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80 font-mono font-medium">
            FL.ru: <strong className="text-amber-900 font-bold">{stats.sources_breakdown['fl_ru'] || 0}</strong>
          </span>
          <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono font-medium">
            Kwork: <strong className="text-emerald-900 font-bold">{stats.sources_breakdown['kwork'] || 0}</strong>
          </span>
          <span className="px-3 py-1 rounded-xl bg-violet-50 text-violet-700 border border-violet-200/80 font-mono font-medium">
            Авито Работа: <strong className="text-violet-900 font-bold">{stats.sources_breakdown['avito'] || 0}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
