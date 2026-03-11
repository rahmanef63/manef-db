# OpenClaw Backend Parity Tasklist

Updated: 2026-03-11

Dokumen ini melacak pekerjaan `manef-db` agar menjadi backend mirror yang
konsisten terhadap runtime OpenClaw, sekaligus melayani `manef-ui`.

Definisi selesai untuk setiap task backend:

1. ada schema/table yang jelas di Convex
2. ada query untuk read
3. ada mutation/action untuk create/update/delete bila feature memang writable
4. ada sync atau mirror dari runtime OpenClaw ke Convex
5. hasil sync terbaca kembali oleh frontend tanpa data dummy

Task belum selesai bila:

- hanya ada schema tanpa sync runtime
- hanya ada query tetapi write path masih mock
- write berhasil ke Convex tetapi tidak pernah muncul di runtime OpenClaw
- runtime berubah tetapi Convex tidak ikut berubah

## Global rules

- [ ] Semua action `refresh*` atau `sync*` untuk feature OpenClaw harus nyata,
  bukan `console.log`.
- [ ] Semua feature operasional harus punya read API, write API, dan mirror path.
- [ ] Semua record yang termirror dari runtime harus punya metadata source:
  `runtime`, `manual`, `seed`, atau `mirror`.
- [ ] Semua mirror job harus idempotent.
- [ ] Semua tabel OpenClaw harus punya strategi reconcile:
  insert, patch, soft delete atau mark stale.

## Navigator model

- [ ] Pertahankan `userProfiles + workspaceTrees + agents` sebagai navigator
  business-facing.
- [ ] Jelaskan mapping resmi antara:
  `contact/user`, `root workspace`, `agent`, `sub-agent`, `channel binding`.
- [ ] Tambahkan source metadata pada `workspaceTrees` agar jelas node ini berasal
  dari onboarding, migration, atau runtime sync.

Definition of done:

- `openclawNavigator:listScopes` mengembalikan tree yang stabil
- admin melihat semua root milik semua user
- non-admin hanya melihat scope miliknya
- setiap node membawa `agentIds` turunan untuk filter frontend

## Agents

Status saat ini:

- schema ada
- query read ada
- create/run masih mock

Tasks:

- [ ] Finalisasi schema `agents` sebagai mirror agent runtime OpenClaw.
- [ ] Simpan metadata penting:
  `agentId`, `name`, `type`, `status`, `owner`, `tenantId`, `config`,
  `agentDir`, `bindings`, `workspace path`, `lastSeenAt`.
- [ ] Tambahkan upsert runtime sync dari OpenClaw official CLI/runtime.
- [ ] Bedakan agent root, specialized agent, dan sub-agent.
- [ ] Pastikan create/update/delete agent punya jalur yang jelas:
  manual admin atau runtime mirror.
- [ ] Hapus random `deployAgent` behavior untuk production path.
- [x] Tambahkan query detail agent dan query children/sub-agents.
  Bukti:
  - `getAgents` sekarang mengembalikan `workspacePath`, `agentDir`,
    `boundChannels`, `sessionCount`, `childCount`, `ownerName`, `model`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/agents/api.ts)
  - commit `3fd3851`
- [ ] Tambahkan table atau metadata untuk parent-child agent relationship bila
  belum cukup diwakili oleh `workspaceTrees`.

Definition of done:

- daftar agent di DB sama dengan daftar agent runtime
- agent baru dari runtime muncul sebagai upsert, bukan insert duplikat
- update metadata agent dari runtime mem-patch record yang sama
- delete atau nonaktif agent ditandai konsisten di DB

## Channel bindings

- [ ] Jadikan binding channel -> agent sebagai data kelas satu, bukan hanya
  bagian dari blob config.
- [ ] Tambahkan read API untuk binding per channel dan per agent.
- [ ] Tambahkan write API untuk relink binding.
- [ ] Tambahkan sync dari runtime OpenClaw bindings ke Convex.

Definition of done:

- setiap channel account bisa ditelusuri ke agent tujuan
- frontend dapat menampilkan binding live tanpa fallback
- perubahan binding termirror dua arah sesuai mode yang dipilih

## Sessions

- [ ] Pertahankan `sessions` sebagai mirror session runtime.
- [ ] Pastikan key canonical mengikuti model runtime yang stabil.
- [ ] Simpan metadata:
  `sessionKey`, `canonicalSessionKey`, `agentId`, `channel`, `userId`,
  `messageCount`, `firstTs`, `lastTs`, `rawUserRef`.
