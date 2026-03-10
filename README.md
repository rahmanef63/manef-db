# manef-db

Convex backend repo for Manef.

## Responsibilities

- Owns `convex/` schema, queries, mutations, actions, and generated API types.
- Exports `@manef/db/api` for typed function references in `manef-ui`.
- Exports `@manef/db/dataModel` for shared Convex types like `Id`.

## Local development

1. Run `npm install` in this repo.
2. Configure Convex envs and deployment as needed.
3. Start the backend with `npm run dev`.

## Docker proxy for `ggdb.rahmanef.com`

This repo also includes a lightweight Nginx container to front the hosted
Convex deployment on a dedicated domain such as `ggdb.rahmanef.com`.

Use it when:

- `manef-db` lives in a separate repo/deployment target
- you want a dedicated backend domain now
- the actual runtime still lives on Convex hosted infrastructure

Required environment variables:

- `PUBLIC_DB_DOMAIN=ggdb.rahmanef.com`
- `UPSTREAM_CONVEX_URL=https://<your-convex-deployment>.convex.cloud`

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
  case `ggdb.rahmanef.com` should be configured directly in Convex, and this
  proxy can be removed.

Frontend note:

- `manef-ui` should use `NEXT_PUBLIC_CONVEX_URL=https://ggdb.rahmanef.com`
  once this domain is active.

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
