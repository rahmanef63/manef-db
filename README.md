# manef-db

Convex backend repo for Manef.

## Current status

- [Deployment status 2026-03-11](./DEPLOYMENT_STATUS_2026-03-11.md)
- [Docs index](./docs/README.md)
- [Target architecture](./docs/TARGET_ARCHITECTURE.md)
- [OpenClaw backend parity tasklist](./docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md)

Session handoff references:

- backend tasklist:
  [OPENCLAW_BACKEND_PARITY_TASKLIST.md](/home/rahman/projects/manef-db/docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md)
- frontend tasklist:
  [OPENCLAW_FRONTEND_PARITY_TASKLIST.md](/home/rahman/projects/manef-ui/docs/OPENCLAW_FRONTEND_PARITY_TASKLIST.md)
- Superspace repo clone:
  [superspace](/home/rahman/projects/superspace)

## Responsibilities

- Owns `convex/` schema, queries, mutations, actions, and generated API types.
- Exports `@manef/db/api` for typed function references in `manef-ui`.
- Exports `@manef/db/dataModel` for shared Convex types like `Id`.

OpenClaw parity rule:

- sebuah feature backend baru dianggap selesai hanya jika CRUD Convex tersedia
  dan state-nya termirror dengan data runtime OpenClaw

## OpenClaw workspace model

Repo ini sekarang punya dua lapisan model workspace yang perlu dibedakan:

- `workspaces` + `members` + `messages`
  Dipakai oleh layer legacy/ent untuk auth workspace, invites, members, dan
  message board sederhana.
- `userProfiles` + `workspaceTrees` + `workspaceAgents` + `agents` + `agentDelegations`
  Dipakai oleh dashboard OpenClaw untuk contact workspace, agent workspace,
  multi-agent workspace, dan sub-agent hierarchy.

Query utama untuk header navigator OpenClaw ada di:

- [convex/openclawNavigator.ts](./convex/openclawNavigator.ts)

Contract-nya:

- admin melihat seluruh root workspace milik semua `userProfiles`
- non-admin hanya melihat scope miliknya sendiri
- setiap root mengembalikan seluruh child/sub-workspace agent di bawahnya
- setiap node mengembalikan `agentIds` turunan agar frontend bisa memfilter
  halaman seperti `Agents`, `Sessions`, dan `Usage`
- satu workspace boleh memiliki banyak agent lewat tabel `workspaceAgents`
- `workspaceTrees.agentId` dipertahankan sebagai primary/default agent untuk
  kompatibilitas lama, bukan lagi satu-satunya relasi workspace -> agent

Penting:

- perubahan file di bawah `convex/` tidak otomatis hidup hanya dengan redeploy
  container Dokploy
- setelah mengubah schema/query/mutation/action, jalankan `npm run deploy:ci`
  untuk publish functions ke Convex deployment aktif

## OpenClaw runtime sync

Repo ini sekarang punya jalur mirror runtime OpenClaw lokal -> Convex Cloud
untuk beberapa panel yang dipakai `manef-ui`.

Entry points:

- `npm run sync:runtime:agents`
- `npm run sync:runtime:workspaces`
- `npm run sync:runtime:sessions`
- `npm run sync:runtime:config`
- `npm run sync:runtime:crons`
- `npm run sync:runtime:skills`
- `npm run sync:runtime:channels`
- `npm run sync:runtime:logs`
- `npm run sync:runtime`

Source runtime yang aktif saat ini:

- `openclaw skills list --json`
- `~/.openclaw/openclaw.json`
- `~/.openclaw/workspace*`
- `~/.openclaw/cron/jobs.json`
- `journalctl --user-unit openclaw-gateway -o json`

Scheduler VPS:

- service:
  [scripts/systemd/manef-openclaw-runtime-sync.service](./scripts/systemd/manef-openclaw-runtime-sync.service)
- timer:
  [scripts/systemd/manef-openclaw-runtime-sync.timer](./scripts/systemd/manef-openclaw-runtime-sync.timer)

Status parity saat ini:

