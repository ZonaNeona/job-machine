import React from 'react';
import { 
  Building, 
  Sparkles, 
  ArrowUpRight,
  CheckCircle2,
  Zap,
  Send
} from 'lucide-react';
import { Lead } from '../types';

interface TableViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onQuickGenerate: (leadId: number) => void;
  onOpenOutreach?: (lead: Lead) => void;
  generatingLeadId: number | null;
}

export const TableView: React.FC<TableViewProps> = ({
  leads,
  onSelectLead,
  onQuickGenerate,
  onOpenOutreach,
  generatingLeadId
}) => {
  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'new':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">Новый</span>;
      case 'ai_scored':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">Скоринг пройден</span>;
      case 'offer_generated':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-violet-50 text-violet-700 border border-violet-200 font-medium">Оффер готов</span>;
      case 'sent':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-medium">Отправлен</span>;
      case 'replied':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold animate-pulse">Ответ получен 🔥</span>;
      case 'in_negotiation':
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-amber-50 text-amber-700 border border-amber-200 font-medium">В переговорах</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 text-slate-500">Архив</span>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 75) return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-slate-600 bg-slate-100 border-slate-200';
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'hh.ru':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'telegram':
        return 'text-sky-700 bg-sky-50 border-sky-200';
      default:
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden card-shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 font-mono uppercase text-[11px]">
            <tr>
              <th className="py-4 px-5 font-semibold">Match Score</th>
              <th className="py-4 px-5 font-semibold">Вакансия / Заказ</th>
              <th className="py-4 px-5 font-semibold">Источник</th>
              <th className="py-4 px-5 font-semibold">Оплата / Вилка</th>
              <th className="py-4 px-5 font-semibold">Статус</th>
              <th className="py-4 px-5 font-semibold">Оффер</th>
              <th className="py-4 px-5 font-semibold text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const isGenerating = generatingLeadId === lead.id;

              return (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                >
                  {/* Score */}
                  <td className="py-4 px-5">
                    <span className={`inline-block px-2.5 py-1 rounded-md font-mono font-bold text-xs border ${getScoreBadge(lead.match_score)}`}>
                      {lead.match_score}%
                    </span>
                  </td>

                  {/* Title & Company */}
                  <td className="py-4 px-5 max-w-md">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {lead.title}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        {lead.company && (
                          <span className="flex items-center gap-1 font-medium">
                            <Building className="w-3 h-3 text-slate-400" />
                            {lead.company}
                          </span>
                        )}
                        <span>{lead.location || 'Удаленно'}</span>
                      </div>
                    </div>
                  </td>

                  {/* Source */}
                  <td className="py-4 px-5">
                    <span className={`px-2.5 py-0.5 rounded-md font-mono text-[11px] font-medium border ${getSourceBadge(lead.source)}`}>
                      {lead.source}
                    </span>
                  </td>

                  {/* Salary */}
                  <td className="py-4 px-5 font-mono font-bold text-emerald-700">
                    {lead.salary_raw || 'По договоренности'}
                  </td>

                  {/* Status */}
                  <td className="py-4 px-5">
                    {getStatusBadge(lead.status)}
                  </td>

                  {/* Offer status */}
                  <td className="py-4 px-5">
                    {lead.generated_offer ? (
                      <span className="inline-flex items-center gap-1 text-violet-700 font-mono text-[11px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Готов
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickGenerate(lead.id);
                        }}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-medium transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                        <span>{isGenerating ? 'AI...' : 'Сгенерировать'}</span>
                      </button>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {lead.status !== 'sent' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenOutreach) onOpenOutreach(lead);
                            else onSelectLead(lead);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs shadow-indigo-600/20 transition-all cursor-pointer"
                          title="Быстрый отклик с проверкой (Dry-Run)"
                        >
                          <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                          <span>Отклик</span>
                        </button>
                      )}
                      {lead.status === 'sent' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Отправлен
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 group-hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                        title="Подробная карточка заказа"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-400 text-xs font-medium">
                  Лиды по выбранным критериям не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
