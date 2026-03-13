# deploy-check

Pre-deploy checklist untuk manef-db sebelum `npm run deploy:ci`.

## Cek Otomatis

```bash
cd /home/rahman/projects/manef-db

# 1. Cek return types (scan untuk query/mutation tanpa returns:)
grep -n "export const" convex/features/*/api.ts | grep -v "returns:"
# Jika ada output → ada fungsi tanpa return type

# 2. Cek schema import di root
python3 -c "
import re
with open('convex/schema.ts') as f: content = f.read()
imports = re.findall(r'import \{.*?Schema.*?\}', content)
for i in imports: print(i)
"

# 3. Cek pending git changes
git status --short convex/

# 4. Cek TypeScript compile
npx tsc --noEmit 2>&1 | head -30
```

## Manual Checklist

- [ ] Semua query/mutation punya `returns: v.xxx()`
- [ ] Schema baru sudah diimport di `convex/schema.ts`
- [ ] Write-through mutations punya `syncOutbox` insert
- [ ] Python sync scripts tidak break dengan schema baru
- [ ] Tidak ada breaking change ke `@manef/db` exports

## Deploy

```bash
npm run deploy:ci
```

## Post-Deploy

```bash
# Sync vendor ke manef-ui
bash /home/rahman/projects/manef-ui/scripts/sync-vendor.sh

# Verifikasi backend accessible
curl -si https://dbgg.rahmanef.com/version

# Test sync runtime (jika ada schema change terkait sync)
npm run sync:runtime:agents  # atau domain yang relevan
```
