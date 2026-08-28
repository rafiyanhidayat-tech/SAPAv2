"""Iteration 3 backend tests: /rooms/{id}/booked, /bookings/{id}/receipt (PDF), payment->receipt e2e."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base_url.rstrip("/") + "/api"

ROOM = "outdoor"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(client):
    r = client.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    t = r.json().get("token")
    assert t
    return t


@pytest.fixture(scope="module")
def auth(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def created(auth):
    ids = []
    yield ids
    for bid in ids:
        auth.delete(f"{BASE}/bookings/{bid}")


def make_booking(client, room_id, ci, co, name="TEST_I3 Guest"):
    payload = {
        "guest_name": name,
        "phone": "081234567890",
        "payment_method": "QRIS",
        "items": [{
            "room_id": room_id, "room_name": room_id.upper(),
            "checkin": ci, "checkout": co, "days": 2,
            "base_price": 500000, "room_total": 1000000,
            "addons": [], "addons_total": 0, "notes": "", "total": 1000000,
        }],
    }
    return client.post(f"{BASE}/bookings", json=payload)


def booking_ids_for_group(auth, group_id):
    rows = auth.get(f"{BASE}/bookings").json()
    return [b["id"] for b in rows if b.get("group_id") == group_id]


# ---------- GET /rooms/{id}/booked ----------
class TestBookedRanges:
    def test_booked_shape_and_public(self, client):
        r = client.get(f"{BASE}/rooms/{ROOM}/booked")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for d in data:
            assert set(d.keys()) == {"checkin", "checkout"}
            assert isinstance(d["checkin"], str)

    def test_unknown_room_returns_empty(self, client):
        r = client.get(f"{BASE}/rooms/no-such-room-{uuid.uuid4().hex[:6]}/booked")
        assert r.status_code == 200
        assert r.json() == []

    def test_booked_includes_new_range_and_availability_false(self, client, auth, created):
        ci, co = "2041-03-10", "2041-03-12"
        r = make_booking(client, ROOM, ci, co)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("count") == 1 and body.get("group_id")
        ids = booking_ids_for_group(auth, body["group_id"])
        assert len(ids) == 1
        created.extend(ids)

        booked = client.get(f"{BASE}/rooms/{ROOM}/booked").json()
        assert {"checkin": ci, "checkout": co} in booked

        av = client.get(f"{BASE}/availability", params={"room_id": ROOM, "checkin": "2041-03-11", "checkout": "2041-03-13"})
        assert av.status_code == 200
        assert av.json()["available"] is False

        av2 = client.get(f"{BASE}/availability", params={"room_id": ROOM, "checkin": "2041-04-01", "checkout": "2041-04-03"})
        assert av2.json()["available"] is True

        # other room unaffected
        other = client.get(f"{BASE}/rooms/vip/booked").json()
        assert {"checkin": ci, "checkout": co} not in other

    def test_cancelled_booking_excluded_from_booked(self, client, auth, created):
        ci, co = "2041-05-10", "2041-05-12"
        r = make_booking(client, ROOM, ci, co, "TEST_I3 Cancel")
        assert r.status_code == 200
        bid = booking_ids_for_group(auth, r.json()["group_id"])[0]
        created.append(bid)
        assert {"checkin": ci, "checkout": co} in client.get(f"{BASE}/rooms/{ROOM}/booked").json()
        assert auth.patch(f"{BASE}/bookings/{bid}", json={"status": "cancelled"}).status_code == 200
        assert {"checkin": ci, "checkout": co} not in client.get(f"{BASE}/rooms/{ROOM}/booked").json()


# ---------- GET /bookings/{id}/receipt ----------
class TestReceipt:
    def test_receipt_requires_auth(self, client, auth, created):
        r = make_booking(client, "meeting", "2041-06-10", "2041-06-12", "TEST_I3 Auth")
        assert r.status_code == 200
        bid = booking_ids_for_group(auth, r.json()["group_id"])[0]
        created.append(bid)
        resp = client.get(f"{BASE}/bookings/{bid}/receipt")
        assert resp.status_code in (401, 403), resp.status_code

    def test_receipt_400_when_unpaid(self, client, auth, created):
        r = make_booking(client, "meeting", "2041-07-10", "2041-07-12", "TEST_I3 Unpaid")
        assert r.status_code == 200, r.text
        bid = booking_ids_for_group(auth, r.json()["group_id"])[0]
        created.append(bid)
        resp = auth.get(f"{BASE}/bookings/{bid}/receipt")
        assert resp.status_code == 400, resp.text
        assert "Lunas" in resp.json().get("detail", "")

    def test_receipt_404_unknown_id(self, auth):
        resp = auth.get(f"{BASE}/bookings/{uuid.uuid4()}/receipt")
        assert resp.status_code == 404

    def test_payment_paid_then_receipt_pdf(self, client, auth, created):
        r = make_booking(client, "ballroom", "2041-08-10", "2041-08-12", "TEST_I3 Paid")
        assert r.status_code == 200, r.text
        bid = booking_ids_for_group(auth, r.json()["group_id"])[0]
        created.append(bid)

        # unpaid by default
        blist = auth.get(f"{BASE}/bookings").json()
        target = next(b for b in blist if b["id"] == bid)
        assert target["payment_status"] == "unpaid"

        p = auth.patch(f"{BASE}/bookings/{bid}/payment", json={"payment_status": "paid"})
        assert p.status_code == 200, p.text

        blist = auth.get(f"{BASE}/bookings").json()
        target = next(b for b in blist if b["id"] == bid)
        assert target["payment_status"] == "paid"

        resp = auth.get(f"{BASE}/bookings/{bid}/receipt")
        assert resp.status_code == 200, resp.text[:300]
        assert resp.headers["content-type"].startswith("application/pdf")
        assert resp.content[:4] == b"%PDF"
        assert len(resp.content) > 1500
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd and ".pdf" in cd

        # revert to unpaid -> receipt blocked again
        assert auth.patch(f"{BASE}/bookings/{bid}/payment", json={"payment_status": "unpaid"}).status_code == 200
        assert auth.get(f"{BASE}/bookings/{bid}/receipt").status_code == 400

    def test_payment_invalid_status(self, client, auth, created):
        r = make_booking(client, "vip", "2041-09-10", "2041-09-12", "TEST_I3 Bad")
        assert r.status_code == 200, r.text
        bid = booking_ids_for_group(auth, r.json()["group_id"])[0]
        created.append(bid)
        assert auth.patch(f"{BASE}/bookings/{bid}/payment", json={"payment_status": "half"}).status_code == 400


# ---------- static logo asset ----------
def test_logo_asset_served(client):
    r = client.get(base_url.rstrip("/") + "/logo-kaltara.png")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")
    assert len(r.content) > 1000
