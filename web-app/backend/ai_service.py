import os
import json
import httpx
from typing import List, Dict, Any, Optional

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
DEFAULT_MODEL = os.getenv("OPENROUTER_DEFAULT_MODEL", "anthropic/claude-3.5-sonnet")
SCORING_MODEL = os.getenv("OPENROUTER_SCORING_MODEL", "deepseek/deepseek-chat")

async def call_openrouter(messages: List[Dict[str, str]], model: str = DEFAULT_MODEL, temperature: float = 0.7) -> str:
    """Calls OpenRouter API with provided messages or raises error if unconfigured."""
    api_key = os.getenv("OPENROUTER_API_KEY", OPENROUTER_API_KEY)
    if not api_key or "your_openrouter_api_key" in api_key:
        raise ValueError("OPENROUTER_API_KEY не установлен в .env")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://job-machine.local",
        "X-Title": "JobMachine Outreach Agent",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 1500
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


async def score_lead(title: str, description: str, kb_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates lead compatibility with target profile (LLM/AI, Telegram bots, automation, remote).
    Returns match_score (0-100) and detailed reasoning.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", OPENROUTER_API_KEY)
    
    # If API key is available, use LLM
    if api_key and "your_openrouter_api_key" not in api_key:
        prompt = f"""Ты — строгий технический директор и агент лидогенерации для Senior AI & Automation инженера.
Твоя цель: оценить вакансию/заказ по 100-балльной шкале на соответствие целевому профилю.

Целевой профиль исполнителя:
- Эксперт по LLM/AI (интеграция GPT-4o, Claude, DeepSeek, RAG, embeddings, AI-агенты, LangChain/LlamaIndex)
- Автоматизация бизнес-процессов, парсинг данных, API-интеграции
- Сложные Telegram-боты (aiogram, Telethon, платежи, админки, webapps)
- Формат: УДАЛЕНКА, проектная работа / контракт / парт-тайм (ставка ориентир 80 000 - 120 000 руб./мес.)
- География: РФ или русскоязычные заказчики за рубежом.

Вакансия/Заказ:
Название: {title}
Описание: {description}

Верни СТРОГО валидный JSON следующего формата (без markdown разметки):
{{
  "match_score": 85,
  "scoring_reason": "Краткое обоснование: какие задачи идеально попадают в стек, какие боли у заказчика, и есть ли стоп-факторы (например, требование офиса или легаси)."
}}
"""
        try:
            raw_response = await call_openrouter([{"role": "user", "content": prompt}], model=SCORING_MODEL, temperature=0.2)
            cleaned = raw_response.strip().replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            return {
                "match_score": int(data.get("match_score", 70)),
                "scoring_reason": data.get("scoring_reason", "Оценка получена от AI-модели.")
            }
        except Exception as e:
            print(f"Error in LLM scoring: {e}")

    # Smart fallback heuristic scoring when OpenRouter key is pending
    desc_lower = (title + " " + description).lower()
    score = 40
    reasons = []

    # Positives
    if any(k in desc_lower for k in ["llm", "нейросеть", "gpt", "rag", "ии", "ai", "langchain", "llama"]):
        score += 30
        reasons.append("Явный фокус на LLM/AI технологиях")
    if any(k in desc_lower for k in ["telegram", "телеграм", "aiogram", "telethon", "бот"]):
        score += 25
        reasons.append("Требуется разработка или развитие Telegram-инфраструктуры")
    if any(k in desc_lower for k in ["автоматизаци", "парсинг", "интеграци", "fastapi", "python"]):
        score += 15
        reasons.append("Релевантный стек (Python, FastAPI, интеграции)")
    if any(k in desc_lower for k in ["удален", "remote", "парт-тайм", "проект", "подряд"]):
        score += 10
        reasons.append("Подходящий удаленный/проектный формат")

    # Negatives
    if any(k in desc_lower for k in ["только офис", "гибрид москва", "строго офис"]):
        score -= 40
        reasons.append("Внимание: требование работы в офисе")
    if any(k in desc_lower for k in ["1с", "php", "wordpress", "bitrix", "битрикс"]):
        score -= 20
        reasons.append("Нецелевой легаси-стек")

    score = max(10, min(98, score))
    reason_str = " | ".join(reasons) if reasons else "Базовое соответствие профилю"

    return {
        "match_score": score,
        "scoring_reason": reason_str
    }



ANGLE_GUIDES = {
    "pain": "Главный акцент — на боли из ТЗ. Покажи, что понял, где именно сейчас рвётся процесс и что сломается, если оставить как есть.",
    "speed": "Главный акцент — на скорости выхода в результат. Что можно запустить на этой неделе, а что делать не нужно вовсе.",
    "money": "Главный акцент — на деньгах: где теряется маржа, время или токены и как это окупается.",
    "architecture": "Главный акцент — на архитектуре и надёжности: границы сервисов, логирование, цена ошибки, поведение при росте.",
    "prototype": "Главный акцент — на рабочем прототипе: что можно потрогать через несколько дней, без долгого ТЗ.",
}

LENGTH_TARGETS = {
    "short": "2 абзаца, 450–750 знаков. Читается за 20–30 секунд.",
    "medium": "3 абзаца, 800–1100 знаков. Читается за 40 секунд.",
}

OPENING_STYLES = [
    "Первая фраза — наблюдение по существу задачи, без приветствия и представления.",
    "Первая фраза — короткий конкретный вопрос по задаче, который показывает, что ТЗ прочитано.",
    "Первая фраза — как эту задачу обычно ломают и что здесь важно не повторить.",
]


def _fallback_offer(
    title: str,
    company: Optional[str],
    description: str,
    kb_cases: List[Dict[str, Any]],
    angle: str,
    length: str,
) -> str:
    """Deterministic draft used only when OpenRouter is not configured.

    No invented metrics, no fake case studies. The owner finishes it by hand.
    """
    text = " ".join((description or "").split())
    focus = text[:180].rstrip(" .,") if text else title
    case = next((c for c in kb_cases if c.get("content")), None)
    if case:
        case_line = (
            f"Из похожего: {(case.get('title') or 'проект').strip()}. "
            "Детали и цифры могу скинуть отдельно, чтобы не пересказывать их здесь."
        )
    else:
        case_line = (
            "Похожую задачу уже собирал, детали и цифры могу показать отдельно — "
            "здесь важнее не растягивать письмо."
        )

    next_steps = {
        "prototype": "Могу за пару дней собрать узкий прототип на ваших данных и показать, как это работает, до обсуждения бюджета.",
        "money": "Могу посчитать, где именно уходит время и деньги и что даёт быстрый эффект без переписывания всего.",
        "speed": "Могу назвать срок до первого рабочего результата и что для этого нужно с вашей стороны.",
        "architecture": "Могу набросать схему решения и показать узкие места, которые обычно всплывают на второй неделе.",
        "pain": "Могу за 15 минут разобрать вашу задачу и сказать, где реально узкое место.",
    }

    return (
        f"Задача «{title}» — судя по описанию, вопрос в том, чтобы {focus}.\n\n"
        f"{case_line}\n\n"
        f"{next_steps.get(angle, next_steps['pain'])}"
    )



async def generate_tailored_offer(
    title: str,
    company: Optional[str],
    description: str,
    kb_cases: List[Dict[str, Any]],
    custom_instructions: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    angle: str = "pain",
    length: str = "short",
    variation: int = 0,
) -> str:
    """Generates a short, human-sounding, lead-specific message.

    One rule above all: no AI cadence. A concrete detail from the brief,
    one proof from the knowledge base, one light next step.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", OPENROUTER_API_KEY)

    cases_text = ""
    for idx, c in enumerate(kb_cases, 1):
        cases_text += f"\n--- Кейс {idx}: {c.get('title')} ---\n{c.get('content')}\n"

    angle_guide = ANGLE_GUIDES.get(angle, ANGLE_GUIDES["pain"])
    length_target = LENGTH_TARGETS.get(length, LENGTH_TARGETS["short"])
    opening_style = OPENING_STYLES[variation % len(OPENING_STYLES)]

    system_prompt = f"""Ты — практикующий инженер (LLM, Python, Telegram-боты, автоматизация). Пишешь заказчику короткое личное сообщение в чат или отклик на вакансию. Не резюме и не презентацию — сообщение человека, который прочитал ТЗ.

ЖЁСТКИЕ ПРАВИЛА СТИЛЯ:
1. Никаких штампов: «Здравствуйте! Меня зовут…», «Я ознакомился с вашей вакансией», «Я идеальный кандидат», «имею богатый опыт», «буду рад плодотворному сотрудничеству», «надеюсь на долгосрочное сотрудничество».
2. Никакого канцелярита и AI-лексики: «в современном мире», «стоит отметить», «важно отметить», «таким образом», «в заключение», «данный», «осуществлять», «является», «ключевой», «комплексный», «эффективный», «инновационный», «бесшовный», «синергия», «экосистема», «погрузиться в задачу», «в рамках проекта».
3. Никаких списков, markdown, жирного текста, эмодзи и восклицательных знаков. Обычный текст, как в Telegram.
4. Никаких превосходных степеней и самопохвалы: «уникальное решение», «под ключ», «полный цикл», «лучший на рынке».
5. Не выдумывай факты, цифры, компании и кейсы. Только база знаний ниже. Нет подходящего кейса — говори о подходе без фейковых метрик.
6. Первое предложение цепляет конкретикой из ТЗ: инструмент, ограничение, число, странность в постановке. {opening_style}
7. Дальше — одна проверяемая мысль о решении и один пруф (кейс с цифрой, если он есть).
8. Финал — лёгкий следующий шаг или короткий вопрос. Без давления и без «жду ответа».
9. Ритм: короткие предложения по 8–18 слов, разной длины. Одна мысль — одно предложение. Пиши как объясняешь коллеге.
10. Объём: {length_target}
11. Фокус: {angle_guide}
12. Не упоминай, что текст написан ИИ. Не извиняйся и не благодари за внимание.

Верни ТОЛЬКО текст сообщения, без пояснений и кавычек.

База знаний исполнителя (реальные кейсы и факты):
{cases_text}
"""

    user_prompt = f"""Заказчик: {company or 'не указан'}
Задача: {title}
Описание задачи:
{description}

{("Пожелания владельца к тексту: " + custom_instructions) if custom_instructions else ""}

Напиши это сообщение. Уникальное под эту задачу, без шаблонных связок."""

    if api_key and "your_openrouter_api_key" not in api_key:
        try:
            return await call_openrouter(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model=model,
                temperature=0.85,
            )
        except Exception as e:
            print(f"Error calling OpenRouter: {e}")

    return _fallback_offer(title, company, description, kb_cases, angle, length)

