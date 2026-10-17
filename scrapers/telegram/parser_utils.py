import re
from typing import List, Optional, Tuple, Dict, Any
from config import TARGET_KEYWORDS, STOP_KEYWORDS

def is_relevant_message(text: str) -> bool:
    """Checks whether a message matches our IT/LLM/Bot/Automation profile and isn't spam."""
    if not text or len(text.strip()) < 50:
        return False

    text_lower = text.lower()

    # Reject if contains any hard stop-words
    for stop in STOP_KEYWORDS:
        if stop in text_lower:
            return False

    # Accept if contains at least one target keyword
    for target in TARGET_KEYWORDS:
        if target in text_lower:
            return True

    return False


def extract_contacts(text: str) -> str:
    """Extracts Telegram usernames, links, and emails from text."""
    contacts = []

    # 1. @usernames
    usernames = re.findall(r"@([a-zA-Z0-9_]{4,32})", text)
    for u in usernames:
        # Filter out common channel keywords
        if u.lower() not in ["channel", "admin", "bot", "here", "all"]:
            contacts.append(f"@{u}")

    # 2. t.me/ links
    tme_links = re.findall(r"(?:https?://)?t\.me/([a-zA-Z0-9_]{4,32})", text)
    for t in tme_links:
        formatted = f"@{t}"
        if formatted not in contacts:
            contacts.append(formatted)

    # 3. Emails
    emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    for em in emails:
        if em not in contacts:
            contacts.append(em)

    return " | ".join(list(dict.fromkeys(contacts))) if contacts else "Контакты в посте"


def extract_salary(text: str) -> Tuple[str, Optional[int], Optional[int]]:
    """Extracts salary string and numeric bounds from Telegram posting text."""
    # Pattern for salary e.g. "80 000 - 120 000 руб", "от 90к", "до 150000 ₽"
    salary_patterns = [
        r"(?:от|до|з/п|оплата|ставка|вилка)?\s*(\d{2,3}(?:[\s\.]?\d{3})*|\d{2,3}\s*[kк])\s*(?:-|до|—)?\s*(\d{2,3}(?:[\s\.]?\d{3})*|\d{2,3}\s*[kк])?\s*(?:руб|рублей|₽|usd|\$|usdt)",
        r"(\d{2,3}\s*[kк]|\d{5,6})\s*(?:руб|₽|\$)"
    ]

    for pat in salary_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw = match.group(0).strip()
            # Parse digits
            digits = re.findall(r"\d+", raw.replace("k", "000").replace("к", "000").replace(" ", "").replace(".", ""))
            if len(digits) >= 2:
                try:
                    return raw, int(digits[0]), int(digits[1])
                except ValueError:
                    pass
            elif len(digits) == 1:
                try:
                    return raw, int(digits[0]), None
                except ValueError:
                    pass
            return raw, None, None

    return "По договоренности", None, None


def extract_title_and_company(text: str, channel: str) -> Tuple[str, str]:
    """Generates a clean job title and extracts or infers company name."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return "Заказ на разработку (Telegram)", f"@{channel}"

    # First clean line often serves as title
    first_line = lines[0].replace("#", "").replace("*", "").replace("!", "").strip()
    
    # Try finding explicit role keywords in first few lines
    candidate_title = first_line
    for line in lines[:4]:
        line_clean = line.replace("#", "").replace("*", "").strip()
        if any(k in line_clean.lower() for k in ["ищем", "вакансия", "требуется", "разработчик", "developer", "engineer", "нужен"]):
            candidate_title = line_clean
            break

    if len(candidate_title) > 90:
        candidate_title = candidate_title[:87] + "..."

    # Check for company mention
    company = f"Telegram @{channel}"
    for line in lines[:5]:
        comp_match = re.search(r"(?:компания|проект|стартап|клиент):\s*([^\n,]+)", line, re.IGNORECASE)
        if comp_match:
            company = comp_match.group(1).strip()
            break

    return candidate_title, company
