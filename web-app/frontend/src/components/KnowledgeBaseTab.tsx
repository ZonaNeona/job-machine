import React, { useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Check, 
  Tag, 
  Sparkles, 
  Code, 
  MessageSquare,
  FileText
} from 'lucide-react';
import { KnowledgeBaseItem } from '../types';

interface KnowledgeBaseTabProps {
  items: KnowledgeBaseItem[];
  onAddItem: (item: Omit<KnowledgeBaseItem, 'id' | 'created_at'>) => Promise<void>;
  onDeleteItem: (id: number) => Promise<void>;
}

export const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({
  items,
  onAddItem,
  onDeleteItem
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<KnowledgeBaseItem['category']>('case_study');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSaving(true);
    try {
      await onAddItem({
        title: newTitle,
        category: newCategory,
        content: newContent,
        tags: newTags,
        is_active: true
      });
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      setIsAdding(false);
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'case_study':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-50 text-violet-700 border border-violet-200/80">
            Кейс проекта
          </span>
        );
      case 'stack':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-cyan-50 text-cyan-800 border border-cyan-200/80">
            Стек & Технологии
          </span>
        );
      case 'tone_of_voice':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
            Tone of Voice & Правила
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
            О себе & Формат
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white border border-slate-200/80 rounded-2xl card-shadow">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-['Inter']">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            База знаний разработчика & Оффер-матрица
          </h2>
          <p className="text-xs text-slate-500">
            ИИ берет реальные данные и кейсы отсюда для составления конвертящих откликов с пруфами и метриками.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? 'Отмена' : 'Добавить кейс / правило'}</span>
        </button>
      </div>

      {/* Add New Item Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="p-6 bg-white border border-indigo-200/90 rounded-2xl space-y-4 card-shadow animate-fade-in">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-['Inter']">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Новая запись в базу знаний
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 font-medium">Заголовок кейса / навыка:</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Например: Кейс: RAG-бот с Claude 3.5 для e-commerce"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 font-medium">Категория:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium cursor-pointer"
              >
                <option value="case_study">Кейс проекта (Проблема → Решение → Результат)</option>
                <option value="stack">Стек & Компетенции</option>
                <option value="tone_of_voice">Tone of Voice & Стоп-слова</option>
                <option value="about_me">Формат работы & Условия</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-600 font-medium">
              Содержание (детали, стек, цифры, факты, ссылки на демо):
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Опишите, какую задачу решили, какие инструменты использовали, какой измеримый результат получил бизнес..."
              rows={5}
              required
              className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600 font-medium">Теги (через запятую):</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="LLM, FastAPI, Telegram, Telethon"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex justify-end pt-5">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить запись'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between p-6 bg-white border border-slate-200/80 rounded-2xl space-y-4 hover:border-slate-300 card-shadow transition-all group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(item.category)}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight font-['Inter']">
                    {item.title}
                  </h3>
                </div>

                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Удалить запись"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                {item.content}
              </div>
            </div>

            {item.tags && (
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
                {item.tags.split(',').map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200/70"
                  >
                    #{t.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
