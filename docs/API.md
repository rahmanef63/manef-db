# manef-db API Reference

Updated: 2026-03-13

Dokumentasi API Convex untuk manef-db. Diakses oleh manef-ui dan external webapps yang terintegrasi dengan OpenClaw runtime.

## Cara Akses

### 1. Dari manef-ui (Internal — Direkomendasikan)

```typescript
import { appApi, useAppQuery, useAppMutation, useAppAction } from "@/lib/convex/client";

const agents = useAppQuery(appApi.features.agents.api.getAgents, {});
```

### 2. Dari Next.js App Lain (Convex Client)

```typescript
import { ConvexReactClient } from "convex/react";
import { api } from "@manef/db/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Query
const agents = useQuery(api.features.agents.api.getAgents, {});

// Mutation
const updateAgent = useMutation(api.features.agents.api.updateAgent);
```

### 3. HTTP API (Server-to-Server)

Convex menyediakan HTTP API untuk akses dari server eksternal:

```
Base URL: https://dbgg.rahmanef.com
```

```bash
# Query via HTTP
curl -X POST https://dbgg.rahmanef.com/api/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Convex {token}" \
  -d '{
    "path": "features/agents/api:getAgents",
    "args": {}
  }'
```

---

## Agents API

### `features.agents.api.getAgents`
**Type:** Query

List semua agents, dengan enrichment dari workspace tree dan session data.

**Args:**
```typescript
{
  agentIds?: string[]       // Filter by specific agentId strings
  ownerId?: Id<"userProfiles">  // Filter by owner
}
```

**Returns:**
```typescript
Array<{
  _id: Id<"agents">
  agentId: string
  name: string
  description?: string        // From agentsMd field
  workspacePath?: string      // Runtime workspace path
  agentDir?: string           // Agent config directory
  boundChannels: string[]     // Channel IDs bound to this agent
  capabilities: string[]
  childCount: number          // Number of sub-agents
  sessionCount: number        // Active sessions count
  lastActiveAt?: number       // Unix timestamp ms
  model?: string              // LLM model (e.g. "claude-sonnet-4-6")
  owner?: Id<"userProfiles">
  ownerName?: string
  role: string                // Agent type/role
  status: string              // "active" | "inactive" | "draft"
}>
```

---

### `features.agents.api.deployAgent`
**Type:** Mutation

Buat draft agent baru di Convex (Convex-side only — agent sebenarnya dibuat via OpenClaw CLI).

**Args:**
```typescript
{
  name: string
  role: string
  description?: string
  tenantId?: string
}
```

**Returns:** `Id<"agents">`

---

### `features.agents.api.updateAgent`
**Type:** Mutation | Write-Through

Update metadata agent. Perubahan dikirim ke OpenClaw runtime via syncOutbox.

**Args:**
```typescript
{
  id: Id<"agents">
  name?: string
  model?: string
  description?: string
}
```

**Returns:** `null`

**Side Effect:** Inserts to `syncOutbox` → Python worker → `~/.openclaw/openclaw.json`

---

### `features.agents.api.archiveAgent`
**Type:** Mutation | Write-Through

Archive agent (tandai inactive di Convex, enqueue ke runtime).

**Args:**
```typescript
{ id: Id<"agents"> }
```

**Returns:** `null`

---

## Sessions API

### `features.sessions.api.getSessions`
**Type:** Query

List active sessions dengan filter options.

**Args:**
```typescript
{
  agentId?: string            // Filter by specific agent
  agentIds?: string[]         // Filter by multiple agents
  activeWithinMinutes?: number // Only sessions active within N minutes
  includeUnknown?: boolean     // Include sessions without agentId
  limit?: number               // Max results (default: 50)
}
```

**Returns:**
```typescript
Array<{
  _id: Id<"sessions">
  agentId?: string
  channel?: string
  sessionKey: string
  status: string              // "active" | "closed" | "error"
  messageCount: number
  lastActiveAt: number        // Unix timestamp ms
}>
```

---

### `features.sessions.api.createSession`
**Type:** Mutation

Buat session baru.

**Args:**
```typescript
{
  sessionKey: string
  tenantId?: string
}
```

**Returns:** `Id<"sessions">`

---

## Channels API

### `features.channels.api.listChannels`
**Type:** Query

List semua channels dengan workspace bindings dan identity bindings.

**Args:**
```typescript
{ tenantId?: string }
```

