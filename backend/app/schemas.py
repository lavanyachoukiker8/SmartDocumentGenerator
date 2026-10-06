from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


# Role & Primitive Types
UserRole = Literal["admin", "member", "faculty"]
Status = Literal["draft", "needs_info", "ready", "approved"]
FieldSource = Literal["user_text", "club_profile", "ai_draft", "missing"]
FieldType = Literal["text", "longtext", "date", "time", "number", "select", "table"]
EventCategory = Literal["workshop", "seminar", "talk", "competition", "hackathon", "meeting", "other"]
EventMode = Literal["offline", "online", "hybrid"]

ExportFormat = Literal["docx", "pdf"]

TableRow = Dict[str, Any]
FieldValue = Union[str, List[TableRow], None]
FieldValues = Dict[str, FieldValue]


class DocumentFilters(CamelModel):
    event_id: Optional[str] = None
    template_id: Optional[str] = None
    status: Optional[Status] = None


class Signatory(CamelModel):
    id: str
    name: str
    short_name: str
    designation: str
    role: str


class ReferenceFormat(CamelModel):
    category: str
    pattern: str
    counter: int


class ClubBranding(CamelModel):
    logo_left: str
    logo_right: str
    primary_color: str
    dark_color: str
    heading_font: str
    body_font: str
    letterhead_title: str
    letterhead_subtitle: str


class Club(CamelModel):
    id: str
    short_name: str
    name: str
    institute: str
    department: str
    branding: ClubBranding
    default_submitted_to: str
    signatories: List[Signatory]
    reference_formats: List[ReferenceFormat]
    academic_year: str
    financial_year: str
    retain_sensitive_data: Optional[bool] = False


class TableColumn(CamelModel):
    key: str
    label: str
    type: Literal["text", "number"]
    never_ai: Optional[bool] = False
    masked: Optional[bool] = False
    sensitive: Optional[bool] = False
    width: Optional[float] = None


class Placeholder(CamelModel):
    key: str
    label: str
    type: FieldType
    required: bool
    question: Optional[str] = None
    never_ai: bool = False
    masked: bool = False
    sensitive: Optional[bool] = False
    ai_draftable: bool = False
    section: str = "General"
    shared: Optional[bool] = False
    options: Optional[List[str]] = None
    columns: Optional[List[TableColumn]] = None
    help_text: Optional[str] = None
    suggest: Optional[str] = None


class RecommendationRule(CamelModel):
    id: str
    description: str
    condition: str


class Template(CamelModel):
    id: str
    name: str
    short_name: str
    description: str
    authority: str
    ref_category: str
    file_name: str
    version: int
    updated_at: str
    placeholders: List[Placeholder]
    rules: List[RecommendationRule]
    usage_count: int = 0


class TemplateAnalysis(CamelModel):
    file_name: str
    yaml_file_name: Optional[str] = None
    detected: List[Placeholder]
    suggested_rules: List[RecommendationRule]
    warnings: List[str]


class NewTemplateInput(CamelModel):
    name: str
    description: str
    authority: str
    ref_category: str
    file_name: str
    placeholders: List[Placeholder]
    rules: List[RecommendationRule]


class ExtractedField(CamelModel):
    key: str
    label: str
    type: FieldType
    value: FieldValue = None
    source: FieldSource = "missing"
    confidence: float = 0.0
    required: bool = False
    never_ai: bool = False
    masked: bool = False
    sensitive: Optional[bool] = False
    ai_draftable: bool = False
    question: str = ""
    section: str = "General"
    shared: Optional[bool] = False
    options: Optional[List[str]] = None
    columns: Optional[List[TableColumn]] = None
    help_text: Optional[str] = None
    user_confirmed: Optional[bool] = None
    suggestion: Optional[str] = None


class DocumentRecommendation(CamelModel):
    template_id: str
    template_name: str
    reason: str
    recommended: bool
    missing_keys: List[str]


class ClubEvent(CamelModel):
    id: str
    title: str
    category: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    venue: Optional[str] = None
    status: Status = "draft"
    created_at: str
    updated_at: str
    source_text: Optional[str] = None
    fields: List[ExtractedField]
    document_ids: List[str]
    last_generated_at: Optional[str] = None
    changed_since_generation: bool = False
    changed_keys: List[str] = []


class EventSummary(CamelModel):
    id: str
    title: str
    category: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    venue: Optional[str] = None
    status: Status
    document_count: int
    missing_count: int
    updated_at: str


class EventFormInput(CamelModel):
    title: str
    category: str
    start_date: str
    end_date: Optional[str] = ""
    start_time: Optional[str] = ""
    end_time: Optional[str] = ""
    venue: Optional[str] = ""
    mode: Optional[str] = "offline"
    participants: Optional[str] = ""
    description: Optional[str] = ""
    objective: Optional[str] = ""
    organizers: Optional[str] = ""


class GenerateOptions(CamelModel):
    allow_placeholders: bool = False


class DocumentVersion(CamelModel):
    version: int
    created_at: str
    author: str
    note: str
    values: FieldValues


class GeneratedDocument(CamelModel):
    id: str
    event_id: str
    event_title: str
    template_id: str
    template_name: str
    title: str
    status: Status
    current_version: int
    values: FieldValues
    versions: List[DocumentVersion]
    created_at: str
    updated_at: str
    out_of_sync: bool
    has_placeholders: bool


class DocumentSummary(CamelModel):
    id: str
    event_id: str
    event_title: str
    template_id: str
    template_name: str
    status: Status
    current_version: int
    created_at: str
    updated_at: str
    out_of_sync: bool
    missing_count: int


class SaveDocumentResult(CamelModel):
    document: GeneratedDocument
    propagated_to: List[str]
    updated_fields: List[str]


class ReferencePeekResult(CamelModel):
    ref: str


class DashboardStats(CamelModel):
    total_documents: int
    documents_this_month: int
    total_events: int
    events_needing_info: int
    approved_documents: int
    by_template: List[Dict[str, Any]]
    hours_saved: float
