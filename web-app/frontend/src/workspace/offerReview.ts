import { Lead } from '../types';

export type IssueLevel = 'high' | 'medium' | 'low';

export interface OfferIssue {
  level: IssueLevel;
  label: string;
}

export interface OfferReview {
  score: number;
  verdict: 'excellent' | 'good' | 'risky';
  issues: OfferIssue[];
  stats: {
    chars: number;
    words: number;
    sentences: number;
    avgSentence: number;
    paragraphs: number;
  };
  similarity: { score: number; title: string } | null;
}

const CLICHES: { re: RegExp; label: string }[] = [
  { re: /меня зовут/i, label: '«Меня зовут…» — шаблонное вступление, имя есть в подписи' },
  { re: /(я|мы)\s+ознакомил/i, label: '«Ознакомился с вакансией» — это и так понятно' },
  { re: /идеальн\w*\s+кандидат/i, label: '«Идеальный кандидат» — самооценка вместо факта' },
  { re: /богат\w*\s+опыт/i, label: '«Богатый опыт» — без цифры не значит ничего' },
  { re: /буду рад/i, label: '«Буду рад» — вежливая вода' },
  { re: /плодотворн/i, label: '«Плодотворное сотрудничество» — канцелярит' },
  { re: /надеюсь на/i, label: '«Надеюсь на…» — просьба вместо предложения' },
  { re: /в современном мире/i, label: '«В современном мире» — классика ChatGPT' },
  { re: /(стоит|важно|необходимо)\s+отметить/i, label: '«Стоит отметить» — вода' },
  { re: /таким образом|в заключение|подводя итог/i, label: 'Финальные связки из эссе' },
  { re: /данн(ый|ая|ое|ые)\s/i, label: '«Данный» — канцелярит' },
  { re: /осуществля/i, label: '«Осуществлять» — канцелярит' },
  { re: /являет(ся|ются)/i, label: '«Является» — канцелярит' },
  { re: /ключев(ой|ая|ое|ые)/i, label: '«Ключевой» — AI-слово' },
  { re: /комплексн(ый|ая|ое|ые)/i, label: '«Комплексный» — AI-слово' },
  { re: /эффективн(ый|ая|ое|ые)/i, label: '«Эффективный» — AI-слово' },
  { re: /инновационн/i, label: '«Инновационный» — AI-слово' },
  { re: /бесшовн/i, label: '«Бесшовный» — AI-слово' },
  { re: /синерг|экосистем/i, label: '«Синергия / экосистема» — AI-слово' },
  { re: /погрузи(ться|мся)/i, label: '«Погрузиться в задачу» — AI-слово' },
  { re: /в рамках/i, label: '«В рамках» — канцелярит' },
  { re: /под\s+ключ|полный\s+цикл|уникальн(ое|ый|ая)/i, label: 'Продающие штампы «под ключ» / «полный цикл»' },
  { re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, label: 'Эмодзи — в личном сообщении выглядят навязчиво' },
  { re: /!/, label: 'Восклицательный знак — лишний напор' },
  { re: /\*\*|^#{1,3}\s|^\s*[-•*]\s/m, label: 'Markdown и списки — это письмо, а не презентация' },
];

const STOP_WORDS = new Set([
  'это', 'что', 'как', 'для', 'или', 'если', 'мне', 'вас', 'ваш', 'ваши', 'мы', 'вы', 'я',
  'не', 'на', 'в', 'с', 'по', 'и', 'но', 'а', 'же', 'бы', 'то', 'так', 'уже', 'ещё', 'еще',
  'всё', 'все', 'можно', 'нужно', 'будет', 'есть', 'чем', 'при', 'из', 'от', 'до', 'за',
  'под', 'над', 'об', 'о', 'их', 'его', 'её', 'ее', 'они', 'она', 'оно', 'когда', 'чтобы',
  'только', 'даже', 'очень', 'просто', 'сейчас', 'потом', 'там', 'тут', 'где', 'ли', 'либо',
  'который', 'которая', 'которые', 'этот', 'эта', 'эти', 'себя', 'нам', 'вам', 'них',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

export function textSimilarity(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((word) => {
    if (right.has(word)) intersection += 1;
  });
  return intersection / (left.size + right.size - intersection);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function analyzeOffer(text: string, lead: Lead, siblings: Lead[] = []): OfferReview {
  const clean = text.trim();
  const stats = {
    chars: clean.length,
    words: clean ? clean.split(/\s+/).length : 0,
    sentences: 0,
    avgSentence: 0,
    paragraphs: clean ? clean.split(/\n{2,}/).filter((part) => part.trim()).length : 0,
  };

  if (!clean) {
    return {
      score: 0,
      verdict: 'risky',
      issues: [{ level: 'high', label: 'Текст пустой — нечего отправлять' }],
      stats,
      similarity: null,
    };
  }

  const sentences = splitSentences(clean);
  stats.sentences = sentences.length;
  stats.avgSentence = Math.round(stats.words / Math.max(1, sentences.length));

  const issues: OfferIssue[] = [];
  const lower = clean.toLowerCase();

  CLICHES.forEach(({ re, label }) => {
    if (re.test(clean)) issues.push({ level: 'high', label });
  });

  // Specificity: does the text actually mention this client's task?
  const keywords = tokenize(`${lead.title} ${lead.company || ''} ${lead.tags || ''}`).slice(0, 24);
  const mentioned = keywords.filter((word) => lower.includes(word));
  const companyMentioned = Boolean(lead.company && lower.includes(lead.company.toLowerCase()));
  if (!companyMentioned && mentioned.length === 0) {
    issues.push({ level: 'medium', label: 'Нет ни одной детали из этой задачи — текст можно отправить кому угодно' });
  }

  if (!/\d/.test(clean)) {
    issues.push({ level: 'low', label: 'Нет ни одной цифры или срока — конкретики мало' });
  }

  if (!/(\?|могу\s+(скинуть|показать|собрать|посчитать|разобрать|набросать|созвон|прислать)|давайте|предлагаю\s+(созвон|коротк))/i.test(clean)) {
    issues.push({ level: 'medium', label: 'Не видно следующего шага — непонятно, что делать после ответа' });
  }

  if (stats.chars < 300) {
    issues.push({ level: 'medium', label: 'Слишком коротко: не хватает пруфа или конкретики' });
  }
  if (stats.chars > 1500) {
    issues.push({ level: 'medium', label: 'Слишком длинно: в чате дочитают вряд ли' });
  }
  if (stats.avgSentence > 26) {
    issues.push({ level: 'medium', label: `Длинные предложения (в среднем ${stats.avgSentence} слов) — разбей` });
  }
  if (stats.chars > 450 && stats.paragraphs < 2) {
    issues.push({ level: 'low', label: 'Один сплошной блок — раздели на 2–3 абзаца' });
  }
  if ((clean.match(/—/g) || []).length > 4) {
    issues.push({ level: 'low', label: 'Много тире — ритм выглядит машинным' });
  }
  const firstPerson = (clean.match(/\bя\b|\bмой\b|\bмне\b|\bменя\b/gi) || []).length;
  if (firstPerson > 9) {
    issues.push({ level: 'low', label: 'Много «я» — переведи фокус на задачу заказчика' });
  }

  let similarity: OfferReview['similarity'] = null;
  siblings.forEach((sibling) => {
    if (sibling.id === lead.id || !sibling.generated_offer?.trim()) return;
    const score = textSimilarity(clean, sibling.generated_offer);
    if (score >= 0.35 && (!similarity || score > similarity.score)) {
      similarity = { score, title: sibling.title };
    }
  });
  if (similarity) {
    issues.push({
      level: 'medium',
      label: `Похоже на оффер для «${similarity.title}» (${Math.round(similarity.score * 100)}%) — нужна своя деталь`,
    });
  }

  const penalty = issues.reduce((sum, issue) => {
    if (issue.level === 'high') return sum + 17;
    if (issue.level === 'medium') return sum + 9;
    return sum + 4;
  }, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const verdict: OfferReview['verdict'] = score >= 85 ? 'excellent' : score >= 60 ? 'good' : 'risky';

  const order: Record<IssueLevel, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);

  return { score, verdict, issues, stats, similarity };
}

