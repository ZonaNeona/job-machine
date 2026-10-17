import React from 'react';
import { 
  Bot, 
  Layers, 
  BookOpen, 
  Settings, 
  Target, 
  Download, 
  Send, 
  PanelLeftClose, 
  PanelLeftOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Briefcase,
  Building2
} from 'lucide-react';
import { SystemStats, SystemSettings } from '../types';

interface SidebarProps {
  currentTab: 'pipeline' | 'kb' | 'settings';
  onTabChange: (tab: 'pipeline' | 'kb' | 'settings') => void;
  stats: SystemStats | null;
  settings: SystemSettings | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTriggerHHScraper: () => void;
  isScrapingHH: boolean;
  onTriggerTGScraper: () => void;
  isScrapingTG: boolean;
  onTriggerFreelanceScraper: () => void;
  isScrapingFreelance: boolean;
  onTriggerAvitoScraper: () => void;
  isScrapingAvito: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  stats,
  settings,
  collapsed,
  onToggleCollapse,
  onTriggerHHScraper,
  isScrapingHH,
  onTriggerTGScraper,
  isScrapingTG,
  onTriggerFreelanceScraper,
  isScrapingFreelance,
  onTriggerAvitoScraper,
  isScrapingAvito
}) => {
  const openRouterReady = settings?.OPENROUTER_CONFIGURED;
  const mrrProgress = stats ? Math.min(100, Math.round((stats.current_mrr / (stats.target_mrr || 1)) * 100)) : 0;

  return (
    <aside
      className={`relative flex flex-col justify-between border-r border-slate-200/90 bg-white transition-all duration-300 ease-in-out shrink-0 select-none z-30 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Top Header / Brand */}
      <div>
        <div className="flex items-center justify-between p-4.5 border-b border-slate-100 h-18">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-slate-900 font-['Inter']">
                    JobMachine
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono">
                    HQ
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">Конвейер заказов & ИИ</p>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation Section */}
        <div className="p-3 space-y-1.5">
          {!collapsed && (
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Навигация
            </div>
          )}

          <nav className="space-y-1">
            {/* Nav: Pipeline */}
            <button
              onClick={() => onTabChange('pipeline')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                currentTab === 'pipeline'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Воронка лидов"
            >
              <Layers className={`w-4 h-4 shrink-0 ${currentTab === 'pipeline' ? 'text-indigo-600' : 'text-slate-500'}`} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>Воронка лидов</span>
                  {stats && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                      {stats.total_leads}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Nav: Knowledge Base */}
            <button
              onClick={() => onTabChange('kb')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                currentTab === 'kb'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="База знаний & Кейсы"
            >
              <BookOpen className={`w-4 h-4 shrink-0 ${currentTab === 'kb' ? 'text-indigo-600' : 'text-slate-500'}`} />
              {!collapsed && <span>База знаний & Кейсы</span>}
            </button>

            {/* Nav: Settings */}
            <button
              onClick={() => onTabChange('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Каналы & Настройки"
            >
              <Settings className={`w-4 h-4 shrink-0 ${currentTab === 'settings' ? 'text-indigo-600' : 'text-slate-500'}`} />
              {!collapsed && <span>Каналы & Настройки</span>}
            </button>
          </nav>
        </div>

        {/* Scraper Triggers Section */}
        <div className="p-3 pt-2">
          {!collapsed && (
            <div className="px-3 pt-2 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Сборщики лидов
            </div>
          )}

          <div className="space-y-2">
            {/* Trigger: hh.ru */}
            <button
              onClick={onTriggerHHScraper}
              disabled={isScrapingHH}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                isScrapingHH
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-700 card-shadow'
              }`}
              title="Запустить сбор вакансий с HeadHunter"
            >
              <Download className={`w-4 h-4 shrink-0 ${isScrapingHH ? 'animate-bounce text-rose-600' : 'text-rose-500'}`} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>{isScrapingHH ? 'Сбор hh.ru...' : 'Собрать с hh.ru'}</span>
                  {stats && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {stats.sources_breakdown['hh.ru'] || 0}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Trigger: Telegram */}
            <button
              onClick={onTriggerTGScraper}
              disabled={isScrapingTG}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                isScrapingTG
                  ? 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 hover:text-sky-700 card-shadow'
              }`}
              title="Запустить сбор заказов из Telegram"
            >
              <Send className={`w-4 h-4 shrink-0 ${isScrapingTG ? 'animate-bounce text-sky-600' : 'text-sky-500'}`} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>{isScrapingTG ? 'Сбор TG...' : 'Собрать с Telegram'}</span>
                  {stats && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {stats.sources_breakdown['telegram'] || 0}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Trigger: Freelance (Habr + FL.ru) */}
            <button
              onClick={onTriggerFreelanceScraper}
              disabled={isScrapingFreelance}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                isScrapingFreelance
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-700 card-shadow'
              }`}
              title="Запустить сбор заказов с Хабр Карьеры и FL.ru"
            >
              <Briefcase className={`w-4 h-4 shrink-0 ${isScrapingFreelance ? 'animate-bounce text-amber-600' : 'text-amber-500'}`} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>{isScrapingFreelance ? 'Сбор Фриланс...' : 'Собрать Хабр & FL'}</span>
                  {stats && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {(stats.sources_breakdown['habr_freelance'] || 0) + (stats.sources_breakdown['fl_ru'] || 0) + (stats.sources_breakdown['kwork'] || 0)}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Trigger: Avito */}
            <button
              onClick={onTriggerAvitoScraper}
              disabled={isScrapingAvito}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border cursor-pointer ${
                isScrapingAvito
                  ? 'bg-violet-50 text-violet-700 border-violet-200 animate-pulse'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700 card-shadow'
              }`}
              title="Запустить сбор вакансий с Авито Работы"
            >
              <Building2 className={`w-4 h-4 shrink-0 ${isScrapingAvito ? 'animate-bounce text-violet-600' : 'text-violet-500'}`} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>{isScrapingAvito ? 'Сбор Авито...' : 'Собрать с Авито'}</span>
                  {stats && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {stats.sources_breakdown['avito'] || 0}
                    </span>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Goal Widget & Status */}
      <div className="p-3.5 space-y-3 border-t border-slate-100 bg-slate-50/50">
        {/* Financial Goal Card (Only visible if not collapsed) */}
        {!collapsed && stats && (
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 card-shadow space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-600" />
                План выручки
              </span>
              <span className="font-mono font-bold text-indigo-600 text-[11px]">
                {mrrProgress}%
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${mrrProgress}%` }}
              />
            </div>

            <div className="flex justify-between items-baseline text-[11px]">
              <span className="font-mono font-bold text-slate-900">
                {stats.current_mrr.toLocaleString()} ₽
              </span>
              <span className="text-slate-600 font-mono">
                из {stats.target_mrr.toLocaleString()} ₽
              </span>
            </div>
          </div>
        )}

        {/* Status Pill */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 text-[11px] card-shadow">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className={`w-2 h-2 rounded-full shrink-0 ${openRouterReady ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {!collapsed && (
              <span className="truncate text-slate-600 font-mono">
                OpenRouter: <strong className={openRouterReady ? 'text-emerald-700' : 'text-amber-700'}>{openRouterReady ? 'Готов' : 'Демо'}</strong>
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="text-[10px] text-slate-500 font-mono">
              v1.0
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
