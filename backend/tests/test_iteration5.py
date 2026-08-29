"""Iteration 5 backend tests: /api/guide PDF, bank fields in settings, upload+files
regression, mandatory payment proof flow, booking regression."""
import base64
import io
import os
import re
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


@pytest.fixture(scope="module")
def creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing credentials file")
    c = p.read_text(encoding="utf-8")
    u = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?username(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not u or not pw:
        pytest.skip("no creds parsed")
    return {"username": u.group(1), "password": pw.group(1)}


@pytest.fixture(scope="module")
def api():
    return requests.Session()


@pytest.fixture(scope="module")
def auth(api, creds):
    r = api.post(f"{BASE_URL}/api/auth/login", json=creds)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("token")
    assert isinstance(tok, str) and tok
    return {"Authorization": f"Bearer {tok}"}


def future(offset_days, length=1):
    d = date.today() + timedelta(days=offset_days)
    return d.isoformat(), (d + timedelta(days=length)).isoformat()


# ------------------------------------------------- Guidebook PDF (public)
class TestGuide:
    def test_guide_public_pdf(self):
        r = requests.get(f"{BASE_URL}/api/guide", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 2000
        assert "filename" in r.headers.get("content-disposition", "")


# ------------------------------------------------- Settings + bank fields
class TestSettings:
    def test_reset_contains_bank_fields(self, api, auth):
        r = api.post(f"{BASE_URL}/api/settings/reset", headers=auth)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "_id" not in d
        for k in ("bank_name", "bank_account", "bank_holder"):
            assert k in d, f"{k} missing from settings after reset"
            assert d[k] == "", f"{k} should default to empty, got {d[k]!r}"
        assert len(d["rooms"]) == 4

    def test_put_persists_bank_and_images(self, api, auth):
        cur = api.get(f"{BASE_URL}/api/settings").json()
        payload = dict(cur)
        payload.update({
            "bank_name": "TEST_Bank Kaltara",
            "bank_account": "1234567890",
            "bank_holder": "TEST_Pemprov Kaltara",
            "qris_image": "/api/files/test/qris.png",
            "hero_image": "/api/files/test/hero.png",
        })
        r = api.put(f"{BASE_URL}/api/settings", json={"data": payload}, headers=auth)
        assert r.status_code == 200, r.text[:300]
        got = api.get(f"{BASE_URL}/api/settings").json()
        assert got["bank_name"] == "TEST_Bank Kaltara"
        assert got["bank_account"] == "1234567890"
        assert got["bank_holder"] == "TEST_Pemprov Kaltara"
        assert got["qris_image"] == "/api/files/test/qris.png"
        assert got["hero_image"] == "/api/files/test/hero.png"

    def test_put_requires_auth(self, api):
        r = api.put(f"{BASE_URL}/api/settings", json={"data": {"bank_name": "x"}})
        assert r.status_code in (401, 403), r.status_code


# ------------------------------------------------- Upload / download regression
class TestUpload:
    def test_upload_and_serve(self, api, auth):
        files = {"file": ("TEST_tiny.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = api.post(f"{BASE_URL}/api/upload", files=files, headers=auth)
        assert r.status_code == 200, r.text[:300]
        url = r.json().get("url")
        assert isinstance(url, str) and url.startswith("/api/files/")
        g = requests.get(f"{BASE_URL}{url}", timeout=30)
        assert g.status_code == 200, g.text[:200]
        assert g.headers.get("content-type", "").startswith("image/")
        assert g.content == PNG_BYTES

    def test_upload_requires_auth(self, api):
        files = {"file": ("TEST_tiny.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = api.post(f"{BASE_URL}/api/upload", files=files)
        assert r.status_code in (401, 403), r.status_code

    def test_missing_file_404(self):
        r = requests.get(f"{BASE_URL}/api/files/does/not/exist.png", timeout=30)
        assert r.status_code == 404, r.status_code


# ------------------------------------------------- Booking + proof
class TestBookingProof:
    ids = []

    @pytest.fixture(scope="class", autouse=True)
    def cleanup(self, api, auth):
        yield
        for bid in self.ids:
            api.delete(f"{BASE_URL}/api/bookings/{bid}", headers=auth)

    def _make_booking(self, api, offset, method="QRIS"):
        ci, co = future(offset)
        body = {
            "guest_name": "TEST_Proof Guest",
            "phone": "081234567890",
            "payment_method": method,
            "items": [{
                "room_id": "meeting", "room_name": "Meeting Room",
                "checkin": ci, "checkout": co, "days": 1,
                "base_price": 500000, "room_total": 500000,
                "addons": [], "addons_total": 0, "notes": "TEST", "total": 500000,
            }],
        }
        return api.post(f"{BASE_URL}/api/bookings", json=body)

    def test_create_booking_pending(self, api, auth):
        r = self._make_booking(api, 900)
        assert r.status_code == 200, r.text[:300]
        gid = r.json()["group_id"]
        assert r.json()["count"] == 1
        lst = api.get(f"{BASE_URL}/api/bookings", headers=auth)
        assert lst.status_code == 200
        mine = [b for b in lst.json() if b["group_id"] == gid]
        assert len(mine) == 1
        b = mine[0]
        type(self).ids.append(b["id"])
        assert b["status"] == "pending"
        assert b["payment_status"] == "unpaid"
        assert b["payment_proof"] == ""
        type(self).group_id = gid

    def test_overlap_conflict(self, api):
        r = self._make_booking(api, 900)
        assert r.status_code == 409, r.status_code

    def test_upload_proof_public(self, api, auth):
        gid = getattr(type(self), "group_id", None)
        assert gid, "previous booking test must run first"
        files = {"file": ("TEST_proof.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{BASE_URL}/api/bookings/group/{gid}/proof", files=files, timeout=30)
        assert r.status_code == 200, r.text[:300]
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        lst = api.get(f"{BASE_URL}/api/bookings", headers=auth).json()
        b = [x for x in lst if x["group_id"] == gid][0]
        assert b["payment_proof"] == url
        assert requests.get(f"{BASE_URL}{url}", timeout=30).status_code == 200

    def test_proof_rejects_non_image(self):
        gid = getattr(type(self), "group_id", None)
        assert gid
        files = {"file": ("TEST_bad.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{BASE_URL}/api/bookings/group/{gid}/proof", files=files, timeout=30)
        assert r.status_code == 400, r.status_code

    def test_proof_unknown_group_404(self):
        files = {"file": ("TEST_proof.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{BASE_URL}/api/bookings/group/nope-123/proof", files=files, timeout=30)
        assert r.status_code == 404, r.status_code

    def test_payment_toggle_and_receipt(self, api, auth):
        assert self.ids, "need a booking"
        bid = self.ids[0]
        r = api.patch(f"{BASE_URL}/api/bookings/{bid}/payment", json={"payment_status": "paid"}, headers=auth)
        assert r.status_code == 200, r.text[:300]
        lst = api.get(f"{BASE_URL}/api/bookings", headers=auth).json()
        b = [x for x in lst if x["id"] == bid][0]
        assert b["payment_status"] == "paid"
        rec = api.get(f"{BASE_URL}/api/bookings/{bid}/receipt", headers=auth)
        assert rec.status_code == 200, rec.text[:300]
        assert rec.content[:4] == b"%PDF"
        # revert
        api.patch(f"{BASE_URL}/api/bookings/{bid}/payment", json={"payment_status": "unpaid"}, headers=auth)
        rec2 = api.get(f"{BASE_URL}/api/bookings/{bid}/receipt", headers=auth)
        assert rec2.status_code in (400, 403, 409), rec2.status_code

    def test_availability_and_booked_ranges(self, api):
        ci, co = future(900)
        a = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": ci, "checkout": co})
        assert a.status_code == 200
        assert a.json()["available"] is False
        ci2, co2 = future(1500)
        a2 = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": ci2, "checkout": co2})
        assert a2.json()["available"] is True
        br = api.get(f"{BASE_URL}/api/rooms/meeting/booked")
        assert br.status_code == 200
        assert any(x["checkin"] == ci for x in br.json())

    def test_past_date_rejected(self, api):
        ci, co = future(-5)
        body = {
            "guest_name": "TEST_Past", "phone": "0812", "payment_method": "QRIS",
            "items": [{"room_id": "vip", "room_name": "VIP Room", "checkin": ci, "checkout": co,
                       "days": 1, "base_price": 1, "room_total": 1, "addons": [], "addons_total": 0,
                       "notes": "", "total": 1}],
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=body)
        assert r.status_code == 400, r.status_code


# ------------------------------------------------- restore defaults last
class TestZZCleanup:
    def test_reset_settings_to_defaults(self, api, auth):
        r = api.post(f"{BASE_URL}/api/settings/reset", headers=auth)
        assert r.status_code == 200
        d = api.get(f"{BASE_URL}/api/settings").json()
        assert d["bank_name"] == ""
        assert len(d["rooms"]) == 4
