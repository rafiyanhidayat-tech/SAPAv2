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


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing credentials file")
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
def token(api, test_credentials):
    r = api.post(f"{BASE_URL}/api/auth/login", json=test_credentials)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    t = r.json().get("token")
    assert t
    return t


@pytest.fixture(scope="session")
def auth(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


# ---------------- Settings
class TestSettings:
    def test_get_settings_defaults(self, api):
        r = api.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        d = r.json()
        assert "_id" not in d
        assert isinstance(d["hero_title"], str) and len(d["hero_title"]) > 0
        rooms = d["rooms"]
        assert len(rooms) == 4
        ids = [x["id"] for x in rooms]
        assert set(ids) == {"meeting", "ballroom", "vip", "outdoor"}
        assert {a["id"] for a in d["addons"]} == {"mc", "catering", "pelayan", "eo"}
        assert "qris_image" in d

    def test_update_settings_requires_auth(self, api):
        r = api.put(f"{BASE_URL}/api/settings", json={"data": {"hero_title": "X"}})
        assert r.status_code == 401

    def test_update_and_reset(self, auth, api):
        r = auth.put(f"{BASE_URL}/api/settings", json={"data": {"hero_title": "TEST_HERO"}})
        assert r.status_code == 200
        assert r.json()["hero_title"] == "TEST_HERO"
        assert api.get(f"{BASE_URL}/api/settings").json()["hero_title"] == "TEST_HERO"
        r = auth.post(f"{BASE_URL}/api/settings/reset")
        assert r.status_code == 200
        assert r.json()["hero_title"] != "TEST_HERO"
        assert api.get(f"{BASE_URL}/api/settings").json()["hero_title"] != "TEST_HERO"

    def test_reset_requires_auth(self, api):
        assert api.post(f"{BASE_URL}/api/settings/reset").status_code == 401


# ---------------- Auth
class TestAuth:
    def test_login_success(self, api, test_credentials):
        r = api.post(f"{BASE_URL}/api/auth/login", json=test_credentials)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["token"], str) and d["token"]
        assert d["admin"]["username"] == test_credentials["username"]
        assert d["expires_in"] == 900

    def test_login_invalid(self, api, test_credentials):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": test_credentials["username"], "password": "wrong-pass"})
        assert r.status_code == 401

    def test_login_unknown_user(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "nouser_zzz", "password": "x"})
        assert r.status_code == 401

    def test_me(self, auth, test_credentials):
        r = auth.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == test_credentials["username"]
        assert "password_hash" not in d
        assert d.get("is_owner") is True

    def test_me_no_token(self, api):
        assert api.get(f"{BASE_URL}/api/auth/me").status_code == 401

    def test_me_bad_token(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer abc.def.ghi"})
        assert r.status_code == 401

    def test_bcrypt_hash_format(self):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values as dv
        env = dv("/app/backend/.env")

        async def check():
            c = AsyncIOMotorClient(env["MONGO_URL"])
            doc = await c[env["DB_NAME"]].admins.find_one({"username": "admin"})
            c.close()
            return doc
        doc = asyncio.run(check())
        assert doc is not None
        assert doc["password_hash"].startswith("$2b$"), doc["password_hash"][:6]

    def test_brute_force_lockout(self, api, test_credentials):
        codes = []
        for _ in range(6):
            r = api.post(f"{BASE_URL}/api/auth/login", json={"username": test_credentials["username"], "password": "bad"})
            codes.append(r.status_code)
        # informational: lockout would give 423/429
        assert all(c in (401, 423, 429) for c in codes), codes
        if 429 not in codes and 423 not in codes:
            pytest.xfail(f"No brute-force lockout after 6 failed logins: {codes}")


# ---------------- Bookings
# use far-future unique dates so overlap check (iteration 2) does not clash with seeded data
def booking_payload(name="TEST_Guest", checkin="2031-03-01", checkout="2031-03-03", room_id="ballroom", room_name="Ballroom"):
    return {
        "guest_name": name,
        "phone": "0812345678",
        "payment_method": "QRIS",
        "items": [{
            "room_id": room_id, "room_name": room_name,
            "checkin": checkin, "checkout": checkout, "days": 2,
            "base_price": 2000000, "room_total": 4000000,
            "addons": [{"name": "Katering", "qty": 10, "unit_price": 75000, "total": 750000}],
            "addons_total": 750000, "notes": "TEST note", "total": 4750000,
        }],
    }


class TestBookings:
    created = []

    def test_create_booking_public(self, api, auth):
        r = api.post(f"{BASE_URL}/api/bookings", json=booking_payload())
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["count"] == 1 and d["group_id"]
        lst = auth.get(f"{BASE_URL}/api/bookings")
        assert lst.status_code == 200
        mine = [b for b in lst.json() if b["group_id"] == d["group_id"]]
        assert len(mine) == 1
        b = mine[0]
        TestBookings.created.append(b["id"])
        assert b["status"] == "pending"
        assert b["guest_name"] == "TEST_Guest"
        assert b["total"] == 4750000
        assert b["addons"][0]["qty"] == 10
        assert "_id" not in b

    def test_list_requires_auth(self, api):
        assert api.get(f"{BASE_URL}/api/bookings").status_code == 401

    def test_create_invalid_payload(self, api):
        r = api.post(f"{BASE_URL}/api/bookings", json={"guest_name": "x"})
        assert r.status_code == 422

    def test_status_transitions(self, auth):
        bid = TestBookings.created[0]
        for st in ["confirmed", "done", "cancelled", "pending"]:
            r = auth.patch(f"{BASE_URL}/api/bookings/{bid}", json={"status": st})
            assert r.status_code == 200, r.text[:200]
            got = [b for b in auth.get(f"{BASE_URL}/api/bookings").json() if b["id"] == bid][0]
            assert got["status"] == st

    def test_status_invalid(self, auth):
        r = auth.patch(f"{BASE_URL}/api/bookings/{TestBookings.created[0]}", json={"status": "bogus"})
        assert r.status_code == 400

    def test_status_not_found(self, auth):
        r = auth.patch(f"{BASE_URL}/api/bookings/does-not-exist", json={"status": "done"})
        assert r.status_code == 404

    def test_patch_requires_auth(self, api):
        r = api.patch(f"{BASE_URL}/api/bookings/{TestBookings.created[0]}", json={"status": "done"})
        assert r.status_code == 401

    def test_delete_and_verify(self, auth, api):
        r = api.post(f"{BASE_URL}/api/bookings", json=booking_payload("TEST_DeleteMe", "2031-04-01", "2031-04-03"))
        assert r.status_code == 200, r.text[:300]
        gid = r.json()["group_id"]
        bid = [b for b in auth.get(f"{BASE_URL}/api/bookings").json() if b["group_id"] == gid][0]["id"]
        assert api.delete(f"{BASE_URL}/api/bookings/{bid}").status_code == 401
        assert auth.delete(f"{BASE_URL}/api/bookings/{bid}").status_code == 200
        assert all(b["id"] != bid for b in auth.get(f"{BASE_URL}/api/bookings").json())
        assert auth.delete(f"{BASE_URL}/api/bookings/{bid}").status_code == 404

    def test_cleanup(self, auth):
        for bid in TestBookings.created:
            auth.delete(f"{BASE_URL}/api/bookings/{bid}")
        assert True


# ---------------- Upload
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


class TestUpload:
    def test_upload_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/upload", files={"file": ("t.png", io.BytesIO(PNG), "image/png")})
        assert r.status_code == 401

    def test_upload_and_serve(self, token):
        r = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("TEST_pixel.png", io.BytesIO(PNG), "image/png")},
            timeout=120,
        )
        assert r.status_code == 200, r.text[:300]
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        g = requests.get(f"{BASE_URL}{url}", timeout=60)
        assert g.status_code == 200
        assert g.headers["Content-Type"].startswith("image/")
        assert len(g.content) == len(PNG)

    def test_missing_file_404(self):
        g = requests.get(f"{BASE_URL}/api/files/sapa-panti/uploads/nope-xyz.png", timeout=60)
        assert g.status_code == 404


