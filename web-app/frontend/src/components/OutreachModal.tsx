import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Send, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  Sparkles, 
  MessageSquare, 
  Mail, 
  Globe, 
  AlertCircle,
  Building,
  RefreshCw,
  Archive,
  CheckCircle2
} from 'lucide-react';
import { Lead } from '../types';

interface OutreachModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onDispatch: (leadId: number, offerText: string, channel: string) => Promise<void>;
  onGenerateOffer: (leadId: number) => Promise<string>;
  onUpdateStatus: (leadId: number, status: Lead['status']) => Promise<void>;
}

interface Destination {
  id: string;
  type: 'telegram' | 'email' | 'web';
  label: string;
  target: string;
  url: string;
  badge: string;
  description: string;
}

export const OutreachModal: React.FC<OutreachModalProps> = ({
  lead,
  isOpen,
  onClose,
  onDispatch,
  onGenerateOffer,
  onUpdateStatus,
}) => {
  if (!isOpen || !lead) return null;

  const [offerText, setOfferText] = useState(lead.generated_offer || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedDestId, setSelectedDestId] = useState<string>('');

  // Extract all possible contact destinations
  const destinations: Destination[] = [];

  if (lead.contact_info) {
    // Telegram handles
    const tgMatches = lead.contact_info.match(/@[a-zA-Z0-9_]+/g);
    if (tgMatches) {
      tgMatches.forEach((tg, idx) => {
        const username = tg.replace('@', '');
        destinations.push({
          id: `tg-${idx}`,
          type: 'telegram',
          label: `Telegram @${username}`,
          target: `@${username}`,
          url: `https://t.me/${username}`,
          badge: 'Telegram',
          description: 'Откроет личный диалог с заказчиком в Telegram'
        });
      });
    }

    // Email
    const emailMatches = lead.contact_info.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      emailMatches.forEach((email, idx) => {
        destinations.push({
          id: `email-${idx}`,
          type: 'email',
          label: `Email: ${email}`,
          target: email,
          url: `mailto:${email}?subject=${encodeURIComponent('Отклик на проект: ' + lead.title)}`,
          badge: 'Email',
          description: 'Создаст черновик письма в почтовом клиенте'
        });
      });
    }
  }

  // Web Platform project link
  if (lead.url) {
    let platformLabel = 'Страница заказа';
    if (lead.source === 'kwork') platformLabel = 'Проект на Kwork';
    else if (lead.source === 'fl_ru') platformLabel = 'Заказ на FL.ru';
    else if (lead.source === 'habr_freelance') platformLabel = 'Хабр Карьера';
    else if (lead.source === 'hh.ru') platformLabel = 'Вакансия на hh.ru';
    else if (lead.source === 'avito') platformLabel = 'Вакансия на Авито';
    else if (lead.source === 'telegram') platformLabel = 'Сообщение в Telegram';

    destinations.push({
      id: 'web-platform',
      type: 'web',
      label: platformLabel,
      target: lead.url,
      url: lead.url,
      badge: lead.source,
      description: 'Откроет прямую страницу публикации для отклика'
    });
  }

  // Fallback if no destination detected
  if (destinations.length === 0) {
    destinations.push({
      id: 'generic',
      type: 'web',
      label: 'Ручной отклик',
      target: 'Буфер обмена',
      url: lead.url || '#',
      badge: lead.source,
      description: 'Текст будет скопирован в буфер для отправки вручную'
    });
  }

  // Set default selected destination
  useEffect(() => {
    if (destinations.length > 0 && !selectedDestId) {
      setSelectedDestId(destinations[0].id);
    }
  }, [destinations, selectedDestId]);

  // Update offerText if lead changes
  useEffect(() => {
    setOfferText(lead.generated_offer || '');
    if (!lead.generated_offer) {
      handleAutoGenerate();
    }
  }, [lead.id]);

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const generated = await onGenerateOffer(lead.id);
      setOfferText(generated);
    } catch (err) {
      console.error('Failed to auto-generate offer:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyOnly = () => {
    if (!offerText) return;
    navigator.clipboard.writeText(offerText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmAndDispatch = async () => {
    if (!offerText.trim()) {
      alert('Пожалуйста, сгенерируйте или введите текст отклика');
      return;
    }

    setIsDispatching(true);
    try {
      // 1. Copy to clipboard
      await navigator.clipboard.writeText(offerText);

      // 2. Open selected channel destination in new tab / app
      const activeDest = destinations.find(d => d.id === selectedDestId) || destinations[0];
      if (activeDest.url && activeDest.url !== '#') {
        window.open(activeDest.url, '_blank', 'noopener,noreferrer');
      }

      // 3. Mark as sent on backend with Human-in-the-Loop confirmed flag
      await onDispatch(lead.id, offerText, activeDest.type);

      onClose();
    } catch (err) {
      console.error('Dispatch error:', err);
      alert('Ошибка при подтверждении отклика');
    } finally {
      setIsDispatching(false);
    }
  };

  const activeDestination = destinations.find(d => d.id === selectedDestId) || destinations[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200/90 rounded-2xl popover-shadow overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Dry-Run: Human-in-the-Loop
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500">
                Лид #{lead.id}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 line-clamp-1 leading-snug">
              {lead.title}
            </h3>
            {lead.company && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Building className="w-3 h-3 text-slate-400" />
                <span>{lead.company}</span>
                <span>•</span>
                <span className="text-emerald-700 font-mono font-bold">{lead.salary_raw || 'По договоренности'}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safeguard Notice Box */}
        <div className="px-6 py-2.5 bg-amber-50/80 border-b border-amber-100 flex items-center gap-2.5 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-tight">
            <strong>Защита от спама:</strong> Сообщение <u>не</u> отправляется автоматически. Вы лично утверждаете текст, он копируется в буфер, и открывается прямая ссылка на контакт.
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Target Channel Destination Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Куда откликаемся (Точка контакта):</span>
              <span className="text-slate-400 font-normal">Найдено каналов: {destinations.length}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {destinations.map((dest) => {
                const isSelected = dest.id === selectedDestId;
                return (
                  <div
                    key={dest.id}
                    onClick={() => setSelectedDestId(dest.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      dest.type === 'telegram' ? 'bg-sky-100 text-sky-700' :
                      dest.type === 'email' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {dest.type === 'telegram' && <MessageSquare className="w-4 h-4" />}
                      {dest.type === 'email' && <Mail className="w-4 h-4" />}
                      {dest.type === 'web' && <Globe className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate flex items-center justify-between">
                        <span>{dest.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {dest.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Offer Proposal Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Текст отклика (Pain-Hook-Proof-CTA):</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoGenerate}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Перегенерировать оффер"
                >
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Генерация...' : 'Перегенерировать'}</span>
                </button>
                <button
                  onClick={handleCopyOnly}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Скопировать только текст"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                placeholder={isGenerating ? "ИИ формулирует персональный отклик под боли вакансии..." : "Введите или скорректируйте текст..."}
                rows={8}
                disabled={isGenerating}
                className="w-full p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono leading-relaxed resize-none card-shadow"
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-2xs flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-2 text-indigo-700 text-xs font-semibold">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Сборка персонального оффера...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Символов: {offerText.length}</span>
              <span>Формула: Боль $\rightarrow$ Крючок $\rightarrow$ Кейс $\rightarrow$ Призыв</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onUpdateStatus(lead.id, 'archived');
                onClose();
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>В архив</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Отмена
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmAndDispatch}
              disabled={isDispatching || isGenerating || !offerText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isDispatching ? 'Подтверждение...' : '⚡ Скопировать и открыть контакт'}</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
