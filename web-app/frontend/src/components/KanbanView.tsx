import React from 'react';
import { 
  Sparkles, 
  Building, 
  ArrowRight,
  Send,
  MessageSquare,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { Lead } from '../types';

interface KanbanViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onQuickGenerate: (leadId: number) => void;
  onOpenOutreach?: (lead: Lead) => void;
  generatingLeadId: number | null;
}

const COLUMNS: { id: Lead['status'] | string; title: string; color: string; dotColor: string }[] = [
  { id: 'new', title: 'Новые лиды', color: 'border-slate-200 bg-slate-100/70', dotColor: 'bg-slate-400' },
  { id: 'ai_scored', title: 'Отобраны ИИ', color: 'border-indigo-200/80 bg-indigo-50/40', dotColor: 'bg-indigo-500' },
  { id: 'offer_generated', title: 'Оффер готов', color: 'border-violet-200/80 bg-violet-50/40', dotColor: 'bg-violet-500' },
  { id: 'sent', title: 'Отправлен отклик', color: 'border-blue-200/80 bg-blue-50/40', dotColor: 'bg-blue-500' },
  { id: 'replied', title: 'Ответ получен 🔥', color: 'border-emerald-200/80 bg-emerald-50/40', dotColor: 'bg-emerald-500' },
  { id: 'in_negotiation', title: 'В переговорах', color: 'border-amber-200/80 bg-amber-50/40', dotColor: 'bg-amber-500' },
];

export const KanbanView: React.FC<KanbanViewProps> = ({
  leads,
  onSelectLead,
  onQuickGenerate,
  generatingLeadId
}) => {
  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200/90';
    if (score >= 75) return 'text-indigo-700 bg-indigo-50 border-indigo-200/90';
    if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200/90';
    return 'text-slate-600 bg-slate-100 border-slate-200';
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'hh.ru':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'telegram':
        return 'text-sky-700 bg-sky-50 border-sky-200';
      case 'habr_freelance':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      default:
        return 'text-amber-700 bg-amber-50 border-amber-200';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colLeads = leads.filter((l) => l.status === col.id);

        return (
          <div
            key={col.id}
            className={`flex flex-col rounded-2xl border ${col.color} p-3.5 min-w-[270px] h-[75vh]`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <h3 className="text-xs font-bold text-slate-800 tracking-tight">{col.title}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white text-slate-700 border border-slate-200 card-shadow">
                {colLeads.length}
              </span>
            </div>

            {/* Column Content */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {colLeads.map((lead) => {
                const isGenerating = generatingLeadId === lead.id;

                return (
                  <div
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className="group bg-white border border-slate-200/90 hover:border-indigo-400/80 rounded-xl p-4 space-y-2.5 transition-all cursor-pointer card-shadow card-shadow-hover"
                  >
                    {/* Top Row: Score & Source */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border ${getScoreBadge(lead.match_score)}`}>
                        {lead.match_score}% match
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border ${getSourceBadge(lead.source)}`}>
                        {lead.source}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                      {lead.title}
                    </h4>

                    {/* Company & Salary */}
                    <div className="space-y-1 text-[11px]">
                      {lead.company && (
                        <div className="flex items-center gap-1.5 text-slate-500 truncate">
                          <Building className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate font-medium">{lead.company}</span>
                        </div>
                      )}
                      <div className="text-emerald-700 font-mono font-bold">
                        {lead.salary_raw || 'По договоренности'}
                      </div>
                    </div>

                    {/* Tags preview */}
                    {lead.tags && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {lead.tags.split(',').slice(0, 3).map((t, idx) => (
                          <span key={idx} className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-50 text-slate-600 border border-slate-200/70">
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between text-[11px] gap-2">
                      <span className="text-slate-400 group-hover:text-indigo-600 font-medium flex items-center gap-1 transition-colors">
                        Открыть <ArrowRight className="w-3 h-3" />
                      </span>

                      <div className="flex items-center gap-1.5">
                        {lead.status !== 'sent' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLead(lead);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs shadow-indigo-600/20 transition-all cursor-pointer"
                            title="Быстрый отклик с проверкой (Dry-Run)"
                          >
                            <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                            <span>Отклик</span>
                          </button>
                        )}
                        {lead.status === 'sent' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Отправлен
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {colLeads.length === 0 && (
                <div className="h-28 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-medium">
                  Нет лидов
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
