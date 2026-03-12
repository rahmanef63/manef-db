# OpenClaw Backend Parity Tasklist

Updated: 2026-03-12

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

Session handoff references:

- backend repo aktif:
  [manef-db](/home/rahman/projects/manef-db)
- frontend repo aktif:
  [manef-ui](/home/rahman/projects/manef-ui)
- repo acuan feature store:
  [superspace](/home/rahman/projects/superspace)
- backend menu store acuan:
  [menuItems.ts](/home/rahman/projects/superspace/convex/features/menus/menuItems.ts)
- frontend menu store acuan:
  [MenuStorePage.tsx](/home/rahman/projects/superspace/frontend/features/menus/MenuStorePage.tsx)

## Global rules

- [ ] Semua action `refresh*` atau `sync*` untuk feature OpenClaw harus nyata,
  bukan `console.log`.
- [ ] Semua feature operasional harus punya read API, write API, dan mirror path.
- [ ] Semua record yang termirror dari runtime harus punya metadata source:
  `runtime`, `manual`, `seed`, atau `mirror`.
- [ ] Semua mirror job harus idempotent.
- [ ] Semua tabel OpenClaw harus punya strategi reconcile:
  insert, patch, soft delete atau mark stale.

## Future context: Feature Store and Superspace

Konteks ini belum selesai dan belum menjadi contract backend resmi, tetapi harus
diakomodasi mulai sekarang agar model data tidak buntu saat integrasi app
builder dimulai.

