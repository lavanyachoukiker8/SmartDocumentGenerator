"""
Generates the 3 starter Word (.docx) templates along with schema.yaml, rules.yaml, and meta.yaml
matching the sample PDF files:
  1. Room Permission Letter (EXEC MEET_public.pdf) -> templates/room_permission/
  2. Bill Certificate Form BC-R (Bill Certificate_public.pdf) -> templates/bill_certificate/
  3. Bill Summary (BIll_summary_public.pdf) -> templates/bill_summary/
"""

import os
from pathlib import Path
import yaml
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = ROOT / "templates"


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def set_cell_shading(cell, color_hex="F2F2F2"):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._element.get_or_add_tcPr().append(shd)


def create_room_permission_template(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = Document()

    # Page Margins: 0.75 in
    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Letterhead Header
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_header.add_run("ASSOCIATION FOR COMPUTING MACHINERY\n")
    run_title.font.name = "Times New Roman"
    run_title.font.size = Pt(15)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(0x4F, 0x81, 0xBD)

    run_sub = p_header.add_run("SVNIT Student Chapter\nDepartment of Computer Science & Engineering\nSardar Vallabhbhai National Institute of Technology, Surat - 395007")
    run_sub.font.name = "Times New Roman"
    run_sub.font.size = Pt(9.5)
    run_sub.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

    # Horizontal Divider Line
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_before = Pt(4)
    p_div.paragraph_format.space_after = Pt(10)
    p_div_border = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="1" w:color="4F81BD"/></w:pBdr>')
    p_div._p.get_or_add_pPr().append(p_div_border)

    # Reference No & Date Row
    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_after = Pt(8)
    r_ref = p_meta.add_run("Ref. No.: {{ ref_no or '[TO BE FILLED]' }}")
    r_ref.font.name = "Times New Roman"
    r_ref.font.size = Pt(10.5)
    r_ref.font.bold = True

    # Tab to date
    p_meta.paragraph_format.tab_stops.add_tab_stop(Inches(6.8))
    r_tab = p_meta.add_run("\tDate: {{ letter_date or '[TO BE FILLED]' }}")
    r_tab.font.name = "Times New Roman"
    r_tab.font.size = Pt(10.5)

    # Submitted to
    p_to = doc.add_paragraph()
    p_to.paragraph_format.space_after = Pt(8)
    r_to = p_to.add_run("To,\n{{ submitted_to or 'The Head of Department, CSE Dept.' }}\nSVNIT, Surat.")
    r_to.font.name = "Times New Roman"
    r_to.font.size = Pt(10.5)

    # Subject
    p_subj = doc.add_paragraph()
    p_subj.paragraph_format.space_before = Pt(6)
    p_subj.paragraph_format.space_after = Pt(8)
    r_subj = p_subj.add_run("Subject: {{ subject or 'Requesting Permission to Conduct Event.' }}")
    r_subj.font.name = "Times New Roman"
    r_subj.font.size = Pt(10.5)
    r_subj.font.bold = True

    # Body
    p_body = doc.add_paragraph()
    p_body.paragraph_format.space_after = Pt(6)
    p_body.paragraph_format.line_spacing = 1.15
    r_body = p_body.add_run(
        "Respected Sir/Madam,\n\n"
        "ACM SVNIT Student Chapter is planning to conduct {{ event_title or '[TO BE FILLED]' }} "
        "on {{ start_date or '[TO BE FILLED]' }} in {{ venue or '[TO BE FILLED]' }}. "
        "{{ description or '' }}\n\n"
        "Objective of the event:\n{{ objective or '' }}\n"
    )
    r_body.font.name = "Times New Roman"
    r_body.font.size = Pt(10.5)

    # Schedule Table
    doc.add_paragraph("Event Schedule:").runs[0].font.bold = True
    table_sched = doc.add_table(rows=1, cols=3)
    table_sched.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_sched.autofit = False

    hdr_cells = table_sched.rows[0].cells
    hdr_cells[0].text = "Date"
    hdr_cells[1].text = "Time"
    hdr_cells[2].text = "Session / Activity"
    for c in hdr_cells:
        set_cell_shading(c, "EAECEE")
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9.5)
            r.font.bold = True

    # Jinja loop row for docxtpl
    row_sched = table_sched.add_row().cells
    row_sched[0].text = "{% for s in schedule %}{{ s.date }}"
    row_sched[1].text = "{{ s.time }}"
    row_sched[2].text = "{{ s.session }}{% if not loop.last %}\n{% endif %}{% endfor %}"
    for c in row_sched:
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Contact Details Table
    doc.add_paragraph("Contact Information:").runs[0].font.bold = True
    table_cnt = doc.add_table(rows=1, cols=5)
    table_cnt.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_cnt.autofit = False

    cnt_hdrs = table_cnt.rows[0].cells
    cnt_hdrs[0].text = "Sr No"
    cnt_hdrs[1].text = "Name"
    cnt_hdrs[2].text = "Designation / Role"
    cnt_hdrs[3].text = "Branch / Year"
    cnt_hdrs[4].text = "Mobile Number"
    for c in cnt_hdrs:
        set_cell_shading(c, "EAECEE")
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)
            r.font.bold = True

    row_cnt = table_cnt.add_row().cells
    row_cnt[0].text = "{% for c in contacts %}{{ loop.index }}"
    row_cnt[1].text = "{{ c.name }}"
    row_cnt[2].text = "{{ c.designation }}"
    row_cnt[3].text = "{{ c.branch }}"
    row_cnt[4].text = "{{ c.mobile or '[TO BE FILLED]' }}{% if not loop.last %}\n{% endif %}{% endfor %}"
    for c in row_cnt:
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)

    # Signatures
    p_sig = doc.add_paragraph()
    p_sig.paragraph_format.space_before = Pt(30)
    r_sig = p_sig.add_run(
        "Yours faithfully,\n\n\n\n"
        "Chairperson, ACM SVNIT\t\tFaculty Chairman, ACM SVNIT"
    )
    r_sig.font.name = "Times New Roman"
    r_sig.font.size = Pt(10.5)

    doc.save(str(out_dir / "template.docx"))

    # meta.yaml
    meta = {
        "id": "room-permission",
        "name": "Room Permission Letter",
        "short_name": "Room Permission",
        "description": "Standard letter on official ACM letterhead requesting classroom, lab, or seminar hall booking from HoD.",
        "authority": "HoD (CSE Dept.)",
        "ref_category": "ROOM",
        "file_name": "room_permission.docx",
        "version": 1,
    }
    with open(out_dir / "meta.yaml", "w", encoding="utf-8") as f:
        yaml.dump(meta, f, sort_keys=False)

    # schema.yaml
    schema = {
        "placeholders": [
            {"key": "ref_no", "label": "Reference Number", "type": "text", "required": True, "never_ai": True, "masked": False, "question": "Official reference number for room booking", "section": "Header"},
            {"key": "letter_date", "label": "Letter Date", "type": "date", "required": True, "never_ai": False, "masked": False, "question": "Date of this letter", "section": "Header"},
            {"key": "submitted_to", "label": "Submitted To", "type": "text", "required": True, "never_ai": False, "masked": False, "question": "Authority addressed", "section": "Header"},
            {"key": "event_title", "label": "Event Title", "type": "text", "required": True, "never_ai": False, "masked": False, "shared": True, "question": "What is the event title?", "section": "Event Details"},
            {"key": "start_date", "label": "Start Date", "type": "date", "required": True, "never_ai": False, "masked": False, "shared": True, "question": "When does the event start?", "section": "Event Details"},
            {"key": "end_date", "label": "End Date", "type": "date", "required": False, "never_ai": False, "masked": False, "shared": True, "question": "When does the event end?", "section": "Event Details"},
            {"key": "venue", "label": "Venue / Room", "type": "text", "required": True, "never_ai": False, "masked": False, "shared": True, "question": "Which room or seminar hall is requested?", "section": "Event Details"},
            {"key": "mode", "label": "Event Mode", "type": "text", "required": False, "never_ai": False, "masked": False, "shared": True, "question": "Offline, Online, or Hybrid?", "section": "Event Details"},
            {"key": "participants", "label": "Expected Participants", "type": "text", "required": False, "never_ai": False, "masked": False, "shared": True, "question": "Expected attendance count", "section": "Event Details"},
            {"key": "faculty_coordinator", "label": "Faculty Coordinator", "type": "text", "required": True, "never_ai": False, "masked": False, "shared": True, "question": "Who is the faculty coordinator?", "section": "Event Details"},
            {"key": "subject", "label": "Subject Line", "type": "text", "required": True, "never_ai": False, "masked": False, "question": "Subject of the permission letter", "section": "Letter Content"},
            {"key": "description", "label": "Event Description", "type": "longtext", "required": False, "never_ai": False, "masked": False, "ai_draftable": True, "question": "Brief overview of activities", "section": "Letter Content"},
            {"key": "objective", "label": "Event Objective", "type": "longtext", "required": False, "never_ai": False, "masked": False, "ai_draftable": True, "question": "Learning outcomes or goal", "section": "Letter Content"},
            {
                "key": "schedule",
                "label": "Schedule",
                "type": "table",
                "required": False,
                "never_ai": False,
                "masked": False,
                "question": "Day-by-day session schedule",
                "section": "Schedule",
                "columns": [
                    {"key": "date", "label": "Date", "type": "text"},
                    {"key": "time", "label": "Time", "type": "text"},
                    {"key": "session", "label": "Session", "type": "text"},
                ],
            },
            {
                "key": "contacts",
                "label": "Contact Persons",
                "type": "table",
                "required": False,
                "never_ai": False,
                "masked": False,
                "question": "Student and faculty contact details",
                "section": "Contacts",
                "columns": [
                    {"key": "name", "label": "Name", "type": "text"},
                    {"key": "designation", "label": "Designation", "type": "text"},
                    {"key": "branch", "label": "Branch", "type": "text"},
                    {"key": "mobile", "label": "Mobile", "type": "text", "never_ai": True, "masked": True},
                ],
            },
        ]
    }
    with open(out_dir / "schema.yaml", "w", encoding="utf-8") as f:
        yaml.dump(schema, f, sort_keys=False)

    # rules.yaml
    rules = {
        "rules": [
            {
                "id": "rule-room-needed",
                "description": "Recommended whenever a physical venue (hall, lab) is requested and event is not purely online.",
                "condition": "venue != None and mode != 'Online'",
            }
        ]
    }
    with open(out_dir / "rules.yaml", "w", encoding="utf-8") as f:
        yaml.dump(rules, f, sort_keys=False)


