import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base

# Always resolve database file path relative to backend directory
BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_DB_FILE = BACKEND_DIR / "job_machine.db"

raw_db_url = os.getenv("DATABASE_URL", "")
if not raw_db_url or raw_db_url.startswith("sqlite:///.") or raw_db_url == "sqlite:///job_machine.db":
    DATABASE_URL = f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"
else:
    DATABASE_URL = raw_db_url

# For SQLite, check_same_thread=False is needed for multi-threaded FastAPI workers
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def _migrate_lead_columns():
    """Additive, backwards-compatible migration for SQLite.

    `create_all` never alters existing tables, so new nullable columns are added
    manually. Existing rows receive safe defaults and nothing is dropped.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return

    with engine.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(leads)")).fetchall()
        if not rows:
            return

        existing = {row[1] for row in rows}
        if "priority" not in existing:
            conn.execute(text("ALTER TABLE leads ADD COLUMN priority VARCHAR DEFAULT 'normal'"))
        if "next_action_at" not in existing:
            conn.execute(text("ALTER TABLE leads ADD COLUMN next_action_at DATETIME"))
        if "category" not in existing:
            conn.execute(text("ALTER TABLE leads ADD COLUMN category VARCHAR DEFAULT 'ai'"))
        if "deal_type" not in existing:
            conn.execute(text("ALTER TABLE leads ADD COLUMN deal_type VARCHAR DEFAULT 'retainer'"))
        if "urgency" not in existing:
            conn.execute(text("ALTER TABLE leads ADD COLUMN urgency VARCHAR DEFAULT 'normal'"))
        conn.commit()

    try:
        from classifier import backfill_all_leads
        with SessionLocal() as db:
            from models import Lead
            unclassified = db.query(Lead).filter(
                (Lead.category == None) | (Lead.deal_type == None) | (Lead.deal_type == "")
            ).first()
            if unclassified:
                backfill_all_leads(db)
    except Exception as exc:
        print(f"[!] Classifier backfill notice: {exc}")


def _seed_account_platforms():
    """Ensure default account-monitor platforms exist (idempotent)."""
    from models import AccountPlatform, SystemSetting

    with SessionLocal() as db:
        if not db.query(AccountPlatform).filter(AccountPlatform.platform == "hh.ru").first():
            db.add(AccountPlatform(
                platform="hh.ru",
                label="hh.ru · чаты откликов",
                enabled=True,
                interval_minutes=60,
                last_status="idle",
            ))
        defaults = [
            ("HH_ACCOUNT_SYNC_ENABLED", "true", "Мониторинг чатов hh.ru"),
            ("HH_ACCOUNT_SYNC_INTERVAL_MIN", "60", "Интервал синка hh-аккаунта (мин)"),
            ("HH_ACCOUNT_BASE_URL", "https://hh.ru", "Базовый URL hh.ru"),
            ("HH_ACCOUNT_OPEN_CHAT_DETAILS", "true", "Открывать чаты за vacancy_id"),
            ("HH_ACCOUNT_MAX_CHATS_TO_OPEN", "12", "Лимит открытий чатов за проход"),
            ("HH_ACCOUNT_ALERT_ON_REPLY", "true", "Telegram при ответе работодателя"),
        ]
        for key, value, desc in defaults:
            if not db.query(SystemSetting).filter(SystemSetting.key == key).first():
                db.add(SystemSetting(key=key, value=value, description=desc))
        db.commit()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_lead_columns()
    _seed_account_platforms()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
