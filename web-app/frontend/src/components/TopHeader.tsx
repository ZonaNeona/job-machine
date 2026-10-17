import React from 'react';
import { 
  Search, 
  LayoutGrid, 
  ListFilter, 
  RefreshCw,
  Globe
} from 'lucide-react';

interface TopHeaderProps {
  currentTab: 'pipeline' | 'kb' | 'settings';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (source: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  viewMode: 'kanban' | 'table';
  onViewModeChange: (mode: 'kanban' | 'table') => void;
  onRefresh: () => void;
  isLoading: boolean;
  totalLeadsCount: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  isLoading,
  totalLeadsCount
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'pipeline':
        return 'Воронка лидов & Отклики';
      case 'kb':
        return 'База знаний & Кейсы разработчика';
      case 'settings':
        return 'Настройки & Финансовые цели';
      default:
        return 'Панель управления';
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Page Title & Breadcrumb */}
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {getTabTitle()}
          </h1>
          {currentTab === 'pipeline' && (
            <>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {totalLeadsCount}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Все сообщения отправляются только после вашего личного подтверждения">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Dry-Run: Human-in-the-Loop
              </span>
            </>
          )}
        </div>

        {/* Center / Right: Search & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {currentTab === 'pipeline' && (
            <>
              {/* Search Bar */}
              <div className="relative w-64 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Поиск по стеку, компании, боли..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all card-shadow"
                />
              </div>

              {/* Source Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 text-xs font-medium">
                <button
                  onClick={() => onSourceFilterChange('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => onSourceFilterChange('hh.ru')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === 'hh.ru'
                      ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  hh.ru
                </button>
                <button
                  onClick={() => onSourceFilterChange('telegram')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === 'telegram'
                      ? 'bg-white text-sky-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Telegram
                </button>
                <button
                  onClick={() => onSourceFilterChange('habr_freelance')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === 'habr_freelance'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Хабр
                </button>
                <button
                  onClick={() => onSourceFilterChange('fl_ru')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === 'fl_ru'
                      ? 'bg-white text-amber-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  FL.ru
                </button>
                <button
                  onClick={() => onSourceFilterChange('kwork')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === 'kwork'
                      ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kwork
                </button>
                <button
                  onClick={() => onSourceFilterChange('avito')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    sourceFilter === 'avito'
                      ? 'bg-white text-violet-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Авито
                </button>
              </div>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 card-shadow font-medium cursor-pointer"
              >
                <option value="all">Все статусы</option>
                <option value="new">Новые</option>
                <option value="ai_scored">Скоринг пройден</option>
                <option value="offer_generated">Оффер готов</option>
                <option value="sent">Отправлен</option>
                <option value="replied">Ответ получен 🔥</option>
                <option value="in_negotiation">В переговорах</option>
              </select>

              {/* View Switcher (Segmented Control) */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
                <button
                  onClick={() => onViewModeChange('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'kanban'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Канбан-доска"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Канбан</span>
                </button>
                <button
                  onClick={() => onViewModeChange('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Таблица"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Таблица</span>
                </button>
              </div>
            </>
          )}

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 card-shadow transition-all disabled:opacity-50 cursor-pointer"
            title="Обновить данные"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