- `agents`: live registry mirror aktif
- `workspaceFiles`: live workspace document mirror aktif
- `sessions`: live session store mirror aktif
- `configEntries`: live sanitized config mirror aktif
- `cronJobs`: live cron store mirror aktif
- `skills`: live mirror aktif
- `channels`: live config/binding mirror aktif
- `gatewayLogs`: live journal snapshot aktif
- `nodes`: belum full runtime mirror
- `workspaceChannelBindings`: live runtime mirror aktif
- `identityWorkspaceBindings`: live runtime mirror aktif

Workspace runtime note:

- OpenClaw memakai filesystem workspace nyata seperti:
  `~/.openclaw/workspace`, `~/.openclaw/workspace-si-coder`,
  `~/.openclaw/workspace-irul`, dst
- repo ini sekarang memisahkan:
  - `workspaceTrees.rootPath` untuk navigator/business scope
  - `workspaceTrees.runtimePath` untuk path filesystem runtime yang nyata
- dokumen inti workspace agent dimirror ke:
  - tabel `workspaceFiles`
  - subset field agent seperti `soulMd`, `identityMd`, `toolsMd`, `userMd`
- default binding workspace -> agent dimirror ke tabel `workspaceAgents`
- canonical file yang dimirror:
  `AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `MEMORY.md`,
  `HEARTBEAT.md`, `IDENTITY.md`, `BOOTSTRAP.md`

Bridge note:

- untuk arsitektur saat ini, jalur yang paling stabil adalah `local VPS sync ->
  Convex Cloud`
- `n8n` tidak wajib untuk mirror read path
- `n8n` baru masuk akal jika nanti dibutuhkan orchestration atau write-through
  lintas sistem yang lebih kompleks

Write-through note:

- write manual dari dashboard belum menulis file OpenClaw lokal secara langsung
- jalur aman yang sedang dipakai adalah:
  `dashboard mutation -> Convex row update -> syncOutbox event -> worker/webhook lokal`
- `config` dan `crons` sekarang sudah mengeluarkan `syncOutbox` event untuk
  create/update/delete manual
- write manual tersebut juga bisa memakai `expectedUpdatedAt` untuk mencegah
  overwrite buta jika runtime/local file berubah lebih dulu
- langkah berikutnya adalah menyambungkan outbox ini ke worker lokal atau webhook
  `n8n`/Gateway executor

Progress terbaru:

- binding `channel/account -> workspace` sekarang sudah termirror dari runtime
- binding `userIdentity -> workspace` sekarang sudah termirror dari runtime
- `Feature Store` backend sekarang sudah punya:
  - catalog schema
  - daftar feature `manef` yang nyata sebagai store items
  - preview metadata
  - install/uninstall per workspace
  - metadata capability:
    `featureKey`, `route`, `requiredRoles`, `grantedSkillKeys`, `runtimeDomains`
- `skills` sekarang juga berfungsi sebagai `Skills Store` backend:
  - source-aware metadata
  - label publisher:
    `by Rahman`, `by ClawHub`, `by OpenClaw`
  - metadata `trust`, `scope`, `install state`, `homepage`
  - query status store untuk ringkasan inventory
  - query workspace-aware untuk policy grant:
    `listSkills({ workspaceId })`
  - mutation manual grant/revoke:
    `setWorkspaceSkillPolicy`
- `Agent Builder` backend sekarang sudah punya:
  - draft schema per workspace
  - create/update/archive API
  - contract output minimum:
    `requiredFeatureKeys`, `requiredSkillKeys`, linked agents/channels
  - evaluasi capability nyata:
    workspace features, workspace skills, available agents, dan gap skill per agent
  - contract review minimum untuk `custom_code`:
    `language`, `entryFile`, `sourceCode`, `reviewSummary`,
    `reviewChecklist`
  - `customCodeReport` untuk menentukan apakah draft aman ditandai `ready`
- `workspaceTrees` sekarang juga menyimpan `featureKeys`:
  - daftar feature yang terpasang pada workspace tersebut
  - ikut dikembalikan oleh `openclawNavigator`
- RBAC store sekarang lebih ketat:
  - install/uninstall feature dibatasi oleh akses workspace + role admin
  - grant/revoke skill workspace dibatasi oleh akses workspace + role admin
  - draft builder workspace dibatasi oleh akses workspace + role admin
- install feature sekarang juga menurunkan policy capability:
  - `workspaceSkillPolicies`
  - `workspaceAgentSkillPolicies`
  - query ringkasan:
    `getWorkspaceCapabilityPolicy`
- auth admin sekarang juga punya mutation reset password sementara untuk user:
  - dipakai oleh `Admin -> Users` di frontend
- backend auth sekarang mendukung:
  - login `email/phone`
  - registration request
  - forgot-password request
  - temporary password
  - first-login password change

Remaining phase terdekat:

- write-through/publish downstream untuk `Feature Store`
- renderer/publish contract `Agent Builder`:
  `json_blocks`
- sandbox execution/publish contract `Agent Builder`:
  `custom_code`
- hardening RBAC untuk install/uninstall store items

Skills Store note:

- sumber runtime utama tetap `openclaw skills list --json`
- klasifikasi `ClawHub` saat ini `pull-ready`, bukan webhook push
- worker sync lokal memeriksa metadata/lockfile `ClawHub` yang tersedia di host
  dan memetakannya ke source type `clawhub` bila ditemukan

Admin write surface yang sudah siap:

- backend mutation:
  - `attachWorkspaceChannel`
  - `detachWorkspaceChannel`
  - `attachIdentityWorkspace`
  - `detachIdentityWorkspace`
- policy mutation:
  - `setChannelBindingPolicy`
- `manef-ui` sekarang sudah punya panel admin untuk memakai mutation tersebut

Write-through lokal terbaru:

- outbox event untuk binding manual sekarang diproses oleh
  [process_openclaw_outbox.py](/home/rahman/projects/manef-db/scripts/process_openclaw_outbox.py)
- worker ini menulis ke namespace aman `manef.dashboard.*` di file
  `~/.openclaw/openclaw.json`
- sync runtime berikutnya membaca namespace itu kembali dan memirror hasilnya ke
  Convex

## Future product context

Repo ini juga perlu menyiapkan contract backend untuk roadmap berikut:

- `Feature Store`
- `Agent Builder`
- integrasi `Superspace Apps`

Target downstream yang disebut saat ini:

- `https://github.com/zianinn/v0-remix-of-superspace-app-aazian.git`

