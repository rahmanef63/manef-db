# manef-db

Convex backend repo for Manef.

## Current status

- [Deployment status 2026-03-11](./DEPLOYMENT_STATUS_2026-03-11.md)
- [Docs index](./docs/README.md)
- [OpenClaw backend parity tasklist](./docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md)

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