**Returns:**
```typescript
Array<{
  _id: Id<"channels">
  _creationTime: number
  channelId: string
  type: string               // "whatsapp" | "telegram" | "slack" | dll
  label?: string
  configured: boolean
  running: boolean
  linked?: boolean
  connected?: boolean
  mode?: string
  lastStartAt?: number
  lastProbeAt?: number
  lastConnectAt?: number
  lastMessageAt?: number
  authAgeMs?: number
  lastError?: string
  config?: any
  bindingPolicy?: {
    mode: string             // "single-primary" | "multi-workspace"
    primaryWorkspaceId?: Id<"workspaceTrees">
    source?: string
  }
  workspaceBindings: Array<{
    access?: string
    agentId?: string
    slug: string
    workspaceId: Id<"workspaceTrees">
    workspaceName: string
  }>
  identityBindings: Array<{
    access?: string
    channel: string
    externalUserId: string
    normalizedPhone?: string
    userId?: Id<"userProfiles">
    workspaceId: Id<"workspaceTrees">
    workspaceName: string
  }>
}>
```

---

### `features.channels.api.getChannel`
**Type:** Query

Get channel by channelId string.

**Args:**
```typescript
{ channelId: string }
```

**Returns:** Channel object atau `null`

---

### `features.channels.api.attachWorkspaceChannel`
**Type:** Mutation | Write-Through

Bind channel ke workspace. Enqueue ke runtime via outbox.

**Args:**
```typescript
{
  channelId: string
  workspaceId: Id<"workspaceTrees">
  agentId?: string
  access?: string            // default: "manual"
  source?: string
  tenantId?: string
}
```

**Returns:** `Id<"workspaceChannelBindings">`

---

### `features.channels.api.detachWorkspaceChannel`
**Type:** Mutation | Write-Through

Unbind channel dari workspace.

**Args:**
```typescript
{
  channelId: string
  workspaceId: Id<"workspaceTrees">
}
```

**Returns:** `null`

---

### `features.channels.api.setChannelBindingPolicy`
**Type:** Mutation | Write-Through

Set policy routing channel (single-primary atau multi-workspace).

**Args:**
```typescript
{
  channelId: string
  mode: "single-primary" | "multi-workspace"
  primaryWorkspaceId?: Id<"workspaceTrees">
  tenantId?: string
}
```

**Returns:** `Id<"channelBindingPolicies">`

---

## Config API

### `features.config.api.listConfig`
**Type:** Query

List semua config entries dari runtime.

**Args:** `{}`

**Returns:**
```typescript
Array<{
  _id: Id<"configEntries">
  key: string
  value: any
  updatedAt: number
}>
```

---

## Crons API

### `features.crons.api.listCrons`
**Type:** Query

List semua cron jobs.

**Returns:**
```typescript
Array<{
  _id: Id<"cronJobs">
  cronId: string
  name?: string
  schedule: string           // Cron expression
  command: string
  enabled: boolean
  lastRunAt?: number
  nextRunAt?: number
  status?: string
}>
```

---

## Skills API

### `features.skills.api.listSkills`
**Type:** Query

List semua skills yang terdaftar.

**Returns:**
```typescript
Array<{
  _id: Id<"skills">
  skillId: string
  name: string
  description?: string
  enabled: boolean
  agentBindings: string[]    // Agent IDs yang menggunakan skill ini
}>
```

---

## Logs API

### `features.logs.api.getLogs`
**Type:** Query

Get activity logs dari runtime.

**Args:**
```typescript
{
  agentId?: string
  limit?: number             // default: 50
  since?: number             // Unix timestamp ms
}
```

**Returns:**
```typescript
Array<{
  _id: Id<"activityLogs">
  agentId?: string
  event: string
  level: string              // "info" | "warn" | "error"
  message: string
  timestamp: number
  metadata?: any
}>
```

---

## Workspace API

### `features.workspace.api.getWorkspaceTrees`
**Type:** Query

Get workspace tree (OpenClaw layer workspace).

**Returns:**
```typescript
Array<{
  _id: Id<"workspaceTrees">
  name: string
  agentId?: string
  rootPath?: string
  runtimePath?: string
  isRoot: boolean
  parentId?: Id<"workspaceTrees">
}>
```

---

## OpenClaw Navigator

### `openclawNavigator.getNavigatorData`
**Type:** Query

Get data untuk workspace switcher di dashboard.

**Args:**
```typescript
{ userId: Id<"users"> }
```

**Returns:** Navigator tree dengan workspaces dan agents untuk user tersebut.

---

## Error Handling

Semua mutations melempar error jika:
- Record tidak ditemukan: `Error("{Entity} {id} not found")`
- Validation gagal: Convex throws `ConvexError` dengan message

```typescript
try {
  await updateAgent({ id, name: "new name" });
} catch (error) {
  if (error instanceof ConvexError) {
    console.error(error.data);  // structured error
  }
}
```

---

## Rate Limits & Quotas

Convex Cloud limits (default):
- Queries: 1000 req/min per deployment
- Mutations: 500 req/min per deployment
- Realtime subscriptions: unlimited

---

## Pagination

Saat ini query menggunakan `.take(N)` dengan default 50. Untuk pagination, tambahkan:
```typescript
// Belum diimplementasi — gunakan cursor dari _id jika perlu
```
