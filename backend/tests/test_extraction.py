from unittest.mock import patch, MagicMock
from app.services.extractor import (
    extract_from_text,
    call_llm_with_retry,
    LLMExtractionPayload,
    FieldExtractionWithEvidence,
)
from app.config import settings


def test_parser_runs_first_without_llm():
    text = "We are conducting a two-day Web Development Workshop on 14–15 October in Seminar Hall for around 120 students."
    values, conf, sources, category, flags = extract_from_text(text)

    assert values.get("event_title") == "Web Development Workshop"
    assert values.get("start_date") is not None and "10-14" in values["start_date"]
    assert values.get("end_date") is not None and "10-15" in values["end_date"]
    assert values.get("venue") == "Seminar Hall"
    assert values.get("participants") == "120"
    assert category == "workshop"


def test_llm_hallucinations_and_forbidden_keys_dropped():
    input_text = "We are planning a Python Coding Meet on 10 November in Lab 3."

    # Mock LLM returning fabricated date, phone number, and fake ref_no
    mock_payload = LLMExtractionPayload(
        # Legitimate extraction with valid substring evidence
        faculty_coordinator=FieldExtractionWithEvidence(
            value="Dr. Patel",
            evidence="Python Coding Meet",  # Substring present
        ),
        # Fabricated date: evidence NOT in input_text
        start_date=FieldExtractionWithEvidence(
            value="2026-12-25",
            evidence="on Christmas Eve",  # NOT in input_text!
        ),
        # AI Draftable description & objective
        description="A comprehensive Python session covering core libraries and hands-on drills.",
        objective="To enhance practical programming proficiency among chapter members.",
        has_expenses=True,
    )

    with patch("app.services.extractor.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "dummy-key"
        mock_settings.GEMINI_API_KEY = None
        mock_settings.ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"

        with patch("app.services.extractor.call_llm_with_retry", return_value=mock_payload):
            values, conf, sources, category, flags = extract_from_text(input_text)

            # 1. Assert fabricated date with non-matching evidence is NOT applied
            assert values.get("start_date") != "2026-12-25"
            # In fact, the parser's 10 November should remain
            assert "11-10" in values.get("start_date", "")

            # 2. Assert AI draftable fields are kept with source 'ai_draft'
            assert values.get("description") == mock_payload.description
            assert sources.get("description") == "ai_draft"
            assert values.get("objective") == mock_payload.objective
            assert sources.get("objective") == "ai_draft"


def test_rule_r1_forbids_phone_and_ref_no_even_if_llm_returns():
    input_text = "ACM SVNIT organizing a general club meetup in Seminar Hall."

    # Mock raw LLM JSON response attempting to inject phone number and ref_no
    raw_llm_json = """{
        "event_title": {"value": "Club Meetup", "evidence": "general club meetup"},
        "ref_no": {"value": "ACM/26-27/ROOM/99", "evidence": "ACM"},
        "mobile": {"value": "+91 9876543210", "evidence": "SVNIT"},
        "contact_1_mobile": {"value": "9998887776", "evidence": "SVNIT"},
        "bank_account": {"value": "1234567890", "evidence": "SVNIT"},
        "description": "General club meetup description",
        "objective": "Discuss roadmap"
    }"""

    with patch("app.services.extractor.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "dummy-key"
        mock_settings.GEMINI_API_KEY = None
        mock_settings.ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"

        with patch("app.services.extractor._call_llm_api", return_value=raw_llm_json):
            values, conf, sources, category, flags = extract_from_text(input_text)

            # Rule R1: Official/sensitive keys MUST NEVER be populated
            assert "ref_no" not in values
            assert "mobile" not in values
            assert "contact_1_mobile" not in values
            assert "bank_account" not in values


def test_llm_validation_and_retry():
    # First attempt returns invalid JSON, second attempt returns valid JSON
    bad_attempt = "This is not valid json {"
    good_attempt = """{
        "event_title": {"value": "Robotics Workshop", "evidence": "Robotics Workshop"},
        "description": "An interactive robotics workshop",
        "objective": "Learn robot kinematics"
    }"""

    with patch("app.services.extractor.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_settings.GEMINI_API_KEY = None
        mock_settings.ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"

        with patch("app.services.extractor._call_llm_api", side_effect=[bad_attempt, good_attempt]):
            payload = call_llm_with_retry("Robotics Workshop announcement", ["event_title", "description"])
            assert payload is not None
            assert payload.event_title.value == "Robotics Workshop"
            assert payload.description == "An interactive robotics workshop"
