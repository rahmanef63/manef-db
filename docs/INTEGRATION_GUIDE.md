# manef-db Integration Guide

Updated: 2026-03-13

Panduan untuk webapp lain yang ingin mengintegrasikan dengan manef-db (OpenClaw runtime data).

---

## Use Cases

1. **Tampilkan daftar agents** di webapp lain (e.g., landing page, monitoring dashboard)
2. **Monitor sessions** yang aktif dari agent tertentu
3. **Manage channel bindings** dari aplikasi eksternal
4. **Baca activity logs** untuk alerting atau analytics
5. **Embed workspace navigator** ke dalam app lain

---

## Integrasi via Convex Client SDK

### Setup

```bash
# Install Convex client
npm install convex
# atau
pnpm add convex
```

```typescript
// env variable yang dibutuhkan
NEXT_PUBLIC_CONVEX_URL=https://dbgg.rahmanef.com
```

### React/Next.js Integration

```typescript
// providers.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

```typescript
// Menggunakan API dari @manef/db
// CATATAN: Butuh akses ke vendor/manef-db/ atau install sebagai package lokal

// Option A: vendor copy (untuk apps di server yang sama)
import { api } from "/home/rahman/projects/manef-ui/vendor/manef-db/convex/_generated/api";

// Option B: Install sebagai local package (di monorepo)
// package.json: "@manef/db": "file:../../manef-db"
import { api } from "@manef/db/api";
```

```typescript
// Component contoh: Agent List
import { useQuery } from "convex/react";
import { api } from "@manef/db/api";

export function AgentList() {
  const agents = useQuery(api.features.agents.api.getAgents, {});

  if (!agents) return <div>Loading...</div>;

  return (
    <ul>
      {agents.map((agent) => (
        <li key={agent.agentId}>
          <strong>{agent.name}</strong> — {agent.status}
          <br />
          Sessions: {agent.sessionCount} | Channels: {agent.boundChannels.length}
        </li>
      ))}
    </ul>
  );
}
```

---

## Integrasi via HTTP (Server-to-Server)

Untuk backend apps atau server-side code yang tidak bisa menggunakan Convex SDK.

### Convex HTTP API

```bash
# Base URL Convex HTTP API
CONVEX_URL=https://dbgg.rahmanef.com

# Query (read data)
curl -X POST ${CONVEX_URL}/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "path": "features/agents/api:getAgents",
    "args": {},
    "format": "json"
  }'
```

**Response format:**
```json
{
  "status": "success",
  "value": [
    {
      "_id": "j572...",
      "agentId": "agent-main",
      "name": "Main Agent",
      "status": "active",
      "sessionCount": 3,
      "boundChannels": ["whatsapp-main"],
      ...
    }
  ]
}
```

```bash
# Mutation (write data) — Butuh auth token
curl -X POST ${CONVEX_URL}/api/mutation \
  -H "Content-Type: application/json" \
  -H "Authorization: Convex ${CONVEX_TOKEN}" \
  -d '{
    "path": "features/agents/api:updateAgent",
    "args": {
      "id": "j572...",
      "name": "Updated Name"
    }
  }'
```

### Node.js Server Example

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "@manef/db/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

// Fetch agents (no auth needed for public queries)
const agents = await client.query(api.features.agents.api.getAgents, {});

// Update agent (needs auth)
client.setAuth(process.env.CONVEX_TOKEN!);
await client.mutation(api.features.agents.api.updateAgent, {
  id: "j572...",
  name: "New Name",
});
```

---

## Real-Time Subscriptions (Convex React)

manef-db mendukung real-time updates — data otomatis refresh ketika ada perubahan.

```typescript
import { useQuery } from "convex/react";
import { api } from "@manef/db/api";

// Component ini auto-update setiap ada session baru
function ActiveSessions({ agentId }: { agentId: string }) {
  const sessions = useQuery(api.features.sessions.api.getSessions, {
    agentId,
    activeWithinMinutes: 60,
  });

  return (
    <div>
      Active sessions: {sessions?.length ?? "loading..."}
    </div>
  );
}
```

---

## Read-Only vs Write APIs

### Read-Only (Public Queries — Tidak butuh auth)
- `getAgents` — List agents
- `getSessions` — List sessions
- `listChannels` — List channels
- `listConfig` — List config
- `listCrons` — List cron jobs
- `getLogs` — Get activity logs
- `listSkills` — List skills
- `getWorkspaceTrees` — Get workspace tree

