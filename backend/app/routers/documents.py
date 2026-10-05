import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from app.config import settings
from app.crypto import decrypt_field, encrypt_field
from app.db import get_session
from app.models import (
    DocumentTable,
    DocumentVersionTable,
    EventFieldTable,
    EventTable,
)
from app.schemas import (
    DocumentSummary,
    DocumentVersion,
    ExportFormat,
    GeneratedDocument,
    SaveDocumentResult,
    Status,
)
from app.services.export import convert_docx_to_pdf
from app.services.fill import render_docx_template
from app.services.template_loader import get_template_by_id, load_templates_from_disk
from app.utils import now_iso

router = APIRouter(prefix="/documents", tags=["Documents"])


def db_to_doc_schema(d: DocumentTable, session: Session) -> GeneratedDocument:
    v_recs = session.exec(
        select(DocumentVersionTable)
        .where(DocumentVersionTable.document_id == d.id)
        .order_by(DocumentVersionTable.version.asc())
    ).all()

    versions = [
        DocumentVersion(
            version=vr.version,
            created_at=vr.created_at,
            author=vr.author,
            note=vr.note,
            values=json.loads(vr.values_json),
        )
        for vr in v_recs
    ]

    return GeneratedDocument(
        id=d.id,
        event_id=d.event_id,
        event_title=d.event_title,
        template_id=d.template_id,
        template_name=d.template_name,
        title=d.title,
        status=d.status,
        current_version=d.current_version,
        values=json.loads(d.values_json),
        versions=versions,
        created_at=d.created_at,
        updated_at=d.updated_at,
        out_of_sync=d.out_of_sync,
        has_placeholders=d.has_placeholders,
    )


