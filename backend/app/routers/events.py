import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.config import settings
from app.crypto import decrypt_field, encrypt_field, mask_value
from app.db import get_session
from app.models import (
    ClubTable,
    CounterTable,
    DocumentTable,
    DocumentVersionTable,
    EventFieldTable,
    EventTable,
    TemplateMetaTable,
)
from app.schemas import (
    ClubEvent,
    DocumentRecommendation,
    EventFormInput,
    EventSummary,
    ExtractedField,
    GenerateOptions,
    GeneratedDocument,
    Placeholder,
    Status,
)
from app.services.extractor import extract_from_text
from app.services.rules import eval_rule_safe
from app.services.template_loader import load_templates_from_disk
from app.utils import format_reference, now_iso

router = APIRouter(prefix="/events", tags=["Events"])


def get_all_placeholders(session: Session) -> List[Placeholder]:
    templates = load_templates_from_disk(session)
    seen = {}
    for t in templates:
        for p in t.placeholders:
            if p.key not in seen:
                seen[p.key] = p
            elif p.required:
                seen[p.key].required = True
    return list(seen.values())


def db_to_event_schema(e: EventTable, fields: List[EventFieldTable], doc_ids: List[str]) -> ClubEvent:
    schema_fields: List[ExtractedField] = []
    for f in fields:
        raw = f.raw_value
        val = raw
        if raw is not None:
            if f.masked and not f.user_confirmed:
                plain = decrypt_field(raw)
                val = mask_value(plain)
            elif f.masked and f.user_confirmed:
                val = decrypt_field(raw)
            elif f.field_type == "table":
                try:
                    val = json.loads(raw)
                except Exception:
                    val = []

        cols = json.loads(f.columns_json) if f.columns_json else None
        opts = json.loads(f.options_json) if f.options_json else None

        schema_fields.append(
            ExtractedField(
                key=f.key,
                label=f.label,
                type=f.field_type,
                value=val,
                source=f.source,
                confidence=f.confidence,
                required=f.required,
                never_ai=f.never_ai,
                masked=f.masked,
                ai_draftable=f.ai_draftable,
                question=f.question,
                section=f.section,
                shared=f.shared,
                user_confirmed=f.user_confirmed,
                suggestion=f.suggestion,
                options=opts,
                columns=cols,
            )
        )

    changed_keys = json.loads(e.changed_keys_json) if e.changed_keys_json else []

    return ClubEvent(
        id=e.id,
        title=e.title,
        category=e.category,
        start_date=e.start_date,
        end_date=e.end_date,
        venue=e.venue,
        status=e.status,
        created_at=e.created_at,
        updated_at=e.updated_at,
        source_text=e.source_text,
        fields=schema_fields,
        document_ids=doc_ids,
        last_generated_at=e.last_generated_at,
        changed_since_generation=e.changed_since_generation,
        changed_keys=changed_keys,
    )


def compute_missing_count(e: EventTable, fields: List[EventFieldTable]) -> int:
    return sum(1 for f in fields if f.required and (f.raw_value is None or str(f.raw_value).strip() == ""))


@router.get("", response_model=List[EventSummary])
def list_events(session: Session = Depends(get_session)):
    events = session.exec(select(EventTable).order_by(EventTable.updated_at.desc())).all()
    summaries: List[EventSummary] = []
    for e in events:
        fields = session.exec(select(EventFieldTable).where(EventFieldTable.event_id == e.id)).all()
        doc_count = len(session.exec(select(DocumentTable.id).where(DocumentTable.event_id == e.id)).all())
        missing = compute_missing_count(e, fields)
        summaries.append(
            EventSummary(
                id=e.id,
                title=e.title,
                category=e.category,
                start_date=e.start_date,
                end_date=e.end_date,
                venue=e.venue,
                status=e.status,
                document_count=doc_count,
                missing_count=missing,
                updated_at=e.updated_at,
            )
        )
    return summaries


@router.get("/{event_id}", response_model=ClubEvent)
def get_event(event_id: str, session: Session = Depends(get_session)):
    event = session.exec(select(EventTable).where(EventTable.id == event_id)).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    fields = session.exec(select(EventFieldTable).where(EventFieldTable.event_id == event_id)).all()
    doc_ids = session.exec(select(DocumentTable.id).where(DocumentTable.event_id == event_id)).all()
    return db_to_event_schema(event, fields, doc_ids)


