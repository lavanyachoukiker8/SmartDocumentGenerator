from typing import Optional
from sqlmodel import Field, SQLModel


class ClubTable(SQLModel, table=True):
    __tablename__ = "club"
    id: str = Field(default="club-acm", primary_key=True)
    short_name: str = "ACM"
    name: str = "Association for Computing Machinery"
    institute: str = "Sardar Vallabhbhai National Institute of Technology, Surat"
    department: str = "Department of Computer Science & Engineering"
    branding_json: str
    default_submitted_to: str = "The Head of Department, CSE"
    academic_year: str = "2026-27"
    financial_year: str = "26-27"
    signatories_json: str
    reference_formats_json: str
    retain_sensitive_data: bool = False


class EventTable(SQLModel, table=True):
    __tablename__ = "event"
    id: str = Field(primary_key=True, index=True)
    title: str
    category: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    venue: Optional[str] = None
    status: str = "draft"  # draft, needs_info, ready, approved
    source_text: Optional[str] = None
    last_generated_at: Optional[str] = None
    changed_since_generation: bool = False
    changed_keys_json: str = "[]"
    created_at: str
    updated_at: str


class EventFieldTable(SQLModel, table=True):
    __tablename__ = "event_field"
    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(index=True)
    key: str = Field(index=True)
    label: str
    field_type: str
    raw_value: Optional[str] = None  # May be encrypted if masked=True
    source: str = "missing"  # user_text, club_profile, ai_draft, missing
    confidence: float = 0.0
    required: bool = False
    never_ai: bool = False
    masked: bool = False
    ai_draftable: bool = False
    question: str = ""
    section: str = "General"
    shared: bool = False
    user_confirmed: bool = False
    suggestion: Optional[str] = None
    options_json: Optional[str] = None
    columns_json: Optional[str] = None


class DocumentTable(SQLModel, table=True):
    __tablename__ = "document"
    id: str = Field(primary_key=True, index=True)
    event_id: str = Field(index=True)
    event_title: str
    template_id: str
    template_name: str
    title: str
    status: str = "draft"  # draft, needs_info, ready, approved
    current_version: int = 1
    values_json: str  # Encrypted field values where masked=True
    created_at: str
    updated_at: str
    out_of_sync: bool = False
    has_placeholders: bool = False


class DocumentVersionTable(SQLModel, table=True):
    __tablename__ = "document_version"
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: str = Field(index=True)
    version: int
    created_at: str
    author: str
    note: str
    values_json: str


class TemplateMetaTable(SQLModel, table=True):
    __tablename__ = "template_meta"
    id: str = Field(primary_key=True, index=True)
    name: str
    short_name: str
    description: str
    authority: str
    ref_category: str
    file_name: str
    version: int = 1
    updated_at: str
    placeholders_json: str
    rules_json: str
    usage_count: int = 0


class CounterTable(SQLModel, table=True):
    __tablename__ = "counter"
    category: str = Field(primary_key=True)
    counter: int = 0


class AuditLogTable(SQLModel, table=True):
    __tablename__ = "audit_log"
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: str
    user: str
    action: str
    resource_type: str
    resource_id: str
    detail: str


class UserTable(SQLModel, table=True):
    __tablename__ = "user"
    id: str = Field(primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    role: str = "member"  # admin, member, faculty
    full_name: str = ""

