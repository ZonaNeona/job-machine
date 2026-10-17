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


async def generate_tailored_offer(
    title: str, 
    company: Optional[str], 
    description: str, 
    kb_cases: List[Dict[str, Any]], 
    custom_instructions: Optional[str] = None,
    model: str = DEFAULT_MODEL
) -> str:
    """
    Generates a personalized, punchy outreach message addressing client's specific pain points.
    Uses developer's knowledge base cases.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", OPENROUTER_API_KEY)

    cases_text = ""
    for idx, c in enumerate(kb_cases, 1):
        cases_text += f"\n--- Кейс {idx}: {c.get('title')} ---\n{c.get('content')}\n"

    system_prompt = f"""Ты — опытный Senior AI / Python разработчик и инженер-автоматизатор.
Ты пишешь прямое, уважительное, профессиональное и гиперперсонализированное сопроводительное письмо заказчику/работодателю.

ГЛАВНЫЕ ПРАВИЛА:
1. НИКАКОЙ ВОДЫ И ШАБЛОНОВ. Запрещены фразы: "Здравствуйте! Меня зовут...", "Я ознакомился с вашей прекрасной вакансией...", "Я идеальный кандидат, потому что имею богатый опыт...".
2. ПЕРВОЕ ПРЕДЛОЖЕНИЕ: Сразу в суть и в боль проекта. Покажи, что ты понял реальную задачу (например: "Добрый день. Вижу, что вам нужно связать LLM с базой знаний и вывести это в Telegram-бота без галлюцинаций...").
3. ПРУФ ИЗ ОПЫТА: Приведи 1 конкретный релевантный факт/кейс из базы знаний с цифрами или конкретным решением (как решалась точно такая же проблема).
4. ЧЕТКИЙ CTA (Призыв к действию): Легкий следующий шаг без давления (например: "Могу прислать короткое видео/ссылку на рабочий прототип аналогичного бота" или "Готов на 15 минут созвониться/списаться и подсветить архитектурные нюансы").
5. ОБЪЕМ: 2-3 компактных абзаца (максимум 600-800 символов). Читается за 30 секунд.

База знаний исполнителя:
{cases_text}
"""

    user_prompt = f"""Вакансия / Заказ:
Компания: {company or 'Не указана'}
Название: {title}
Описание:
{description}

{f"Дополнительные инструкции: {custom_instructions}" if custom_instructions else ""}

Напиши готовый персонализированный отклик для отправки заказчику.
"""

    if api_key and "your_openrouter_api_key" not in api_key:
        try:
            return await call_openrouter(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=model,
                temperature=0.6
            )
        except Exception as e:
            print(f"Error calling OpenRouter: {e}")

    # High quality fallback template matching the task if API key is not yet provided
    company_name = company if company else "команде"
    return f"""Добрый день! 

Обратил внимание на ваш проект «{title}». Вижу ключевую задачу: внедрить надежный AI-слой и автоматизировать процесс обработки данных без сбоев и лишних расходов на токены.

Недавно реализовал похожую архитектуру:
— Развернул связку Claude 3.5 / DeepSeek с локальной базой знаний (RAG) через pgvector и FastAPI;
— Выстроил Telegram-интерфейс с поддержкой очередей и стриминга ответов, сократив ручную обработку запросов на 70%;
— Полная изоляция логики, логирование промптов и мониторинг качества ответов.

Готов подключиться к проекту в формате регулярного подряда/парт-тайма (удаленно). Могу показать живую демку похожего решения или обсудить архитектуру в Telegram — когда вам будет удобно списаться?"""
