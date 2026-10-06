import json
import logging
import os
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional, Tuple

import httpx
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}
MONTH_RE = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}

# Official & Sensitive field keys that must NEVER be populated by AI or extraction (Rule R1)
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
    "contact_1_mobile",
    "contact_2_mobile",
    "contact_3_mobile",
    "signatures",
    "taxes",
}

AI_DRAFTABLE_KEYS = {"description", "objective"}


class FieldExtractionWithEvidence(BaseModel):
    value: Optional[str] = None
    evidence: Optional[str] = None


class LLMExtractionPayload(BaseModel):
    event_title: Optional[FieldExtractionWithEvidence] = None
    start_date: Optional[FieldExtractionWithEvidence] = None
    end_date: Optional[FieldExtractionWithEvidence] = None
    venue: Optional[FieldExtractionWithEvidence] = None
    participants: Optional[FieldExtractionWithEvidence] = None
    mode: Optional[FieldExtractionWithEvidence] = None
    event_category: Optional[FieldExtractionWithEvidence] = None
    faculty_coordinator: Optional[FieldExtractionWithEvidence] = None
    description: Optional[str] = None
    objective: Optional[str] = None
    has_expenses: Optional[bool] = False
    has_prizes: Optional[bool] = False


def build_llm_prompt(text: str, missing_fields: list[str]) -> str:
    fields_list = "\n".join(f"- {f}" for f in missing_fields)
    return f"""You are an event details extraction engine for college club documents.
The user provided the following announcement text:
\"\"\"{text}\"\"\"

We need to fill the following missing or low-confidence fields:
{fields_list}

RULES:
1. For each field (except description and objective), you MUST return an object:
   {{"value": "<extracted value>", "evidence": "<exact verbatim quote from text>"}}
   If the information is not explicitly stated in the text, return null for that field!
2. Do NOT invent, assume, or guess any dates, venues, names, or participant counts.
3. NEVER extract or invent official numbers, reference numbers, bank accounts, IFSC, GST, mobile numbers, or signatures. If present, ignore them.
4. "description" and "objective" are AI drafts: provide a concise professional description and educational objective based on the context.
5. "has_expenses": true if refreshments/printing/banners/purchases are mentioned, else false.
6. "has_prizes": true if cash/prizes are mentioned, else false.

Return ONLY a JSON object matching this schema:
{{
  "event_title": {{"value": "...", "evidence": "..."}} or null,
  "start_date": {{"value": "YYYY-MM-DD", "evidence": "..."}} or null,
  "end_date": {{"value": "YYYY-MM-DD", "evidence": "..."}} or null,
  "venue": {{"value": "...", "evidence": "..."}} or null,
  "participants": {{"value": "...", "evidence": "..."}} or null,
  "mode": {{"value": "Offline" | "Online" | "Hybrid", "evidence": "..."}} or null,
  "event_category": {{"value": "...", "evidence": "..."}} or null,
  "faculty_coordinator": {{"value": "...", "evidence": "..."}} or null,
  "description": "...",
  "objective": "...",
  "has_expenses": false,
  "has_prizes": false
}}
"""


def _call_llm_api(prompt: str) -> Optional[str]:
    """
    Calls Anthropic or Gemini using HTTP headers (NEVER query parameters for keys).
    Reads model name from ANTHROPIC_MODEL env var.
    Logs errors without including text content.
    """
    model_name = os.getenv("ANTHROPIC_MODEL", settings.ANTHROPIC_MODEL)
    if settings.ANTHROPIC_API_KEY:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": model_name,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }
        resp = httpx.post(url, headers=headers, json=body, timeout=12.0)
        if resp.status_code == 200:
            data = resp.json()
            return data["content"][0]["text"].strip()
        else:
            logger.error("Anthropic API returned status %s", resp.status_code)
            return None

    elif settings.GEMINI_API_KEY:
        # Pass API key via header, NEVER in URL
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
        headers = {
            "x-goog-api-key": settings.GEMINI_API_KEY,
            "content-type": "application/json",
        }
        body = {"contents": [{"parts": [{"text": prompt}]}]}
        resp = httpx.post(url, headers=headers, json=body, timeout=12.0)
        if resp.status_code == 200:
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        else:
            logger.error("Gemini API returned status %s", resp.status_code)
            return None

    return None


