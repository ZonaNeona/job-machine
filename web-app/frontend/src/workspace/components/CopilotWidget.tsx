import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../../api';
import { Lead } from '../../types';
import { Spinner } from './ui';

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface CopilotWidgetProps {
  currentLead?: Lead | null;
  onSelectLead?: (leadId: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  notify?: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

const QUICK_PROMPTS = [
  { label: '🔥 Топ заказов на сегодня', query: 'Покажи топ-3 заказа с максимальным Sweet Spot на сегодня' },
  { label: '📊 Какая площадка хуже всего?', query: 'Какая площадка сейчас хуже всего работает и где больше всего шума?' },
  { label: '📉 Аудит воронки', query: 'Проведи аудит воронки и покажи наши узкие места' },
];

export function CopilotWidget({ currentLead, onSelectLead, isOpen, onToggle, notify }: CopilotWidgetProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Привет! Я подключен к базе данных конвейера. Могу провести аудит источников, найти самые выгодные заказы дня или оценить скрытые риски и бюджет любого ТЗ.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: CopilotMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const payloadMessages = nextHistory.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.postCopilotChat(payloadMessages, currentLead?.id);

      const assistantMsg: CopilotMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: res.reply || 'Ответ не получен',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...nextHistory, assistantMsg]);
    } catch (err) {
      const errorMsg: CopilotMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `Ошибка связи с копилотом: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...nextHistory, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: String(Date.now()),
        role: 'assistant',
        content: 'История очищена. Чем могу помочь?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          title="Открыть ИИ-Копилота"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 9999,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.35)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
          className="copilot-pill-btn"
        >
          <span style={{ position: 'relative', display: 'flex' }}>
            <Sparkles size={16} color="#38bdf8" />
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
          </span>
          <span>ИИ-Копилот</span>
          {currentLead && (
            <span
              style={{
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 9999,
              }}
            >
              #{currentLead.id}
            </span>
          )}
        </button>
      )}

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 440,
            maxWidth: 'calc(100vw - 32px)',
            height: 600,
            maxHeight: 'calc(100vh - 48px)',
            zIndex: 950,
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 20px 48px -8px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>
                  ИИ-Копилот конвейера
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {currentLead ? (
                    <span style={{ color: '#0284c7', fontWeight: 500 }}>
                      Контекст: Лид #{currentLead.id} ({currentLead.source})
                    </span>
                  ) : (
                    'Вся база данных (166+ лидов)'
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="icon-btn sm"
                title="Очистить чат"
                onClick={clearChat}
              >
                <Trash2 size={13} />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                title="Свернуть"
                onClick={onToggle}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #f1f5f9',
              background: '#ffffff',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
            }}
          >
            {currentLead && (
              <button
                type="button"
                className="slice-pill"
                style={{ fontSize: 11, padding: '3px 9px', whiteSpace: 'nowrap' }}
                onClick={() => handleSend(`Разбери подробно лид #${currentLead.id}: какие риски в ТЗ, какую вилку цены назвать и какой наш кейс лучше всего сослаться?`)}
              >
                🎯 Оценить лид #{currentLead.id}
              </button>
            )}
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="slice-pill"
                style={{ fontSize: 11, padding: '3px 9px', whiteSpace: 'nowrap' }}
                onClick={() => handleSend(p.query)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: '#fafbfc',
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '90%',
                    padding: '9px 13px',
                    borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: m.role === 'user' ? '#0f172a' : '#ffffff',
                    color: m.role === 'user' ? '#f8fafc' : '#1e293b',
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    boxShadow: m.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                    border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, padding: '0 4px' }}>
                  {m.timestamp}
                </span>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', color: '#64748b', fontSize: 12 }}>
                <Spinner size={14} />
                <span>Копилот анализирует базу данных...</span>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <textarea
                ref={inputRef}
                value={input}
                rows={2}
                placeholder="Спросить о заказах, площадках, ставках..."
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                style={{
                  flex: 1,
                  resize: 'none',
                  fontSize: 12.5,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="btn btn-primary"
                style={{ height: 46, padding: '0 14px', borderRadius: 8 }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
