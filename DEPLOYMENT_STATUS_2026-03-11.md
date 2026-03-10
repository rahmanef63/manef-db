# Deployment Status

Updated: 2026-03-11

Dokumen ini merangkum status `manef-db` saat user berhenti kerja pada malam
2026-03-11. Fokusnya adalah deploy production, mode deploy yang aktif, dan
blocker yang masih tersisa.

## Current production symptoms

Hasil verifikasi dari mesin lokal:

- `https://dbgg.rahmanef.com/version` -> `502 Bad Gateway`
- `https://dbgg.rahmanef.com/api/query` -> `502 Bad Gateway`

Akibat langsung:

- `manef-ui` tidak bisa login karena preflight auth ke backend gagal
- UI menampilkan error `service_unavailable`

## Verified state of Convex production

`convex deploy -y` menarget production deployment Convex, bukan dev.

Temuan yang sudah diverifikasi:

- `.env.local` menunjuk deployment dev `proficient-cricket-724`
- `convex deploy` default ke deployment prod `peaceful-dove-887`
- env production Convex sempat kosong sampai diisi manual

Perintah cek yang dipakai:

```bash
npx convex env list --prod
```

## Current deployment confusion

Saat ini ada dua mode yang sempat tercampur:

### Mode A: Convex Cloud + proxy

Repo ini menjalankan `convex deploy` ke Convex Cloud production, lalu domain
publik `dbgg.rahmanef.com` seharusnya diteruskan oleh `docker-compose.yml`.

Env Dokploy yang benar untuk mode ini:

```env
PUBLIC_DB_DOMAIN=dbgg.rahmanef.com
UPSTREAM_CONVEX_URL=https://peaceful-dove-887.convex.cloud
```

### Mode B: Self-hosted Convex

Repo ini juga punya `docker-compose.selfhost.yml` dengan env seperti:

```env
INSTANCE_SECRET
CONVEX_CLOUD_ORIGIN
CONVEX_SITE_ORIGIN
NEXT_PUBLIC_DEPLOYMENT_URL
```

Mode ini tidak boleh dicampur dengan `Convex Cloud + proxy` pada app Dokploy
yang sama.

## Recommended active mode

Untuk status saat dokumen ini dibuat, mode yang paling konsisten adalah:

- tetap pakai `Convex Cloud + proxy`
- gunakan `docker-compose.yml`
- jangan pakai env self-hosted pada app Dokploy `manef-db`

Alasannya:

- production Convex Cloud sudah dipakai via `convex deploy`
- blocker utama sekarang adalah routing/proxy Dokploy, bukan migrasi penuh ke
  self-hosted runtime

## Auth config work already done

Patch yang sudah ada di repo:

- `41556e9` `fix(auth): use issuer for custom jwt config`
- `825a2f4` `fix(auth): derive convex issuer from hosted url`
- `fef8458` `feat(auth): trust custom jwt issuer from manef-ui`
- `57c7813` `fix(workspaces): avoid invalid member index lookup`

Current auth config intent:

- issuer JWT browser auth diturunkan dari `HOSTED_URL`
- audience default: `manef-ui`
- browser JWT diverifikasi via JWKS dari `https://gg.rahmanef.com/api/convex-auth/.well-known/jwks.json`

## Required runtime env in Convex production

Minimal env production Convex yang harus tetap ada:

```env
AUTH_ADMIN_EMAIL=rahmanef63@gmail.com
AUTH_ADMIN_NAME=Rahman
AUTH_ADMIN_PASSWORD=namam
AUTH_ADMIN_ROLES=admin
CONVEX_AUTH_AUDIENCE=manef-ui
HOSTED_URL=https://gg.rahmanef.com
RESEND_API_KEY=<optional but already available>
```

## Required Dokploy env for cloud + proxy mode

App Dokploy `manef-db` seharusnya hanya punya:

```env
PUBLIC_DB_DOMAIN=dbgg.rahmanef.com
UPSTREAM_CONVEX_URL=https://peaceful-dove-887.convex.cloud
```

Env self-hosted berikut harus dihapus jika app ini memang cloud + proxy:

```env
INSTANCE_SECRET
CONVEX_CLOUD_ORIGIN
CONVEX_SITE_ORIGIN
NEXT_PUBLIC_DEPLOYMENT_URL
```

## Webhook note

Menguji Dokploy deploy webhook dengan:

```bash
curl https://backend.rahmanef.com/api/deploy/<token>
```

menghasilkan:

```json
{"message":"Branch Not Match"}
```

Ini bukan health check backend production. Itu menunjukkan webhook deploy tidak
menerima branch/payload yang cocok untuk auto deploy. Untuk verifikasi backend,
gunakan health check publik seperti `/version`, bukan webhook URL.

## Recommended next steps

1. Pastikan app Dokploy `manef-db` memakai `docker-compose.yml`, bukan
   `docker-compose.selfhost.yml`.
2. Set env Dokploy hanya untuk mode proxy cloud.
3. Redeploy `manef-db` dari UI Dokploy.
4. Ulangi cek:

```bash
curl.exe -i https://dbgg.rahmanef.com/version
```

Target minimal:

- status `200`
- bukan `502 Bad Gateway`

5. Setelah backend hijau, lanjut cek auth bridge di `manef-ui`.
