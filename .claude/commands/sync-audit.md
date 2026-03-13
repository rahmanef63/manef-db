# sync-audit

Audit status sinkronisasi runtime OpenClaw ke Convex.

Gunakan agent `sync-monitor` untuk audit lengkap.

## Quick Commands

```bash
# Status gateway
openclaw gateway status
sudo ss -tlnp | grep 18789

# Status timer
systemctl --user list-timers | grep manef

# Manual full sync
cd /home/rahman/projects/manef-db && npm run sync:runtime

# Manual per domain
npm run sync:runtime:agents
npm run sync:runtime:sessions
npm run sync:runtime:channels
npm run sync:runtime:config
npm run sync:runtime:crons
npm run sync:runtime:skills
npm run sync:runtime:logs
npm run sync:runtime:nodes

# Lihat log sync terakhir
journalctl --user -u manef-openclaw-runtime-sync.service -n 50 --no-pager
```

## Restart Timer (jika tidak jalan)

```bash
systemctl --user restart manef-openclaw-runtime-sync.timer
systemctl --user enable manef-openclaw-runtime-sync.timer
```
