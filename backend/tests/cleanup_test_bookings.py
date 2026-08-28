"""Utility: delete bookings whose guest_name starts with TEST."""
import os
import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
tok = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "admin123"}).json()["token"]
h = {"Authorization": f"Bearer {tok}"}
rows = requests.get(f"{BASE}/api/bookings", headers=h).json()
removed = 0
for b in rows:
    if b["guest_name"].upper().startswith("TEST"):
        requests.delete(f"{BASE}/api/bookings/{b['id']}", headers=h)
        removed += 1
print("removed", removed, "remaining", len(rows) - removed)