@router.post("/from-text", response_model=ClubEvent)
def create_event_from_text(payload: dict, session: Session = Depends(get_session)):
    text = payload.get("text", "")
    extracted_values, confidences, sources, category, flags = extract_from_text(text)

    event_id = f"evt-{uuid.uuid4().hex[:6]}"
    now = now_iso()

    title = extracted_values.get("event_title") or "Untitled Event"
    start_date = extracted_values.get("start_date")
    end_date = extracted_values.get("end_date") or start_date
    venue = extracted_values.get("venue")

    event = EventTable(
        id=event_id,
        title=title,
        category=category,
        start_date=start_date,
        end_date=end_date,
        venue=venue,
        status="needs_info" if not venue or not start_date else "ready",
        source_text=text,
        created_at=now,
        updated_at=now,
    )
    session.add(event)

    all_placeholders = get_all_placeholders(session)
    club = session.exec(select(ClubTable)).first()

    for p in all_placeholders:
        val = extracted_values.get(p.key)
        src = sources.get(p.key, "missing")
        conf = confidences.get(p.key, 0.0)

        # AI draftable logic
        if val is None and p.ai_draftable and not p.never_ai:
            if p.key == "subject":
                val = f"Requesting Permission to Conduct {title} in {venue or 'the requested hall'}."
                src = "ai_draft"
                conf = 0.6
            elif p.key == "description":
                val = f"ACM SVNIT is conducting {title}, an interactive technical session open to students."
                src = "ai_draft"
                conf = 0.6
            elif p.key == "objective":
                val = f"To provide students with hands-on exposure and practical understanding of topics covered in {title}."
                src = "ai_draft"
                conf = 0.6

        # Club Profile defaults for non-sensitive fields
        if val is None and not p.never_ai and club:
            if p.key == "submitted_to":
                val = club.default_submitted_to
                src = "club_profile"
                conf = 1.0

        # Suggested ref peek
        suggestion = None
        if p.key == "ref_no" and club:
            formats = json.loads(club.reference_formats_json)
            fmt = next((f for f in formats if f["category"] == "ROOM"), None)
            if fmt:
                suggestion = format_reference(
                    fmt["pattern"],
                    fmt["counter"] + 1,
                    club.financial_year,
                    club.academic_year,
                    club.short_name,
                    category.upper(),
                )

        raw_stored = str(val) if val is not None else None
        if raw_stored and p.masked:
            raw_stored = encrypt_field(raw_stored)

        cols_json = json.dumps([c.model_dump(by_alias=True) for c in p.columns]) if p.columns else None

        field_rec = EventFieldTable(
            event_id=event_id,
            key=p.key,
            label=p.label,
            field_type=p.type,
            raw_value=raw_stored,
            source=src,
            confidence=conf,
            required=p.required,
            never_ai=p.never_ai,
            masked=p.masked,
            ai_draftable=p.ai_draftable,
            question=p.question,
            section=p.section,
            shared=p.shared or False,
            user_confirmed=src == "user_text",
            suggestion=suggestion,
            columns_json=cols_json,
        )
        session.add(field_rec)

    session.commit()
    return get_event(event_id, session)


@router.post("/from-form", response_model=ClubEvent)
def create_event_from_form(payload: EventFormInput, session: Session = Depends(get_session)):
    event_id = f"evt-{uuid.uuid4().hex[:6]}"
    now = now_iso()

    event = EventTable(
        id=event_id,
        title=payload.title,
        category=payload.category,
        start_date=payload.start_date,
        end_date=payload.end_date or payload.start_date,
        venue=payload.venue,
        status="ready",
        created_at=now,
        updated_at=now,
    )
    session.add(event)

    all_placeholders = get_all_placeholders(session)
    form_dict = payload.model_dump()

    for p in all_placeholders:
        val = form_dict.get(p.key)
        src = "user_text" if val else "missing"
        conf = 1.0 if val else 0.0

        raw_stored = str(val) if val else None
        if raw_stored and p.masked:
            raw_stored = encrypt_field(raw_stored)

        cols_json = json.dumps([c.model_dump(by_alias=True) for c in p.columns]) if p.columns else None

        field_rec = EventFieldTable(
            event_id=event_id,
            key=p.key,
            label=p.label,
            field_type=p.type,
            raw_value=raw_stored,
            source=src,
            confidence=conf,
            required=p.required,
            never_ai=p.never_ai,
            masked=p.masked,
            ai_draftable=p.ai_draftable,
            question=p.question,
            section=p.section,
            shared=p.shared or False,
            user_confirmed=bool(val),
            columns_json=cols_json,
        )
        session.add(field_rec)

    session.commit()
    return get_event(event_id, session)


