import os
import shutil
import subprocess
import sys
from pathlib import Path
from app.config import settings


def convert_docx_to_pdf(docx_path: Path, output_dir: Path) -> Path:
    """
    Converts a .docx file to .pdf using LibreOffice in headless mode,
    with automatic native Word COM fallback on Windows if LibreOffice is not yet present.
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

    if soffice_cmd:
        cmd = [
            soffice_cmd,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(docx_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if result.returncode == 0 and target_pdf.exists():
            return target_pdf

    # Windows fallback using native Microsoft Word COM automation
    if sys.platform == "win32":
        abs_docx = str(docx_path.resolve())
        abs_pdf = str(target_pdf.resolve())
        ps_script = (
            f"$word = New-Object -ComObject Word.Application; "
            f"$word.Visible = $false; "
            f"$doc = $word.Documents.Open('{abs_docx}'); "
            f"$doc.SaveAs([ref]'{abs_pdf}', [ref]17); "
            f"$doc.Close(); "
            f"$word.Quit()"
        )
        try:
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if target_pdf.exists():
                return target_pdf
        except Exception:
            pass

    if not soffice_cmd and not target_pdf.exists():
        raise RuntimeError(
            "LibreOffice ('soffice') executable not found. Please install LibreOffice or run via Docker for exact PDF conversion."
        )

    if not target_pdf.exists():
        raise FileNotFoundError(f"Converted PDF not found at {target_pdf}")

    return target_pdf
