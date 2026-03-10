# Self-Hosted Convex on Dokploy

Updated: 2026-03-10

This repo now supports two deployment modes:

1. `docker-compose.yml`
   - Reverse proxy only
   - Keeps using Convex Cloud as the real backend
2. `docker-compose.selfhost.yml`
   - Runs the official self-hosted Convex backend and dashboard in Dokploy

## Why the current `dbgg.rahmanef.com` path fails

Current audit from local machine:

- `dbgg.rahmanef.com` resolves
- HTTPS only works with `curl -k`
- without skipping verification, TLS fails with `SEC_E_UNTRUSTED_ROOT`
- `/healthz` returns `404 page not found`, which means traffic is not hitting the
  Nginx proxy defined in this repo

So the current cloud+proxy issue is a combination of:

1. untrusted TLS certificate chain on `dbgg.rahmanef.com`
2. Dokploy/Traefik routing not landing on the intended proxy container

`docker-compose.yml` now includes Traefik labels so Dokploy can route it
consistently.

## Self-hosted topology

Official Convex self-hosting exposes:

- API/backend on port `3210`
- site proxy / HTTP actions on port `3211`
- dashboard on port `6791`

Recommended public routing:

- `https://dbgg.rahmanef.com` -> backend/API (`3210`)
- `https://dbggsite.rahmanef.com` -> site proxy / HTTP actions (`3211`)
- `https://dbggdash.rahmanef.com` -> Convex dashboard (`6791`)

## Dokploy setup

1. Use `docker-compose.selfhost.yml` for the Dokploy app.
2. Load environment variables from `.env.selfhost.example`.
3. Set at minimum:
   - `INSTANCE_SECRET`
   - `CONVEX_CLOUD_ORIGIN`
   - `CONVEX_SITE_ORIGIN`
   - `NEXT_PUBLIC_DEPLOYMENT_URL`
4. Attach the three public domains above.
5. Deploy the stack.

## After first deploy

Generate an admin key from the backend container:

```bash
docker compose -f docker-compose.selfhost.yml exec convex-backend ./generate_admin_key.sh
```

Then, on the machine where you run Convex CLI for this project, set in
`manef-db/.env.local`:

```env
CONVEX_SELF_HOSTED_URL=https://dbgg.rahmanef.com
CONVEX_SELF_HOSTED_ADMIN_KEY=<generated-admin-key>
```

After that, use the normal scripts from this repo:

```bash
npm run dev
npm run deploy
npm run codegen
```

## What changes in `manef-ui`

For production:

```env
NEXT_PUBLIC_CONVEX_URL=https://dbgg.rahmanef.com
CONVEX_SERVER_URL=
```

For temporary local fallback while TLS is still being fixed:

```env
CONVEX_SERVER_URL=https://dbgg.rahmanef.com
```

But ideally `CONVEX_SERVER_URL` should not be needed once the public certificate
chain is valid.