@router.patch("/{event_id}/fields", response_model=ClubEvent)
def update_event_fields(
    event_id: str,
    payload: dict,
    session: Session = Depends(get_session),
):
    event = session.exec(select(EventTable).where(EventTable.id == event_id)).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    updates = payload.get("updates", {})
    changed_keys = json.loads(event.changed_keys_json) if event.changed_keys_json else []

    for key, val in updates.items():
        f = session.exec(
            select(EventFieldTable)
            .where(EventFieldTable.event_id == event_id)
            .where(EventFieldTable.key == key)
        ).first()

        if not f:
            continue

        raw = None
        if val is not None:
            if isinstance(val, (list, dict)):
                raw = json.dumps(val)
            else:
                raw = str(val)

            if f.masked:
                raw = encrypt_field(raw)

        f.raw_value = raw
        f.source = "user_text" if raw else "missing"
        f.confidence = 1.0 if raw else 0.0
        f.user_confirmed = bool(raw)
        session.add(f)

        # Track title/date/venue changes on EventTable
        if key == "event_title" and val:
            event.title = str(val)
        elif key == "start_date":
            event.start_date = str(val) if val else None
        elif key == "end_date":
            event.end_date = str(val) if val else None
        elif key == "venue":
            event.venue = str(val) if val else None

        if key not in changed_keys:
            changed_keys.append(key)

    # Check if event has generated documents -> mark out of sync
    docs = session.exec(select(DocumentTable).where(DocumentTable.event_id == event_id)).all()
    if docs and changed_keys:
        event.changed_since_generation = True
        for d in docs:
            d.out_of_sync = True
            session.add(d)

    event.changed_keys_json = json.dumps(changed_keys)
    event.updated_at = now_iso()
    session.add(event)
    session.commit()

    return get_event(event_id, session)


@router.get("/{event_id}/recommendations", response_model=List[DocumentRecommendation])
def get_recommendations(event_id: str, session: Session = Depends(get_session)):
    event = session.exec(select(EventTable).where(EventTable.id == event_id)).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    fields = session.exec(select(EventFieldTable).where(EventFieldTable.event_id == event_id)).all()
    templates = load_templates_from_disk(session)

    # Context for rule evaluation
    val_map = {}
    for f in fields:
        raw = f.raw_value
        if raw is not None and f.masked:
            val_map[f.key] = decrypt_field(raw)
        elif raw is not None and f.field_type == "table":
            try:
                val_map[f.key] = json.loads(raw)
            except Exception:
                val_map[f.key] = []
        else:
            val_map[f.key] = raw

    category = event.category
    text = (event.source_text or "") + " " + (str(val_map.get("description") or ""))
    _, _, _, _, flags = extract_from_text(text)

    context = {
        "venue": val_map.get("venue"),
        "mode": val_map.get("mode") or "Offline",
        "category": category,
        "participants": val_map.get("participants"),
        "hasExpenses": flags.get("hasExpenses", False),
        "hasPrizes": flags.get("hasPrizes", False),
        "budget": 0.0,
    }

    recs: List[DocumentRecommendation] = []
    for t in templates:
        rule_matched = False
        reason = "Template available for this event."
        if t.rules:
            r = t.rules[0]
            rule_matched = eval_rule_safe(r.condition, context)
            reason = r.description if rule_matched else "Not typically required for this event category."
        else:
            rule_matched = True

        missing_keys = [
            p.key for p in t.placeholders
            if p.required and (val_map.get(p.key) is None or str(val_map.get(p.key)).strip() == "")
        ]

        recs.append(
            DocumentRecommendation(
                template_id=t.id,
                template_name=t.name,
                reason=reason,
                recommended=rule_matched,
                missing_keys=missing_keys,
            )
        )
    return recs