- [ ] Tambahkan sync job resmi dari file/runtime OpenClaw ke Convex.
- [ ] Tambahkan mark stale/archive untuk session yang hilang dari runtime.

Definition of done:

- daftar sessions di DB sama dengan runtime setelah sync
- tidak ada session duplikat untuk key canonical yang sama
- query per scope agent menghasilkan hasil yang benar

## Channels

- [x] Finalisasi schema `channels` sebagai mirror state channel runtime.
  Bukti:
  - bulk mutation `syncRuntimeChannels`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
  - [sync_openclaw_channels_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_channels_to_convex.py)
  - commit current working set 2026-03-11
- [x] Tambahkan metadata account:
  `channelId`, `type`, `label`, `configured`, `running`, `linked`,
  `connected`, `mode`, `lastStartAt`, `lastConnectAt`, `lastError`.
  Bukti:
  - arg/patch `upsertChannel` diperluas
  - `syncRuntimeChannels` menulis metadata status + config mirror
  - [api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
- [x] Tambahkan sync nyata dari Gateway/OpenClaw runtime.
  Bukti:
  - source runtime: `~/.openclaw/openclaw.json`
  - sync script:
    [sync_openclaw_channels_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_channels_to_convex.py)
  - scheduler:
    [manef-openclaw-runtime-sync.service](/home/rahman/projects/manef-db/scripts/systemd/manef-openclaw-runtime-sync.service)
    dan
    [manef-openclaw-runtime-sync.timer](/home/rahman/projects/manef-db/scripts/systemd/manef-openclaw-runtime-sync.timer)
  - hasil sync awal: `upserted=2`, `allowListEntries=18`
- [ ] Upsert channel manual harus tetap konsisten dengan hasil runtime sync.

Definition of done:

- channel list sama dengan runtime setelah refresh
- update channel dari admin terbaca lagi setelah sync
- record tidak kembali ke data lama secara salah

## Nodes and exec approvals

- [x] Finalisasi `nodes`, `execApprovals`, dan `nodeBindings`.
  Bukti:
  - query baru `listNodeBindings`
  - existing live APIs `listNodes`, `getExecApprovals`, `upsertExecApproval`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/nodes/api.ts)
  - commit `a22c153`
- [ ] Tambahkan sync nyata dari runtime node registry.
- [x] Tambahkan query join:
  node + bound agents + exec approval summary.
  Bukti:
  - `listNodeBindings` join `nodeBindings` dengan `nodes`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/nodes/api.ts)
  - commit `a22c153`
- [ ] Pastikan approval changes bersifat read-after-write.

Definition of done:

- node list sama dengan runtime
- approval yang disimpan bisa dibaca ulang langsung
- frontend tidak perlu fallback statis

## Logs

- [x] Finalisasi `gatewayLogs` sebagai snapshot log runtime.
  Bukti:
  - schema menambah `runtimeKey` + index `by_runtimeKey`
  - bulk mutation `syncRuntimeLogs`
  - [schema.ts](/home/rahman/projects/manef-db/convex/features/logs/schema.ts)
  - [api.ts](/home/rahman/projects/manef-db/convex/features/logs/api.ts)
- [x] Tambahkan fetch nyata dari runtime log source.
  Bukti:
  - source runtime: `journalctl --user-unit openclaw-gateway -o json`
  - sync script:
    [sync_openclaw_logs_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_logs_to_convex.py)
  - timer service aktif menjalankan sync berkala
  - hasil sync awal: `upserted=200`
- [ ] Tambahkan filter source/level/time di backend agar frontend tidak perlu
  memfilter besar-besaran.
- [x] Tambahkan filter source/text dasar di backend.
  Bukti:
  - `getRecentLogs` sekarang menerima `source` dan `searchText`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/logs/api.ts)
- [ ] Tentukan retention policy dan cleanup policy.

Definition of done:

- log terbaru dari runtime dapat muncul di Convex
- query log membaca data live/stale-aware, bukan seed/mock
- cleanup tidak menghapus log yang masih dibutuhkan UI

## Skills

- [x] Finalisasi `skills` sebagai mirror registry skill runtime.
  Bukti:
  - bulk mutation `syncRuntimeSkills`
  - sync script:
    [sync_openclaw_skills_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_skills_to_convex.py)
  - hasil sync awal: `upserted=60`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/skills/api.ts)
- [x] Simpan metadata:
  `name`, `source`, `enabled`, `version`, `config`, `updatedAt`.
  Bukti:
  - `syncRuntimeSkills` menulis metadata runtime ke tabel `skills`
  - field `config` menyimpan snapshot runtime terpilih
