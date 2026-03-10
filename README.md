# manef-db

Convex backend repo for Manef.

## Current status

- [Deployment status 2026-03-11](./DEPLOYMENT_STATUS_2026-03-11.md)

## Responsibilities

- Owns `convex/` schema, queries, mutations, actions, and generated API types.
- Exports `@manef/db/api` for typed function references in `manef-ui`.
- Exports `@manef/db/dataModel` for shared Convex types like `Id`.

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
- Untuk image lama/standar Nginx yang listen `80`, gunakan `80`.
- Intinya: samakan `Container Port` Dokploy dengan port yang benar-benar listen di container aktif.

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
- `/healthz` and `/version` are not reaching this proxy yet, which points to a
  Dokploy/Traefik routing issue in the active deployment

This repo's `docker-compose.yml` now includes Traefik labels to make the
cloud+proxy path routable in Dokploy.

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
