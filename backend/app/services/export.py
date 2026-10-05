import shutil
import subprocess
from pathlib import Path
from app.config import settings


def convert_docx_to_pdf(docx_path: Path, output_dir: Path) -> Path:
    """
    Converts a .docx file to .pdf using LibreOffice in headless mode.
    Command: soffice --headless --convert-to pdf --outdir <output_dir> <docx_path>
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_filename = docx_path.stem + ".pdf"
    target_pdf = output_dir / pdf_filename

    soffice_cmd = shutil.which(settings.LIBREOFFICE_PATH) or shutil.which("soffice")

    # On Windows, check common LibreOffice install paths
    if not soffice_cmd:
        common_paths = [
            Path("C:/Program Files/LibreOffice/program/soffice.exe"),
            Path("C:/Program Files (x86)/LibreOffice/program/soffice.exe"),
        ]
        for p in common_paths:
            if p.exists():
                soffice_cmd = str(p)
                break

    if not soffice_cmd:
        raise RuntimeError(
            "LibreOffice ('soffice') executable not found. Please install LibreOffice to enable exact headless PDF conversion."
        )

    cmd = [
        soffice_cmd,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(output_dir),
        str(docx_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr or result.stdout}")

    if not target_pdf.exists():
        raise FileNotFoundError(f"Converted PDF not found at {target_pdf}")

    return target_pdf
