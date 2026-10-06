import json
from sqlmodel import Session, SQLModel, create_engine, select
from app.config import settings
from app.models import (
    AuditLogTable,
    ClubTable,
    CounterTable,
    DocumentTable,
    DocumentVersionTable,
    EventFieldTable,
    EventTable,
    TemplateMetaTable,
    UserTable,
)

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def get_session():
    with Session(engine) as session:
        yield session


def seed_initial_data(session: Session):
    # Check if Club already exists
    club = session.exec(select(ClubTable)).first()
    if not club:
        initial_club = ClubTable(
            id="club-acm",
            short_name="ACM",
            name="Association for Computing Machinery",
            institute="Sardar Vallabhbhai National Institute of Technology, Surat",
            department="Department of Computer Science & Engineering",
            branding_json=json.dumps({
                "logoLeft": "/logos/svnit.svg",
                "logoRight": "/logos/acm.svg",
                "primaryColor": "#4F81BD",
                "darkColor": "#1F3A5F",
                "headingFont": "Cinzel, Times New Roman, serif",
                "bodyFont": "Inter, Arial, sans-serif",
                "letterheadTitle": "ASSOCIATION FOR COMPUTING MACHINERY",
                "letterheadSubtitle": "SVNIT Student Chapter · Department of Computer Science & Engineering",
            }),
            default_submitted_to="The Head of Department, Department of Computer Science & Engineering, SVNIT Surat",
            academic_year="2026-27",
            financial_year="26-27",
            signatories_json=json.dumps([
                {
                    "id": "sig-1",
                    "name": "Ansh Gupta",
                    "shortName": "Ansh Gupta",
                    "designation": "Chairperson, ACM SVNIT",
                    "role": "Chairperson",
                },
                {
                    "id": "sig-2",
                    "name": "Arshad Khatib",
                    "shortName": "Arshad Khatib",
                    "designation": "Secretary, ACM SVNIT",
                    "role": "Student Secretary",
                },
                {
                    "id": "sig-3",
                    "name": "Dr. Sankita J. Patel",
                    "shortName": "Dr. Sankita Patel",
                    "designation": "Associate Professor & Faculty Chairman, ACM SVNIT",
                    "role": "Faculty Chairman",
                },
            ]),
            reference_formats_json=json.dumps([
                {"category": "ROOM", "pattern": "ACM/{FY}/ROOM/{seq}", "counter": 9},
                {"category": "BILL", "pattern": "ACM/{FY}/BILL/{seq}", "counter": 3},
                {"category": "GEN", "pattern": "ACM/{FY}/GEN/{seq}", "counter": 5},
            ]),
            retain_sensitive_data=False,
        )
        session.add(initial_club)

        # Initialize counters
        for cat, cnt in [("ROOM", 9), ("BILL", 3), ("GEN", 5)]:
            session.add(CounterTable(category=cat, year="26-27", last_seq=cnt))

    session.commit()

    from app.auth import seed_default_users
    seed_default_users(session)



def init_db():
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(counter)")).fetchall()
            col_names = [r[1] for r in res]
            if col_names and "year" not in col_names:
                conn.execute(text("DROP TABLE counter"))
                conn.commit()
        except Exception:
            pass
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_initial_data(session)



def reset_database():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_initial_data(session)