Catatan:

- repo eksternal di atas belum menjadi source of truth backend
- model data `manef-db` harus tetap netral dan workspace-aware
- integrasi Superspace sebaiknya dilakukan lewat adapter/publish contract, bukan
  dengan meniru struktur repo eksternal secara langsung

Temuan Superspace yang sudah diverifikasi:

- acuan `Feature Store` yang paling relevan adalah `menu-store`
- acuan `Workspace Store` yang paling relevan adalah `workspace-store`
- file referensi penting:
  - [menuItems.ts](/home/rahman/projects/superspace/convex/features/menus/menuItems.ts)
  - [menu_manifest_data.ts](/home/rahman/projects/superspace/convex/features/menus/menu_manifest_data.ts)
  - [optional_features_catalog.ts](/home/rahman/projects/superspace/convex/features/menus/optional_features_catalog.ts)
  - [MenuStorePage.tsx](/home/rahman/projects/superspace/frontend/features/menus/MenuStorePage.tsx)
  - [WorkspaceStorePage.tsx](/home/rahman/projects/superspace/frontend/features/workspace-store/WorkspaceStorePage.tsx)

Kesimpulan implementasi:

- `Feature Store` `manef-db` nanti harus menyediakan catalog/install contract
  per workspace
- `Workspace Store` tetap dipisahkan dari `Feature Store`
- `Agent Builder` menjadi item store khusus dengan dua mode:
  `json_blocks` dan `custom_code`
- semua itu tetap harus mengikuti boundary:
  `workspace`, `sub-workspace`, `agents`, `channels`, dan mirror runtime OpenClaw

Sessions volume note:

- `sessions` saat ini disimpan sebagai metadata mirror, bukan full transcript JSONL
- ini sengaja dilakukan agar biaya write/read Convex tetap terkendali
- jika UI butuh isi transcript penuh, jalur yang benar adalah fetch on-demand
  dari executor lokal, bukan mirror seluruh JSONL ke Convex secara terus-menerus

## Local development

1. Run `npm install` in this repo.
2. Configure Convex envs and deployment as needed.
3. Start the backend with `npm run dev`.

## Convex release

Container deploy in Dokploy does not publish Convex functions automatically.
If you change files under `convex/`, you still need to run a Convex release step:

```bash
npm run deploy
```

For non-interactive environments or CI:

