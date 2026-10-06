import json
from pathlib import Path
from typing import List, Optional
import yaml
from sqlmodel import Session, select
from app.config import settings
from app.models import TemplateMetaTable
from app.schemas import Placeholder, RecommendationRule, Template


def load_templates_from_disk(session: Session) -> List[Template]:
    """
    Scans `templates/` subdirectories.
    Rule R2: Templates are data (a .docx + schema.yaml + rules.yaml in a folder), never code.
    Syncs with DB TemplateMetaTable so counts and versions are preserved.
    """
    templates_dir = settings.TEMPLATES_DIR
    templates_out: List[Template] = []

    if not templates_dir.exists():
        return []

    for item in sorted(templates_dir.iterdir()):
        if not item.is_dir():
            continue

        meta_path = item / "meta.yaml"
        schema_path = item / "schema.yaml"
        rules_path = item / "rules.yaml"
        docx_path = item / "template.docx"

        if not docx_path.exists():
            continue

        tpl_error: Optional[str] = None
        tpl_warnings: List[str] = []

        meta = {}
        if meta_path.exists():
            try:
                meta = yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}
            except Exception as e:
                tpl_warnings.append(f"Invalid YAML in meta.yaml: {str(e)}")

        schema = {}
        if not schema_path.exists():
            tpl_error = f"Missing schema.yaml in '{item.name}'"
        else:
            try:
                schema = yaml.safe_load(schema_path.read_text(encoding="utf-8")) or {}
                if not isinstance(schema, dict) or "placeholders" not in schema:
                    tpl_error = f"Invalid schema structure in '{item.name}/schema.yaml'"
            except Exception as e:
                tpl_error = f"Invalid YAML in '{item.name}/schema.yaml': {str(e)}"

        rules_data = {}
        if rules_path.exists():
            try:
                rules_data = yaml.safe_load(rules_path.read_text(encoding="utf-8")) or {}
            except Exception as e:
                tpl_warnings.append(f"Invalid YAML in rules.yaml: {str(e)}")

        # Validate rule expressions and collect warnings
        from app.services.rules import validate_rule_condition
        for r_dict in rules_data.get("rules", []):
            cond = r_dict.get("condition", "")
            if cond:
                err = validate_rule_condition(cond)
                if err:
                    tpl_warnings.append(f"Rule '{r_dict.get('id', 'rule')}' has invalid expression: {err}")

        t_id = meta.get("id", item.name.replace("_", "-"))
        name = meta.get("name", item.name.replace("_", " ").title())
        short_name = meta.get("short_name", name)
        description = meta.get("description", "Club institutional document template")
        authority = meta.get("authority", "HoD / Dean")
        ref_category = meta.get("ref_category", "GEN")
        file_name = meta.get("file_name", f"{item.name}.docx")
        version = meta.get("version", 1)

        placeholders_raw = schema.get("placeholders", []) if isinstance(schema, dict) else []
        placeholders = []
        for p in placeholders_raw:
            if not p.get("question"):
                p["question"] = f"What is the {p.get('label', p.get('key', 'field'))}?"
            placeholders.append(Placeholder(**p))

        rules_raw = rules_data.get("rules", []) if isinstance(rules_data, dict) else []
        rules = [RecommendationRule(**r) for r in rules_raw]

        # Check DB for usage count and updates
        db_meta = session.exec(select(TemplateMetaTable).where(TemplateMetaTable.id == t_id)).first()
        usage_count = db_meta.usage_count if db_meta else 0

        if not db_meta:
            db_meta = TemplateMetaTable(
                id=t_id,
                name=name,
                short_name=short_name,
                description=description,
                authority=authority,
                ref_category=ref_category,
                file_name=file_name,
                version=version,
                updated_at="2026-10-06T00:00:00Z",
                placeholders_json=json.dumps([p.model_dump(by_alias=True) for p in placeholders]),
                rules_json=json.dumps([r.model_dump(by_alias=True) for r in rules]),
                usage_count=usage_count,
            )
            session.add(db_meta)
            session.commit()

        templates_out.append(
            Template(
                id=t_id,
                name=name,
                short_name=short_name,
                description=description,
                authority=authority,
                ref_category=ref_category,
                file_name=file_name,
                version=version,
                updated_at=db_meta.updated_at,
                placeholders=placeholders,
                rules=rules,
                usage_count=db_meta.usage_count,
                warnings=tpl_warnings,
                error=tpl_error,
            )
        )

    return templates_out



def get_template_by_id(t_id: str, session: Session) -> Optional[Template]:
    all_tpls = load_templates_from_disk(session)
    return next((t for t in all_tpls if t.id == t_id), None)
