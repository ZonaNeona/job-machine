import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  Copy, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  MessageSquare, 
  Archive, 
  FileText,
  Building,
  DollarSign,
  MapPin,
  Tag,
  ShieldCheck
} from 'lucide-react';
import { Lead } from '../types';

interface OfferModalProps {
  lead: Lead | null;
  onClose: () => void;
  onGenerateOffer: (leadId: number, model: string, instructions?: string) => Promise<void>;
  onSendOffer: (leadId: number, offerText: string) => Promise<void>;
  onUpdateStatus: (leadId: number, status: Lead['status']) => Promise<void>;
  isGenerating: boolean;
}

export const OfferModal: React.FC<OfferModalProps> = ({
  lead,
  onClose,
  onGenerateOffer,
  onSendOffer,
  onUpdateStatus,
  isGenerating
}) => {
  if (!lead) return null;

  const [offerText, setOfferText] = useState(lead.generated_offer || '');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.5-sonnet');
  const [customInstructions, setCustomInstructions] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  React.useEffect(() => {
    setOfferText(lead.generated_offer || '');
  }, [lead]);

  const handleCopy = () => {
    navigator.clipboard.writeText(offerText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!offerText.trim()) return;
    setIsSending(true);
    try {
      // 1. Dry-Run Safeguard: Copy to clipboard
      await navigator.clipboard.writeText(offerText);

      // 2. Open direct target contact or platform URL
      let targetUrl = lead.url;
      if (lead.contact_info) {
        const tgMatch = lead.contact_info.match(/@[a-zA-Z0-9_]+/);
        if (tgMatch) {
          targetUrl = `https://t.me/${tgMatch[0].replace('@', '')}`;
        }
      }
      if (targetUrl && targetUrl !== '#') {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }

      // 3. Mark as sent
      await onSendOffer(lead.id, offerText);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const handleRegenerate = async () => {
    await onGenerateOffer(lead.id, selectedModel, customInstructions);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-700 border-emerald-200 bg-emerald-50';
    if (score >= 75) return 'text-indigo-700 border-indigo-200 bg-indigo-50';
    if (score >= 60) return 'text-amber-700 border-amber-200 bg-amber-50';
    return 'text-slate-600 border-slate-200 bg-slate-100';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white border border-slate-200/90 rounded-2xl popover-shadow overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="space-y-2 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${getScoreColor(lead.match_score)}`}>
                Match Score: {lead.match_score}%
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-white text-slate-700 border border-slate-200 card-shadow">
                {lead.source}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {lead.external_id || `#${lead.id}`}
              </span>
              {lead.url && (
                <a
                  href={lead.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors ml-1"
                >
                  <span>Открыть оригинал</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">{lead.title}</h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              {lead.company && (
                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                  <Building className="w-4 h-4 text-slate-400" />
                  {lead.company}
                </span>
              )}
              <span className="flex items-center gap-1 font-mono font-bold text-emerald-700">
                <DollarSign className="w-4 h-4" />
                {lead.salary_raw || 'По договоренности'}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                {lead.location || 'Удаленно'}
              </span>
              {lead.contact_info && (
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono text-[11px] font-semibold">
                  {lead.contact_info}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Split Screen) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 overflow-y-auto">
          {/* Left Side: Requirements & AI Analysis */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] md:max-h-[70vh]">
            {/* AI Reasoning Callout */}
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider font-mono">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                AI-Анализ & Выделенные боли
              </div>
              <p className="text-xs text-indigo-950/80 leading-relaxed font-medium">
                {lead.scoring_reason || 'Анализ соответствия стеку и требованиям.'}
              </p>
            </div>

            {/* Tags */}
            {lead.tags && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Стек и навыки:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.split(',').map((tag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-50 text-slate-700 border border-slate-200/80"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full Job Description */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Исходный текст заказа / вакансии:
              </span>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans max-h-80 overflow-y-auto">
                {lead.description}
              </div>
            </div>
          </div>

          {/* Right Side: AI Offer Studio Editor */}
          <div className="p-6 space-y-4 flex flex-col justify-between overflow-y-auto max-h-[60vh] md:max-h-[70vh]">
            <div className="space-y-3.5">
              {/* Header Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Персонализированный отклик</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 font-mono card-shadow cursor-pointer font-medium"
                  >
                    <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="deepseek/deepseek-chat">DeepSeek V3</option>
                    <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                    <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                  </select>

                  <button
                    onClick={handleRegenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>{isGenerating ? 'Генерация...' : 'Перегенерировать'}</span>
                  </button>
                </div>
              </div>

              {/* Offer Text Editor */}
              <div className="relative">
                <textarea
                  value={offerText}
                  onChange={(e) => setOfferText(e.target.value)}
                  placeholder="Сгенерируйте отклик через ИИ или введите текст..."
                  rows={11}
                  className="w-full p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono leading-relaxed resize-none card-shadow"
                />
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 card-shadow transition-all text-xs flex items-center gap-1.5 cursor-pointer font-medium"
                  title="Копировать текст"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>

              {/* Custom Prompt Instructions */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider font-mono">
                  Специальные указания для ИИ (опционально):
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Например: 'Сделай акцент на Telethon и предложи аудит бесплатно'"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 card-shadow"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateStatus(lead.id, 'in_negotiation')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>В переговоры</span>
                </button>

                <button
                  onClick={() => onUpdateStatus(lead.id, 'archived')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 text-xs font-medium transition-all cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>В архив</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Dry-Run: буфер + переход
                </span>
                <button
                  onClick={handleSend}
                  disabled={isSending || !offerText.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Отправка...' : '⚡ Скопировать и открыть контакт'}</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
