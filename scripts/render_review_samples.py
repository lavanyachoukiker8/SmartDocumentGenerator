import os
import sys
from pathlib import Path

# Add backend to sys.path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.services.fill import render_docx_template
from app.services.export import convert_docx_to_pdf

out_dir = ROOT / "backend" / "outputs" / "review"
out_dir.mkdir(parents=True, exist_ok=True)

# 1. Room Permission
room_data = {
    "ref_no": "ACM/26-27/ROOM/009",
    "letter_date": "2026-10-14",
    "submitted_to": "HoD(CSE Dept.)",
    "subject": "Requesting Permission to Conduct ACM Executives Meet in Seminar Hall 402, CSE Department.",
    "event_title": "ACM Executives Meet",
    "venue": "Seminar Hall 402 (4th Floor)",
    "start_date": "2026-10-14",
    "end_date": "2026-10-14",
    "time_from": "18:00",
    "time_to": "19:30",
    "description": "ACM NIT Surat is organizing an Executive Meet to discuss the chapter's vision, provide guidance on organizing events and initiatives, and facilitate effective collaboration among executive members.",
    "objective": "To provide guidance to the ACM executive team on organizing events, coordinating group projects, and fostering effective collaboration.",
    "participants": "150+",
    "mode": "Offline",
    "organizers": "ACM Core 2026-27",
    "faculty_coordinator": "Dr. Sankita J. Patel",
    "contact_1_name": "Ansh Gupta",
    "contact_1_designation": "Chairperson, ACM",
    "contact_1_admn": "I24AI005",
    "contact_1_branch": "Artificial Intelligence",
    "contact_1_mobile": "",
    "contact_2_name": "Sunny Bodiwala",
    "contact_2_designation": "Tech Assistant, Seminar Hall",
    "contact_2_branch": "Computer Science & Engineering",
    "contact_2_mobile": "",
    "contact_3_name": "Shri. Rakesh P. Gohil",
    "contact_3_designation": "Faculty in-charge, Seminar Hall",
    "contact_3_branch": "Computer Science & Engineering",
    "contact_4_name": "Dr. Sankita J. Patel",
    "contact_4_designation": "Chairman, ACM",
    "contact_4_branch": "Computer Science & Engineering",
}

docx1 = render_docx_template("room_permission", room_data, out_dir / "room_permission_review.docx")
pdf1 = convert_docx_to_pdf(docx1, out_dir)
print(f"Room Permission generated: {pdf1.name} ({pdf1.stat().st_size} bytes)")

# 2. Bill Certificate
bill_cert_data = {
    "chapter_name": "ACM",
    "chapter_code": "6/52",
    "approval_note_no": "ACM/2026-27/SIH/001",
    "approval_date": "2026-09-08",
    "bill_no": "1059",
    "bill_date": "2026-09-08",
    "bill_amount": 15420.0,
    "supplier_name": "Reliable Stationery & Tech Hub",
    "purchase_order": "NiL",
    "head_of_account": "6/52",
    "advance_drawn": "NiL",
    "certifying_person": "Dr. Sankita J. Patel",
    "items": [
        {"sr_no": 1, "item_name": "Networking Cables & Crimping Tools", "qty": 5, "unit_cost": 450.0, "total": 2250.0},
        {"sr_no": 2, "item_name": "Event Banners & Lanyards", "qty": 120, "unit_cost": 85.0, "total": 10200.0},
        {"sr_no": 3, "item_name": "Technical Certificates & Stationery", "qty": 150, "unit_cost": 19.8, "total": 2970.0},
    ],
    "taxes": 0.0,
    "supplier_gst": "24AAAAA0000A1Z5",
    "other_taxes": "-",
    "invoice_no": "1059",
    "invoice_date": "2026-09-08",
    "payee_name": "Reliable Stationery & Tech Hub",
    "account_number": "50100234561234",
    "account_holder": "Reliable Stationery",
    "bank_name": "State Bank of India",
    "bank_branch": "SVNIT Branch",
    "ifsc": "SBIN0003320",
    "stock_office": "Student Council",
    "stock_register_type": "Recurring Register",
    "stock_serial_no": "14",
    "stock_page_no": "32",
    "stock_date": "2026-09-08",
    "faculty_chairman_name": "Dr. Sankita J. Patel",
    "faculty_chairman_designation": "Associate Professor & Faculty Chairman",
    "department": "CSE",
}

docx2 = render_docx_template("bill_certificate", bill_cert_data, out_dir / "bill_certificate_review.docx")
pdf2 = convert_docx_to_pdf(docx2, out_dir)
print(f"Bill Certificate generated: {pdf2.name} ({pdf2.stat().st_size} bytes)")

# 3. Bill Summary
bill_sum_data = {
    "letter_date": "2026-09-10",
    "event_title": "SIH Internal Hackathon",
    "reimbursements": [
        {"sr_no": 1, "name": "Team ByteForce", "account_details": "HDFC Bank 50100998877", "paid_to": "Ansh Gupta", "prize_money": 10000.0, "other": 0.0, "total": 10000.0},
        {"sr_no": 2, "name": "Refreshment Reimbursement", "account_details": "SBI 30201122334", "paid_to": "Arshad Khatib", "prize_money": 0.0, "other": 3500.0, "total": 3500.0},
    ],
    "other_accounts": [
        {"sr_no": 1, "name": "ACM Student Chapter", "account_no": "50100234561234", "ifsc": "SBIN0003320", "amount": 13500.0}
    ],
    "student_chairperson_name": "Ansh Gupta",
    "student_secretary_name": "Arshad Khatib",
    "faculty_chairman_name": "Dr. Sankita Patel",
}

docx3 = render_docx_template("bill_summary", bill_sum_data, out_dir / "bill_summary_review.docx")
pdf3 = convert_docx_to_pdf(docx3, out_dir)
print(f"Bill Summary generated: {pdf3.name} ({pdf3.stat().st_size} bytes)")
