import React from 'react';
import { 
  Bot, 
  Layers, 
  BookOpen, 
  Settings, 
  RefreshCw, 
  Target, 
  Zap, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Download,
  Send
} from 'lucide-react';
import { SystemStats, SystemSettings } from '../types';

interface NavbarProps {
  currentTab: 'pipeline' | 'kb' | 'settings';
  onTabChange: (tab: 'pipeline' | 'kb' | 'settings') => void;
  stats: SystemStats | null;
  settings: SystemSettings | null;
  onRefresh: () => void;
  isLoading: boolean;
  onTriggerHHScraper?: () => void;
  isScrapingHH?: boolean;
  onTriggerTGScraper?: () => void;
  isScrapingTG?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  stats,
  settings,
  onRefresh,
  isLoading,
  onTriggerHHScraper,
  isScrapingHH,
  onTriggerTGScraper,
  isScrapingTG
}) => {
  const openRouterReady = settings?.OPENROUTER_CONFIGURED;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
        {/* Brand & System Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-violet-600 text-white shadow-lg shadow-cyan-500/20">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 font-['JetBrains_Mono']">
                  JOB<span className="text-cyan-400">MACHINE</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800 font-mono">
                    HQ v1.0
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">Автоматизированный конвейер IT-заказов с ИИ-слоем</p>
            </div>
          </div>

          {/* Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => onTabChange('pipeline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'pipeline'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Воронка лидов</span>
              {stats && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                  {stats.total_leads}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('kb')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'kb'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>База знаний & Кейсы</span>
            </button>

            <button
              onClick={() => onTabChange('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'settings'
                  ? 'bg-slate-700/50 text-slate-100 border border-slate-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Каналы & Настройки</span>
            </button>
          </nav>
        </div>

        {/* Right Stats & Actions */}
        <div className="flex items-center gap-3">
          {/* Target Revenue Indicator */}
          {stats && (
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Цель:</span>
                <span className="text-white font-semibold">{stats.target_clients} клиентов</span>
                <span className="text-slate-500">× 85к =</span>
                <span className="text-emerald-400 font-semibold">{stats.target_mrr.toLocaleString()} ₽/мес</span>
              </div>
              <div className="h-3 w-px bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Факт:</span>
                <span className="text-cyan-300 font-bold">{stats.current_mrr.toLocaleString()} ₽</span>
              </div>
            </div>
          )}

          {/* OpenRouter Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
            {openRouterReady ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 font-mono">OpenRouter: <span className="text-emerald-400">Active</span></span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300 font-mono">OpenRouter: <span className="text-amber-400">Offline / Mock</span></span>
              </>
            )}
          </div>

          {/* HeadHunter Scraper Button */}
          {onTriggerHHScraper && (
            <button
              onClick={onTriggerHHScraper}
              disabled={isScrapingHH}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/80 transition-all text-xs font-medium disabled:opacity-50 cursor-pointer shadow-sm"
              title="Запустить сбор вакансий с hh.ru"
            >
              <Download className={`w-3.5 h-3.5 ${isScrapingHH ? 'animate-bounce text-red-400' : ''}`} />
              <span>{isScrapingHH ? 'Сбор hh.ru...' : 'Сбор hh.ru'}</span>
            </button>
          )}

          {/* Telegram Ingestor Button */}
          {onTriggerTGScraper && (
            <button
              onClick={onTriggerTGScraper}
              disabled={isScrapingTG}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/70 hover:bg-sky-900/80 text-sky-300 border border-sky-800/80 transition-all text-xs font-medium disabled:opacity-50 cursor-pointer shadow-sm"
              title="Запустить сбор заказов из Telegram"
            >
              <Send className={`w-3.5 h-3.5 ${isScrapingTG ? 'animate-bounce text-sky-400' : ''}`} />
              <span>{isScrapingTG ? 'Сбор TG...' : 'Сбор TG'}</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Обновить данные"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
