# Docs Index

Updated: 2026-03-12

Dokumen aktif untuk repo ini:

- `docs/TARGET_ARCHITECTURE.md`
- `docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md`

Dokumen root-level yang masih relevan:

- `DEPLOYMENT_STATUS_2026-03-11.md`

Prinsip utama backend repo ini:

- `manef-db` dianggap selesai untuk suatu feature hanya jika:
  1. CRUD database Convex tersedia
  2. data tersebut bisa termirror dari runtime OpenClaw
  3. perubahan dari UI atau automation bisa terbaca ulang dari DB
  4. data yang tampil di frontend sama dengan source runtime setelah sync

Dokumen baru yang harus dipakai sebelum lanjut `Feature Store`:

- [TARGET_ARCHITECTURE.md](/home/rahman/projects/manef-db/docs/TARGET_ARCHITECTURE.md)

Dokumen ini menetapkan boundary:

- `Superspace` = acuan product shell
- `OpenClaw` = runtime SSOT
- `manef-db` = integration backend

Progress terbaru yang sudah hidup:

- runtime mirror `agents`, `sessions`, `config`, `crons`, `skills`, `channels`, `logs`
- binding `channel/account -> workspace` dan `identity -> workspace`
- `Feature Store` backend:
  - `featureStoreItems`
  - `featureStorePreviews`
  - `workspaceFeatureInstalls`

Remaining phase terdekat:

1. Hardening RBAC install/uninstall `Feature Store`.
2. `Agent Builder` backend contract.
3. Publish/downstream adapter ke `Superspace`.
