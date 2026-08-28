"""Seed UI test data for iteration-3 frontend testing."""
import json
import sys

import requests
from dotenv import dotenv_values

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
s = requests.Session()
tok = s.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}).json()["token"]
a = requests.Session()
a.headers.update({"Authorization": f"Bearer {tok}"})


def create(room_id, room_name, ci, co, name):
    payload = {"guest_name": name, "phone": "081298765432", "payment_method": "QRIS",
               "items": [{"room_id": room_id, "room_name": room_name, "checkin": ci, "checkout": co,
                          "days": 3, "base_price": 500000, "room_total": 1500000, "addons": [],
                          "addons_total": 0, "notes": "", "total": 1500000}]}
    r = s.post(f"{BASE}/bookings", json=payload)
    assert r.status_code == 200, r.text
    gid = r.json()["group_id"]
    bid = [b["id"] for b in a.get(f"{BASE}/bookings").json() if b["group_id"] == gid][0]
    return bid, gid


if sys.argv[1] == "seed":
    paid_id, paid_gid = create("meeting", "Meeting Room", "2039-03-05", "2039-03-08", "TEST_UI3 Lunas")
    a.patch(f"{BASE}/bookings/{paid_id}/payment", json={"payment_status": "paid"})
    unpaid_id, unpaid_gid = create("meeting", "Meeting Room", "2039-04-05", "2039-04-08", "TEST_UI3 Belum")
    out = {"paid_id": paid_id, "paid_gid": paid_gid, "unpaid_id": unpaid_id, "unpaid_gid": unpaid_gid}
    open("/tmp/ui3_seed.json", "w").write(json.dumps(out))
    print(json.dumps(out))
elif sys.argv[1] == "cleanup":
    rows = a.get(f"{BASE}/bookings").json()
    for b in rows:
        if b["guest_name"].startswith("TEST_"):
            print("delete", b["guest_name"], a.delete(f"{BASE}/bookings/{b['id']}").status_code)
    print("remaining:", [(b["guest_name"], b["room_name"], b["checkin"]) for b in a.get(f"{BASE}/bookings").json()])
elif sys.argv[1] == "list":
    print([(b["guest_name"], b["room_name"], b["checkin"], b["checkout"], b["payment_status"], b["status"]) for b in a.get(f"{BASE}/bookings").json()])