- [x] Tambahkan refresh nyata dari runtime.
  Bukti:
  - source runtime: `openclaw skills list --json`
  - sync script:
    [sync_openclaw_skills_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_skills_to_convex.py)
  - timer service aktif menjalankan sync berkala
- [ ] Tambahkan toggle enable/disable yang konsisten dengan runtime.
- [x] Tambahkan toggle enable/disable yang konsisten dengan sync berikutnya.
  Bukti:
  - `toggleSkill` menyimpan `config.manualOverrideEnabled`
  - `syncRuntimeSkills` menjaga override tetap hidup sambil menyimpan
    `config.runtimeEnabled`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/skills/api.ts)

Definition of done:

- daftar skill di DB sama dengan runtime setelah sync
- toggle dari UI terbaca lagi dari DB
- sync tidak menduplikasi record skill yang sama

## Config

- [ ] Finalisasi `configEntries` untuk kategori operasional OpenClaw.
- [ ] Tentukan field mana yang benar-benar mirror runtime config.
- [ ] Tambahkan reload/apply config nyata, atau tandai read-only bila belum
  bisa write-through.
- [ ] Tambahkan hash/version metadata untuk mencegah overwrite buta.

Definition of done:

- config yang dibaca UI berasal dari DB live
- perubahan config terbaca lagi dari DB
- bila write-through diaktifkan, runtime ikut berubah

## Crons

- [ ] Finalisasi `cronJobs` dan `cronRuns`.
- [ ] Tambahkan sync job runtime -> DB.
- [ ] Tambahkan mutation untuk enable/disable/edit schedule.
- [ ] Tambahkan action manual trigger yang benar.

Definition of done:

- cron list sama dengan runtime setelah sync
- manual trigger menghasilkan `cronRuns`
- status enable/disable tidak kembali salah setelah refresh

## Usage

- [ ] Tambahkan relasi eksplisit usage -> agent -> session -> scope bila belum
  lengkap.
- [ ] Pastikan aggregation by `agentIds` benar untuk root dan child scope.

Definition of done:

- usage root adalah agregasi seluruh agent turunannya
- usage child hanya menghitung agent child tersebut
- angka dapat ditrace ke `usageRecords`

## Sync and mirror jobs

- [x] Buat daftar resmi semua sync entrypoints:
  agents, sessions, channels, nodes, logs, skills, config, crons.
  Bukti:
  - wrapper:
    [sync_openclaw_runtime_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_runtime_to_convex.py)
  - entrypoint per runtime:
    [sync_openclaw_skills_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_skills_to_convex.py),
    [sync_openclaw_channels_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_channels_to_convex.py),
    [sync_openclaw_logs_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_logs_to_convex.py)
- [ ] Tentukan mana yang pull-based, mana yang webhook-based, mana yang n8n-based.
- [x] Semua sync job harus punya output status:
  `inserted`, `updated`, `unchanged`, `failed`, `stale`.
  Bukti:
  - current scripts output JSON summary per sync job
  - contoh hasil nyata:
    `skills upserted=60`, `channels upserted=2 allowListEntries=18`, `logs upserted=200`
- [ ] Simpan sync audit di tabel khusus bila perlu.

## Feature smoke tests

- [x] Tambahkan smoke test backend untuk fitur dashboard utama.
  Bukti:
  - [smoke_dashboard_features.py](/home/rahman/projects/manef-db/scripts/smoke_dashboard_features.py)
  - script menguji:
    `openclawNavigator`, `agents`, `skills toggle`, `channels`, `logs`,
    `sessions create/delete`, `nodes`
  - package script:
    [package.json](/home/rahman/projects/manef-db/package.json)

Definition of done:

- ada satu command/runbook jelas untuk mirror penuh
- hasil sync dapat diaudit
- frontend tahu apakah data live, stale, atau belum pernah synced

## Release validation

- [x] Jalankan publish functions ke production Convex.
  Bukti:
  - `npm run deploy:ci` berhasil publish ke `https://peaceful-dove-887.convex.cloud`
  - deployment dilakukan setelah commit `3fd3851`
- [ ] Jalankan mirror agents.
- [ ] Jalankan mirror sessions.
- [ ] Jalankan mirror channels.
- [ ] Jalankan mirror nodes.
- [ ] Jalankan mirror logs.
- [ ] Jalankan mirror skills.
- [ ] Verifikasi `openclawNavigator:listScopes`.
- [ ] Verifikasi frontend membaca hasil yang sama tanpa mock.
