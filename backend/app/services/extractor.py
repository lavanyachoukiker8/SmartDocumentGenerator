import re
from datetime import datetime, date, timedelta
from typing import Any, Dict, Tuple

from app.config import settings
import json
import httpx

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}
MONTH_RE = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}

# Official & Sensitive field keys that must NEVER be populated by AI or extraction
OFFICIAL_FORBIDDEN_KEYS = {
    "ref_no",
    "approval_note_no",
    "approval_date",
    "head_of_account",
    "invoice_no",
    "invoice_date",
    "purchase_order",
    "advance_drawn",
    "supplier_gst",
    "account_number",
    "account_holder",
    "bank_name",
    "bank_branch",
    "ifsc",
    "payee_name",
    "mobile",
    "signatures",
    "taxes",
}


def try_llm_extraction(text: str) -> Tuple[Dict[str, Any], Dict[str, float], Dict[str, str], str, Dict[str, bool]] | None:
    """
    Attempts extraction using Gemini or Anthropic if API keys are configured.
    Enforces Rule R1 post-filter so official/financial details are NEVER populated.
    """
    prompt = f"""You are an event details extraction engine for college club documents.
Extract the following information from the user's event announcement into valid JSON:
- event_title: Name of event (string)
- start_date: YYYY-MM-DD or null
- end_date: YYYY-MM-DD or null
- venue: Venue name or null
- participants: Estimated number of attendees (e.g. "120" or "100+") or null
- mode: "Offline" | "Online" | "Hybrid"
- event_category: "workshop" | "hackathon" | "competition" | "seminar" | "talk" | "meeting" | "other"
- description: A professional 2-3 sentence overview of the event
- objective: A clear educational/technical objective statement
- hasExpenses: boolean (true if snacks, banners, certificates, equipment, or prizes are expected)
- hasPrizes: boolean (true if prizes/cash rewards are mentioned)

CRITICAL RULE: DO NOT extract or invent official numbers, reference codes, bank accounts, IFSC, GST, phone numbers, or signatures.

Text:
\"\"\"{text}\"\"\"

Return ONLY valid JSON matching this schema, without code blocks or other text.
"""
    try:
        if settings.GEMINI_API_KEY:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            resp = httpx.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=10.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_out = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if raw_out.startswith("```"):
                    raw_out = re.sub(r"^```(?:json)?\s*", "", raw_out)
                    raw_out = re.sub(r"\s*```$", "", raw_out)
                parsed = json.loads(raw_out)
                return _process_llm_result(parsed)

        elif settings.ANTHROPIC_API_KEY:
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            resp = httpx.post(
                url,
                headers=headers,
                json={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 1000,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_out = data["content"][0]["text"].strip()
                if raw_out.startswith("```"):
                    raw_out = re.sub(r"^```(?:json)?\s*", "", raw_out)
                    raw_out = re.sub(r"\s*```$", "", raw_out)
                parsed = json.loads(raw_out)
                return _process_llm_result(parsed)
    except Exception:
        # LLM failure or timeout -> silently proceed to robust regex engine
        pass
    return None


def _process_llm_result(parsed: dict) -> Tuple[Dict[str, Any], Dict[str, float], Dict[str, str], str, Dict[str, bool]]:
    values: Dict[str, Any] = {}
    confidences: Dict[str, float] = {}
    sources: Dict[str, str] = {}

    for k, v in parsed.items():
        if k in OFFICIAL_FORBIDDEN_KEYS:
            continue
        if v is not None and k not in ["hasExpenses", "hasPrizes", "event_category"]:
            values[k] = v
            confidences[k] = 0.92
            sources[k] = "ai_draft" if k in ["description", "objective"] else "user_text"

    category = parsed.get("event_category", "workshop")
    flags = {
        "hasExpenses": bool(parsed.get("hasExpenses", False)),
        "hasPrizes": bool(parsed.get("hasPrizes", False)),
    }

    # Strict post-filter: strip forbidden keys
    for forbidden in OFFICIAL_FORBIDDEN_KEYS:
        values.pop(forbidden, None)
        confidences.pop(forbidden, None)
        sources.pop(forbidden, None)

    return values, confidences, sources, category, flags



def guess_year(month: int, day: int) -> int:
    now = datetime.now()
    y = now.year
    candidate = date(y, month, day)
    if (candidate - now.date()).days < -30:
        return y + 1
    return y


def detect_category(text: str) -> str:
    t = text.lower()
    if re.search(r"hackathon", t):
        return "hackathon"
    if re.search(r"workshop|bootcamp|hands-on", t):
        return "workshop"
    if re.search(r"competition|contest|quiz|coding round", t):
        return "competition"
    if re.search(r"seminar|symposium", t):
        return "seminar"
    if re.search(r"talk|lecture|session|webinar", t):
        return "talk"
    if re.search(r"meet|meeting|orientation", t):
        return "meeting"
    return "other"


def extract_from_text(text: str) -> Tuple[Dict[str, Any], Dict[str, float], Dict[str, str], str, Dict[str, bool]]:
    if settings.GEMINI_API_KEY or settings.ANTHROPIC_API_KEY:
        llm_result = try_llm_extraction(text)
        if llm_result is not None:
            return llm_result

    values: Dict[str, Any] = {}
    confidence: Dict[str, float] = {}
    sources: Dict[str, str] = {}

    def set_val(k: str, v: Any, conf: float, src: str = "user_text"):
        # Enforce Rule R1: Never fabricate official data
        if k in OFFICIAL_FORBIDDEN_KEYS:
            return
        values[k] = v
        confidence[k] = conf
        sources[k] = src

    clean = re.sub(r"\s+", " ", text).strip()

    # Title
    title_m = re.search(
        r"(?:conduct(?:ing)?|organi[sz](?:e|ing)|host(?:ing)?|hold(?:ing)?|plan(?:ning)?|arrang(?:e|ing))\s+(?:an?\s+|the\s+|our\s+)?(?:(one|two|three|four|five|\d+)[- ]day\s+)?(.+?)(?=\s+(?:on|in|at|for|from|during|between|with)\s|[,.;]|$)",
        clean,
        re.IGNORECASE,
    )
    duration_days = 1
    if title_m:
        d = title_m.group(1)
        if d:
            duration_days = NUM_WORDS.get(d.lower(), int(d) if d.isdigit() else 1)
        raw_title = title_m.group(2).strip()
        raw_title = re.sub(r"^(a|an|the)\s+", "", raw_title, flags=re.IGNORECASE)
        set_val("event_title", raw_title.title(), 0.86)
    else:
        day_m = re.search(r"(one|two|three|four|five|\d+)[- ]day", clean, re.IGNORECASE)
        if day_m:
            duration_days = NUM_WORDS.get(day_m.group(1).lower(), int(day_m.group(1)) if day_m.group(1).isdigit() else 1)

    # Dates
    range_re = re.compile(
        rf"(\d{{1,2}})(?:st|nd|rd|th)?\s*(?:-|–|—|to|and|&)\s*(\d{{1,2}})(?:st|nd|rd|th)?\s+{MONTH_RE}(?:,?\s+(\d{{4}}))?",
        re.IGNORECASE,
    )
    single_re = re.compile(
        rf"(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?{MONTH_RE}(?:,?\s+(\d{{4}}))?",
        re.IGNORECASE,
    )
    range_m = range_re.search(clean)
    if range_m:
        m_str = range_m.group(3)[:3].lower()
        month = MONTHS.get(m_str, 1)
        year = int(range_m.group(4)) if range_m.group(4) else guess_year(month, int(range_m.group(1)))
        start_d = date(year, month, int(range_m.group(1))).isoformat()
        end_d = date(year, month, int(range_m.group(2))).isoformat()
        set_val("start_date", start_d, 0.93)
        set_val("end_date", end_d, 0.93)
    else:
        single_m = single_re.search(clean)
        if single_m:
            m_str = single_m.group(2)[:3].lower()
            month = MONTHS.get(m_str, 1)
            year = int(single_m.group(3)) if single_m.group(3) else guess_year(month, int(single_m.group(1)))
            start_d = date(year, month, int(single_m.group(1))).isoformat()
            set_val("start_date", start_d, 0.9)
            if duration_days > 1:
                end_d = (date(year, month, int(single_m.group(1))) + timedelta(days=duration_days - 1)).isoformat()
                set_val("end_date", end_d, 0.75)
            else:
                set_val("end_date", start_d, 0.8)

    # Venue
    venue_m = re.search(
        r"\b(?:in|at)\s+(?:the\s+)?((?:[A-Z0-9][\w.&-]*\s+){0,4}(?:Seminar Hall|Hall|Auditorium|Lab(?:oratory)?|Room|Theatre|Theater|Centre|Center|LT|Amphitheatre|Ground)(?:[\s-]*\d+[A-Z]?)?(?:,\s*[A-Z][\w\s&]*?Department)?)",
        text,
    )
    if not venue_m:
        venue_m = re.search(r"\b(?:in|at)\s+(?:the\s+)?(seminar hall(?:\s*\d+)?|auditorium|lab\s*\d*)", text, re.IGNORECASE)
    if venue_m:
        set_val("venue", venue_m.group(1).title(), 0.88)

    # Participants
    part_m = re.search(
        r"(?:around|about|approx\.?|approximately|nearly|~|over)?\s*(\d{2,5})\s*(\+)?\s*(?:students|participants|attendees|people|members|delegates)",
        clean,
        re.IGNORECASE,
    )
    if part_m:
        set_val("participants", f"{part_m.group(1)}{part_m.group(2) or ''}", 0.9)

    # Mode
    if re.search(r"hybrid", clean, re.IGNORECASE):
        set_val("mode", "Hybrid", 0.92)
    elif re.search(r"online|virtual|google meet|zoom|webinar", clean, re.IGNORECASE):
        set_val("mode", "Online", 0.9)
    elif re.search(r"offline|in[- ]person", clean, re.IGNORECASE) or values.get("venue"):
        set_val("mode", "Offline", 0.9)

    category = detect_category(clean)
    set_val("event_category", category, 0.8)

    flags = {
        "hasExpenses": bool(
            re.search(r"refreshment|snack|lunch|food|purchase|print|goodies|kit|stationery|banner|bill|expense|swag|certificate", clean, re.IGNORECASE)
            or category in ["workshop", "hackathon", "competition"]
        ),
        "hasPrizes": bool(
            re.search(r"prize|reward|reimburse|winner|cash", clean, re.IGNORECASE)
            or category in ["hackathon", "competition"]
        ),
    }

    # Post-filter verification: ensure no official forbidden keys leaked
    for forbidden in OFFICIAL_FORBIDDEN_KEYS:
        if forbidden in values:
            del values[forbidden]
            if forbidden in confidence:
                del confidence[forbidden]
            if forbidden in sources:
                del sources[forbidden]

    return values, confidence, sources, category, flags
