# manef-db — Project Guardrails

Updated: 2026-03-13

## Ringkasan Project

**manef-db** adalah Convex backend untuk manef-ui. Integration layer antara OpenClaw runtime dan dashboard UI.

- **URL**: https://dbgg.rahmanef.com (Nginx proxy → Convex Cloud)
- **Package**: `@manef/db`
- **Stack**: Convex BaaS, TypeScript, Python sync scripts

## Arsitektur

```
OpenClaw Runtime (local VPS, ~/.openclaw/)
  ↓ Python sync scripts (systemd timer)
Convex Cloud (manef-db)
  ↓ Nginx Docker proxy
https://dbgg.rahmanef.com
  ↓ Convex client SDK
manef-ui
```

## Struktur Penting

```
manef-db/
├── convex/
│   ├── schema.ts              # Root schema (aggregate semua feature schemas)
│   ├── features/              # 25 feature domains
│   │   └── {domain}/
│   │       ├── schema.ts      # Table definitions
│   │       └── api.ts         # queries + mutations + actions
│   ├── openclawNavigator.ts   # Workspace tree untuk dashboard navigation
│   ├── permissions_schema.ts  # Role/Permission types
│   └── _generated/            # AUTO-GENERATED — jangan edit!
└── scripts/
    ├── sync_openclaw_*.py     # Runtime sync scripts
    └── process_openclaw_outbox.py  # Write-through worker
```

## Domain Features (25)

`agents`, `auth`, `calendar`, `channels`, `config`, `core`, `crons`, `dashboard`,
`debug`, `featureStore`, `inbox`, `instances`, `knowledge`, `logs`, `nodes`,
`projects`, `sessions`, `skills`, `tasks`, `usage`, `users`, `workspace`, `workspace_tasks`

## Aturan Wajib

### DILARANG
- Edit file di `convex/_generated/` secara langsung
- Mengubah schema tanpa deploy (`npm run deploy:ci`)
- Menggunakan Convex query/mutation tanpa return type yang eksplisit
- Merge ke manef-ui schema sebelum integration contract stabil

### WAJIB
- Semua query/mutation HARUS punya `returns: v.xxx()` yang eksplisit
- Schema changes → deploy dulu sebelum sync vendor
- Python sync scripts harus bisa idempotent (upsert, bukan insert-only)
- Runtime SSOT = OpenClaw. Convex adalah mirror, bukan primary store

## Write-Through Pattern

Setiap mutation yang mengubah runtime (agents, channels, config) HARUS:
1. Update Convex dulu
2. Insert ke `syncOutbox` table
3. Python worker (`process_openclaw_outbox.py`) baca outbox dan apply ke runtime

```typescript
// Contoh di api.ts
await ctx.db.patch(id, { name: args.name, updatedAt: Date.now() });
await ctx.db.insert("syncOutbox", {
  entityType: "agent",
  entityKey: agent.agentId,
  operation: "update",
  payload: { agentId: agent.agentId, name: args.name },
  status: "pending",
  source: "dashboard",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  attemptCount: 0,
});
```

## Exports Public (@manef/db)

```
@manef/db/api         → function references (Id, query/mutation names)
@manef/db/dataModel   → Convex types (Id<"tableName">, etc.)
@manef/db/errors      → Error definitions
@manef/db/permissions → Permission utilities
@manef/db/workspaces  → Workspace APIs
```

## Deploy Flow

```bash
# 1. Edit convex/features/{domain}/schema.ts atau api.ts
# 2. Test lokal (optional)
npm run dev

# 3. Deploy ke Convex Cloud
npm run deploy:ci

# 4. Sync vendor ke manef-ui
bash /home/rahman/projects/manef-ui/scripts/sync-vendor.sh
```

## Sync Runtime

```bash
npm run sync:runtime                 # Sync semua domain
npm run sync:runtime:agents          # Agents saja
npm run sync:runtime:sessions        # Sessions saja
npm run sync:runtime:channels        # Channels + bindings saja
npm run sync:runtime:config          # Config saja
npm run sync:runtime:crons           # Cron jobs saja
npm run sync:runtime:skills          # Skills saja
npm run sync:runtime:logs            # Activity logs saja
npm run sync:runtime:nodes           # Runtime nodes saja
```

## Schema Changes Pending Deploy (per 2026-03-13)

- `syncAuditLog` table di `debugSchema`
- `syncRuntimeNodes` mutation di `nodes/api.ts`
- **Action**: `cd /home/rahman/projects/manef-db && npm run deploy:ci`

## Health Check

```bash
curl -si https://dbgg.rahmanef.com/version
sudo ss -tlnp | grep 18789    # OpenClaw gateway
openclaw gateway status
```
