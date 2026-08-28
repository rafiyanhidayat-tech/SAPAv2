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
- ✅ Public landing: hero dinamis, katalog responsif, modal detail dengan date picker, add-on qty, catatan, sticky CTA.
- ✅ Cart slide-over + checkout membuat booking status Pending; QRIS ditampilkan bila di-upload.
- ✅ Admin JWT login (username+password), sesi 15 menit.
- ✅ Admin Dashboard, Settings/CMS, Accounts CRUD.
- ✅ Toast notifications (Sonner) top-right; format Rupiah.

## Iteration 2 (2026-06)
- ✅ Cek ketersediaan: GET /api/availability + tolak double-booking (409) untuk ruangan+tanggal tumpang tindih (termasuk antar-item dalam 1 keranjang). Badge Tersedia/Sudah dibooking di modal.
- ✅ Bukti pembayaran: tamu upload bukti bayar setelah checkout (POST /api/bookings/group/{group_id}/proof, image-only); admin lihat thumbnail & tandai Lunas/Belum (PATCH /api/bookings/{id}/payment).
- ✅ Notifikasi WhatsApp: tombol wa.me di halaman sukses checkout berisi detail booking (nomor admin dari Settings).
- ✅ Katalog dinamis: admin tambah/hapus ruangan & layanan tambahan, edit kapasitas/fasilitas/deskripsi.
- ✅ Dashboard modern: recharts (bar pendapatan per ruangan + donut status), kolom status bayar & bukti.
- ✅ Fix timezone off-by-one pada tanggal (WIB/WITA), teks ketersediaan diperbaiki.
- Tested: backend iter2 21/21 + 33/34 regression; frontend 11/11 flow.

## Iteration 3 (2026-06)
- ✅ Logo resmi Kalimantan Utara (BENUANTA) di header (public/logo-kaltara.png dari Wikimedia).
- ✅ Kalender ketersediaan per ruangan: GET /api/rooms/{id}/booked; tanggal penuh di-disable & merah di date picker + chip "Tanggal penuh".
- ✅ Kwitansi PDF: GET /api/bookings/{id}/receipt (reportlab + logo), hanya Lunas & non-cancelled; tombol unduh di dashboard.
- ✅ Konfirmasi WhatsApp tamu: mark Lunas → wa.me ke nomor tamu (pesan LUNAS); tombol WA per baris paid.
- ✅ Hardening: tolak check-in masa lalu, logo PDF diperkecil (~40KB), unduhan blob diperbaiki.
- Tested: backend iter3 10/10 + full suite 64 passed/1 xfail; frontend 8/8 flow.

## Backlog / Remaining
- Login brute-force lockout, CORS origin eksplisit, Pydantic schema PUT /settings, recompute total server-side, migrasi lifespan, Shadcn AlertDialog pengganti window.confirm, DialogDescription a11y.

## Credentials
Admin owner: username `admin` / password `admin123` (email record: rafiyanhidayat@gmail.com). See /app/memory/test_credentials.md.
