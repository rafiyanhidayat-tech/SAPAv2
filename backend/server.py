from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import logging
import uuid
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta

# ------------------------------------------------------------------ DB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ------------------------------------------------------------------ Auth helpers
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 15


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token tidak valid")
        admin = await db.admins.find_one({"id": payload["sub"]}, {"_id": 0})
        if not admin or not admin.get("active", True):
            raise HTTPException(status_code=401, detail="Akun tidak ditemukan atau nonaktif")
        admin.pop("password_hash", None)
        return admin
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi kadaluarsa, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


# ------------------------------------------------------------------ Object storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "sapa-panti"
storage_key = None

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ------------------------------------------------------------------ Defaults
DEFAULT_SETTINGS = {
    "id": "app_settings",
    "hero_title": "Sewa Gedung & Ruangan untuk Event Anda",
    "hero_subtitle": "Wujudkan acara istimewa Anda di venue elegan dan mewah milik Panti Sosial Provinsi Kalimantan Utara. Fasilitas premium, harga terbaik.",
    "hero_image": "https://images.pexels.com/photos/12689009/pexels-photo-12689009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "rooms": [
        {"id": "meeting", "name": "Meeting Room", "capacity": 20, "features": ["AC", "Proyektor", "Wi-Fi"], "price": 500000,
         "description": "Ruang meeting nyaman untuk rapat dan diskusi profesional dengan kapasitas hingga 20 orang.",
         "photo": "https://images.unsplash.com/photo-1740933084056-078fac872bff?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjBjb3Jwb3JhdGUlMjBtZWV0aW5nJTIwcm9vbXxlbnwwfHx8fDE3ODc4OTU4MzZ8MA&ixlib=rb-4.1.0&q=85"},
        {"id": "ballroom", "name": "Ballroom", "capacity": 500, "features": ["Panggung", "Sound System", "AC"], "price": 2000000,
         "description": "Ballroom megah untuk resepsi pernikahan, gala dinner, dan acara akbar hingga 500 tamu.",
         "photo": "https://images.pexels.com/photos/12689009/pexels-photo-12689009.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"},
        {"id": "vip", "name": "VIP Room", "capacity": 50, "features": ["Premium", "Private", "Lounge"], "price": 1500000,
         "description": "Ruang VIP eksklusif dengan interior premium dan privasi penuh untuk pertemuan penting.",
         "photo": "https://images.unsplash.com/photo-1756981168649-0e3c3c8a32f3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBWSVAlMjBsb3VuZ2UlMjByb29tfGVufDB8fHx8MTc4Nzg5NTgzNnww&ixlib=rb-4.1.0&q=85"},
        {"id": "outdoor", "name": "Outdoor Venue", "capacity": 300, "features": ["Taman", "Open Air", "Lighting"], "price": 1000000,
         "description": "Venue outdoor asri dengan taman dan suasana open air, sempurna untuk acara sore & malam hari.",
         "photo": "https://images.unsplash.com/photo-1780888207019-dd9121069a81?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxvdXRkb29yJTIwd2VkZGluZyUyMHZlbnVlJTIwZXZlbmluZ3xlbnwwfHx8fDE3ODc4OTU4MzZ8MA&ixlib=rb-4.1.0&q=85"},
    ],
    "addons": [
        {"id": "mc", "name": "MC / Pembawa Acara", "price": 1500000, "type": "flat", "unit": ""},
        {"id": "catering", "name": "Katering", "price": 75000, "type": "per_pax", "unit": "pax"},
        {"id": "pelayan", "name": "Pelayan", "price": 750000, "type": "per_qty_day", "unit": "orang/hari"},
        {"id": "eo", "name": "Jasa Event Organizer", "price": 20000000, "type": "flat", "unit": ""},
    ],
    "qris_image": "",
    "whatsapp_admin": "",
    "payment_info": "Silakan lakukan pembayaran melalui QRIS di atas, lalu unggah bukti pembayaran. Booking Anda berstatus Pending hingga pembayaran diverifikasi admin.",
}

# ------------------------------------------------------------------ App
app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ Models
class LoginInput(BaseModel):
    username: str
    password: str


class AdminCreate(BaseModel):
    name: str
    username: str
    password: str
    active: bool = True


class AdminUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None


class BookingAddon(BaseModel):
    name: str
    qty: int = 1
    unit_price: float = 0
    total: float = 0