def create_bill_certificate_template(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Form Header
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_inst = p_header.add_run("SARDAR VALLABHBHAI NATIONAL INSTITUTE OF TECHNOLOGY, SURAT\n")
    r_inst.font.name = "Times New Roman"
    r_inst.font.size = Pt(12)
    r_inst.font.bold = True

    r_form = p_header.add_run("FORM BC-R: BILL CERTIFICATE & REIMBURSEMENT PROFORMA\nDean (Student Welfare) Office")
    r_form.font.name = "Times New Roman"
    r_form.font.size = Pt(10.5)
    r_form.font.bold = True

    # Note numbers and approvals
    p_app = doc.add_paragraph()
    p_app.paragraph_format.space_before = Pt(8)
    p_app.paragraph_format.space_after = Pt(6)
    p_app.add_run("Approval Note No.: {{ approval_note_no or '[TO BE FILLED]' }}\t\tApproval Date: {{ approval_date or '[TO BE FILLED]' }}").font.name = "Times New Roman"
    p_app.runs[0].font.size = Pt(9.5)

    p_ev = doc.add_paragraph()
    p_ev.add_run("Event: {{ event_title or '[TO BE FILLED]' }} | Head of Account: {{ head_of_account or '[TO BE FILLED]' }}").font.name = "Times New Roman"
    p_ev.runs[0].font.size = Pt(9.5)
    p_ev.runs[0].font.bold = True

    # Items Table
    doc.add_paragraph("Purchased Items / Services Details:").runs[0].font.bold = True
    tbl_items = doc.add_table(rows=1, cols=5)
    tbl_items.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_items.autofit = False

    hdrs = tbl_items.rows[0].cells
    hdrs[0].text = "Sr No"
    hdrs[1].text = "Item Description"
    hdrs[2].text = "Qty"
    hdrs[3].text = "Unit Cost (₹)"
    hdrs[4].text = "Total (₹)"
    for c in hdrs:
        set_cell_shading(c, "EAECEE")
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)
            r.font.bold = True

    r_item = tbl_items.add_row().cells
    r_item[0].text = "{% for item in items %}{{ loop.index }}"
    r_item[1].text = "{{ item.name }}"
    r_item[2].text = "{{ item.qty }}"
    r_item[3].text = "{{ item.unit_cost }}"
    r_item[4].text = "{{ item.total }}{% if not loop.last %}\n{% endif %}{% endfor %}"
    for c in r_item:
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)

    # Supplier & Bank Details (Official, Masked)
    p_pay = doc.add_paragraph()
    p_pay.paragraph_format.space_before = Pt(10)
    p_pay.paragraph_format.space_after = Pt(4)
    r_pay_hdr = p_pay.add_run("Supplier / Payee & Banking Details:")
    r_pay_hdr.font.name = "Times New Roman"
    r_pay_hdr.font.bold = True
    r_pay_hdr.font.size = Pt(10)

    p_sup = doc.add_paragraph()
    p_sup.paragraph_format.line_spacing = 1.15
    p_sup.add_run(
        "Supplier / Payee Name: {{ supplier_name or payee_name or '[TO BE FILLED]' }}\n"
        "GSTIN: {{ supplier_gst or '[TO BE FILLED]' }} | Invoice No: {{ invoice_no or '[TO BE FILLED]' }} | Date: {{ invoice_date or '[TO BE FILLED]' }}\n"
        "Bank Name: {{ bank_name or '[TO BE FILLED]' }} | Branch: {{ bank_branch or '[TO BE FILLED]' }}\n"
        "Account Number: {{ account_number or '[TO BE FILLED]' }} | IFSC Code: {{ ifsc or '[TO BE FILLED]' }}\n"
    ).font.name = "Times New Roman"
    p_sup.runs[0].font.size = Pt(9.5)

    # Certificate
    p_cert = doc.add_paragraph()
    p_cert.paragraph_format.space_before = Pt(8)
    r_cert = p_cert.add_run(
        "CERTIFICATE: Certified that the items/services mentioned above have been received in good condition, "
        "verified as per rate and specifications, and entered in the stock register of the student council/chapter."
    )
    r_cert.font.name = "Times New Roman"
    r_cert.font.italic = True
    r_cert.font.size = Pt(9)

    # Signatories
    p_sig = doc.add_paragraph()
    p_sig.paragraph_format.space_before = Pt(35)
    r_sig = p_sig.add_run(
        "Indenter / Faculty Coordinator\t\tDean (Student Welfare)"
    )
    r_sig.font.name = "Times New Roman"
    r_sig.font.size = Pt(10)
    r_sig.font.bold = True

    doc.save(str(out_dir / "template.docx"))

    # meta.yaml
    meta = {
        "id": "bill-certificate",
        "name": "Bill Certificate (Form BC-R)",
        "short_name": "Bill Certificate",
        "description": "Institute Form BC-R submitted to Dean Student Welfare for expense reimbursement and bill passing.",
        "authority": "Dean (Student Welfare)",
        "ref_category": "BILL",
        "file_name": "bill_certificate.docx",
        "version": 1,
    }
    with open(out_dir / "meta.yaml", "w", encoding="utf-8") as f:
        yaml.dump(meta, f, sort_keys=False)

    # schema.yaml
    schema = {
        "placeholders": [
            {"key": "approval_note_no", "label": "Approval Note No.", "type": "text", "required": True, "never_ai": True, "masked": False, "question": "Official approval note reference", "section": "Approval"},
            {"key": "approval_date", "label": "Approval Date", "type": "date", "required": True, "never_ai": True, "masked": False, "question": "Date of approval note", "section": "Approval"},
            {"key": "head_of_account", "label": "Head of Account", "type": "text", "required": True, "never_ai": True, "masked": False, "question": "Budget head code (e.g. 6/52)", "section": "Approval"},
            {"key": "event_title", "label": "Event Title", "type": "text", "required": True, "never_ai": False, "masked": False, "shared": True, "question": "Event title", "section": "Event Details"},
            {
                "key": "items",
                "label": "Purchased Items",
                "type": "table",
                "required": True,
                "never_ai": False,
                "masked": False,
                "question": "Bill items and quantities",
                "section": "Items & Bills",
                "columns": [
                    {"key": "name", "label": "Item Name", "type": "text"},
                    {"key": "qty", "label": "Qty", "type": "number"},
                    {"key": "unit_cost", "label": "Unit Cost", "type": "number"},
                    {"key": "total", "label": "Total", "type": "number"},
                ],
            },
            {"key": "supplier_name", "label": "Supplier Name", "type": "text", "required": True, "never_ai": False, "masked": False, "question": "Name of vendor or supplier", "section": "Vendor Details"},
            {"key": "supplier_gst", "label": "Supplier GST", "type": "text", "required": False, "never_ai": True, "masked": True, "question": "Vendor GST Number", "section": "Vendor Details"},
            {"key": "invoice_no", "label": "Invoice No.", "type": "text", "required": True, "never_ai": True, "masked": False, "question": "Vendor bill or invoice number", "section": "Vendor Details"},
            {"key": "invoice_date", "label": "Invoice Date", "type": "date", "required": True, "never_ai": True, "masked": False, "question": "Date on the invoice", "section": "Vendor Details"},
            {"key": "account_number", "label": "Bank Account Number", "type": "text", "required": True, "never_ai": True, "masked": True, "question": "Bank account number for payment", "section": "Bank Details"},
            {"key": "bank_name", "label": "Bank Name", "type": "text", "required": True, "never_ai": False, "masked": False, "question": "Name of payee bank", "section": "Bank Details"},
            {"key": "bank_branch", "label": "Bank Branch", "type": "text", "required": False, "never_ai": False, "masked": False, "question": "Bank branch name", "section": "Bank Details"},
            {"key": "ifsc", "label": "IFSC Code", "type": "text", "required": True, "never_ai": True, "masked": True, "question": "Bank IFSC Code", "section": "Bank Details"},
        ]
    }
    with open(out_dir / "schema.yaml", "w", encoding="utf-8") as f:
        yaml.dump(schema, f, sort_keys=False)

    # rules.yaml
    rules = {
        "rules": [
            {
                "id": "rule-expenses-needed",
                "description": "Recommended when events involve purchases, refreshments, printing, or external vendors.",
                "condition": "hasExpenses == True",
            }
        ]
    }
    with open(out_dir / "rules.yaml", "w", encoding="utf-8") as f:
        yaml.dump(rules, f, sort_keys=False)