# ---------------- Admins
class TestAdmins:
    created_id = None

    def test_list_requires_auth(self, api):
        assert api.get(f"{BASE_URL}/api/admins").status_code == 401

    def test_list_admins(self, auth):
        r = auth.get(f"{BASE_URL}/api/admins")
        assert r.status_code == 200
        docs = r.json()
        assert any(a.get("is_owner") for a in docs)
        assert all("password_hash" not in a and "_id" not in a for a in docs)

    def test_create_admin(self, auth):
        r = auth.post(f"{BASE_URL}/api/admins", json={"name": "TEST_Staff", "username": "TEST_staff1", "password": "Secret123!"})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        TestAdmins.created_id = d["id"]
        assert d["username"] == "test_staff1"
        assert d["is_owner"] is False
        assert "password_hash" not in d
        assert any(a["id"] == d["id"] for a in auth.get(f"{BASE_URL}/api/admins").json())

    def test_new_admin_can_login(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "test_staff1", "password": "Secret123!"})
        assert r.status_code == 200

    def test_duplicate_username(self, auth):
        r = auth.post(f"{BASE_URL}/api/admins", json={"name": "TEST_Dup", "username": "test_staff1", "password": "x123456"})
        assert r.status_code == 400

    def test_update_admin(self, auth):
        r = auth.put(f"{BASE_URL}/api/admins/{TestAdmins.created_id}", json={"name": "TEST_Renamed", "active": False})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Renamed"
        got = [a for a in auth.get(f"{BASE_URL}/api/admins").json() if a["id"] == TestAdmins.created_id][0]
        assert got["name"] == "TEST_Renamed" and got["active"] is False

    def test_inactive_admin_login_forbidden(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "test_staff1", "password": "Secret123!"})
        assert r.status_code == 403, r.status_code

    def test_update_not_found(self, auth):
        assert auth.put(f"{BASE_URL}/api/admins/nope", json={"name": "x"}).status_code == 404

    def test_owner_cannot_be_deleted(self, auth):
        owner = [a for a in auth.get(f"{BASE_URL}/api/admins").json() if a.get("is_owner")][0]
        r = auth.delete(f"{BASE_URL}/api/admins/{owner['id']}")
        assert r.status_code == 400

    def test_delete_admin(self, auth, api):
        assert api.delete(f"{BASE_URL}/api/admins/{TestAdmins.created_id}").status_code == 401
        assert auth.delete(f"{BASE_URL}/api/admins/{TestAdmins.created_id}").status_code == 200
        assert all(a["id"] != TestAdmins.created_id for a in auth.get(f"{BASE_URL}/api/admins").json())
        assert auth.delete(f"{BASE_URL}/api/admins/{TestAdmins.created_id}").status_code == 404
