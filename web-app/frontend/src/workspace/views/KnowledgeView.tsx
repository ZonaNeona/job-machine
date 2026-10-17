import React, { useMemo, useState } from 'react';
import { BookOpen, Info, Plus, Search, Trash2, X } from 'lucide-react';
import { KnowledgeBaseItem } from '../../types';
import { formatDate } from '../lib';
import { EmptyState, Spinner } from '../components/ui';

interface KnowledgeViewProps {
  items: KnowledgeBaseItem[];
  busy: boolean;
  onAdd: (item: Omit<KnowledgeBaseItem, 'id' | 'created_at'>) => Promise<unknown>;
  onRemove: (id: number) => void;
}

const CATEGORIES = [
  { id: 'case_study', label: 'Кейсы', className: '' },
  { id: 'stack', label: 'Стек', className: 'stack' },
  { id: 'tone_of_voice', label: 'Голос', className: 'tone_of_voice' },
  { id: 'about_me', label: 'Обо мне', className: 'about_me' },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((item) => [item.id, item.label]));

export function KnowledgeView({ items, busy, onAdd, onRemove }: KnowledgeViewProps) {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', category: 'case_study', tags: '', content: '' });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => !query || `${item.title} ${item.content} ${item.tags ?? ''}`.toLowerCase().includes(query));
  }, [items, category, search]);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        title: form.title.trim(),
        category: form.category,
        content: form.content.trim(),
        tags: form.tags.trim(),
        is_active: true,
      });
      setForm({ title: '', category: 'case_study', tags: '', content: '' });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="kb-hint">
        <Info size={15} />
        <span>
          Эти записи подмешиваются в генерацию офферов. Чем конкретнее цифры и формулировки — тем меньше шансов,
          что модель начнёт выдумывать опыт. Один кейс = одна проверяемая история.
        </span>
      </div>

      <div className="kb-toolbar">
        <div className="chips">
          <button type="button" className={`chip ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>
            Все <span className="chip-count">{items.length}</span>
          </button>
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${category === item.id ? 'active' : ''}`}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
              <span className="chip-count">{items.filter((kb) => kb.category === item.id).length}</span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div className="input-wrap" style={{ width: 220 }}>
          <Search size={13} />
          <input
            className="input sm"
            placeholder="Поиск по базе…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={13} /> Добавить кейс
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<BookOpen size={18} />}
            title="Здесь пока пусто"
            hint="Добавь первый кейс с цифрой — он станет опорой для будущих офферов."
            action={<button type="button" className="btn btn-sm mt-8" onClick={() => setOpen(true)}><Plus size={12} /> Добавить кейс</button>}
          />
        </div>
      ) : (
        <div className="kb-grid">
          {filtered.map((item) => (
            <article className="kb-card" key={item.id}>
              <div className="kb-card-top">
                <span className={`kb-cat ${CATEGORIES.find((cat) => cat.id === item.category)?.className ?? ''}`}>
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </span>
                {pendingDelete === item.id ? (
                  <span className="row" style={{ gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => { onRemove(item.id); setPendingDelete(null); }}
                    >
                      Удалить
                    </button>
                    <button type="button" className="icon-btn sm" onClick={() => setPendingDelete(null)}><X size={12} /></button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="icon-btn sm"
                    title="Удалить кейс"
                    onClick={() => setPendingDelete(item.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="kb-title">{item.title}</div>
              <div className="kb-text">{item.content}</div>
              <div className="kb-foot">
                <div className="kb-tags">
                  {(item.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 4).map((tag) => (
                    <span className="tag" key={tag}>{tag}</span>
                  ))}
                </div>
                <span className="kb-date">{formatDate(item.created_at)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div
          className="overlay center"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <div className="modal-title">Новый кейс в базу знаний</div>
                <div className="modal-sub">Факт, цифра, конкретное решение — без общих слов</div>
              </div>
              <button type="button" className="icon-btn sm" onClick={() => setOpen(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">Название</label>
                <input
                  className="input"
                  placeholder="RAG-бот для клиники: −70% ручных запросов"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label">Категория</label>
                <select
                  className="select"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Теги <span>через запятую</span></label>
                <input
                  className="input"
                  placeholder="RAG, pgvector, FastAPI, Telegram"
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label">Что сделано и какой результат</label>
                <textarea
                  className="textarea"
                  rows={7}
                  placeholder="Задача, решение, стек, цифры, сроки. Одна история — один кейс."
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={saving || busy || !form.title.trim() || !form.content.trim()}
              >
                {saving ? <Spinner size={13} /> : <Plus size={13} />} Сохранить кейс
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