### Write APIs (Butuh auth — hanya dari dashboard)
- `updateAgent`, `archiveAgent` — Modify agents
- `attachWorkspaceChannel`, `detachWorkspaceChannel` — Channel bindings
- `setChannelBindingPolicy` — Routing policy
- `createSession`, `deleteSession` — Session management
- Semua `sync*` mutations — Hanya dari Python sync scripts

---

## Konfigurasi CORS

Jika webapp kamu perlu akses dari browser (bukan server), tambahkan domain ke allowed origins di Convex dashboard:

1. Buka `https://dashboard.convex.dev`
2. Pilih deployment manef-db
3. Settings → HTTP streaming / CORS
4. Tambahkan domain webapp kamu

---

## Integrasi dengan Superspace

Jika kamu sedang develop fitur di **superspace** yang perlu data OpenClaw runtime:

```typescript
// Di superspace, gunakan fetch ke manef-db HTTP API
// Jangan install Convex client baru — superspace punya Convex deployment sendiri

async function getOpenClawAgents() {
  const res = await fetch(`${process.env.MANEF_DB_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "features/agents/api:getAgents",
      args: {},
    }),
  });
  const data = await res.json();
  return data.value;
}
```

---

## Integrasi dengan OpenClaw RPG / Projects Lain

Untuk `openclaw-rpg` atau projects OpenClaw-based lainnya yang butuh data runtime:

```typescript
// lib/manef.ts — Helper untuk akses manef-db
export async function fetchManefData<T>(
  queryPath: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${process.env.MANEF_DB_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: queryPath, args }),
  });
  if (!res.ok) throw new Error(`manef-db error: ${res.status}`);
  const { status, value, errorMessage } = await res.json();
  if (status !== "success") throw new Error(errorMessage);
  return value as T;
}

// Usage
const agents = await fetchManefData("features/agents/api:getAgents", {});
const sessions = await fetchManefData("features/sessions/api:getSessions", {
  activeWithinMinutes: 30,
});
```

---

## Environment Variables

```bash
# Untuk apps yang connect ke manef-db
NEXT_PUBLIC_CONVEX_URL=https://dbgg.rahmanef.com   # Browser/React apps
CONVEX_URL=https://dbgg.rahmanef.com               # Server-side
MANEF_DB_URL=https://dbgg.rahmanef.com             # Generic HTTP access

# Untuk mutations (opsional, hanya jika perlu write)
CONVEX_TOKEN={token dari Convex dashboard}
```

---

## Webhook / Event-Based Integration

Convex belum mendukung webhooks secara native. Untuk event-based integration:

**Option 1: Polling** (simple)
```typescript
// Poll setiap 30 detik
setInterval(async () => {
  const sessions = await fetchManefData("features/sessions/api:getSessions", {
    activeWithinMinutes: 1,
  });
  // Process new sessions
}, 30000);
```

**Option 2: Convex Real-Time** (direkomendasikan untuk React apps)
Gunakan `useQuery` dari Convex React client — auto-subscribe ke changes.

**Option 3: Custom Convex Action**
Tambahkan HTTP action di manef-db yang bisa dipanggil dari external webhook:
```typescript
// convex/features/{domain}/api.ts
export const handleWebhook = httpAction(async (ctx, request) => {
  const body = await request.json();
  // process webhook
  return new Response("ok");
});
```

---

## FAQ

**Q: Apakah data di manef-db real-time?**
A: Ya, untuk apps yang menggunakan Convex React client dengan `useQuery`. Data otomatis push dari server ketika ada perubahan.

**Q: Apakah aman mengakses manef-db dari webapp publik?**
A: Query data runtime (agents, sessions, dll) tidak mengandung credential. Aman untuk dibaca. Mutations butuh auth token dan sebaiknya hanya dari server-side.

**Q: Bagaimana jika data stale (tidak update)?**
A: Cek apakah Python sync scripts berjalan. Jalankan `npm run sync:runtime` di manef-db. Atau cek `openclaw gateway status`.

**Q: Bisa custom query selain yang ada di API?**
A: Tambahkan query baru di `convex/features/{domain}/api.ts`, deploy ke Convex, sync vendor. Lihat API.md untuk contoh pattern.