- [x] Tambahkan model backend untuk `feature store items`.
  Bukti:
  - schema:
    [schema.ts](/home/rahman/projects/manef-db/convex/features/featureStore/schema.ts)
  - seed catalog:
    [catalog.ts](/home/rahman/projects/manef-db/convex/features/featureStore/catalog.ts)
  - API:
    [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [x] Bedakan item store:
  `workspace-app`, `agent-builder`, `shared-block-set`, `template`, `external app`.
  Bukti:
  - katalog sekarang juga memuat `dashboard-feature` untuk feature `manef` yang nyata
  - field item:
    `featureKey`, `route`, `requiredRoles`, `grantedSkillKeys`, `runtimeDomains`
    di [schema.ts](/home/rahman/projects/manef-db/convex/features/featureStore/schema.ts)
- [x] `Agent Builder` sekarang menyimpan draft untuk dua mode source:
  `json_blocks` dan `custom_code`.
-  Bukti:
  - schema draft:
    `agentBuilderDrafts` di
    [schema.ts](/home/rahman/projects/manef-db/convex/features/featureStore/schema.ts)
  - API:
    `listAgentBuilderDrafts`, `createAgentBuilderDraft`,
    `updateAgentBuilderDraft`, `archiveAgentBuilderDraft`
    di [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [ ] `json_blocks` harus bisa dirender ulang dari schema/metadata backend tanpa
  kehilangan struktur block.
- [x] `custom_code` sekarang punya contract review/safety minimum, tidak lagi
  hanya blob string.
  Bukti:
  - `listAgentBuilderDrafts` sekarang mengembalikan `customCodeReport`
  - `updateAgentBuilderDraft` menolak status `ready` jika review belum lengkap
  - review minimum meliputi:
    `scopeReviewed`, `secretSafe`, `networkReviewed`,
    `runtimeWriteReviewed`
  - file:
    [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [x] Setiap store item harus punya scope:
  `workspace`, `tenant`, `global`.
- [x] Setiap store item harus bisa dikaitkan ke satu atau banyak workspace.
  Bukti:
  - install table:
    `workspaceFeatureInstalls`
  - mutation:
    `installFeatureStoreItem`, `uninstallFeatureStoreItem`
    di [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [x] Setiap workspace sekarang menyimpan array `featureKeys` yang dimiliki.
  Bukti:
  - schema:
    [workspace/schema.ts](/home/rahman/projects/manef-db/convex/features/workspace/schema.ts)
  - install/uninstall feature sekarang menyinkronkan `workspaceTrees.featureKeys`
  - file:
    [featureStore/api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [x] Install feature sekarang menurunkan `grantedSkillKeys` menjadi policy nyata
  `workspace -> skills` dan `workspace -> agents -> skills`.
  Bukti:
  - tabel baru:
    `workspaceSkillPolicies`, `workspaceAgentSkillPolicies`
  - sinkronisasi turunan:
    `syncWorkspaceCapabilityPolicies`
  - query policy:
    `getWorkspaceCapabilityPolicy`
  - file:
    [schema.ts](/home/rahman/projects/manef-db/convex/features/featureStore/schema.ts)
    [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [x] `Agent Builder` draft sekarang menyimpan kontrak output policy minimum:
  workspace target, linked agents/channels, required feature keys, required skill keys.
  Bukti:
  - field baru:
    `requiredFeatureKeys`, `requiredSkillKeys`
  - file:
    [schema.ts](/home/rahman/projects/manef-db/convex/features/featureStore/schema.ts)
    [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [x] `Agent Builder` draft sekarang punya evaluasi capability nyata terhadap
  workspace dan agent target.
  Bukti:
  - helper snapshot:
    `buildWorkspaceCapabilitySnapshot`
  - evaluator draft:
    `buildDraftCapabilityReport`
  - query draft sekarang mengembalikan `capabilityReport`
  - status `ready` sekarang ditolak backend jika capability belum terpenuhi
  - file:
    [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
- [ ] Backend harus siap menyimpan metadata target integrasi `Superspace`.

Konteks integrasi eksternal:

- target repo saat ini:
  `https://github.com/zianinn/v0-remix-of-superspace-app-aazian.git`
- status:
  - repo ini disebut sebagai target downstream
  - isi internals repo belum diverifikasi langsung oleh tasklist backend ini
- implikasi arsitektur:
  - jangan jadikan struktur repo eksternal itu sebagai SSOT backend
  - siapkan adapter/backend contract agar `Feature Store` bisa publish atau
    sinkron ke target eksternal tersebut nanti

Definition of done:

- ada schema/table/contract jelas untuk store items
- item bisa dibaca per workspace dan per visibility scope
- output builder bisa dipublish ke target eksternal tanpa mengubah model inti

## Superspace findings

Temuan yang sudah diverifikasi dari repo
[superspace](/home/rahman/projects/superspace):

- `workspace-store` di Superspace bukan feature installer; dia adalah manager
  hierarchy workspace
- `menu-store` adalah pola yang lebih dekat ke `Feature Store`:
  catalog, preview, install, visibility, permission
- SSOT feature di Superspace berasal dari `config.ts` per feature, lalu
  digenerate menjadi:
  - manifest default/system
  - optional catalog

Bukti file:

- backend manifest:
  [menu_manifest_data.ts](/home/rahman/projects/superspace/convex/features/menus/menu_manifest_data.ts)
- backend optional catalog:
  [optional_features_catalog.ts](/home/rahman/projects/superspace/convex/features/menus/optional_features_catalog.ts)
- backend installer/manage:
  [menuItems.ts](/home/rahman/projects/superspace/convex/features/menus/menuItems.ts)
- frontend store UI:
  [MenuStorePage.tsx](/home/rahman/projects/superspace/frontend/features/menus/MenuStorePage.tsx)
- frontend workspace hierarchy:
  [WorkspaceStorePage.tsx](/home/rahman/projects/superspace/frontend/features/workspace-store/WorkspaceStorePage.tsx)

Implikasi untuk `manef-db`:

- `Feature Store` backend harus menyediakan:
  - catalog query
  - preview metadata query
  - install/uninstall per workspace
  - scope metadata:
    `workspace-local`, `workspace-shared`, `general/shared`
- `Workspace Store` backend tetap dipisah dari `Feature Store`
- `Agent Builder` harus ditambahkan sebagai item store khusus, bukan disamakan
  dengan menu installer biasa
- model backend `manef` tidak boleh meniru Superspace mentah-mentah; dia tetap
  harus `workspace + agent + runtime OpenClaw aware`

Progress terbaru untuk `Feature Store`:

- [x] Query katalog store live:
  `listFeatureStoreItems`
- [x] Preview metadata backend:
  `featureStorePreviews`
- [x] Seed katalog backend:
  `seedFeatureStoreCatalog`
- [x] Install/uninstall item per workspace:
  `workspaceFeatureInstalls`
- [x] Draft `Agent Builder` per workspace:
  `agentBuilderDrafts`
- [x] Katalog sekarang disejajarkan dengan feature `manef` yang nyata:
  `overview`, `chat-session`, `inbox`, `agents`, `channels`, `sessions`,
  `usage`, `crons`, `skills`, `nodes`, `config`, `debug`, `logs`,
  `users`, `roles`, `audit`, `feature-store`
- [x] RBAC backend untuk install/uninstall dan draft builder sudah diperketat
  berdasarkan akses workspace + role admin.
  Bukti:
  - guard `requireViewerContext` dan `assertWorkspaceAccess` di
    [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
  - guard `requireViewerContext` dan `assertWorkspaceAccess` di
    [api.ts](/home/rahman/projects/manef-db/convex/features/skills/api.ts)
  - `seedFeatureStoreCatalog`, `installFeatureStoreItem`,
    `uninstallFeatureStoreItem`, `createAgentBuilderDraft`,
    `updateAgentBuilderDraft`, `archiveAgentBuilderDraft`,
    `setWorkspaceSkillPolicy` sekarang menolak caller non-admin
    untuk workspace target.
- [x] Install feature sekarang otomatis menghasilkan policy skill
  agent/workspace.
- [ ] Publish/write-through ke downstream `Superspace` belum ada
- [ ] Renderer `json_blocks` belum ada
- [x] Sandbox/review contract minimum untuk `custom_code` sudah ada
  di backend.
  Bukti:
  - helper evaluator custom code review di:
    [api.ts](/home/rahman/projects/manef-db/convex/features/featureStore/api.ts)
  - report yang dikembalikan:
    `customCodeReport`
  - status `ready` ditolak jika source kosong, entry file kosong,
    review summary kosong, atau checklist review belum lengkap
- [ ] Sandbox execution/publish contract `custom_code` ke downstream runtime/app
  belum ada

## Auth portal extensions

- [x] Tambahkan antrean `password reset request` terpisah dari registrasi.
  Bukti:
  - schema:
    `authPasswordResetRequests`
    di [schema.ts](/home/rahman/projects/manef-db/convex/features/auth/schema.ts)
  - mutation/query:
    `submitPasswordResetRequest`,
    `listPasswordResetRequests`,
    `approvePasswordResetRequest`,
    `denyPasswordResetRequest`
    di [api.ts](/home/rahman/projects/manef-db/convex/features/auth/api.ts)

## Navigator model

- [x] Pertahankan `userProfiles + workspaceTrees + workspaceAgents + agents`
  sebagai navigator
  business-facing.
- [ ] Jelaskan mapping resmi antara:
  `contact/user`, `root workspace`, `agent`, `sub-agent`, `channel binding`.
- [ ] Tambahkan source metadata pada `workspaceTrees` agar jelas node ini berasal
  dari onboarding, migration, atau runtime sync.
- [x] Bedakan navigator path dari runtime filesystem path.
  Bukti:
  - `workspaceTrees` sekarang punya `runtimePath` dan `source`
  - onboarding/migration/manual insert menandai `source`
  - runtime mirror patch hanya mengisi `runtimePath` pada tree existing, tanpa
    memaksa `rootPath` synthetic ikut berubah
  - [schema.ts](/home/rahman/projects/manef-db/convex/features/workspace/schema.ts)
  - [api.ts](/home/rahman/projects/manef-db/convex/features/workspace/api.ts)
  - [onboarding.ts](/home/rahman/projects/manef-db/convex/onboarding.ts)
  - [migrations.ts](/home/rahman/projects/manef-db/convex/migrations.ts)
  - [agentOps.ts](/home/rahman/projects/manef-db/convex/agentOps.ts)
- [x] Navigator sekarang juga mengembalikan `featureKeys` per root/child workspace.
  Bukti:
  - [openclawNavigator.ts](/home/rahman/projects/manef-db/convex/openclawNavigator.ts)

Definition of done:

- `openclawNavigator:listScopes` mengembalikan tree yang stabil
- admin melihat semua root milik semua user
- non-admin hanya melihat scope miliknya
- setiap node membawa `agentIds` turunan untuk filter frontend

## Workspace <-> agents

- [x] Tambahkan relasi many-to-many `workspaceAgents`.
  Bukti:
  - schema baru:
    [workspace/schema.ts](/home/rahman/projects/manef-db/convex/features/workspace/schema.ts)
  - field:
    `workspaceId`, `agentId`, `relation`, `isPrimary`, `inheritToChildren`,
    `source`
  - index:
    `by_workspace`, `by_agent`, `by_workspace_agent`
- [x] Jadikan `workspaceTrees.agentId` hanya sebagai primary/default agent
  compatibility field.
  Bukti:
  - navigator sekarang menghitung `agentIds` dari `workspaceAgents` terlebih dulu
  - fallback ke `workspaceTrees.agentId` hanya bila relation row belum ada
  - [openclawNavigator.ts](/home/rahman/projects/manef-db/convex/openclawNavigator.ts)
- [x] Setiap agent runtime punya default workspace binding.
  Bukti:
  - runtime workspace sync menulis `bindingsUpserted=16`
  - source:
    [sync_openclaw_workspaces_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_workspaces_to_convex.py)
  - bulk mutation:
    [workspace/api.ts](/home/rahman/projects/manef-db/convex/features/workspace/api.ts)
- [x] Onboarding/manual create juga membuat binding workspace-agent.
  Bukti:
  - [onboarding.ts](/home/rahman/projects/manef-db/convex/onboarding.ts)
  - [migrations.ts](/home/rahman/projects/manef-db/convex/migrations.ts)
  - [agentOps.ts](/home/rahman/projects/manef-db/convex/agentOps.ts)
- [x] Tambahkan API attach/detach agent ke workspace.
  Bukti:
  - `attachWorkspaceAgent`
  - `detachWorkspaceAgent`
  - `listWorkspaceAgents`
  - [workspace/api.ts](/home/rahman/projects/manef-db/convex/features/workspace/api.ts)

Definition of done:

- satu workspace bisa punya multiple agents
- setiap agent punya primary workspace default
- child workspace bisa punya agent sendiri tanpa kehilangan parent tree
- frontend bisa tetap memakai `selectedScope.agentIds`

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
- [x] Tambahkan upsert runtime sync dari OpenClaw official CLI/runtime.
  Bukti:
  - bulk mutation `syncRuntimeAgents`
  - script:
    [sync_openclaw_agents_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_agents_to_convex.py)
  - wrapper runtime:
    [sync_openclaw_runtime_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_runtime_to_convex.py)
  - hasil sync nyata: `upserted=16`
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
- [x] Mirror dokumen inti workspace agent ke DB.
  Bukti:
  - script:
    [sync_openclaw_workspaces_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_workspaces_to_convex.py)
  - script membaca canonical docs:
    `AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `MEMORY.md`,
    `HEARTBEAT.md`, `IDENTITY.md`, `BOOTSTRAP.md`
    dengan fallback lowercase jika ada
  - hasil sync nyata:
    `workspace files upserted=104`, `trees upserted=16`
  - `syncRuntimeAgents` sekarang menerima patch dokumen inti dan
    `workspacePath/agentDir`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/agents/api.ts)

Definition of done:

- daftar agent di DB sama dengan daftar agent runtime
- agent baru dari runtime muncul sebagai upsert, bukan insert duplikat
- update metadata agent dari runtime mem-patch record yang sama
- delete atau nonaktif agent ditandai konsisten di DB

## Channel bindings

- [ ] Jadikan binding channel -> agent sebagai data kelas satu, bukan hanya
  bagian dari blob config.
- [x] Tambahkan binding `channel/account -> workspace`.
  Bukti:
  - schema baru:
    `workspaceChannelBindings` di
    [channels/schema.ts](/home/rahman/projects/manef-db/convex/features/channels/schema.ts)
  - sync runtime menerima `workspaceBindings` dan resolve `agentId -> workspace`
    di [channels/api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
  - script runtime mengirim payload binding dari `openclaw.json bindings` di
    [sync_openclaw_channels_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_channels_to_convex.py)
- [x] Tambahkan binding `userIdentity -> workspace`.
  Bukti:
  - schema baru:
    `identityWorkspaceBindings` di
    [channels/schema.ts](/home/rahman/projects/manef-db/convex/features/channels/schema.ts)
  - sync runtime menerima `identityBindings` dan resolve `userProfile` bila ada
    di [channels/api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
- [ ] Tambahkan policy apakah satu channel bisa mengakses banyak workspace atau
  hanya satu workspace utama.
- [x] Tambahkan read API untuk binding per channel dan per agent.
  Bukti:
  - `listChannelWorkspaceBindings`
  - `listIdentityWorkspaceBindings`
  - `listChannels` kini membawa binding summary
  - [channels/api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
- [x] Tambahkan write API untuk relink binding.
  Bukti:
  - `attachWorkspaceChannel`
  - `detachWorkspaceChannel`
  - `attachIdentityWorkspace`
  - `detachIdentityWorkspace`
  - [channels/api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
- [ ] Tambahkan sync dari runtime OpenClaw bindings ke Convex.
- [x] Tambahkan sync dari runtime OpenClaw bindings ke Convex.
  Bukti:
  - `syncRuntimeChannels` menerima `workspaceBindings` dan `identityBindings`
  - [sync_openclaw_channels_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_channels_to_convex.py)

Definition of done:

- setiap channel account bisa ditelusuri ke agent tujuan
- setiap channel account bisa ditelusuri ke workspace tujuan
- nomor/identity user bisa dipetakan ke workspace yang benar
- frontend dapat menampilkan binding live tanpa fallback
- perubahan binding termirror dua arah sesuai mode yang dipilih

## Remaining phases

- [x] Phase: tambah policy unik apakah satu channel boleh multi-workspace
  atau single primary workspace.
  Bukti:
  - tabel:
    `channelBindingPolicies` di
    [channels/schema.ts](/home/rahman/projects/manef-db/convex/features/channels/schema.ts)
  - mutation/query:
    `setChannelBindingPolicy`, `listChannelBindingPolicies` di
    [channels/api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
- [x] Phase: write-through lokal dari binding manual ke runtime OpenClaw.
  Bukti:
  - mutation binding manual sekarang enqueue `syncOutbox`
  - worker lokal:
    [process_openclaw_outbox.py](/home/rahman/projects/manef-db/scripts/process_openclaw_outbox.py)
  - worker menulis ke namespace aman:
    `manef.dashboard.*` di `~/.openclaw/openclaw.json`
  - runtime sync wrapper sekarang menjalankan worker outbox sebelum pull sync:
    [sync_openclaw_runtime_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_runtime_to_convex.py)
- [ ] Phase berikutnya: schema/backend untuk `Feature Store`.
- [ ] Phase berikutnya: sandbox/review backend untuk `Agent Builder`
  output `custom_code`.

Remaining breakdown untuk phase selanjutnya:

- [ ] schema `featureStoreItems`
- [ ] schema `workspaceFeatureInstalls`
- [ ] schema `featureStorePreviews`
- [ ] read API katalog item per workspace/scope
- [ ] install/uninstall API per workspace
- [ ] metadata publishing target untuk Superspace/external app
- [ ] schema `agentBuilderDrafts`
- [ ] mode draft:
  `json_blocks` / `custom_code`

Definition of done:

- write manual dari dashboard membuat outbox event
- worker lokal memproses outbox ke file lokal
- sync berikutnya membaca ulang file lokal dan memantulkan state yang sama ke Convex
- policy channel terbaca lagi dari file lokal ke DB

## Auth onboarding and access model

- [x] Login identifier mendukung `email` atau `phone`.
  Bukti:
  - [api.ts](/home/rahman/projects/manef-db/convex/features/auth/api.ts)
  - [schema.ts](/home/rahman/projects/manef-db/convex/features/auth/schema.ts)
  - commit `d2aaa73`
- [x] Temporary password flow tersambung ke backend.
  Bukti:
  - registration request + issue password:
    [api.ts](/home/rahman/projects/manef-db/convex/features/auth/api.ts)
  - commit `1ad944b`
- [x] First login dengan temporary password wajib ganti password.
  Bukti:
  - mutation `changePassword`
  - flag `mustChangePassword`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/auth/api.ts)
  - commit `1606fed`
- [x] Device approval tidak lagi memblok login.
  Bukti:
  - policy default `requireDeviceApproval: false`
  - mutation `setRequireDeviceApproval`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/auth/api.ts)
  - commit `8323ae1`
- [ ] Tambahkan status registry yang jelas untuk request:
  `pending_workspace`, `ready_for_access`, `approved`, `denied`.
- [ ] Tambahkan jalur admin reset password sementara tanpa mengubah profile/workspace.
- [ ] Tambahkan linkage eksplisit `authUser -> userProfile -> userIdentities -> workspace access`.

## Sessions

- [ ] Pertahankan `sessions` sebagai mirror session runtime.
- [x] Pertahankan `sessions` sebagai mirror session runtime.
  Bukti:
  - bulk mutation `syncRuntimeSessions`
  - script:
    [sync_openclaw_sessions_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_sessions_to_convex.py)
  - hasil sync nyata: `upserted=15`
- [ ] Pastikan key canonical mengikuti model runtime yang stabil.
- [ ] Simpan metadata:
  `sessionKey`, `canonicalSessionKey`, `agentId`, `channel`, `userId`,
  `messageCount`, `firstTs`, `lastTs`, `rawUserRef`.
- [x] Tambahkan sync job resmi dari file/runtime OpenClaw ke Convex.
  Bukti:
  - source runtime: `~/.openclaw/agents/*/sessions/sessions.json`
    dan `*.jsonl`
  - script:
    [sync_openclaw_sessions_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_sessions_to_convex.py)
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
- [x] Tambahkan metadata `Skills Store` untuk source/publisher/trust/scope.
  Bukti:
  - field baru:
    `sourceType`, `publisherLabel`, `publisherHandle`, `trustLevel`,
    `skillScope`, `installState`, `homepage`
  - schema:
    [schema.ts](/home/rahman/projects/manef-db/convex/features/skills/schema.ts)
  - API read/sync:
    [api.ts](/home/rahman/projects/manef-db/convex/features/skills/api.ts)
- [x] Klasifikasikan skill menjadi:
  `by Rahman`, `by ClawHub`, `by OpenClaw`.
  Bukti:
  - sync script kini mengklasifikasikan hasil runtime menjadi:
    `rahman_local`, `clawhub`, `openclaw_bundled`
  - source klasifikasi ada di:
    [sync_openclaw_skills_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_skills_to_convex.py)
- [x] Siapkan `ClawHub` sebagai sync source `pull-ready`, bukan webhook push.
  Bukti:
  - sync script memeriksa kandidat lockfile/metadata lokal `ClawHub`
  - backend menyediakan query status store:
    `getSkillStoreStatus`
  - tidak ada asumsi webhook eksternal dari registry
- [ ] Tambahkan toggle enable/disable yang konsisten dengan runtime.
- [x] Tambahkan toggle enable/disable yang konsisten dengan sync berikutnya.
  Bukti:
  - `toggleSkill` menyimpan `config.manualOverrideEnabled`
  - `syncRuntimeSkills` menjaga override tetap hidup sambil menyimpan
    `config.runtimeEnabled`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/skills/api.ts)
- [x] Turunkan `Skills Store` menjadi policy nyata
  `workspace -> skills -> agents`.
  Bukti:
  - query `listSkills` sekarang bisa menerima `workspaceId` dan mengembalikan
    `workspacePolicyEnabled`, `workspacePolicySources`,
    `workspaceAssignedAgentCount`
  - mutation baru:
    `setWorkspaceSkillPolicy`
  - policy manual `skill_store` ditulis ke tabel capability yang sama:
    `workspaceSkillPolicies`, `workspaceAgentSkillPolicies`
  - file:
    [api.ts](/home/rahman/projects/manef-db/convex/features/skills/api.ts)

Definition of done:

- daftar skill di DB sama dengan runtime setelah sync
- toggle dari UI terbaca lagi dari DB
- sync tidak menduplikasi record skill yang sama
- source label dan metadata trust/scope tersedia untuk `Skills Store`
- jika metadata `ClawHub` muncul di host, backend bisa memetakannya tanpa
  perubahan schema baru
- policy skill manual dari store ikut terbaca oleh query capability workspace

## Config

- [x] Finalisasi `configEntries` untuk kategori operasional OpenClaw.
  Bukti:
  - schema sekarang menyimpan `source` dan `runtimePath`
  - bulk mutation `syncRuntimeConfig`
  - [schema.ts](/home/rahman/projects/manef-db/convex/features/config/schema.ts)
  - [api.ts](/home/rahman/projects/manef-db/convex/features/config/api.ts)
  - [sync_openclaw_config_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_config_to_convex.py)
- [x] Tentukan field mana yang benar-benar mirror runtime config.
  Bukti:
  - source runtime disanitasi dari `~/.openclaw/openclaw.json`
  - entry top-level + path-level disimpan sebagai `configEntries`
  - field sensitif di-redact sebelum dikirim ke Convex
- [ ] Tambahkan reload/apply config nyata, atau tandai read-only bila belum
  bisa write-through.
- [x] Tambahkan guard konflik minimum untuk write manual.
  Bukti:
  - `setConfig` dan `deleteConfig` menerima `expectedUpdatedAt` opsional
  - bila record sudah berubah, mutation melempar error conflict
  - [api.ts](/home/rahman/projects/manef-db/convex/features/config/api.ts)
- [x] Tambahkan outbox event untuk write-through config.
  Bukti:
  - `setConfig` membuat `syncOutbox` event `config/upsert`
  - `deleteConfig` membuat `syncOutbox` event `config/delete`
  - [api.ts](/home/rahman/projects/manef-db/convex/features/config/api.ts)
- [ ] Tambahkan hash/version metadata yang lebih kuat dari sekadar `updatedAt`
  bila write-through lokal sudah diaktifkan.

Definition of done:

- config yang dibaca UI berasal dari DB live
- perubahan config terbaca lagi dari DB
- bila write-through diaktifkan, runtime ikut berubah

## Crons

- [x] Finalisasi `cronJobs` dan `cronRuns`.
  Bukti:
  - schema `cronJobs` sekarang punya `runtimeJobId` dan `source`
  - bulk mutation `syncRuntimeJobs`
  - [schema.ts](/home/rahman/projects/manef-db/convex/features/crons/schema.ts)
  - [api.ts](/home/rahman/projects/manef-db/convex/features/crons/api.ts)
- [x] Tambahkan sync job runtime -> DB.
  Bukti:
  - source runtime: `~/.openclaw/cron/jobs.json`
  - sync script:
    [sync_openclaw_crons_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_crons_to_convex.py)
  - scheduler:
    [sync_openclaw_runtime_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_runtime_to_convex.py)
  - hasil sync nyata: `upserted=1`
- [ ] Tambahkan mutation untuk enable/disable/edit schedule.
- [x] Tambahkan queue write-through untuk create/update/delete cron.
  Bukti:
  - `createJob` membuat `syncOutbox` event `cron/create`
  - `updateJob` membuat `syncOutbox` event `cron/update`
  - `deleteJob` membuat `syncOutbox` event `cron/delete`
  - `updateJob` dan `deleteJob` menerima `expectedUpdatedAt` opsional
  - [api.ts](/home/rahman/projects/manef-db/convex/features/crons/api.ts)
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
    [sync_openclaw_agents_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_agents_to_convex.py),
    [sync_openclaw_sessions_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_sessions_to_convex.py),
    [sync_openclaw_config_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_config_to_convex.py),
    [sync_openclaw_crons_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_crons_to_convex.py),
    [sync_openclaw_skills_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_skills_to_convex.py),
    [sync_openclaw_channels_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_channels_to_convex.py),
    [sync_openclaw_logs_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_logs_to_convex.py)
- [x] Tentukan mana yang pull-based, mana yang webhook-based, mana yang n8n-based.
  Bukti:
  - runtime sync yang aktif sekarang bersifat `pull-based local VPS -> Convex`
  - `n8n` tidak wajib untuk mirror `config`, `crons`, `skills`, `channels`, `logs`
  - `n8n` tetap opsional untuk workflow/write-through tertentu
- [x] Semua sync job harus punya output status:
  `inserted`, `updated`, `unchanged`, `failed`, `stale`.
  Bukti:
  - current scripts output JSON summary per sync job
  - contoh hasil nyata:
    `agents upserted=16`, `sessions upserted=15`, `config upserted=119`,
    `crons upserted=1`, `skills upserted=60`,
    `channels upserted=2 allowListEntries=18`, `logs upserted=81`
- [ ] Simpan sync audit di tabel khusus bila perlu.
- [x] Tambahkan runtime workspace mirror ke daftar sync resmi.
  Bukti:
  - script baru:
    [sync_openclaw_workspaces_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_workspaces_to_convex.py)
  - wrapper:
    [sync_openclaw_runtime_to_convex.py](/home/rahman/projects/manef-db/scripts/sync_openclaw_runtime_to_convex.py)
  - package script:
    [package.json](/home/rahman/projects/manef-db/package.json)

## Workspace files

- [x] Finalisasi `workspaceFiles` sebagai mirror file inti workspace runtime.
  Bukti:
  - schema `workspaceFiles` sekarang menyimpan `source`
  - mutation bulk:
    `syncRuntimeWorkspaceSnapshot`
  - [schema.ts](/home/rahman/projects/manef-db/convex/features/workspace/schema.ts)
  - [api.ts](/home/rahman/projects/manef-db/convex/features/workspace/api.ts)
- [x] Mirror file inti per workspace OpenClaw ke Convex.
  Bukti:
  - source runtime:
    `~/.openclaw/workspace*`
  - file canonical yang dibaca:
    `AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `MEMORY.md`,
    `HEARTBEAT.md`, `IDENTITY.md`, `BOOTSTRAP.md`
  - hasil sync nyata:
    `filesUpserted=104`
- [x] Tampilkan file runtime melalui query Convex.
  Bukti:
  - `getFiles` sekarang mengembalikan `agentId`, `source`, `syncStatus`
  - smoke test production memverifikasi kategori `identityMd`
  - [smoke_dashboard_features.py](/home/rahman/projects/manef-db/scripts/smoke_dashboard_features.py)

Definition of done:

- file inti workspace ada di Convex setelah sync
- agent bisa ditautkan kembali ke file runtime yang benar
- UI dapat membaca file runtime dari DB tanpa mock
- [x] Siapkan fondasi outbox untuk write-through lokal.
  Bukti:
  - tabel + API `syncOutbox`, `syncRuns`, `syncState`
    di [core/schema.ts](/home/rahman/projects/manef-db/convex/features/core/schema.ts)
    dan [core/api.ts](/home/rahman/projects/manef-db/convex/features/core/api.ts)
  - `config` dan `crons` sekarang sudah memakai outbox saat write manual

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
- [x] Jalankan mirror agents.
- [x] Jalankan mirror sessions.
- [x] Jalankan mirror channels.
- [x] Jalankan mirror config.
- [x] Jalankan mirror crons.
- [ ] Jalankan mirror nodes.
- [x] Jalankan mirror workspaces.
- [x] Verifikasi workspace docs terbaca dari Convex.
- [x] Jalankan mirror logs.
- [ ] Jalankan mirror skills.
- [ ] Verifikasi `openclawNavigator:listScopes`.
- [ ] Verifikasi frontend membaca hasil yang sama tanpa mock.
