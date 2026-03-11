# Docs Index

Updated: 2026-03-11

Dokumen aktif untuk repo ini:

- `docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md`

Dokumen root-level yang masih relevan:

- `DEPLOYMENT_STATUS_2026-03-11.md`

Prinsip utama backend repo ini:

- `manef-db` dianggap selesai untuk suatu feature hanya jika:
  1. CRUD database Convex tersedia
  2. data tersebut bisa termirror dari runtime OpenClaw
  3. perubahan dari UI atau automation bisa terbaca ulang dari DB
  4. data yang tampil di frontend sama dengan source runtime setelah sync