def call_llm_with_retry(text: str, missing_fields: list[str]) -> Optional[LLMExtractionPayload]:
    prompt = build_llm_prompt(text, missing_fields)
    for attempt in range(2):  # Try initial + 1 retry on parse failure
        try:
            raw_response = _call_llm_api(prompt)
            if not raw_response:
                continue
            # Strip markdown fences if present
            cleaned = raw_response.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                cleaned = re.sub(r"\s*```$", "", cleaned)
            parsed_json = json.loads(cleaned)
            validated = LLMExtractionPayload.model_validate(parsed_json)
            return validated
        except Exception as e:
            logger.error("LLM extraction attempt %d failed: %s", attempt + 1, type(e).__name__)
    return None


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


def parse_regex_first(text: str) -> Tuple[Dict[str, Any], Dict[str, float], Dict[str, str], str, Dict[str, bool]]:
    values: Dict[str, Any] = {}
    confidence: Dict[str, float] = {}
    sources: Dict[str, str] = {}

    def set_val(k: str, v: Any, conf: float, src: str = "user_text"):
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
        set_val("event_title", raw_title.title(), 0.88)
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

    # Strict post-filter: remove forbidden keys
    for forbidden in OFFICIAL_FORBIDDEN_KEYS:
        values.pop(forbidden, None)
        confidence.pop(forbidden, None)
        sources.pop(forbidden, None)

    return values, confidence, sources, category, flags


def extract_from_text(text: str) -> Tuple[Dict[str, Any], Dict[str, float], Dict[str, str], str, Dict[str, bool]]:
    """
    Primary extraction pipeline:
    1. Runs parser FIRST.
    2. Identifies fields still missing or low-confidence (<0.85).
    3. If LLM is configured, calls LLM ONLY for missing/low-confidence fields.
    4. Enforces strict evidence substring matching and Rule R1 forbidden keys.
    """
    values, confidence, sources, category, flags = parse_regex_first(text)

    # Identify fields that are missing or low confidence
    candidate_keys = ["event_title", "start_date", "end_date", "venue", "participants", "mode", "faculty_coordinator", "description", "objective"]
    missing_or_low = [k for k in candidate_keys if k not in values or confidence.get(k, 0.0) < 0.85]

    # Only call LLM if missing fields exist AND an API key is configured
    if missing_or_low and (settings.ANTHROPIC_API_KEY or settings.GEMINI_API_KEY):
        llm_payload = call_llm_with_retry(text, missing_or_low)
        if llm_payload:
            # Integrate validated LLM values
            _apply_llm_payload(llm_payload, text, values, confidence, sources, flags)

    # Final enforcement of Rule R1: Never fabricate official data
    for forbidden in OFFICIAL_FORBIDDEN_KEYS:
        values.pop(forbidden, None)
        confidence.pop(forbidden, None)
        sources.pop(forbidden, None)

    return values, confidence, sources, category, flags


def _apply_llm_payload(
    llm: LLMExtractionPayload,
    text: str,
    values: Dict[str, Any],
    confidence: Dict[str, float],
    sources: Dict[str, str],
    flags: Dict[str, bool],
):
    # Process structured fields with evidence
    fields_with_evidence = {
        "event_title": llm.event_title,
        "start_date": llm.start_date,
        "end_date": llm.end_date,
        "venue": llm.venue,
        "participants": llm.participants,
        "mode": llm.mode,
        "faculty_coordinator": llm.faculty_coordinator,
    }

    for key, item in fields_with_evidence.items():
        if key in OFFICIAL_FORBIDDEN_KEYS:
            continue
        if not item or not item.value:
            continue

        # Drop any value whose evidence is not a substring of the input
        if not item.evidence or item.evidence not in text:
            logger.info("Dropping hallucinated field '%s': evidence not found in text", key)
            continue

        # Only overwrite if currently missing or lower confidence
        if key not in values or confidence.get(key, 0.0) < 0.85:
            values[key] = item.value
            confidence[key] = 0.95
            sources[key] = "user_text"

    # Process AI-draftable fields
    if llm.description and ("description" not in values or confidence.get("description", 0.0) < 0.85):
        values["description"] = llm.description
        confidence["description"] = 0.90
        sources["description"] = "ai_draft"

    if llm.objective and ("objective" not in values or confidence.get("objective", 0.0) < 0.85):
        values["objective"] = llm.objective
        confidence["objective"] = 0.90
        sources["objective"] = "ai_draft"

    if llm.has_expenses:
        flags["hasExpenses"] = True
    if llm.has_prizes:
        flags["hasPrizes"] = True
