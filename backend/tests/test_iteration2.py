"""Iteration 2 features: availability check, overlap 409, payment proof upload,
payment status toggle, dynamic rooms/addons CMS."""
import copy
import io
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


@pytest.fixture(scope="session")
def creds():
    p = Path("/app/memory/test_credentials.md")
    c = p.read_text(encoding="utf-8")
    u = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?username(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not u or not pw:
        pytest.skip("no creds parsed")
    return {"username": u.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(api, creds):
    r = api.post(f"{BASE_URL}/api/auth/login", json=creds)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


CREATED_GROUPS = []


@pytest.fixture(scope="session", autouse=True)
def cleanup(auth):
    yield
    for gid in CREATED_GROUPS:
        for b in auth.get(f"{BASE_URL}/api/bookings").json():
            if b.get("group_id") == gid:
                auth.delete(f"{BASE_URL}/api/bookings/{b['id']}")


def payload(name, room_id, room_name, checkin, checkout):
    return {
        "guest_name": name, "phone": "0800000000", "payment_method": "QRIS",
        "items": [{
            "room_id": room_id, "room_name": room_name,
            "checkin": checkin, "checkout": checkout, "days": 2,
            "base_price": 1000000, "room_total": 2000000,
            "addons": [], "addons_total": 0, "notes": "TEST", "total": 2000000,
        }],
    }


def create(api, name, room_id, room_name, checkin, checkout):
    r = api.post(f"{BASE_URL}/api/bookings", json=payload(name, room_id, room_name, checkin, checkout))
    if r.status_code == 200:
        CREATED_GROUPS.append(r.json()["group_id"])
    return r


# ---------------- Availability + overlap
class TestAvailability:
    def test_available_free_range(self, api):
        r = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": "2032-01-10", "checkout": "2032-01-12"})
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"available": True}

    def test_unavailable_after_booking(self, api):
        r = create(api, "TEST_Avail", "meeting", "Meeting Room", "2032-02-10", "2032-02-14")
        assert r.status_code == 200, r.text[:300]
        # exact same range
        a = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": "2032-02-10", "checkout": "2032-02-14"})
        assert a.json()["available"] is False
        # partial overlap at start
        a = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": "2032-02-08", "checkout": "2032-02-11"})
        assert a.json()["available"] is False
        # inside
        a = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": "2032-02-11", "checkout": "2032-02-12"})
        assert a.json()["available"] is False
        # adjacent after (checkin == existing checkout) should be allowed
        a = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": "2032-02-14", "checkout": "2032-02-16"})
        assert a.json()["available"] is True
        # other room unaffected
        a = api.get(f"{BASE_URL}/api/availability", params={"room_id": "vip", "checkin": "2032-02-10", "checkout": "2032-02-14"})
        assert a.json()["available"] is True

    def test_invalid_dates(self, api):
        r = api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting", "checkin": "2032-03-05", "checkout": "2032-03-05"})
        assert r.status_code == 200
        assert r.json()["available"] is False

    def test_missing_params_422(self, api):
        assert api.get(f"{BASE_URL}/api/availability", params={"room_id": "meeting"}).status_code == 422

    def test_booking_overlap_409(self, api):
        r = create(api, "TEST_Clash", "meeting", "Meeting Room", "2032-02-12", "2032-02-13")
        assert r.status_code == 409, f"{r.status_code} {r.text[:300]}"
        assert "dibooking" in r.json()["detail"].lower()

    def test_booking_non_overlap_ok(self, api):
        r = create(api, "TEST_NoClash", "meeting", "Meeting Room", "2032-02-14", "2032-02-16")
        assert r.status_code == 200, r.text[:300]

    def test_booking_invalid_dates_400(self, api):
        r = api.post(f"{BASE_URL}/api/bookings", json=payload("TEST_Bad", "vip", "VIP Room", "2032-05-05", "2032-05-05"))
        assert r.status_code == 400, r.status_code
        r = api.post(f"{BASE_URL}/api/bookings", json=payload("TEST_Bad", "vip", "VIP Room", "2032-05-09", "2032-05-05"))
        assert r.status_code == 400

    def test_cancelled_booking_frees_range(self, api, auth):
        r = create(api, "TEST_Cancelled", "outdoor", "Outdoor Venue", "2032-06-01", "2032-06-03")
        assert r.status_code == 200
        gid = r.json()["group_id"]
        bid = [b for b in auth.get(f"{BASE_URL}/api/bookings").json() if b["group_id"] == gid][0]["id"]
        assert api.get(f"{BASE_URL}/api/availability", params={"room_id": "outdoor", "checkin": "2032-06-01", "checkout": "2032-06-03"}).json()["available"] is False
        assert auth.patch(f"{BASE_URL}/api/bookings/{bid}", json={"status": "cancelled"}).status_code == 200
        assert api.get(f"{BASE_URL}/api/availability", params={"room_id": "outdoor", "checkin": "2032-06-01", "checkout": "2032-06-03"}).json()["available"] is True


# ---------------- Payment defaults, proof upload, payment toggle
class TestPayment:
    gid = None
    bid = None

    def test_new_booking_payment_defaults(self, api, auth):
        r = create(api, "TEST_Pay", "vip", "VIP Room", "2032-07-01", "2032-07-03")
        assert r.status_code == 200, r.text[:300]
        TestPayment.gid = r.json()["group_id"]
        b = [x for x in auth.get(f"{BASE_URL}/api/bookings").json() if x["group_id"] == TestPayment.gid][0]
        TestPayment.bid = b["id"]
        assert b["payment_status"] == "unpaid"
        assert b["payment_proof"] == ""

    def test_upload_proof_public_and_serve(self, auth):
        r = requests.post(
            f"{BASE_URL}/api/bookings/group/{TestPayment.gid}/proof",
            files={"file": ("TEST_proof.png", io.BytesIO(PNG), "image/png")}, timeout=120,
        )
        assert r.status_code == 200, r.text[:300]
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        b = [x for x in auth.get(f"{BASE_URL}/api/bookings").json() if x["id"] == TestPayment.bid][0]
        assert b["payment_proof"] == url
        g = requests.get(f"{BASE_URL}{url}", timeout=60)
        assert g.status_code == 200
        assert g.headers["Content-Type"].startswith("image/")
        assert len(g.content) == len(PNG)

    def test_upload_proof_bad_group_404(self):
        r = requests.post(
            f"{BASE_URL}/api/bookings/group/no-such-group/proof",
            files={"file": ("x.png", io.BytesIO(PNG), "image/png")}, timeout=60,
        )
        assert r.status_code == 404

    def test_payment_toggle_requires_auth(self, api):
        r = api.patch(f"{BASE_URL}/api/bookings/{TestPayment.bid}/payment", json={"payment_status": "paid"})
        assert r.status_code == 401

    def test_payment_toggle(self, auth):
        for st in ["paid", "unpaid", "paid"]:
            r = auth.patch(f"{BASE_URL}/api/bookings/{TestPayment.bid}/payment", json={"payment_status": st})
            assert r.status_code == 200, r.text[:200]
            b = [x for x in auth.get(f"{BASE_URL}/api/bookings").json() if x["id"] == TestPayment.bid][0]
            assert b["payment_status"] == st

    def test_payment_invalid_value_400(self, auth):
        r = auth.patch(f"{BASE_URL}/api/bookings/{TestPayment.bid}/payment", json={"payment_status": "lunas"})
        assert r.status_code == 400

    def test_payment_not_found_404(self, auth):
        r = auth.patch(f"{BASE_URL}/api/bookings/does-not-exist/payment", json={"payment_status": "paid"})
        assert r.status_code == 404

    def test_proof_applies_to_whole_group(self, api, auth):
        multi = payload("TEST_Group", "meeting", "Meeting Room", "2032-08-01", "2032-08-03")
        multi["items"].append({
            "room_id": "vip", "room_name": "VIP Room", "checkin": "2032-08-01", "checkout": "2032-08-03",
            "days": 2, "base_price": 1500000, "room_total": 3000000, "addons": [], "addons_total": 0,
            "notes": "", "total": 3000000,
        })
        r = api.post(f"{BASE_URL}/api/bookings", json=multi)
        assert r.status_code == 200, r.text[:300]
        gid = r.json()["group_id"]
        CREATED_GROUPS.append(gid)
        assert r.json()["count"] == 2
        up = requests.post(
            f"{BASE_URL}/api/bookings/group/{gid}/proof",
            files={"file": ("TEST_proof2.jpg", io.BytesIO(PNG), "image/jpeg")}, timeout=120,
        )
        assert up.status_code == 200, up.text[:300]
        url = up.json()["url"]
        rows = [x for x in auth.get(f"{BASE_URL}/api/bookings").json() if x["group_id"] == gid]
        assert len(rows) == 2
        assert all(x["payment_proof"] == url for x in rows)


# ---------------- Dynamic catalog CMS
class TestCatalogCMS:
    original = None

    def test_snapshot(self, api):
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        TestCatalogCMS.original = r.json()
        assert "whatsapp_admin" in TestCatalogCMS.original

    def test_add_and_remove_room_persists(self, auth, api):
        data = copy.deepcopy(TestCatalogCMS.original)
        rooms = [r for r in data["rooms"] if r["id"] != "outdoor"]  # remove existing
        rooms.append({
            "id": "test_aula", "name": "TEST Aula", "capacity": 123,
            "features": ["AC", "TEST_FEATURE"], "price": 777000,
            "description": "TEST description aula", "photo": "",
        })
        data["rooms"] = rooms
        r = auth.put(f"{BASE_URL}/api/settings", json={"data": data})
        assert r.status_code == 200, r.text[:300]
        got = api.get(f"{BASE_URL}/api/settings").json()
        ids = [x["id"] for x in got["rooms"]]
        assert "test_aula" in ids
        assert "outdoor" not in ids
        new = [x for x in got["rooms"] if x["id"] == "test_aula"][0]
        assert new["capacity"] == 123
        assert new["features"] == ["AC", "TEST_FEATURE"]
        assert new["description"] == "TEST description aula"
        assert new["price"] == 777000

    def test_add_and_remove_addon_persists(self, auth, api):
        data = api.get(f"{BASE_URL}/api/settings").json()
        addons = [a for a in data["addons"] if a["id"] != "eo"]
        addons.append({"id": "test_dekor", "name": "TEST Dekorasi", "price": 250000, "type": "flat", "unit": ""})
        data["addons"] = addons
        r = auth.put(f"{BASE_URL}/api/settings", json={"data": data})
        assert r.status_code == 200
        got = api.get(f"{BASE_URL}/api/settings").json()
        ids = [a["id"] for a in got["addons"]]
        assert "test_dekor" in ids and "eo" not in ids

    def test_whatsapp_admin_persists(self, auth, api):
        data = api.get(f"{BASE_URL}/api/settings").json()
        data["whatsapp_admin"] = "6281234567890"
        assert auth.put(f"{BASE_URL}/api/settings", json={"data": data}).status_code == 200
        assert api.get(f"{BASE_URL}/api/settings").json()["whatsapp_admin"] == "6281234567890"

    def test_restore_defaults(self, auth, api):
        r = auth.post(f"{BASE_URL}/api/settings/reset")
        assert r.status_code == 200
        got = api.get(f"{BASE_URL}/api/settings").json()
        assert {x["id"] for x in got["rooms"]} == {"meeting", "ballroom", "vip", "outdoor"}
        assert {a["id"] for a in got["addons"]} == {"mc", "catering", "pelayan", "eo"}
