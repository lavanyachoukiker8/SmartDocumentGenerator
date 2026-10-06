import json
import threading
from pathlib import Path
from typing import Optional
import yaml
from sqlmodel import Session, select
from app.config import settings
from app.models import ClubTable, CounterTable
from app.utils import format_reference
from app.services.template_loader import get_template_by_id

_counter_lock = threading.Lock()


def get_template_pattern(template_id: str) -> Optional[str]:
    """Reads ref pattern from meta.yaml in template folder if defined."""
    folder = settings.TEMPLATES_DIR / template_id
    if not folder.exists():
        folder = settings.TEMPLATES_DIR / template_id.replace("-", "_")
    meta_path = folder / "meta.yaml"
    if meta_path.exists():
        try:
            data = yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}
            pat = data.get("pattern") or data.get("ref_pattern") or data.get("reference_pattern")
            if pat:
                return str(pat).strip()
        except Exception:
            pass
    return None


def reserve_reference_sequence(
    category: str,
    year: str,
    session: Session,
) -> int:
    """
    Reserves a monotonically increasing sequence for (category, year) in CounterTable.
    Synchronized with thread lock and database commit for concurrency safety.
    """
    with _counter_lock:
        row = session.exec(
            select(CounterTable)
            .where(CounterTable.category == category)
            .where(CounterTable.year == year)
        ).first()

        if not row:
            # Check club table for initial counter default
            initial_seq = 0
            club = session.exec(select(ClubTable)).first()
            if club and club.reference_formats_json:
                try:
                    formats = json.loads(club.reference_formats_json)
                    fmt = next((f for f in formats if f.get("category") == category), None)
                    if fmt:
                        initial_seq = fmt.get("counter", 0)
                except Exception:
                    pass

            row = CounterTable(category=category, year=year, last_seq=initial_seq)
            session.add(row)
            session.commit()
            session.refresh(row)

        row.last_seq += 1
        session.add(row)
        session.commit()
        session.refresh(row)
        return row.last_seq


def reserve_document_reference(
    template_id: str,
    event_category: str,
    session: Session,
) -> Optional[str]:
    """
    Reserves a reference number for a document on approval.
    Reads pattern from meta.yaml if defined, falls back to club profile format.
    Guarantees exactly one reference number per document.
    """
    club = session.exec(select(ClubTable)).first()
    if not club:
        return None

    t = get_template_by_id(template_id, session)
    if not t or not t.ref_category:
        return None

    category = t.ref_category
    year = club.financial_year or "26-27"

    pattern = get_template_pattern(template_id)
    if not pattern:
        formats = json.loads(club.reference_formats_json) if club.reference_formats_json else []
        fmt = next((f for f in formats if f.get("category") == category), None)
        if fmt and fmt.get("pattern"):
            pattern = fmt.get("pattern")
        else:
            pattern = f"{club.short_name}/{{FY}}/{category}/{{seq}}"

    seq = reserve_reference_sequence(category, year, session)

    ref = format_reference(
        pattern=pattern,
        seq=seq,
        financial_year=club.financial_year,
        academic_year=club.academic_year,
        short_name=club.short_name,
        event_code=event_category.upper() if event_category else "GEN",
    )
    return ref
