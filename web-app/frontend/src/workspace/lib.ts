import { Lead, LeadStatus, OfferAngle, OfferLength } from '../types';

export interface StageMeta {
  id: LeadStatus;
  label: string;
  short: string;
  hint: string;
  tone: string;
}

export const STAGES: StageMeta[] = [
  { id: 'new', label: 'Входящие', short: 'Новые', hint: 'Только пришли — ещё не разобраны', tone: 'slate' },
  { id: 'ai_scored', label: 'На оценке', short: 'Оценка', hint: 'Проверены, ждут решения', tone: 'sky' },
  { id: 'offer_generated', label: 'Оффер готов', short: 'Оффер', hint: 'Черновик написан, нужна вычитка', tone: 'violet' },
  { id: 'approved', label: 'К отправке', short: 'Апрув', hint: 'Проверено человеком, можно отправлять', tone: 'amber' },
  { id: 'sent', label: 'Ждём ответ', short: 'Отправлен', hint: 'Отправлено, следим за follow-up', tone: 'blue' },
  { id: 'replied', label: 'Ответили', short: 'Ответ', hint: 'Есть ответ — отвечай сегодня', tone: 'emerald' },
  { id: 'in_negotiation', label: 'Переговоры', short: 'Переговоры', hint: 'Созвон, ТЗ, условия', tone: 'orange' },
  { id: 'closed_won', label: 'Сделка', short: 'Сделка', hint: 'Договорились о сотрудничестве', tone: 'green' },
  { id: 'archived', label: 'Архив', short: 'Архив', hint: 'Не подошло или отказались', tone: 'gray' },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((stage) => [stage.id, stage])) as Record<LeadStatus, StageMeta>;

export const PIPELINE_STAGES = STAGES.filter((stage) => stage.id !== 'archived');

export const SOURCES = [
  { id: 'hh.ru', label: 'hh.ru', short: 'hh', tone: 'hh' },
  { id: 'telegram', label: 'Telegram', short: 'TG', tone: 'tg' },
  { id: 'habr_freelance', label: 'Хабр Фриланс', short: 'Хабр', tone: 'habr' },
  { id: 'fl_ru', label: 'FL.ru', short: 'FL', tone: 'fl' },
  { id: 'kwork', label: 'Kwork', short: 'Kwork', tone: 'kwork' },
  { id: 'avito', label: 'Авито Работа', short: 'Авито', tone: 'avito' },
  { id: 'direct', label: 'Вручную', short: 'Ручной', tone: 'direct' },
];

export const SOURCE_MAP = Object.fromEntries(SOURCES.map((source) => [source.id, source]));

export const ANGLES: { id: OfferAngle; label: string; hint: string }[] = [
  { id: 'pain', label: 'Через боль', hint: 'Где сейчас рвётся процесс' },
  { id: 'speed', label: 'Через скорость', hint: 'Что запустим на этой неделе' },
  { id: 'money', label: 'Через деньги', hint: 'Где теряется маржа и время' },
  { id: 'architecture', label: 'Через архитектуру', hint: 'Надёжность и масштаб' },
  { id: 'prototype', label: 'Через прототип', hint: 'Что можно потрогать быстро' },
];

export const LENGTHS: { id: OfferLength; label: string; hint: string }[] = [
  { id: 'short', label: 'Коротко', hint: '450–750 знаков' },
  { id: 'medium', label: 'Средне', hint: '800–1100 знаков' },
];

export const PRIORITIES = [
  { id: 'high', label: 'Высокий', tone: 'high' },
  { id: 'normal', label: 'Обычный', tone: 'normal' },
  { id: 'low', label: 'Низкий', tone: 'low' },
];

