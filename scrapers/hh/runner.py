import sys
import asyncio
import argparse

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from pipeline import run_hh_pipeline
from config import DEFAULT_SEARCH_PRESETS

async def main():
    parser = argparse.ArgumentParser(description="JobMachine HeadHunter Vacancy Ingestion Engine")
    parser.add_argument("--once", action="store_true", help="Запустить один цикл сбора и выйти")
    parser.add_argument("--query", type=str, help="Запустить сбор только по конкретному запросу")
    parser.add_argument("--watch", action="store_true", help="Периодический мониторинг в фоновом режиме")
    parser.add_argument("--interval", type=int, default=60, help="Интервал между запусками в минутах (по умолчанию: 60)")
    parser.add_argument("--limit", type=int, default=15, help="Лимит вакансий на один пресет (по умолчанию: 15)")

    args = parser.parse_args()

    presets = DEFAULT_SEARCH_PRESETS
    if args.query:
        presets = [{
            "name": f"Пользовательский запрос: {args.query}",
            "query": args.query,
            "schedule": "remote"
        }]

    print("🚀 [JOBMACHINE] Запуск сборщика лидов с HeadHunter...")
    print(f"Пресеты для сканирования: {len(presets)}")

    if args.watch:
        print(f"Режим непрерывного мониторинга включен (интервал: {args.interval} мин). Для остановки нажмите Ctrl+C.\n")
        while True:
            await run_hh_pipeline(presets=presets, max_per_query=args.limit)
            print(f"⏳ Ожидание {args.interval} минут до следующего сканирования...")
            await asyncio.sleep(args.interval * 60)
    else:
        await run_hh_pipeline(presets=presets, max_per_query=args.limit)

if __name__ == "__main__":
    asyncio.run(main())
