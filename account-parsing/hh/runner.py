# -*- coding: utf-8 -*-
"""
CLI for HH account chat sync.

  py account-parsing/hh/runner.py --once
  py account-parsing/hh/runner.py --once --headed
  py account-parsing/hh/runner.py --check-session
  py account-parsing/hh/runner.py --parse-sample
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


async def cmd_once(headed: bool) -> None:
    from pipeline import run_hh_account_sync
    stats = await run_hh_account_sync(headless=not headed, force=True)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


async def cmd_check() -> None:
    from chat_scraper import check_session
    from config import DEFAULT_BASE_URL
    res = await check_session(headless=True, base_url=DEFAULT_BASE_URL)
    print(json.dumps(res, ensure_ascii=False, indent=2))


def cmd_parse_sample() -> None:
    from html_parser import parse_chat_details_html, parse_chat_list_html
    samples = CURRENT_DIR
    list_html = (samples / "Чаты.html").read_text(encoding="utf-8", errors="replace")
    items = parse_chat_list_html(list_html)
    print(f"List chats: {len(items)}")
    for item in items[:5]:
        print(f"  {item.chat_id} | {item.title[:50]} | {item.counterpart} | reply={item.has_reply_hint}")
        print(f"     preview: {item.preview[:90]}")
    opened = samples / "Чаты-opened.html"
    if opened.exists():
        details = parse_chat_details_html(
            opened.read_text(encoding="utf-8", errors="replace"),
            chat_id="5697264260",
        )
        print(f"Opened vacancy_id={details.vacancy_id} messages={len(details.messages)}")
        if details.messages:
            print(f"  last: {details.messages[-1].text[:120]}")


async def cmd_import_sample(alerts: bool = False) -> None:
    from pipeline import run_hh_sample_import
    stats = await run_hh_sample_import(alerts_on=alerts)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="HH account chat monitor")
    parser.add_argument("--once", action="store_true", help="Run one sync into job_machine.db")
    parser.add_argument("--headed", action="store_true", help="Show browser window")
    parser.add_argument("--check-session", action="store_true", help="Check saved cookies/session")
    parser.add_argument("--parse-sample", action="store_true", help="Parse local HTML samples (dry-run)")
    parser.add_argument("--import-sample", action="store_true", help="Import local HTML samples directly into DB")
    parser.add_argument("--alerts", action="store_true", help="Send TG alert when importing/syncing replies")
    args = parser.parse_args()

    if args.parse_sample:
        cmd_parse_sample()
        return
    if args.import_sample:
        asyncio.run(cmd_import_sample(alerts=args.alerts))
        return
    if args.check_session:
        asyncio.run(cmd_check())
        return
    if args.once:
        asyncio.run(cmd_once(headed=args.headed))
        return
    parser.print_help()


if __name__ == "__main__":
    main()
