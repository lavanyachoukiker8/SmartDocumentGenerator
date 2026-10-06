from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.config import settings
from app.db import get_session, seed_initial_data
from app.models import (
    ClubTable,
    CounterTable,
    DocumentTable,
    DocumentVersionTable,
    EventFieldTable,
    EventTable,
    TemplateMetaTable,
)
from app.schemas import DashboardStats
from app.services.template_loader import load_templates_from_disk

router = APIRouter(prefix="", tags=["Analytics & Admin"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(session: Session = Depends(get_session)):
    docs = session.exec(select(DocumentTable)).all()
    events = session.exec(select(EventTable)).all()
    templates = load_templates_from_disk(session)

    total_docs = len(docs)
    total_events = len(events)
    approved_docs = sum(1 for d in docs if d.status == "approved")
    events_needing_info = sum(1 for e in events if e.status == "needs_info")

    by_template = []
    for t in templates:
        cnt = sum(1 for d in docs if d.template_id == t.id)
        by_template.append({
            "templateId": t.id,
            "templateName": t.name,
            "count": cnt,
        })

    # Heuristic: 45 min saved per document
    hours_saved = round((total_docs * 45) / 60.0, 1)

    return DashboardStats(
        total_documents=total_docs,
        documents_this_month=total_docs,
        total_events=total_events,
        events_needing_info=events_needing_info,
        approved_documents=approved_docs,
        by_template=by_template,
        hours_saved=hours_saved,
    )


@router.post("/reset")
def reset_db(session: Session = Depends(get_session)):
    if not settings.ENABLE_DEV_RESET:
        raise HTTPException(
            status_code=403,
            detail="Reset endpoint is disabled in this environment. Set ENABLE_DEV_RESET=true to enable.",
        )
    # Clear tables
    for model in [DocumentVersionTable, DocumentTable, EventFieldTable, EventTable, CounterTable, ClubTable]:
        session.exec(select(model))
        for row in session.exec(select(model)).all():
            session.delete(row)
    session.commit()

    # Re-seed
    seed_initial_data(session)
    return {"ok": True, "status": "ok", "message": "Database reset to initial demo state"}

