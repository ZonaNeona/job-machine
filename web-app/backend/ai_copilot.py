"""In-app AI Copilot for JOB-MACHINE.

Allows the user to converse with the system directly from the browser:
audit platforms, diagnose leads, estimate budgets, and suggest pitch angles.
Powered by OpenRouter or DeepSeek when configured, with a smart heuristic fallback.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from shared.intelligence import (
    execute_readonly_sql,
    get_platform_analytics,
    get_sweet_spot_leads,
    audit_funnel,
    inspect_employer,
    set_employer_blacklist,
)
import ai_service


COPILOT_SYSTEM_PROMPT = """Ты — личный ИИ-копилот и бизнес-стратег конвейера JOB-MACHINE.
Ты помогаешь Senior разработчику и фаундеру (Игорю) управлять потоком входящих IT-заказов и вакансий.

Твой профиль и цели:
- Фокус: Интеграция LLM/AI (RAG, агенты, OpenAI/DeepSeek API), сложные Telegram-боты (aiogram/Telethon), парсинг и автоматизация CRM.
- Бизнес-цель: 5-7 постоянных клиентов на регулярном подряде (retainer) с чеком 80 000 - 90 000 ₽/мес (цель ~510 000 ₽/мес).
- Вторичный фокус: Быстрые чеки (Sweet Spot: 15 000 - 35 000 ₽ за 1-2 дня работы).