@router.post("/{event_id}/generate", response_model=List[GeneratedDocument])
def generate_documents(
    event_id: str,
    payload: dict,
    session: Session = Depends(get_session),
):
    event = session.exec(select(EventTable).where(EventTable.id == event_id)).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    template_ids: list[str] = payload.get("templateIds", [])
    allow_placeholders: bool = payload.get("options", {}).get("allowPlaceholders", False)

    fields = session.exec(select(EventFieldTable).where(EventFieldTable.event_id == event_id)).all()
    templates = load_templates_from_disk(session)
    club = session.exec(select(ClubTable)).first()

    val_map = {}
    for f in fields:
        raw = f.raw_value
        if raw is not None and f.masked:
            val_map[f.key] = decrypt_field(raw)
        elif raw is not None and f.field_type == "table":
            try:
                val_map[f.key] = json.loads(raw)
            except Exception:
                val_map[f.key] = []
        else:
            val_map[f.key] = raw

    generated_docs: List[GeneratedDocument] = []
    now = now_iso()

    for tid in template_ids:
        t = next((tpl for tpl in templates if tpl.id == tid), None)
        if not t:
            continue

        missing_req = [
            p.key for p in t.placeholders
            if p.required and (val_map.get(p.key) is None or str(val_map.get(p.key)).strip() == "")
        ]

        if missing_req and not allow_placeholders:
            raise HTTPException(
                status_code=400,
                detail=f"Template {t.name} is missing required fields: {', '.join(missing_req)}",
            )

        # Check reference format reservation
        if t.ref_category and not val_map.get("ref_no") and club:
            formats = json.loads(club.reference_formats_json)
            fmt = next((f for f in formats if f["category"] == t.ref_category), None)
            if fmt:
                fmt["counter"] += 1
                club.reference_formats_json = json.dumps(formats)
                session.add(club)
                ref = format_reference(
                    fmt["pattern"],
                    fmt["counter"],
                    club.financial_year,
                    club.academic_year,
                    club.short_name,
                    event.category.upper(),
                )
                val_map["ref_no"] = ref
                # Also mirror back to event field
                ef = session.exec(
                    select(EventFieldTable)
                    .where(EventFieldTable.event_id == event_id)
                    .where(EventFieldTable.key == "ref_no")
                ).first()
                if ef:
                    ef.raw_value = ref
                    ef.source = "user_text"
                    ef.user_confirmed = True
                    session.add(ef)

        doc_values = {p.key: val_map.get(p.key) for p in t.placeholders}

        # Check if document already exists
        existing = session.exec(
            select(DocumentTable)
            .where(DocumentTable.event_id == event_id)
            .where(DocumentTable.template_id == t.id)
        ).first()

        if existing:
            v_num = existing.current_version + 1
            existing.current_version = v_num
            existing.values_json = json.dumps(doc_values)
            existing.updated_at = now
            existing.out_of_sync = False
            session.add(existing)

            # Record version
            ver = DocumentVersionTable(
                document_id=existing.id,
                version=v_num,
                created_at=now,
                author="ClubDocs (generated)",
                note="Regenerated from event",
                values_json=json.dumps(doc_values),
            )
            session.add(ver)
            target_id = existing.id
        else:
            doc_id = f"doc-{uuid.uuid4().hex[:6]}"
            new_doc = DocumentTable(
                id=doc_id,
                event_id=event_id,
                event_title=event.title,
                template_id=t.id,
                template_name=t.name,
                title=f"{t.short_name} — {event.title}",
                status="needs_info" if bool(missing_req) else "ready",
                current_version=1,
                values_json=json.dumps(doc_values),
                created_at=now,
                updated_at=now,
                out_of_sync=False,
                has_placeholders=bool(missing_req),
            )
            session.add(new_doc)

            ver = DocumentVersionTable(
                document_id=doc_id,
                version=1,
                created_at=now,
                author="ClubDocs (generated)",
                note="Generated from event",
                values_json=json.dumps(doc_values),
            )
            session.add(ver)

            # Increment template usage
            t_meta = session.exec(select(TemplateMetaTable).where(TemplateMetaTable.id == t.id)).first()
            if t_meta:
                t_meta.usage_count += 1
                session.add(t_meta)

            target_id = doc_id

        # Fetch generated document for response
        d_rec = session.exec(select(DocumentTable).where(DocumentTable.id == target_id)).first()
        v_recs = session.exec(
            select(DocumentVersionTable)
            .where(DocumentVersionTable.document_id == target_id)
            .order_by(DocumentVersionTable.version.asc())
        ).all()

        versions_schema = [
            {
                "version": vr.version,
                "createdAt": vr.created_at,
                "author": vr.author,
                "note": vr.note,
                "values": json.loads(vr.values_json),
            }
            for vr in v_recs
        ]

        generated_docs.append(
            GeneratedDocument(
                id=d_rec.id,
                event_id=d_rec.event_id,
                event_title=d_rec.event_title,
                template_id=d_rec.template_id,
                template_name=d_rec.template_name,
                title=d_rec.title,
                status=d_rec.status,
                current_version=d_rec.current_version,
                values=json.loads(d_rec.values_json),
                versions=versions_schema,
                created_at=d_rec.created_at,
                updated_at=d_rec.updated_at,
                out_of_sync=d_rec.out_of_sync,
                has_placeholders=d_rec.has_placeholders,
            )
        )

    event.last_generated_at = now
    event.changed_since_generation = False
    event.changed_keys_json = "[]"
    event.updated_at = now
    session.add(event)
    session.commit()

    return generated_docs


@router.post("/{event_id}/regenerate", response_model=List[GeneratedDocument])
def regenerate_from_event(event_id: str, session: Session = Depends(get_session)):
    event = session.exec(select(EventTable).where(EventTable.id == event_id)).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    docs = session.exec(select(DocumentTable).where(DocumentTable.event_id == event_id)).all()
    t_ids = [d.template_id for d in docs]
    return generate_documents(event_id, {"templateIds": t_ids, "options": {"allowPlaceholders": True}}, session)