@router.get("", response_model=List[DocumentSummary])
def list_documents(
    eventId: Optional[str] = Query(None),
    templateId: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    query = select(DocumentTable)
    if eventId:
        query = query.where(DocumentTable.event_id == eventId)
    if templateId:
        query = query.where(DocumentTable.template_id == templateId)
    if status:
        query = query.where(DocumentTable.status == status)

    docs = session.exec(query.order_by(DocumentTable.updated_at.desc())).all()
    templates = load_templates_from_disk(session)
    tpl_map = {t.id: t for t in templates}

    summaries: List[DocumentSummary] = []
    for d in docs:
        t = tpl_map.get(d.template_id)
        vals = json.loads(d.values_json) if d.values_json else {}
        missing_count = 0
        if t:
            missing_count = sum(
                1 for p in t.placeholders
                if p.required and (vals.get(p.key) is None or str(vals.get(p.key)).strip() == "")
            )
        summaries.append(
            DocumentSummary(
                id=d.id,
                event_id=d.event_id,
                event_title=d.event_title,
                template_id=d.template_id,
                template_name=d.template_name,
                status=d.status,
                current_version=d.current_version,
                created_at=d.created_at,
                updated_at=d.updated_at,
                out_of_sync=d.out_of_sync,
                missing_count=missing_count,
            )
        )
    return summaries


@router.get("/{document_id}", response_model=GeneratedDocument)
def get_document(document_id: str, session: Session = Depends(get_session)):
    doc = session.exec(select(DocumentTable).where(DocumentTable.id == document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return db_to_doc_schema(doc, session)


@router.put("/{document_id}", response_model=SaveDocumentResult)
def save_document(
    document_id: str,
    payload: dict,
    session: Session = Depends(get_session),
):
    doc = session.exec(select(DocumentTable).where(DocumentTable.id == document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    new_values: Dict[str, Any] = payload.get("values", {})
    note: str = payload.get("note", "Updated field values")
    now = now_iso()

    t = get_template_by_id(doc.template_id, session)
    old_values = json.loads(doc.values_json) if doc.values_json else {}

    # Identify changed shared fields
    shared_keys = []
    updated_field_labels = []
    if t:
        for p in t.placeholders:
            if p.shared:
                if str(new_values.get(p.key)) != str(old_values.get(p.key)):
                    shared_keys.append(p.key)
                    updated_field_labels.append(p.label)

    # Increment version
    v_num = doc.current_version + 1
    doc.current_version = v_num
    doc.values_json = json.dumps(new_values)
    doc.updated_at = now
    session.add(doc)

    # Save version record
    ver = DocumentVersionTable(
        document_id=doc.id,
        version=v_num,
        created_at=now,
        author="User",
        note=note,
        values_json=json.dumps(new_values),
    )
    session.add(ver)

    # Mirror edits to EventFieldTable (Single source of truth - Rule R3)
    event = session.exec(select(EventTable).where(EventTable.id == doc.event_id)).first()
    if event and t:
        for p in t.placeholders:
            if p.key in new_values:
                ef = session.exec(
                    select(EventFieldTable)
                    .where(EventFieldTable.event_id == doc.event_id)
                    .where(EventFieldTable.key == p.key)
                ).first()
                if ef:
                    raw_val = str(new_values[p.key]) if new_values[p.key] is not None else None
                    if raw_val and ef.masked:
                        raw_val = encrypt_field(raw_val)
                    ef.raw_value = raw_val
                    ef.source = "user_text"
                    ef.user_confirmed = True
                    session.add(ef)

        # Update event title if modified
        if "event_title" in new_values and new_values["event_title"]:
            event.title = str(new_values["event_title"])
            doc.event_title = event.title
            session.add(event)

    # Propagate shared fields to other documents of the event
    propagated_to: list[str] = []
    if shared_keys and event:
        other_docs = session.exec(
            select(DocumentTable)
            .where(DocumentTable.event_id == doc.event_id)
            .where(DocumentTable.id != doc.id)
        ).all()

        for od in other_docs:
            ot = get_template_by_id(od.template_id, session)
            if not ot:
                continue

            matching_keys = [k for k in shared_keys if any(p.key == k for p in ot.placeholders)]
            if not matching_keys:
                continue

            od_vals = json.loads(od.values_json) if od.values_json else {}
            for k in matching_keys:
                od_vals[k] = new_values[k]

            od_v_num = od.current_version + 1
            od.current_version = od_v_num
            od.values_json = json.dumps(od_vals)
            od.updated_at = now
            od.event_title = event.title
            session.add(od)

            od_ver = DocumentVersionTable(
                document_id=od.id,
                version=od_v_num,
                created_at=now,
                author="ClubDocs (synced)",
                note=f"Synced shared fields: {', '.join(matching_keys)}",
                values_json=json.dumps(od_vals),
            )
            session.add(od_ver)
            propagated_to.append(od.id)

    session.commit()
    session.refresh(doc)

    return SaveDocumentResult(
        document=db_to_doc_schema(doc, session),
        propagated_to=propagated_to,
        updated_fields=updated_field_labels,
    )


@router.patch("/{document_id}/status", response_model=GeneratedDocument)
def set_document_status(
    document_id: str,
    payload: dict,
    session: Session = Depends(get_session),
):
    doc = session.exec(select(DocumentTable).where(DocumentTable.id == document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    status = payload.get("status")
    if status not in ["draft", "needs_info", "ready", "approved"]:
        raise HTTPException(status_code=400, detail="Invalid document status")

    doc.status = status
    doc.updated_at = now_iso()
    session.add(doc)

    # If all documents are approved, mark event approved
    all_docs = session.exec(select(DocumentTable).where(DocumentTable.event_id == doc.event_id)).all()
    if all(d.status == "approved" for d in all_docs):
        event = session.exec(select(EventTable).where(EventTable.id == doc.event_id)).first()
        if event:
            event.status = "approved"
            session.add(event)

    session.commit()
    return db_to_doc_schema(doc, session)


@router.post("/{document_id}/restore", response_model=GeneratedDocument)
def restore_version(
    document_id: str,
    payload: dict,
    session: Session = Depends(get_session),
):
    doc = session.exec(select(DocumentTable).where(DocumentTable.id == document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    version_to_restore = payload.get("version")
    ver_rec = session.exec(
        select(DocumentVersionTable)
        .where(DocumentVersionTable.document_id == document_id)
        .where(DocumentVersionTable.version == version_to_restore)
    ).first()

    if not ver_rec:
        raise HTTPException(status_code=404, detail=f"Version v{version_to_restore} not found")

    now = now_iso()
    new_v = doc.current_version + 1
    doc.current_version = new_v
    doc.values_json = ver_rec.values_json
    doc.updated_at = now
    session.add(doc)

    new_ver = DocumentVersionTable(
        document_id=doc.id,
        version=new_v,
        created_at=now,
        author="User",
        note=f"Restored from v{version_to_restore}",
        values_json=ver_rec.values_json,
    )
    session.add(new_ver)
    session.commit()

    return db_to_doc_schema(doc, session)


@router.get("/{document_id}/export")
def export_document(
    document_id: str,
    format: str = Query("docx"),
    session: Session = Depends(get_session),
):
    doc = session.exec(select(DocumentTable).where(DocumentTable.id == document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    values: Dict[str, Any] = json.loads(doc.values_json) if doc.values_json else {}

    safe_title = re.sub(r"[^\w\d-]+", "_", doc.title).strip("_")
    out_docx = settings.OUTPUTS_DIR / f"{safe_title}_v{doc.current_version}.docx"

    try:
        render_docx_template(doc.template_id, values, out_docx)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate document DOCX: {str(e)}")

    if format == "pdf":
        try:
            pdf_path = convert_docx_to_pdf(out_docx, settings.OUTPUTS_DIR)
            filename = f"{safe_title}_v{doc.current_version}.pdf"
            headers = {
                "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
            }
            return FileResponse(
                path=str(pdf_path),
                filename=filename,
                media_type="application/pdf",
                headers=headers,
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"PDF export failed: {str(e)}. (Ensure LibreOffice is installed or use DOCX format).",
            )

    filename = f"{safe_title}_v{doc.current_version}.docx"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'
    }
    return FileResponse(
        path=str(out_docx),
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )
