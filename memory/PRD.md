# PRD — Sistem Sewa Gedung & Ruangan (SAPA - Panti Sosial)

## Original Problem Statement
Full-stack SPA "Sistem Sewa Gedung & Ruangan" untuk Panti Sosial Pemprov Kalimantan Utara. Landing publik + katalog ruangan, modal detail dengan dynamic pricing add-ons, slide-over cart & checkout, admin auth, dan admin panel (Dashboard, Pengaturan/CMS, Akun Admin). Tema luxury dark Slate/Amber, Playfair Display + DM Sans.

## Architecture
- Frontend: React (CRA + craco), Tailwind, Shadcn UI, Sonner, lucide-react, react-router. State via AppContext (settings, cart localStorage, auth token localStorage).
- Backend: FastAPI + Motor (MongoDB). All routes under /api.
- Auth: JWT (PyJWT) + bcrypt, Bearer token in Authorization header, 15-min access token / session expiry.
- Storage: Emergent object storage for image uploads (room photos, hero, QRIS) via EMERGENT_LLM_KEY; served through GET /api/files/{path}.
- Collections: admins, bookings, settings (single app_settings doc), files.

## User Personas
- Tamu/Publik: melihat katalog, memilih ruangan + add-on, checkout booking (status Pending).
- Admin/Owner: kelola booking, ubah konten & harga (CMS), upload QRIS/foto, kelola akun admin.

## Core Requirements (static)
- 4 ruangan (Meeting, Ballroom, VIP, Outdoor) dengan harga base & foto dinamis.
- Add-on: MC (flat), Katering (per pax), Pelayan (per orang/hari), Event Organizer (flat).
- Kalkulasi durasi & total otomatis, format Rupiah.
- Checkout: Nama Tamu, No Telepon, Metode Bayar (QRIS, Bank Transfer, Debit, E-Wallet, Bayar di Tempat).
- Admin: metrics, ruangan populer, breakdown status, tabel booking (ubah status + hapus + CSV), CMS pengaturan, CRUD akun.

## Implemented (2026-06)
- ✅ Public landing: hero dinamis, katalog 4 kolom responsif, modal detail dengan date picker (Shadcn Calendar), add-on qty, catatan, sticky CTA.
- ✅ Cart slide-over + checkout membuat booking status Pending; QRIS ditampilkan bila di-upload.
- ✅ Admin JWT login (username+password), sesi 15 menit.
- ✅ Admin Dashboard: metrics, popular rooms bars, status breakdown, tabel booking (status dropdown realtime, delete, export CSV).
- ✅ Admin Settings/CMS: edit hero, harga ruangan + upload foto, harga add-on, upload QRIS, info pembayaran, save + reset.
- ✅ Admin Accounts: CRUD admin, cegah username ganda, proteksi akun owner.
- ✅ Toast notifications (Sonner) top-right; format Rupiah.
- ✅ Backend validation tanggal checkout > checkin.
- Tested: backend 33/34 pytest, frontend e2e core flows 100%.

## Backlog / Remaining
- P1: Server-side recompute totals from settings (anti price-tampering); Pydantic schema untuk settings.
- P2: Brute-force lockout pada login; migrasi ke lifespan handlers; run_in_threadpool untuk storage I/O; DialogDescription a11y; Shadcn AlertDialog untuk konfirmasi reset/hapus.
- P2: Pembayaran nyata / verifikasi QRIS otomatis (saat ini manual via status Pending).

## Credentials
Admin owner: username `admin` / password `admin123` (email record: rafiyanhidayat@gmail.com). See /app/memory/test_credentials.md.
