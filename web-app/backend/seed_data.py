from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import Lead, KnowledgeBaseItem, SystemSetting

def seed_database(db: Session):
    # Check if already seeded
    if db.query(Lead).count() > 0:
        return

    # 1. Knowledge Base Items
    kb_items = [
        KnowledgeBaseItem(
            title="Стек и специализация",
            category="stack",
            content="""Специализация: Senior AI & Python Developer / Инженер автоматизации.
Стек: Python 3.11+, FastAPI, PostgreSQL, pgvector, Redis, Celery.
AI / LLM: OpenAI API (GPT-4o, GPT-4o-mini), Anthropic Claude 3.5 Sonnet, DeepSeek V3/R1, LangChain, LlamaIndex, RAG-системы, векторные базы (Qdrant, ChromaDB, pgvector), fine-tuning промптов.
Telegram: Aiogram 3.x, Telethon (UserBot автоматизация, мониторинг чатов), Pyrogram, Telegram Web Apps, подключение платежных шлюзов (ЮKassa, Robokassa, крипта).
Автоматизация: Playwright, Selenium, парсинг данных, вебхуки, интеграции с Bitrix24, amoCRM, 1C, Google Sheets, n8n.""",
            tags="Stack,Python,LLM,Telegram,FastAPI",
            is_active=True
        ),
        KnowledgeBaseItem(
            title="Кейс: AI-ассистент техподдержки и продаж с RAG",
            category="case_study",
            content="""Разработал и внедрил интеллектуального AI-консультанта для онлайн-сервиса (e-commerce & SaaS).
Реализация:
— Подключил векторный поиск pgvector по базе из 12 000 товаров и регламентов компании.
— Использовал Claude 3.5 Sonnet для сложных консультаций и gpt-4o-mini для быстрых типовых ответов.
— Встроил проверку галлюцинаций и автоматическую эскалацию на оператора при необходимости.
Результат: 68% входящих обращений закрываются без привлечения живых сотрудников, время первого ответа снизилось с 14 минут до 3 секунд.""",
            tags="RAG,Claude,FastAPI,Ecommerce,AI Support",
            is_active=True
        ),
        KnowledgeBaseItem(
            title="Кейс: Telegram-бот лидогенерации и аналитики чатов (Telethon)",
            category="case_study",
            content="""Создал систему мониторинга 150+ отраслевых Telegram-чатов и каналов на базе Telethon.
Реализация:
— Real-time перехват сообщений по вебхукам.
— Модуль AI-классификации на базе LLM (определяет готовность купить, бюджет и контакт лица, принимающего решения).
— Моментальный алерт сейлз-команде с готовым черновиком ответа.
Результат: Клиент получает горячие лиды из Telegram в первые 2 минуты после публикации вопроса, рост входящего пайплайна в 3.5 раза.""",
            tags="Telegram,Telethon,LeadGen,AI Classification",
            is_active=True
        ),
        KnowledgeBaseItem(
            title="Кейс: Автоматизация бизнес-процессов и интеграция с amoCRM / Bitrix24",
            category="case_study",
            content="""Автоматизировал сквозную воронку обработки заявок из 6 различных источников (сайт, Telegram, WhatsApp, маркетплейсы).
Реализация:
— Асинхронный сервис на FastAPI + Redis Queue.
— Автоматическое обогащение данных о клиентах из открытых реестров.
— Синхронизация статусов с CRM, генерация счетов и договоров в PDF за 1 клик.
Результат: Полностью исключен человеческий фактор при заведении лидов, экономия до 40 рабочих часов менеджеров в неделю.""",
            tags="Automation,FastAPI,CRM,Redis,Parsers",
            is_active=True
        ),
        KnowledgeBaseItem(
            title="Tone of Voice и правила откликов",
            category="tone_of_voice",
            content="""1. Стиль: технический партнер, сильный инженер, без заискивания и шаблонов.
2. Никаких «Здравствуйте, меня зовут...» — сразу говорим про проблему заказчика.
3. Обязательно подсвечиваем техническое решение и возможные подводные камни.
4. Предлагаем конкретный следующий шаг (показать демо / созвониться на 15 мин / разобрать архитектуру).
5. Фокусируемся на удаленной проектной работе / ежемесячном подряде (retainer 80 000 - 120 000 руб.).""",
            tags="Rules,Outreach,ToneOfVoice",
            is_active=True
        )
    ]
    for kb in kb_items:
        db.add(kb)

    # 2. Leads in pipeline
    now = datetime.utcnow()
    sample_leads = [
        Lead(
            external_id="hh_92817412",
            title="Разработчик AI-ассистентов / LLM Engineer (удаленно)",
            company="FinTech Solutions Lab",
            source="hh.ru",
            url="https://hh.ru/vacancy/92817412",
            salary_raw="85 000 – 110 000 руб.",
            salary_min=85000,
            salary_max=110000,
            contact_info="hr@fintechlab.pro / Telegram: @artem_fintech",
            location="Удаленно (РФ/СНГ)",
            job_type="Парт-тайм / Подряд",
            description="""Ищем опытного Python-разработчика для создания и интеграции внутреннего AI-ассистента для аналитиков.
Задачи:
- Разработка RAG-пайплайна по внутренней финансовой документации (FastAPI, pgvector/Qdrant).
- Интеграция с моделями OpenRouter / Anthropic Claude / DeepSeek.
- Разработка Telegram-интерфейса бота для команды с разграничением прав доступа.
Требования:
- Опыт работы с LLM API, промпт-инжиниринг, векторные базы.
- Уверенный Python, FastAPI, асинхронное программирование.
- Готовность работать на результат, регулярная коммуникация.""",
            tags="LLM,Python,FastAPI,RAG,Telegram",
            status="replied",
            match_score=96,
            scoring_reason="Идеальное совпадение по стеку (LLM, RAG, FastAPI, Telegram). Подряд/парт-тайм с целевой вилкой 85-110к. Прямой контакт тимлида в Telegram.",
            generated_offer="""Добрый день!

Вижу ключевую задачу в вашем проекте — построить устойчивый RAG-пайплайн по внутренней документации без галлюцинаций модели и с быстрым доступом через Telegram.

Буквально месяц назад развернул похожую архитектуру:
— Связка Claude 3.5 Sonnet + pgvector на FastAPI для онлайн-сервиса (индексация 12к документов, точность фактов >95%);
— Telegram-интерфейс на aiogram 3 с разграничением ролей, стримингом ответов и логированием промптов в PostgreSQL.

Готов подключиться к проекту на парт-тайм / регулярный подряд (ИП / самозанятость). Могу показать живую демку похожего решения в TG: @artem_fintech или обсудить архитектуру на 15-минутном созвоне. Когда вам удобно?""",
            custom_notes="Заказчик ответил в Telegram! Назначен короткий созвон на вторник 15:00 для обсуждения схемы интеграции.",
            created_at=now - timedelta(days=2),
            sent_at=now - timedelta(days=1, hours=8),
            replied_at=now - timedelta(hours=4)
        ),
        Lead(
            external_id="tg_post_48192",
            title="Ищем разработчика для Telegram-бота парсинга и ИИ-обработки заявок",
            company="LeadBridge Agency",
            source="telegram",
            url="https://t.me/jobgeek/48192",
            salary_raw="90 000 руб./мес. (фикс + поддержка)",
            salary_min=90000,
            salary_max=90000,
            contact_info="@mikhail_leadbridge",
            location="Удаленно",
            job_type="Регулярный подряд",
            description="""Нужен разработчик в команду маркетингового агентства.
Задача: разработать и сопровождать систему на Telethon/Aiogram, которая мониторит целевые группы, отбирает сообщения с помощью LLM (отсекает спам, находит потенциальные лиды) и отправляет уведомление менеджеру.
Оплата 90к в месяц стабильно за развитие и поддержку сервиса.""",
            tags="Telegram,Telethon,LLM,Automation",
            status="offer_generated",
            match_score=94,
            scoring_reason="Целевой чек (90 000 руб./мес.), долгосрочная поддержка. Задача один-в-один повторяет наш кейс по Telethon + LLM классификации.",
            generated_offer="""Михаил, добрый день! 

Увидел ваш запрос в канале. Задача по связке Telethon + LLM для умной фильтрации лидов из чатов — это ровно то, что я делал в недавнем проекте.

Как я решал такую задачу:
— Telethon-клиент слушает 150+ чатов в real-time без банов (ротация сессий, умные задержки);
— Легкая LLM (DeepSeek / gpt-4o-mini) фильтрует спам за доли секунды и классифицирует запрос по теплоте;
— В Telegram-бот сейлза падает карточка лида с прямым линком на сообщение и сгенерированным драфтом ответа.

Формат 90 000 руб./мес. за разработку и последующее сопровождение полностью устраивает. Готов показать логику работы на демо-сервере. Давайте спишемся в ЛС?""",
            custom_notes="",
            created_at=now - timedelta(hours=18),
            sent_at=None,
            replied_at=None
        ),
        Lead(
            external_id="hh_94102931",
            title="Python-разработчик (Интеграция ИИ и автоматизация процессов)",
            company="TechRetail Group",
            source="hh.ru",
            url="https://hh.ru/vacancy/94102931",
            salary_raw="80 000 – 120 000 руб.",
            salary_min=80000,
            salary_max=120000,
            contact_info="hr@techretail.ru",
            location="Удаленно",
            job_type="Проектная работа",
            description="""В проект внедрения искусственного интеллекта в отдел продаж и клиентский сервис требуется Python-инженер.
Стек: Python, FastAPI, OpenAI API / OpenRouter, интеграция с amoCRM через вебхуки.
Нужно связать автоответы бота с карточками сделок в CRM.""",
            tags="Python,FastAPI,amoCRM,OpenRouter,Automation",
            status="approved",
            match_score=91,
            scoring_reason="Прямая интеграция CRM + OpenRouter API. Отличный проектный формат, подходит под долгосрочный саппорт.",
            generated_offer="""Добрый день!

Увидел задачу по интеграции ИИ-автоответов с amoCRM на базе FastAPI. Это классическая архитектурная задача, где главное — избежать задержек вебхуков и синхронизировать статусы сделок без дублей.

В похожем проекте я настраивал сквозную воронку:
— Входящий вебхук из CRM ставится в Redis-очередь, фоновый воркер через OpenRouter генерирует ответ с учетом истории переписки;
— Сделка в amoCRM автоматически обновляется, прикрепляется лог генерации и отправляется сообщение клиенту;
— Полная обработка занимает до 2.5 секунд.

Готов взять реализацию и дальнейшее сопровождение под ключ. Могу показать архитектурную схему и фрагменты боевых интеграций. Буду рад обсудить детали!""",
            custom_notes="Оффер одобрен, запланирована отправка в рабочий интервал (10:00).",
            created_at=now - timedelta(days=1),
            sent_at=None,
            replied_at=None
        ),
        Lead(
            external_id="habr_192831",
            title="Создание RAG-системы для юристов на базе локальной базы знаний",
            company="Правовой Центр «Вердикт»",
            source="habr_freelance",
            url="https://freelance.habr.com/tasks/192831",
            salary_raw="80 000 руб.",
            salary_min=80000,
            salary_max=80000,
            contact_info="@verdict_legal_it",
            location="Удаленно",
            job_type="Проект под ключ",
            description="""Требуется разработать прототип интеллектуального поиска по юридическим документам компании (договоры, судебные решения).
Нужно семантическое разбиение на чанки, эмбеддинги, поиск релевантных кусков и генерация итогового резюме с точными ссылками на статьи.""",
            tags="RAG,Embeddings,Python,LegalTech,NLP",
            status="ai_scored",
            match_score=88,
            scoring_reason="Четкое техническое ТЗ по RAG. Бюджет 80к на первый этап (прототип), возможность взять на абонентское обслуживание.",
            generated_offer="",
            custom_notes="",
            created_at=now - timedelta(hours=6),
            sent_at=None,
            replied_at=None
        ),
        Lead(
            external_id="tg_post_49102",
            title="Ищем разработчика для Telegram WebApp магазина с ИИ-консультантом",
            company="FashionAI Brand",
            source="telegram",
            url="https://t.me/telerabota_rf/49102",
            salary_raw="80 000 – 100 000 руб./мес.",
            salary_min=80000,
            salary_max=100000,
            contact_info="@fashion_ai_ceo",
            location="Удаленно",
            job_type="Парт-тайм / Контракт",
            description="""Ищем fullstack / python разработчика для создания Telegram Web App каталога с встроенным AI-стилистом (подбор образов по фото и запросу через vision-модели).
Бюджет обсуждаем, готовы платить фикс помесячно за разработку и поддержку.""",
            tags="Telegram,WebApp,VisionLLM,Python,React",
            status="new",
            match_score=87,
            scoring_reason="Трендовая связка Telegram Mini Apps + Vision LLM. Клиент ищет индивидуального исполнителя на помесячный фикс.",
            generated_offer="",
            custom_notes="",
            created_at=now - timedelta(hours=2),
            sent_at=None,
            replied_at=None
        ),
        Lead(
            external_id="hh_95182910",
            title="Инженер технической автоматизации (Парсинг данных, API, боты)",
            company="Digital Growth Agency",
            source="hh.ru",
            url="https://hh.ru/vacancy/95182910",
            salary_raw="85 000 руб.",
            salary_min=85000,
            salary_max=85000,
            contact_info="job@digitalgrowth.io",
            location="Удаленно",
            job_type="Удаленный подряд",
            description="""Ищем спеца на удаленный подряд для регулярной разработки парсеров (Playwright/Selenium), сборщиков аналитики из маркетплейсов и сервисов конкурентов, выгрузки в PostgreSQL и дашборды.""",
            tags="Playwright,Python,PostgreSQL,Parsers,Scraping",
            status="in_negotiation",
            match_score=89,
            scoring_reason="Регулярный пул задач по парсингу и автоматизации. Идеально под формат ежемесячного сопровождения.",
            generated_offer="""Добрый день!

Вижу потребность в надежной инфраструктуре парсинга и сбора данных с защитой от блокировок.

Мой опыт в аналогичных проектах:
— Разработка распределенных парсеров на Playwright с ротацией резидентных прокси, обходом Cloudflare и эмуляцией отпечатков браузера;
— Автоматическая нормализация данных и заливка в PostgreSQL с проверкой целостности и алертами в Telegram при сбоях;
— Стабильный аптайм пайплайнов >99%.

Формат подряда за 85 000 руб./мес. подходит. Готов созвониться на 15 минут для обсуждения первых целевых источников.""",
            custom_notes="Провели первичный созвон, сейчас заказчик готовит список целевых сайтов для тестовой выгрузки.",
            created_at=now - timedelta(days=4),
            sent_at=now - timedelta(days=3),
            replied_at=now - timedelta(days=2)
        )
    ]

    for lead in sample_leads:
        db.add(lead)

    # 3. System Settings
    settings = [
        SystemSetting(key="TARGET_CLIENTS_COUNT", value="6", description="Целевое количество постоянных клиентов в месяц"),
        SystemSetting(key="TARGET_MONTHLY_RATE", value="85000", description="Целевая ставка с одного клиента (руб.)"),
        SystemSetting(key="HH_AUTO_APPLY_ENABLED", value="false", description="Автоматическая отправка на hh.ru без подтверждения"),
        SystemSetting(key="TG_AUTO_NOTIFY_ENABLED", value="true", description="Уведомления в Telegram о новых лидах и ответах"),
        SystemSetting(key="MIN_MATCH_SCORE_THRESHOLD", value="75", description="Минимальный score для генерации оффера"),
    ]
    for s in settings:
        db.add(s)

    db.commit()
