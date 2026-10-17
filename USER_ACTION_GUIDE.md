# 📋 ЕДИНАЯ ИНСТРУКЦИЯ ДЛЯ ВЛАДЕЛЬЦА (USER_ACTION_GUIDE)

> Этот файл содержит **все действия, которые требуются лично от вас** для перехода конвейера в боевой режим.  
> Всё остальное (парсинг, алгоритмы фильтрации, дедупликация, интерфейс, скоринг) работает автономно.  
> Время на выполнение: **~5–7 минут**.

---

## 🚀 ШАГ 0. Автономный запуск Командного Пункта (независимо от ИИ)
*Чтобы серверы работали стабильно в фоне и не закрывались при перезапусках сессий ассистента или смене моделей:*

1. Перейдите в папку `web-app/` и дважды кликните по файлу:
   👉 [`web-app/run_dev.bat`](file:///f:/JOB-MACHINE/web-app/run_dev.bat)
2. Скрипт откроет **два независимых системных окна консоли Windows**:
   - `JobMachine Backend (API)` — сервер FastAPI на порту **8000**
   - `JobMachine Frontend (UI)` — веб-интерфейс Vite на порту **5173**
3. Откройте в браузере:
   - 🌐 **Веб-интерфейс**: [http://localhost:5173](http://localhost:5173)
   - 📡 **Интерактивная документация API**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
4. *Серверы продолжат бесперебойную работу даже если окно диалога с ИИ перезагрузится.*

---

## 🔑 ШАГ 1. API-ключ OpenRouter (для генерации ИИ-офферов)
*Позволяет бесплатно или за центы генерировать идеальные отклики через Claude 3.5 Sonnet, DeepSeek V3 или GPT-4o прямо в Студии Офферов.*

1. Зайдите на [openrouter.ai](https://openrouter.ai/) и авторизуйтесь (через Google или GitHub).
2. Перейдите в раздел [Keys](https://openrouter.ai/keys) $\rightarrow$ Нажмите **«Create Key»**.
3. Скопируйте полученный ключ (начинается на `sk-or-v1-...`).
4. Пополните баланс на $5–10 (этого хватит на 10 000+ сгенерированных откликов на DeepSeek V3 или 1 000+ на Claude 3.5 Sonnet).
5. Вставьте ключ в файл [`web-app/backend/.env`](file:///f:/JOB-MACHINE/web-app/backend/.env):
   ```env
   OPENROUTER_API_KEY=sk-or-v1-ваш_ключ_здесь
   ```

---

## 📱 ШАГ 2. Telegram API для Telethon (перехват горячих заказов из чатов)
*Позволяет Telethon перехватывать заказы из 20+ профильных Telegram-каналов и чатов в реальном времени, вытягивать юзернеймы заказчиков и ставки.*

1. Зайдите на официальный портал Telegram: [my.telegram.org](https://my.telegram.org/).
2. Введите свой номер телефона, подтвердите код в Telegram.
3. Перейдите в раздел **«API development tools»**.
4. Создайте приложение (в поле *App title* введите `JobMachine`, в *Short name* — `jobmachine`).
5. Скопируйте два параметра:
   - **`App api_id`** (число, например: `28471923`)
   - **`App api_hash`** (строка из букв и цифр, например: `a8f9c1d2e3b4...`)
6. Вставьте их в [`web-app/backend/.env`](file:///f:/JOB-MACHINE/web-app/backend/.env):
   ```env
   TELEGRAM_API_ID=ваш_api_id
   TELEGRAM_API_HASH=ваш_api_hash
   TELEGRAM_PHONE=+79991234567
   ```
7. Запустите в терминале быстрый мастер авторизации:
   ```bash
   py -m scrapers.telegram.auth_helper
   ```
   *Введите одноразовый SMS/Telegram-код — после этого создастся файл сессии, и больше вводить код не потребуется.*

---

## 🔔 ШАГ 3. Telegram-бот для мгновенных алертов в ваш личный чат
*Чтобы при обнаружении горячего заказа (Match Score > 80%) бот сразу присылал пуш вам в телефон с готовым оффером и контактом фаундера.*

1. Откройте в Telegram бота [@BotFather](https://t.me/BotFather).
2. Отправьте команду `/newbot`, укажите имя и юзернейм (например: `MyJobMachineAlertBot`).
3. Скопируйте выданный **Bot Token** (формат: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
4. Узнайте свой личный Telegram ID (напишите боту [@userinfobot](https://t.me/userinfobot) — он пришлет ваш `Id`).
5. Вставьте в [`web-app/backend/.env`](file:///f:/JOB-MACHINE/web-app/backend/.env):
   ```env
   ALERT_BOT_TOKEN=ваш_токен_бота
   ALERT_CHAT_ID=ваш_личный_telegram_id
   ```

---

## 💼 ШАГ 4. Мониторинг откликов и чатов hh.ru (личный кабинет)
*hh.ru не имеет API для чатов соискателя (`/chat/*`). Модуль `account-parsing/hh` позволяет в фоне опрашивать чаты, связывать ответы HR с лидами в базе и слать Telegram-пуши при ответе заказчика.*

1. Запустите 1-разовую интерактивную сессию в терминале:
   ```bash
   py account-parsing/hh/auth_session.py
   ```
2. Откроется окно Chromium:
   - Авторизуйтесь на hh.ru обычным способом (по SMS или паролю).
   - Дождитесь перехода в раздел чатов (`hh.ru/chat`).
   - Скрипт зафиксирует куки в локальный профиль `account-parsing/hh/browser_profile/` и автоматически завершится.
3. Проверить чаты и работу системы:
   - В веб-интерфейсе: раздел **«Аккаунты»** ([http://localhost:5173/#accounts](http://localhost:5173/#accounts)) $\rightarrow$ нажмите **«Синхронизировать»** (или кнопку **«Импорт сэмпла»** для мгновенной загрузки сохранённых HTML-дампов).
   - В консоли:
     ```bash
     py account-parsing/hh/runner.py --import-sample   # быстрая загрузка 9 чатов из дампов
     py account-parsing/hh/runner.py --once            # фоновая проверка живого hh.ru
     py account-parsing/hh/runner.py --check-session   # статус куков/сессии
     ```

---

## 📋 Чек-лист готовности файла `web-app/backend/.env`:
```env
# ИИ Генератор (Шаг 1)
OPENROUTER_API_KEY=sk-or-v1-...

# Telegram перехватчик Telethon (Шаг 2)
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_PHONE=+7...

# Telegram Алертер в телефон (Шаг 3)
ALERT_BOT_TOKEN=...
ALERT_CHAT_ID=...
```

> **Безопасность**: Файлы `.env` и `account-parsing/hh/browser_profile/` добавлены в `.gitignore` и никогда не попадут в репозиторий. Все ключи и сессии хранятся исключительно локально на вашем компьютере.