Твой стиль общения:
- Говори кратко, емко, по делу, как опытный технический директор.
- Никакого корпоративного канцелярита, шаблонных фраз и 'воды'.
- Если даешь оценку лиду — сразу называй: рекомендуемый чек, срок в часах, угол подачи (Hook) и скрытые риски ТЗ.
- Если у лида есть прямой контакт (Telegram/Email), сразу рекомендуй писать напрямую.
"""

async def answer_copilot(
    messages: List[Dict[str, str]],
    lead_id: Optional[int] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates an intelligent copilot answer using live data and OpenRouter."""
    active_model = model or os.getenv("OPENROUTER_DEFAULT_MODEL", "anthropic/claude-3.5-sonnet")
    api_key = os.getenv("OPENROUTER_API_KEY", "")

    # Context enrichment
    context_blocks = []

    # 1. Platform & Funnel Pulse
    try:
        analytics = get_platform_analytics()
        context_blocks.append(f"Сводка площадок: Лучшая — {analytics['summary']['top_opportunity_source']}, Худшая — {analytics['summary']['highest_friction_source']}")
    except Exception:
        pass

    # 2. Specific Lead Context (if lead_id is provided)
    if lead_id:
        try:
            lead_res = execute_readonly_sql(f"SELECT * FROM leads WHERE id = {int(lead_id)} LIMIT 1")
            if lead_res.get("data"):
                l = lead_res["data"][0]
                contacts = l.get("direct_contacts_json") or "нет"
                context_blocks.append(
                    f"Текущий открытый лид #{l['id']}:\n"
                    f"Название: {l['title']}\n"
                    f"Компания/Заказчик: {l['company']} (Источник: {l['source']})\n"
                    f"Бюджет: {l['salary_raw']}\n"
                    f"Категория: {l['category']}, Сделка: {l['deal_type']}, Срочность: {l['urgency']}\n"
                    f"Sweet Spot: {l.get('sweet_spot_score', 5)}/10, Часов: {l.get('estimated_hours', 4)}\n"
                    f"Прямые контакты: {contacts}\n"
                    f"Описание: {l['description'][:1500]}"
                )
        except Exception:
            pass

    full_system = COPILOT_SYSTEM_PROMPT
    if context_blocks:
        full_system += "\n\nАКТУАЛЬНЫЙ КОНТЕКСТ СИСТЕМЫ:\n" + "\n---\n".join(context_blocks)

    # If OpenRouter is configured, call the LLM
    if api_key and "your_openrouter_api_key" not in api_key:
        llm_messages = [{"role": "system", "content": full_system}]
        for m in messages[-6:]:  # Keep recent history
            llm_messages.append({"role": m["role"], "content": m["content"]})

        try:
            reply = await ai_service.call_openrouter(llm_messages, model=active_model, temperature=0.5)
            return {
                "status": "success",
                "reply": reply,
                "model_used": active_model,
                "has_lead_context": bool(lead_id),
            }
        except Exception as exc:
            # Fall through to heuristic if API fails
            pass

    # Fallback heuristic response if OpenRouter key is not yet set
    last_user_msg = messages[-1]["content"].lower() if messages else ""

    if "площадк" in last_user_msg or "источник" in last_user_msg or "хуже" in last_user_msg or "лучш" in last_user_msg:
        audit = get_platform_analytics()
        platforms_summary = "\n".join([
            f"• **{p['source']}**: {p['total_leads']} лидов, Sweet Spot {p['avg_sweet_spot']}/10, ответов {p['replies']}/{p['dispatched']} ({p['verdict']})"
            for p in audit["platforms"]
        ])
        reply = (
            f"📊 **Экспресс-аудит источников лидов:**\n\n"
            f"{platforms_summary}\n\n"
            f"🏆 **Лидер по выгоде**: `{audit['summary']['top_opportunity_source']}` (высокая скорость и прямой контакт).\n"
            f"⚠️ **Высокое трение/шум**: `{audit['summary']['highest_friction_source']}`.\n\n"
            f"*(Для глубоких ответов любой модели укажите ключ OPENROUTER_API_KEY в `.env`)*"
        )
    elif "горит" in last_user_msg or "спринт" in last_user_msg or "топ" in last_user_msg or "заказ" in last_user_msg:
        top_leads = get_sweet_spot_leads(limit=3)
        lead_lines = []
        for l in top_leads["leads"]:
            direct = f" | ⚡ Контакт: {list(l['direct_contacts'].values())[0][0]}" if l["direct_contacts"] else ""
            lead_lines.append(
                f"🔥 **#{l['id']} {l['title']}** ({l['source']})\n"
                f"   Бюджет: `{l['salary']}` | Sweet Spot: `{l['sweet_spot_score']}/10` (~{l['estimated_hours']}ч){direct}\n"
                f"   [Открыть проект]({l['url']})"
            )
        reply = (
            f"⚡ **Топ заказов с максимальной выгодой на сегодня (Sweet Spot):**\n\n" +
            "\n\n".join(lead_lines) +
            f"\n\n💡 *Совет*: начинай с тех, где есть прямой контакт — пиши в первые 15 минут!"
        )
    elif lead_id:
        reply = (
            f"🎯 **Разбор лида #{lead_id}:**\n\n"
            f"• **Потенциал**: задача укладывается в профиль автоматизации и ботов.\n"
            f"• **Стратегия отклика**: не пиши шаблонное полотно. Задай 2 технических уточняющих вопроса и сошлись на кейс из `assets/portfolio/`.\n"
            f"• **Вилка цены**: если заказчик просит фикс — ориентируйся на ~25 000 - 45 000 ₽ за MVP, с предложением поддержки за 85 000 ₽/мес.\n\n"
            f"*(Подключите ключ OpenRouter в настройках для генерации готового текста оффера от Claude 3.5 Sonnet)*"
        )
    else:
        reply = (
            f"Привет, Игорь! Я подключен к базе данных конвейера JOB-MACHINE.\n\n"
            f"Я могу:\n"
            f"• Показать топ заказов с максимальным ROI (`топ заказов` или `утренний спринт`).\n"
            f"• Провести аудит площадок (`какая площадка работает лучше всего?`).\n"
            f"• Разобрать любой заказ и подсказать цену и стратегию (открой карточку лида).\n"
            f"• Выполнять любые SQL-запросы к базе через подключенный **MCP-сервер**.\n\n"
            f"Чем займемся?"
        )

    return {
        "status": "success",
        "reply": reply,
        "model_used": "heuristic-intelligence",
        "has_lead_context": bool(lead_id),
    }
