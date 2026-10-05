from pathlib import Path
from typing import Any, Dict
from docxtpl import DocxTemplate
from app.config import settings


def render_docx_template(template_id: str, values: Dict[str, Any], output_path: Path) -> Path:
    """
    Renders values into docxtpl DocxTemplate.
    Unfilled / empty values are filled with '[TO BE FILLED]'.
    """
    # Find template.docx in templates/<template_id> or templates/<template_id_with_underscore>
    t_dir = settings.TEMPLATES_DIR / template_id
    if not t_dir.exists():
        t_dir = settings.TEMPLATES_DIR / template_id.replace("-", "_")

    template_file = t_dir / "template.docx"
    if not template_file.exists():
        raise FileNotFoundError(f"Template docx file not found for {template_id}")

    doc = DocxTemplate(str(template_file))

    # Preprocess context: default None/empty to [TO BE FILLED] where appropriate
    context: Dict[str, Any] = {}
    for k, v in values.items():
        if v is None or (isinstance(v, str) and not v.strip()):
            context[k] = "[TO BE FILLED]"
        else:
            context[k] = v

    doc.render(context)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))
    return output_path
