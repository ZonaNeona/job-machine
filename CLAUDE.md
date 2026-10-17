# CLAUDE.md — Instructions for Claude Code & Claude Desktop

> **CRITICAL**: Before executing any code or proposing changes in this repository, you **MUST** read:
> 1. [AGENTS.md](file:///f:/JOB-MACHINE/AGENTS.md) (Universal System Protocol)
> 2. [.agent/RULES.md](file:///f:/JOB-MACHINE/.agent/RULES.md) (Engineering Standards & Safety)
> 3. [.agent/CURRENT_SPRINT.md](file:///f:/JOB-MACHINE/.agent/CURRENT_SPRINT.md) (Active Tasks & Status)
> 4. The latest handover in [.agent/HANDOVERS/](file:///f:/JOB-MACHINE/.agent/HANDOVERS/)

## Quick Reference
- **Project Goal**: Automated pipeline to acquire 5–7 ongoing development clients at 80k–90k RUB/mo.
- **Tech Stack**:
  - Backend: FastAPI, SQLAlchemy 2.0, SQLite (`job_machine.db`), Python 3.12+ (Port 8000)
  - Frontend: React 19, Vite, Tailwind CSS v4, Lucide Icons (Port 5173)
  - AI Layer: OpenRouter API (Claude 3.5 Sonnet / DeepSeek V3)
- **Do not break**: Ports 8000 & 5173, UTF-8 file encodings, SQLite schema compatibility.
- **Always update**: When your session ends, fill in a handover report in `.agent/HANDOVERS/` using `TEMPLATE.md` and update `CURRENT_SPRINT.md`.
