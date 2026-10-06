import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.db import get_session
from app.models import ClubTable, CounterTable
from app.schemas import Club, ReferenceFormat, ReferencePeekResult
from app.utils import format_reference

router = APIRouter(prefix="/club", tags=["Club"])


def db_to_club_schema(c: ClubTable) -> Club:
    return Club(
        id=c.id,
        short_name=c.short_name,
        name=c.name,
        institute=c.institute,
        department=c.department,
        branding=json.loads(c.branding_json),
        default_submitted_to=c.default_submitted_to,
        signatories=json.loads(c.signatories_json),
        reference_formats=json.loads(c.reference_formats_json),
        academic_year=c.academic_year,
        financial_year=c.financial_year,
        retain_sensitive_data=c.retain_sensitive_data,
    )


@router.get("", response_model=Club)
def get_club(session: Session = Depends(get_session)):
    club = session.exec(select(ClubTable)).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club profile not found")
    return db_to_club_schema(club)


@router.put("", response_model=Club)
def update_club(payload: Club, session: Session = Depends(get_session)):
    club = session.exec(select(ClubTable)).first()
    if not club:
        club = ClubTable(id=payload.id)

    club.short_name = payload.short_name
    club.name = payload.name
    club.institute = payload.institute
    club.department = payload.department
    club.branding_json = json.dumps(payload.branding.model_dump(by_alias=True))
    club.default_submitted_to = payload.default_submitted_to
    club.signatories_json = json.dumps([s.model_dump(by_alias=True) for s in payload.signatories])
    club.reference_formats_json = json.dumps([rf.model_dump(by_alias=True) for rf in payload.reference_formats])
    club.academic_year = payload.academic_year
    club.financial_year = payload.financial_year
    club.retain_sensitive_data = payload.retain_sensitive_data or False

    session.add(club)
    session.commit()
    session.refresh(club)
    return db_to_club_schema(club)


@router.get("/reference/{category}/peek", response_model=ReferencePeekResult)
def peek_reference(
    category: str,
    eventCode: str = Query("GEN"),
    session: Session = Depends(get_session),
):
    club = session.exec(select(ClubTable)).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club profile not found")

    formats: list[dict] = json.loads(club.reference_formats_json)
    fmt = next((f for f in formats if f["category"] == category), None)
    if not fmt:
        raise HTTPException(status_code=404, detail=f"Reference format for {category} not found")

    year = club.financial_year or "26-27"
    counter_row = session.exec(
        select(CounterTable)
        .where(CounterTable.category == category)
        .where(CounterTable.year == year)
    ).first()
    last_seq = counter_row.last_seq if counter_row else fmt.get("counter", 0)
    next_seq = last_seq + 1

    ref = format_reference(
        fmt["pattern"],
        next_seq,
        club.financial_year,
        club.academic_year,
        club.short_name,
        eventCode,
    )
    return ReferencePeekResult(ref=ref)


@router.post("/reference/{category}/next", response_model=str)
def reserve_reference(
    category: str,
    eventCode: str = Query("GEN"),
    session: Session = Depends(get_session),
):
    club = session.exec(select(ClubTable)).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club profile not found")

    formats: list[dict] = json.loads(club.reference_formats_json)
    fmt = next((f for f in formats if f["category"] == category), None)
    if not fmt:
        raise HTTPException(status_code=404, detail=f"Reference format for {category} not found")

    year = club.financial_year or "26-27"
    from app.services.reference import reserve_reference_sequence
    seq = reserve_reference_sequence(category, year, session)

    ref = format_reference(
        fmt["pattern"],
        seq,
        club.financial_year,
        club.academic_year,
        club.short_name,
        eventCode,
    )
    return ref

