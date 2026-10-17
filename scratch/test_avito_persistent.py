from pathlib import Path
from playwright.sync_api import sync_playwright

USER_DATA_DIR = Path("scratch/avito_browser_data")
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)

print(f"User data dir: {USER_DATA_DIR.resolve()}")