def create_bill_summary_template(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_hdr = p_header.add_run("ACM SVNIT STUDENT CHAPTER\nBILL SUMMARY & INDIVIDUAL REIMBURSEMENT SHEET")
    r_hdr.font.name = "Times New Roman"
    r_hdr.font.size = Pt(13)
    r_hdr.font.bold = True
    r_hdr.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)

    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_before = Pt(8)
    p_meta.add_run("Event: {{ event_title or '[TO BE FILLED]' }}\t\tDate: {{ summary_date or '[TO BE FILLED]' }}").font.name = "Times New Roman"
    p_meta.runs[0].font.size = Pt(10)
    p_meta.runs[0].font.bold = True

    # Reimbursements Table
    doc.add_paragraph("Reimbursement / Prize Distribution Details:").runs[0].font.bold = True
    tbl_reimb = doc.add_table(rows=1, cols=5)
    tbl_reimb.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_reimb.autofit = False

    hdrs = tbl_reimb.rows[0].cells
    hdrs[0].text = "Sr No"
    hdrs[1].text = "Team / Payee Name"
    hdrs[2].text = "Paid To"
    hdrs[3].text = "Bank Account"
    hdrs[4].text = "Amount (₹)"
    for c in hdrs:
        set_cell_shading(c, "EAECEE")
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)
            r.font.bold = True

    r_row = tbl_reimb.add_row().cells
    r_row[0].text = "{% for r in reimbursements %}{{ loop.index }}"
    r_row[1].text = "{{ r.name }}"
    r_row[2].text = "{{ r.paid_to }}"
    r_row[3].text = "{{ r.account }}"
    r_row[4].text = "{{ r.amount }}{% if not loop.last %}\n{% endif %}{% endfor %}"
    for c in r_row:
        set_cell_margins(c)
        for r in c.paragraphs[0].runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(9)

    # Signatories
    p_sig = doc.add_paragraph()
    p_sig.paragraph_format.space_before = Pt(40)
    p_sig.add_run(
        "Prepared By:\nStudent Head / Secretary\t\t\tVerified By:\nFaculty Chairman, ACM SVNIT"
    ).font.name = "Times New Roman"
    p_sig.runs[0].font.size = Pt(10)

    doc.save(str(out_dir / "template.docx"))

    # meta.yaml
    meta = {
        "id": "bill-summary",
        "name": "Bill Summary & Prize Reimbursement",
        "short_name": "Bill Summary",
        "description": "Summary sheet for multiple individual reimbursements, winners prize money, and account breakdowns.",
        "authority": "Accounts Section / DSW",
        "ref_category": "BILL",
        "file_name": "bill_summary.docx",
        "version": 1,
    }
    with open(out_dir / "meta.yaml", "w", encoding="utf-8") as f:
        yaml.dump(meta, f, sort_keys=False)

    # schema.yaml
    schema = {
        "placeholders": [
            {"key": "event_title", "label": "Event Title", "type": "text", "required": True, "never_ai": False, "masked": False, "shared": True, "question": "Event title", "section": "Event Details"},
            {"key": "summary_date", "label": "Summary Date", "type": "date", "required": True, "never_ai": False, "masked": False, "question": "Date of summary sheet", "section": "Header"},
            {
                "key": "reimbursements",
                "label": "Reimbursements Table",
                "type": "table",
                "required": True,
                "never_ai": False,
                "masked": False,
                "question": "Recipient names, bank details, and reimbursement amounts",
                "section": "Distribution",
                "columns": [
                    {"key": "name", "label": "Team / Entity", "type": "text"},
                    {"key": "paid_to", "label": "Paid To", "type": "text"},
                    {"key": "account", "label": "Account", "type": "text", "never_ai": True, "masked": True},
                    {"key": "amount", "label": "Amount", "type": "number"},
                ],
            },
        ]
    }
    with open(out_dir / "schema.yaml", "w", encoding="utf-8") as f:
        yaml.dump(schema, f, sort_keys=False)

    # rules.yaml
    rules = {
        "rules": [
            {
                "id": "rule-prizes-needed",
                "description": "Recommended when events involve cash awards, prize money, or individual reimbursements.",
                "condition": "hasPrizes == True",
            }
        ]
    }
    with open(out_dir / "rules.yaml", "w", encoding="utf-8") as f:
        yaml.dump(rules, f, sort_keys=False)


def main():
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    print("Building starter templates in", TEMPLATES_DIR)
    create_room_permission_template(TEMPLATES_DIR / "room_permission")
    create_bill_certificate_template(TEMPLATES_DIR / "bill_certificate")
    create_bill_summary_template(TEMPLATES_DIR / "bill_summary")
    print("Done! Templates generated successfully.")


if __name__ == "__main__":
    main()