```bash
npm run deploy:ci
```

That maps to `convex deploy -y`.

## Docker proxy for `dbgg.rahmanef.com`

This repo also includes a lightweight Nginx container to front the hosted
Convex deployment on a dedicated domain such as `dbgg.rahmanef.com`.

Use it when:

- `manef-db` lives in a separate repo/deployment target
- you want a dedicated backend domain now
- the actual runtime still lives on Convex hosted infrastructure

Required environment variables:

- `PUBLIC_DB_DOMAIN=dbgg.rahmanef.com`
- `UPSTREAM_CONVEX_URL=https://<your-convex-deployment>.convex.cloud`

Dokploy domain/router port note (critical):

- Container ini (sesuai `Dockerfile`) expose Nginx di **port 8080**.
- Jika Dokploy `Domains -> Container Port` diarahkan ke port yang salah (mis. `3000`), hasilnya akan `502 Bad Gateway`.
- Jika app dibuat di Dokploy dengan mode `Dockerfile`, router aktif datang dari
  konfigurasi `Domains` Dokploy. Label Traefik di `docker-compose.yml` tidak
  dipakai pada mode ini.
- Untuk image lama/standar Nginx yang listen `80`, gunakan `80`.
- Intinya: samakan `Container Port` Dokploy dengan port yang benar-benar listen di container aktif.

HTTPS upstream note (critical):

- Untuk `UPSTREAM_CONVEX_URL=https://...convex.cloud`, proxy harus mengirim SNI
  dan `Host` sesuai host upstream Convex.
- Jika host Docker tidak punya jalur IPv6, pakai resolver Docker dengan
  `ipv6=off` supaya Nginx tidak spam log `connect() to [2606:4700::...] failed`
  sebelum fallback ke IPv4.
- Jika image yang aktif belum membawa fix itu, container bisa sehat tetapi semua
  request runtime ke upstream gagal dengan TLS handshake error dan user melihat
  `502`.

Run locally:

```bash
docker compose up --build
```

Health check:

```bash
curl http://localhost:8080/healthz
```

Important:

- This container is a reverse proxy, not a self-hosted Convex database.
- If you use Convex Pro custom domains, that is the cleaner final setup. In that
  case `dbgg.rahmanef.com` should be configured directly in Convex, and this
  proxy can be removed.

Frontend note:

- `manef-ui` should use `NEXT_PUBLIC_CONVEX_URL=https://dbgg.rahmanef.com`
  once this domain is active.

Current audit result:

- `dbgg.rahmanef.com` resolves
- TLS chain is currently untrusted from local machine
- Pada Dokploy mode `Dockerfile`, pastikan `Domains -> Container Port` diarahkan
  ke `8080`, bukan `80`
- Jika route sudah masuk ke container tetapi upstream masih gagal, cek log Nginx
  untuk error TLS handshake ke `*.convex.cloud`

`docker-compose.yml` tetap berguna jika Anda benar-benar deploy repo ini sebagai
Compose app. Untuk app Dokploy mode `Dockerfile`, source of truth routing ada di
UI Dokploy, bukan di file compose repo.

## Self-hosted Convex option

If you want to stop using Convex Cloud entirely, use the self-hosted stack in:

- `docker-compose.selfhost.yml`
- `.env.selfhost.example`
- `SELF_HOSTED_DOKPLOY.md`

This follows the official Convex self-hosting layout:

- backend/API on `3210`
- site proxy / HTTP actions on `3211`
- dashboard on `6791`

Recommended public domains:

- `dbgg.rahmanef.com`
- `dbggsite.rahmanef.com`
- `dbggdash.rahmanef.com`

## Dokploy troubleshooting

If Dokploy shows:

```text
Initializing deployment
Error: Github Provider not found
```

that is a Dokploy source-provider problem, not a repo build problem.

Check:

1. Dokploy GitHub provider exists and is active.
2. The provider can access `rahmanef63/manef-db`.
3. The app is linked to the correct provider and repo.
4. Recreate the Dokploy app if it was created before the provider was fixed.

## Temporary local linking

`manef-ui` currently depends on this repo via `file:../manef-db`.

That keeps the repos separate while both are checked out side-by-side locally.
When you publish this package to a registry or switch to a git dependency, update
`manef-ui/package.json` accordingly.