class BookingItem(BaseModel):
    room_id: str
    room_name: str
    checkin: str
    checkout: str
    days: int
    base_price: float
    room_total: float
    addons: List[BookingAddon] = []
    addons_total: float = 0
    notes: str = ""
    total: float


class CheckoutInput(BaseModel):
    guest_name: str
    phone: str
    payment_method: str
    items: List[BookingItem]


class StatusUpdate(BaseModel):
    status: str


class PaymentUpdate(BaseModel):
    payment_status: str


class SettingsUpdate(BaseModel):
    data: dict


# ------------------------------------------------------------------ Auth routes
@api_router.post("/auth/login")
async def login(payload: LoginInput):
    admin = await db.admins.find_one({"username": payload.username.strip().lower()})
    if not admin or not verify_password(payload.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not admin.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    token = create_access_token(admin["id"], admin["username"])
    return {
        "token": token,
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
        "admin": {"id": admin["id"], "name": admin["name"], "username": admin["username"]},
    }


@api_router.get("/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin


# ------------------------------------------------------------------ Settings
@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    if not doc:
        await db.settings.insert_one({**DEFAULT_SETTINGS})
        doc = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    return doc


@api_router.put("/settings")
async def update_settings(payload: SettingsUpdate, admin: dict = Depends(get_current_admin)):
    data = payload.data
    data["id"] = "app_settings"
    await db.settings.update_one({"id": "app_settings"}, {"$set": data}, upsert=True)
    return await db.settings.find_one({"id": "app_settings"}, {"_id": 0})


@api_router.post("/settings/reset")
async def reset_settings(admin: dict = Depends(get_current_admin)):
    await db.settings.update_one({"id": "app_settings"}, {"$set": {**DEFAULT_SETTINGS}}, upsert=True)
    return await db.settings.find_one({"id": "app_settings"}, {"_id": 0})


# ------------------------------------------------------------------ Upload
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png").lower()
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, content_type)
    canonical = result["path"]
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": canonical,
        "original_filename": file.filename,
        "content_type": content_type,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": f"/api/files/{canonical}"}


@api_router.get("/files/{path:path}")
async def download(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    ct = record.get("content_type") if record else None
    try:
        data, content_type = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    return Response(content=data, media_type=ct or content_type)


# ------------------------------------------------------------------ Bookings
@api_router.post("/bookings")
async def create_booking(payload: CheckoutInput):
    created = []
    now = datetime.now(timezone.utc).isoformat()
    group_id = str(uuid.uuid4())

    # Intra-payload check: reject overlapping items for the same room within one checkout
    for i in range(len(payload.items)):
        a = payload.items[i]
        for j in range(i + 1, len(payload.items)):
            b = payload.items[j]
            if a.room_id == b.room_id and a.checkin < b.checkout and b.checkin < a.checkout:
                raise HTTPException(
                    status_code=409,
                    detail=f"Tanggal untuk {a.room_name} tumpang tindih di dalam keranjang Anda.",
                )

    # Availability check: reject overlapping bookings for same room (ignore cancelled)
    for item in payload.items:
        if not item.checkin or not item.checkout or item.checkout <= item.checkin:
            raise HTTPException(status_code=400, detail=f"Tanggal check-out harus setelah check-in untuk {item.room_name}")
        clash = await db.bookings.find_one({
            "room_id": item.room_id,
            "status": {"$ne": "cancelled"},
            "checkin": {"$lt": item.checkout},
            "checkout": {"$gt": item.checkin},
        })
        if clash:
            raise HTTPException(
                status_code=409,
                detail=f"{item.room_name} sudah dibooking pada rentang tanggal tersebut. Silakan pilih tanggal lain.",
            )

    for item in payload.items:
        doc = {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "guest_name": payload.guest_name,
            "phone": payload.phone,
            "payment_method": payload.payment_method,
            "room_id": item.room_id,
            "room_name": item.room_name,
            "checkin": item.checkin,
            "checkout": item.checkout,
            "days": item.days,
            "base_price": item.base_price,
            "room_total": item.room_total,
            "addons": [a.model_dump() for a in item.addons],
            "addons_total": item.addons_total,
            "notes": item.notes,
            "total": item.total,
            "status": "pending",
            "payment_status": "unpaid",
            "payment_proof": "",
            "created_at": now,
        }
        await db.bookings.insert_one({**doc})
        created.append(doc)
    return {"count": len(created), "group_id": group_id}


@api_router.get("/availability")
async def availability(room_id: str, checkin: str, checkout: str):
    if not checkin or not checkout or checkout <= checkin:
        return {"available": False, "reason": "Tanggal tidak valid"}
    clash = await db.bookings.find_one({
        "room_id": room_id,
        "status": {"$ne": "cancelled"},
        "checkin": {"$lt": checkout},
        "checkout": {"$gt": checkin},
    })
    return {"available": clash is None}


@api_router.post("/bookings/group/{group_id}/proof")
async def upload_proof(group_id: str, file: UploadFile = File(...)):
    existing = await db.bookings.find_one({"group_id": group_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png").lower()
    if ext not in MIME_TYPES or not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar (jpg, png, webp)")
    content_type = MIME_TYPES.get(ext, "image/png")
    path = f"{APP_NAME}/proofs/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, content_type)
    canonical = result["path"]
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": canonical,
        "original_filename": file.filename,
        "content_type": content_type,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    url = f"/api/files/{canonical}"
    await db.bookings.update_many({"group_id": group_id}, {"$set": {"payment_proof": url}})
    return {"url": url}


@api_router.get("/bookings")
async def list_bookings(admin: dict = Depends(get_current_admin)):
    docs = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api_router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, payload: StatusUpdate, admin: dict = Depends(get_current_admin)):
    valid = ["pending", "confirmed", "done", "cancelled"]
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    res = await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    return {"ok": True}


@api_router.patch("/bookings/{booking_id}/payment")
async def update_payment(booking_id: str, payload: PaymentUpdate, admin: dict = Depends(get_current_admin)):
    if payload.payment_status not in ["unpaid", "paid"]:
        raise HTTPException(status_code=400, detail="Status pembayaran tidak valid")
    res = await db.bookings.update_one({"id": booking_id}, {"$set": {"payment_status": payload.payment_status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    return {"ok": True}


@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, admin: dict = Depends(get_current_admin)):
    res = await db.bookings.delete_one({"id": booking_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    return {"ok": True}


# ------------------------------------------------------------------ Admin management
@api_router.get("/admins")
async def list_admins(admin: dict = Depends(get_current_admin)):
    docs = await db.admins.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(200)
    return docs


@api_router.post("/admins")
async def create_admin(payload: AdminCreate, admin: dict = Depends(get_current_admin)):
    username = payload.username.strip().lower()
    if await db.admins.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "username": username,
        "password_hash": hash_password(payload.password),
        "active": payload.active,
        "is_owner": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admins.insert_one({**doc})
    doc.pop("password_hash")
    return doc


@api_router.put("/admins/{admin_id}")
async def update_admin(admin_id: str, payload: AdminUpdate, admin: dict = Depends(get_current_admin)):
    target = await db.admins.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
    update = {}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.username is not None:
        new_username = payload.username.strip().lower()
        existing = await db.admins.find_one({"username": new_username})
        if existing and existing["id"] != admin_id:
            raise HTTPException(status_code=400, detail="Username sudah digunakan")
        update["username"] = new_username
    if payload.password:
        update["password_hash"] = hash_password(payload.password)
    if payload.active is not None:
        update["active"] = payload.active
    await db.admins.update_one({"id": admin_id}, {"$set": update})
    doc = await db.admins.find_one({"id": admin_id}, {"_id": 0, "password_hash": 0})
    return doc


@api_router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, admin: dict = Depends(get_current_admin)):
    target = await db.admins.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
    if target.get("is_owner"):
        raise HTTPException(status_code=400, detail="Akun owner tidak dapat dihapus")
    if target["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    await db.admins.delete_one({"id": admin_id})
    return {"ok": True}


# ------------------------------------------------------------------ Startup
@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    if await db.settings.find_one({"id": "app_settings"}) is None:
        await db.settings.insert_one({**DEFAULT_SETTINGS})

    admin_username = os.environ.get("ADMIN_USERNAME", "admin").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.admins.find_one({"username": admin_username})
    if existing is None:
        await db.admins.insert_one({
            "id": str(uuid.uuid4()),
            "name": os.environ.get("ADMIN_NAME", "Administrator"),
            "username": admin_username,
            "email": os.environ.get("ADMIN_EMAIL", ""),
            "password_hash": hash_password(admin_password),
            "active": True,
            "is_owner": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Owner admin seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.admins.update_one({"username": admin_username}, {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
