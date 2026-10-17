import os
from pathlib import Path
from sqlalchemy import create_engine
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

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
