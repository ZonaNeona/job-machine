# -*- coding: utf-8 -*-
"""Parse HH chat list / opened chat from HTML (saved pages or live DOM)."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field, asdict
from html import unescape
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from config import NO_REPLY_PREVIEWS, REPLY_STATUS_HINTS, SYSTEM_COUNTERPARTS


@dataclass
class ChatListItem:
    chat_id: str
    chat_url: str
    title: str = ""
    counterpart: str = ""
    time_label: str = ""
    preview: str = ""
    has_reply_hint: bool = False

    def fingerprint(self) -> str:
        raw = "|".join([
            self.chat_id,
            self.title.strip(),
            self.counterpart.strip(),
            self.preview.strip(),
            self.time_label.strip(),
        ])
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["fingerprint"] = self.fingerprint()
        return data


@dataclass
class ChatMessage:
    message_id: str
    text: str
    author: str = ""
    time_label: str = ""


@dataclass
class ChatDetails:
    chat_id: str
    vacancy_id: Optional[str] = None
    vacancy_url: Optional[str] = None
    vacancy_title: str = ""
    participant_title: str = ""
    participant_subtitle: str = ""
    messages: List[ChatMessage] = field(default_factory=list)

    def last_message_text(self) -> str:
        if not self.messages:
            return ""
        return self.messages[-1].text.strip()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chat_id": self.chat_id,
            "vacancy_id": self.vacancy_id,
            "vacancy_url": self.vacancy_url,
            "vacancy_title": self.vacancy_title,
            "participant_title": self.participant_title,
            "participant_subtitle": self.participant_subtitle,
            "messages": [asdict(m) for m in self.messages],
            "last_message": self.last_message_text(),
        }


_CHAT_OPEN_RE = re.compile(r'data-qa="chatik-open-chat-(\d+)"', re.I)
_CHAT_HREF_RE = re.compile(r'href="(https?://[^"]+/chat/(\d+)[^"]*)"', re.I)
_VACANCY_RE = re.compile(r'(?:https?://[^"\s]+)?/vacancy/(\d+)', re.I)
_QA_TEXT_RE = re.compile(
    r'data-qa="(chat-cell-title|chat-cell-subtitle|chat-cell-creation-time)"[^>]*>(.*?)</(?:span|div|a|p|h\d)>',
    re.I | re.S,
)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _plain(html_fragment: str) -> str:
    text = _TAG_RE.sub(" ", html_fragment or "")
    text = unescape(text)
    return _WS_RE.sub(" ", text).strip()


def _guess_has_reply(preview: str, counterpart: str, title: str = "") -> bool:
    preview_l = (preview or "").strip().lower()
    counterpart_l = (counterpart or "").strip().lower()
    blob = f"{preview_l} {counterpart_l} {title.lower()}"

    if counterpart_l in SYSTEM_COUNTERPARTS:
        return False
    if preview_l in NO_REPLY_PREVIEWS:
        return False
    if any(hint in blob for hint in REPLY_STATUS_HINTS):
        return True
    # Employer wrote something other than the system "Отклик на вакансию" stub
    if preview_l and preview_l not in NO_REPLY_PREVIEWS:
        return True
    return False


def parse_chat_list_html(html: str, base_url: str = "https://hh.ru") -> List[ChatListItem]:
    """Extract chat rows from /chat list page HTML."""
    if not html:
        return []

    items: Dict[str, ChatListItem] = {}

    for m in _CHAT_OPEN_RE.finditer(html):
        chat_id = m.group(1)
        items.setdefault(
            chat_id,
            ChatListItem(
                chat_id=chat_id,
                chat_url=urljoin(base_url.rstrip("/") + "/", f"chat/{chat_id}"),
            ),
        )

    for m in _CHAT_HREF_RE.finditer(html):
        chat_id = m.group(2)
        items.setdefault(
            chat_id,
            ChatListItem(chat_id=chat_id, chat_url=m.group(1).split("?")[0]),
        )
        # Prefer absolute href without tracking junk for storage
        items[chat_id].chat_url = m.group(1).split("?")[0]

    # Enrich each chat block: take a window around chatik-open-chat-{id}
    for chat_id, item in items.items():
        marker = f'data-qa="chatik-open-chat-{chat_id}"'
        idx = html.find(marker)
        if idx < 0:
            marker2 = f"/chat/{chat_id}"
            idx = html.find(marker2)
        if idx < 0:
            continue

        start = max(0, idx - 2500)
        end = min(len(html), idx + 4500)
        chunk = html[start:end]

        fields: Dict[str, str] = {}
        for qm in _QA_TEXT_RE.finditer(chunk):
            key = qm.group(1)
            if key not in fields:
                fields[key] = _plain(qm.group(2))

        item.title = fields.get("chat-cell-title", item.title)
        item.counterpart = fields.get("chat-cell-subtitle", item.counterpart)
        item.time_label = fields.get("chat-cell-creation-time", item.time_label)

        # Preview: longest meaningful text node in the cell that isn't title/counterpart/time
        plain_parts = [
            _plain(p)
            for p in re.split(r"</(?:div|span|p|a|label)>", chunk)
        ]
        candidates = []
        skip = {item.title, item.counterpart, item.time_label, "Только непрочитанные", ""}
        for part in plain_parts:
            if not part or part in skip:
                continue
            if part.startswith("data-qa") or "magritte-" in part:
                continue
            if len(part) < 3:
                continue
            candidates.append(part)
        if candidates:
            # Prefer medium/long preview over tiny date leftovers
            candidates.sort(key=len, reverse=True)
            for cand in candidates:
                if cand == item.title or cand == item.counterpart:
                    continue
                if re.fullmatch(r"\d{1,2}\.\d{1,2}", cand) or cand in {"ср", "пн", "вт", "чт", "пт", "сб", "вс"}:
                    continue
                item.preview = cand
                break

        item.has_reply_hint = _guess_has_reply(item.preview, item.counterpart, item.title)

    return sorted(items.values(), key=lambda c: c.chat_id, reverse=True)


def parse_chat_details_html(html: str, chat_id: str, base_url: str = "https://hh.ru") -> ChatDetails:
    """Extract vacancy link + messages from an opened chat page."""
    details = ChatDetails(chat_id=chat_id)

    # Vacancy link in header
    vac_link = re.search(
        r'data-qa="chatik-header-vacancy-link"[^>]*href="([^"]+)"',
        html,
        re.I,
    )
    vac_text = re.search(
        r'data-qa="chatik-header-vacancy-link-text"[^>]*>(.*?)</',
        html,
        re.I | re.S,
    )
    if vac_link:
        href = unescape(vac_link.group(1))
        details.vacancy_url = urljoin(base_url, href)
        vm = _VACANCY_RE.search(href)
        if vm:
            details.vacancy_id = vm.group(1)
    if not details.vacancy_id:
        vm = _VACANCY_RE.search(html)
        if vm:
            details.vacancy_id = vm.group(1)
            details.vacancy_url = urljoin(base_url, f"/vacancy/{details.vacancy_id}")
    if vac_text:
        vt = _plain(vac_text.group(1))
        if vt.lower() not in {"перейти", "перейти к вакансии", "вакансия"}:
            details.vacancy_title = vt

    part_title = re.search(
        r'data-qa="participant-info-title"[^>]*>(.*?)</',
        html,
        re.I | re.S,
    )
    part_sub = re.search(
        r'data-qa="participant-info-subtitle"[^>]*>(.*?)</',
        html,
        re.I | re.S,
    )
    if part_title:
        details.participant_title = _plain(part_title.group(1))
    if part_sub:
        details.participant_subtitle = _plain(part_sub.group(1))

    # Messages: chatik-chat-message-{id}-text and bubble text
    msg_ids = re.findall(r'data-qa="chatik-chat-message-(\d+)(?:-text)?"', html, re.I)
    seen = []
    for mid in msg_ids:
        if mid not in seen:
            seen.append(mid)

    for mid in seen:
        text_m = re.search(
            rf'data-qa="chatik-chat-message-{mid}-text"[^>]*>(.*?)</(?:div|span|p)>',
            html,
            re.I | re.S,
        )
        if not text_m:
            text_m = re.search(
                rf'data-qa="chatik-chat-message-{mid}"[^>]*>.*?data-qa="chat-bubble-text"[^>]*>(.*?)</(?:div|span|p)>',
                html,
                re.I | re.S,
            )
        text = _plain(text_m.group(1)) if text_m else ""
        if not text:
            continue

        # Author near this message block
        block_idx = html.find(f'chatik-chat-message-{mid}')
        author = ""
        time_label = ""
        if block_idx >= 0:
            window = html[max(0, block_idx - 500) : block_idx + 2500]
            am = re.search(r'data-qa="chat-bubble-author-name"[^>]*>(.*?)</', window, re.I | re.S)
            tm = re.search(r'data-qa="chat-buble-display-time"[^>]*>(.*?)</', window, re.I | re.S)
            if am:
                author = _plain(am.group(1))
            if tm:
                time_label = _plain(tm.group(1))

        details.messages.append(
            ChatMessage(message_id=mid, text=text, author=author, time_label=time_label)
        )

    # Fallback: all bubble texts if structured ids missing
    if not details.messages:
        for bm in re.finditer(r'data-qa="chat-bubble-text"[^>]*>(.*?)</(?:div|span|p)>', html, re.I | re.S):
            text = _plain(bm.group(1))
            if text:
                details.messages.append(ChatMessage(message_id=str(len(details.messages) + 1), text=text))

    return details
