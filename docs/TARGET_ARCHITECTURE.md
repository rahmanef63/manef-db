# Target Architecture

Updated: 2026-03-12

Dokumen ini menjadi SSOT arsitektur target untuk `manef-db`.

Tujuannya:

1. memisahkan domain `Superspace`, `OpenClaw`, dan `manef`
2. menjaga model backend tetap netral sebelum ada convergence
3. memberi boundary yang jelas untuk `Feature Store` dan `Agent Builder`

## Decision

Keputusan saat ini:

- **repo tetap terpisah dulu**
- `Superspace` dipakai sebagai acuan product shell, bukan runtime SSOT
- `OpenClaw` tetap menjadi runtime SSOT
- `manef-db` menjadi integration backend aktif

Artinya:

- jangan memodelkan OpenClaw hanya sebagai feature biasa
- jangan memindahkan SSOT runtime ke Superspace
- jangan merge codebase sebelum integration contract stabil

## Domain Model

### 1. Superspace Domain

Cocok sebagai acuan untuk:

- feature catalog
- install/uninstall feature
- preview metadata
- workspace-level product shell
- app/builder ecosystem

Reference files:

- [menuItems.ts](/home/rahman/projects/superspace/convex/features/menus/menuItems.ts)
- [menu_manifest_data.ts](/home/rahman/projects/superspace/convex/features/menus/menu_manifest_data.ts)
- [optional_features_catalog.ts](/home/rahman/projects/superspace/convex/features/menus/optional_features_catalog.ts)

### 2. OpenClaw Domain

Runtime SSOT:

- agents
- sessions
- channels
- config
- cron
- logs
- workspace docs/files
- local bindings

Reference runtime sources:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/workspace*`
- `~/.openclaw/agents/*`
- `~/.openclaw/cron/jobs.json`
- `journalctl --user-unit openclaw-gateway`

### 3. Manef Integration Domain

`manef-db` harus menangani:

- runtime mirror `OpenClaw -> Convex`
- write-through aman `Convex/UI -> local runtime`
- workspace tree yang sekaligus OpenClaw-aware dan UI-friendly
- auth linkage `authUser -> userProfile -> userIdentities -> workspace`
- channel binding dan identity binding
- future `Feature Store` contract yang tetap runtime-aware

Relevant files:

- [openclawNavigator.ts](/home/rahman/projects/manef-db/convex/openclawNavigator.ts)
- [workspace/schema.ts](/home/rahman/projects/manef-db/convex/features/workspace/schema.ts)
- [channels/api.ts](/home/rahman/projects/manef-db/convex/features/channels/api.ts)
- [auth/api.ts](/home/rahman/projects/manef-db/convex/features/auth/api.ts)
- [process_openclaw_outbox.py](/home/rahman/projects/manef-db/scripts/process_openclaw_outbox.py)
- [OPENCLAW_BACKEND_PARITY_TASKLIST.md](/home/rahman/projects/manef-db/docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md)

## Integration Contract

### Workspace Contract

Model target:

- `root workspace`
- `child/sub-workspace`
- `workspaceAgents` many-to-many
- `primaryAgentId` compatibility field
- explicit inheritance policy

Rules:

- satu workspace bisa punya banyak agent
- setiap agent punya primary workspace
- child workspace tidak otomatis mewarisi semua root context
- `runtimePath` harus dibedakan dari navigator/business path

### Identity Contract

- satu `userProfile` bisa punya banyak identity
- identity bisa berupa phone/email/channel external id
- auth tidak boleh lagi mengandalkan email saja
- access harus ditentukan oleh linkage profile/workspace, bukan string email mentah

### Channel Contract

- binding `channel/account -> workspace`
- binding `identity -> workspace`
- policy:
  - `multi-workspace`
  - `single-primary`
- write manual dari dashboard harus masuk ke local runtime lewat outbox/worker

### Feature Contract

`Feature Store` backend harus menyediakan:

- `featureStoreItems`
- `workspaceFeatureInstalls`
- `featureStorePreviews`
- scope:
  - `workspace-local`
  - `workspace-shared`
  - `general/shared`

`Feature Store` tidak boleh hanya meniru menu installer Superspace.
Ia harus tahu:

- workspace aktif
- agent binding
- runtime availability
- publication target

### Builder Contract

`Agent Builder` target model:

- draft `json_blocks`
- draft `custom_code`
- metadata sandbox/review
- link ke workspace
- link ke downstream publish target

## Recommended Backend Approach

Urutan kerja yang disarankan:

1. pertahankan integration contract yang sudah ada:
   `workspace/agent/channel/identity`
2. tambahkan schema `Feature Store`
3. tambahkan install/uninstall per workspace
4. tambahkan `Agent Builder` schema
5. baru evaluasi shared package atau merge strategy

## Why Not Merge Yet

Alasan backend belum layak merge:

- OpenClaw runtime masih merupakan subsystem utama, bukan sekadar optional module
- local runtime files dan Gateway state belum cocok jadi domain biasa Superspace
- contract integrasi masih aktif berubah
- `manef-db` masih menjadi tempat validasi arah sinkronisasi dan isolation model

## Remaining Near-Term Work

Backend phase berikutnya:

- schema `featureStoreItems`
- schema `workspaceFeatureInstalls`
- schema `featureStorePreviews`
- query katalog per workspace/scope
- install/uninstall per workspace
- schema `agentBuilderDrafts`
- mode `json_blocks` dan `custom_code`

Track detail di:

- [OPENCLAW_BACKEND_PARITY_TASKLIST.md](/home/rahman/projects/manef-db/docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md)
