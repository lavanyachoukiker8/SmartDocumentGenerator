import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.crypto import encrypt_field, decrypt_field, mask_value
from app.services.rules import eval_rule_safe

from app.db import init_db

init_db()
client = TestClient(app)



def test_health():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_crypto():
    secret = "50100234561234"
    enc = encrypt_field(secret)
    assert enc != secret
    dec = decrypt_field(enc)
    assert dec == secret

    masked = mask_value(secret)
    assert masked.endswith("1234")
    assert "•" in masked


def test_safe_rules():
    context = {"venue": "Seminar Hall 402", "mode": "Offline", "hasExpenses": True}
    assert eval_rule_safe("venue != None and mode != 'Online'", context) is True
    assert eval_rule_safe("hasExpenses == True", context) is True
    assert eval_rule_safe("hasPrizes == True", context) is False


def test_club_and_reference():
    res = client.get("/api/club")
    assert res.status_code == 200
    club = res.json()
    assert club["shortName"] == "ACM"

    peek_res = client.get("/api/club/reference/ROOM/peek")
    assert peek_res.status_code == 200
    ref_data = peek_res.json()
    assert "ACM" in ref_data["ref"]
    assert "ROOM" in ref_data["ref"]


def test_templates_catalog():
    res = client.get("/api/templates")
    assert res.status_code == 200
    templates = res.json()
    assert len(templates) >= 3
    ids = [t["id"] for t in templates]
    assert "room-permission" in ids


def test_event_lifecycle_and_generation():
    # 1. Create from text
    prompt_text = "We are conducting a two-day Web Development Workshop on 14–15 October in Seminar Hall for around 120 students"
    create_res = client.post("/api/events/from-text", json={"text": prompt_text})
    assert create_res.status_code == 200
    event = create_res.json()
    event_id = event["id"]
    assert "Web Development Workshop" in event["title"]

    # 2. Recommendations
    rec_res = client.get(f"/api/events/{event_id}/recommendations")
    assert rec_res.status_code == 200
    recs = rec_res.json()
    assert len(recs) >= 1
    room_rec = next((r for r in recs if r["templateId"] == "room-permission"), None)
    assert room_rec is not None
    assert room_rec["recommended"] is True

    # 3. Generate document with allowPlaceholders
    gen_res = client.post(
        f"/api/events/{event_id}/generate",
        json={"templateIds": ["room-permission"], "options": {"allowPlaceholders": True}},
    )
    assert gen_res.status_code == 200
    docs = gen_res.json()
    assert len(docs) == 1
    doc_id = docs[0]["id"]
    assert docs[0]["currentVersion"] == 1

    # 4. Save document edits
    doc_vals = docs[0]["values"]
    doc_vals["event_title"] = "Updated Web Dev Workshop Title"
    save_res = client.put(f"/api/documents/{doc_id}", json={"values": doc_vals, "note": "Edited title"})
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data["document"]["currentVersion"] == 2

    # 5. Export document
    export_res = client.get(f"/api/documents/{doc_id}/export?format=docx")
    assert export_res.status_code == 200
    assert "Content-Disposition" in export_res.headers
    assert "attachment" in export_res.headers["Content-Disposition"]


def test_rule_r1_enforcement_never_fabricate_official():
    # Attempting to feed official/financial data in raw text
    text_with_injections = (
        "We are conducting HackSVNIT. Our ref_no is ACM/FAKE/001. "
        "Account number is 1234567890 with IFSC SBIN0001234. Dean signature is Dr. Fake."
    )
    res = client.post("/api/events/from-text", json={"text": text_with_injections})
    assert res.status_code == 200
    event = res.json()

    # Rule R1 check: Official/sensitive fields must never be extracted or populated by AI/text
    for field in event["fields"]:
        if field["key"] in ["ref_no", "account_number", "ifsc", "signatures"]:
            # Value must be empty/None or flagged as missing, never filled with the injected fake text
            assert field["value"] is None or field["value"] == "" or field["value"] == "Not provided" or field["source"] == "missing"
            assert field["neverAi"] is True


def test_stats_and_reset():
    stats_res = client.get("/api/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "totalEvents" in stats
    assert "totalDocuments" in stats

    reset_res = client.post("/api/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "ok"


def test_extracted_logos():
    from pathlib import Path
    from PIL import Image
    assets = Path("backend/assets")
    svnit_path = assets / "svnit_logo.png"
    acm_path = assets / "acm_logo.png"

    assert svnit_path.exists(), "svnit_logo.png missing in backend/assets"
    assert acm_path.exists(), "acm_logo.png missing in backend/assets"
    assert svnit_path.stat().st_size > 1000
    assert acm_path.stat().st_size > 1000

    with Image.open(svnit_path) as img:
        assert img.format == "PNG"
        assert img.width > 50 and img.height > 50

    with Image.open(acm_path) as img:
        assert img.format == "PNG"
        assert img.width > 50 and img.height > 50


