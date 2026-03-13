# Essential Reading — manef-db

## Untuk Developer Baru (Urutan Baca)

### 1. Arsitektur (10 menit)
- `docs/TARGET_ARCHITECTURE.md` — Boundaries domain dan integration contract
- `.claude/CLAUDE.md` — Guardrails dan aturan wajib
- `docs/OPENCLAW_BACKEND_PARITY_TASKLIST.md` — Feature tracking

### 2. Schema (15 menit)
- `convex/schema.ts` — Root schema (aggregate dari semua feature schemas)
- `convex/features/agents/schema.ts` — Contoh schema kompleks
- `convex/features/workspace/schema.ts` — Workspace tree model

### 3. API Pattern (15 menit)
- `convex/features/agents/api.ts` — Contoh query + mutation + write-through
- `convex/features/channels/api.ts` — Contoh sync + binding mutations
- `convex/openclawNavigator.ts` — Navigation query untuk dashboard

## Mental Model Kunci

### 1. Convex = Mirror, bukan Source of Truth
- Source of truth untuk runtime data = OpenClaw (`~/.openclaw/`)
- Convex menyimpan mirror untuk dashboard dan real-time updates
- Semua data runtime di-sync via Python scripts

### 2. Write-Through Outbox Pattern
Setiap mutation yang mengubah runtime HARUS:
1. Update Convex record
2. Insert ke `syncOutbox`
3. Python worker akan process outbox → apply ke OpenClaw

```
Dashboard mutation → Convex → syncOutbox → process_openclaw_outbox.py → ~/.openclaw/
```

### 3. Sync Scripts = Idempotent
Semua Python sync scripts harus bisa dijalankan berulang kali tanpa side effect. Gunakan upsert pattern (bukan insert-only).

### 4. Return Types Wajib Eksplisit
```typescript
// BENAR
export const getAgents = query({
  args: { ... },
  returns: v.array(v.object({ _id: v.id("agents"), name: v.string(), ... })),
  handler: async (ctx, args) => { ... }
});

// SALAH — tidak ada return type
export const getAgents = query({
  args: { ... },
  handler: async (ctx, args) => { ... }
});
```

## Checklist Schema Change

- [ ] Tambah/ubah di `convex/features/{domain}/schema.ts`
- [ ] Import schema baru di `convex/schema.ts` jika table baru
- [ ] Tambah/ubah fungsi di `convex/features/{domain}/api.ts`
- [ ] Test lokal: `npm run dev`
- [ ] Deploy: `npm run deploy:ci`
- [ ] Sync vendor: `bash /home/rahman/projects/manef-ui/scripts/sync-vendor.sh`

## Checklist Sebelum Deploy

- [ ] Semua return types eksplisit
- [ ] Write-through mutations punya syncOutbox insert
- [ ] Python sync scripts masih bisa run setelah schema change
- [ ] Tidak ada breaking change ke exports `@manef/db/*`

## Troubleshooting Umum

### Deploy gagal
```bash
npm run deploy:ci 2>&1 | tail -30
# Cek return type mismatch atau schema error
```

### Sync script error
```bash
python3 scripts/sync_openclaw_agents_to_convex.py 2>&1
# Biasanya: missing env variable atau Convex token expired
```

### Data stale di dashboard
```bash
npm run sync:runtime  # Full sync semua domain
```

### Schema validation error
```bash
# Edit convex/features/{domain}/schema.ts
npm run codegen  # Regenerate types
npm run deploy:ci
```
