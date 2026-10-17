"""
CLI Runner for Freelance & Contract Ingestion (Habr Career, FL.ru).
Usage:
    py -m scrapers.freelance.runner
    py -m scrapers.freelance.runner --habr-only
    py -m scrapers.freelance.runner --fl-only
"""
import sys
import asyncio
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scrapers.freelance.pipeline import run_habr_pipeline, run_fl_pipeline, run_all_freelance

async def main():
    args = sys.argv[1:]
    if "--habr-only" in args:
        print("[RUNNER] Запуск сбора только с Хабр Карьеры...")
        await run_habr_pipeline()
    elif "--fl-only" in args:
        print("[RUNNER] Запуск сбора только с FL.ru...")
        await run_fl_pipeline()
    else:
        print("[RUNNER] Запуск полного сбора с фриланс-площадок (Хабр + FL.ru)...")
        await run_all_freelance()

if __name__ == "__main__":
    asyncio.run(main())