export interface CategoryMeta {
  id: string;
  label: string;
  short: string;
  color: string;
  tone: string;
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'ai', label: 'AI & Агенты', short: 'AI / LLM', color: '#8b5cf6', tone: 'ai', emoji: '🟣' },
  { id: 'bots_parsers', label: 'Боты & Парсинг', short: 'Боты/Парсеры', color: '#3b82f6', tone: 'bots', emoji: '🔵' },
  { id: 'web', label: 'Сайты & Web', short: 'Сайты/Web', color: '#10b981', tone: 'web', emoji: '🟢' },
  { id: 'cms', label: 'CMS & Интеграции', short: 'CMS/CRM', color: '#f59e0b', tone: 'cms', emoji: '🟠' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, CategoryMeta>;

export interface DealTypeMeta {
  id: string;
  label: string;
  badge: string;
  tone: string;
  hint: string;
}

export const DEAL_TYPES: DealTypeMeta[] = [
  { id: 'retainer', label: 'Ретейнер', badge: '💎 Ретейнер', tone: 'purple', hint: 'Ежемесячный подряд / постоянный клиент' },
  { id: 'quick', label: 'Быстрый чек', badge: '⚡ Быстрый чек', tone: 'amber', hint: 'Задача на 1-2 дня, быстрый транш' },
  { id: 'project', label: 'Проект/MVP', badge: '🏗 Проект', tone: 'blue', hint: 'Проектная разработка под ключ' },
];

export const DEAL_TYPE_MAP = Object.fromEntries(DEAL_TYPES.map((d) => [d.id, d])) as Record<string, DealTypeMeta>;

export interface UrgencyMeta {
  id: string;
  label: string;
  short: string;
  tone: string;
  pulse: boolean;
}

export const URGENCY_MAP: Record<string, UrgencyMeta> = {
  hot: { id: 'hot', label: 'Горящий (<2ч)', short: 'Срочно', tone: 'danger', pulse: true },
  warm: { id: 'warm', label: 'Свежий (сегодня)', short: 'Свежий', tone: 'warning', pulse: false },
  normal: { id: 'normal', label: 'Плановый', short: 'Обычный', tone: 'muted', pulse: false },
};

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl';

export function plural(count: number, forms: [string, string, string]): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Backend stores naive UTC datetimes — parse them as UTC, not local. */
export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMoney(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
}

export function formatSalary(lead: Pick<Lead, 'salary_raw' | 'salary_min' | 'salary_max'>): string {
  if (lead.salary_min && lead.salary_max) {
    return `${new Intl.NumberFormat('ru-RU').format(lead.salary_min)}–${new Intl.NumberFormat('ru-RU').format(lead.salary_max)} ₽`;
  }
  return lead.salary_raw?.trim() || 'По договорённости';
}

export function formatDate(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
}

export function formatDateTime(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function formatTime(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function relativeTime(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return 'без даты';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн назад`;
  return formatDate(value);
}

export function daysSince(value?: string | null): number {
  const date = parseDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export function formatDue(value?: string | null): { label: string; overdue: boolean; soon: boolean } {
  const date = parseDate(value);
  if (!date) return { label: 'без срока', overdue: false, soon: false };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(date);
  startOfDue.setHours(0, 0, 0, 0);
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000);
  if (days < 0) return { label: `просрочено ${Math.abs(days)} дн`, overdue: true, soon: false };
  if (days === 0) return { label: 'сегодня', overdue: false, soon: true };
  if (days === 1) return { label: 'завтра', overdue: false, soon: true };
  if (days <= 6) return { label: `через ${days} дн`, overdue: false, soon: false };
  return { label: formatDate(value), overdue: false, soon: false };
}

export function scoreTone(score: number): 'high' | 'mid' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 65) return 'mid';
  return 'low';
}

export function parseTags(tags?: string | null): string[] {
  return (tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function initials(value?: string | null): string {
  const clean = (value || '').trim();
  if (!clean) return '·';
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function contactTarget(
  lead: Pick<Lead, 'contact_info' | 'url' | 'source'>,
): { href: string; label: string; kind: 'telegram' | 'email' | 'link' | 'none' } {
  const raw = (lead.contact_info || '').trim();
  const telegram = raw.match(/(?:t\.me\/|@)([a-zA-Z0-9_]{4,32})/);
  if (telegram) {
    return { href: `https://t.me/${telegram[1]}`, label: `@${telegram[1]}`, kind: 'telegram' };
  }
  if (/^https?:\/\//i.test(raw)) {
    return { href: raw, label: raw.replace(/^https?:\/\//, ''), kind: 'link' };
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(raw)) {
    return { href: `mailto:${raw}`, label: raw, kind: 'email' };
  }
  if (lead.url && lead.url !== '#') {
    return { href: lead.url, label: 'Открыть площадку', kind: 'link' };
  }
  return { href: '', label: 'Контакт не найден', kind: 'none' };
}
