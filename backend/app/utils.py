from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def format_reference(pattern: str, seq: int, financial_year: str, academic_year: str, short_name: str, event_code: str = "GEN") -> str:
    return (
        pattern.replace("{FY}", financial_year)
        .replace("{AY}", academic_year)
        .replace("{CLUB}", short_name)
        .replace("{EVENTCODE}", event_code)
        .replace("{seq}", str(seq).zfill(3))
    )
