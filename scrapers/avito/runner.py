"""
CLI Runner for Avito Rabota Ingestion.
Usage:
    py -m scrapers.avito.runner            # Headless run
    py -m scrapers.avito.runner --headful  # Run with visible browser window
"""
import sys
import asyncio
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scrapers.avito.pipeline import run_avito_pipeline

async def main():
    args = sys.argv[1:]
    headful = "--headful" in args
    print(f"[RUNNER] Запуск сбора вакансий с Авито Работы (headful={headful})...")
    await run_avito_pipeline(headless=not headful)

if __name__ == "__main__":
    asyncio.run(main())
