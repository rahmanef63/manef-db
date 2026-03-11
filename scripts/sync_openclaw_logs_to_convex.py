#!/usr/bin/env python3
"""Mirror recent OpenClaw gateway journal logs into project Convex."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from _runtime_sync import TENANT_ID, ensure_state_dir, print_summary, run_convex

CURSOR_FILE = ensure_state_dir() / "gateway-journal.cursor"
MAX_BATCH = 200


def level_from_priority(priority: str | None) -> str:
    mapping = {
        "0": "error",
        "1": "error",
        "2": "error",
        "3": "error",
        "4": "warn",
        "5": "info",
        "6": "info",
        "7": "debug",
    }
    return mapping.get(str(priority), "info")


def source_from_entry(entry: dict) -> str:
    message = str(entry.get("MESSAGE") or "")
    if "[whatsapp]" in message:
        return "whatsapp"
    if "[telegram]" in message:
        return "telegram"
    if "[gateway]" in message:
        return "gateway"
    return str(entry.get("SYSLOG_IDENTIFIER") or "gateway")


def timestamp_ms(entry: dict) -> int:
    realtime = entry.get("__REALTIME_TIMESTAMP")
    if realtime is None:
        return 0
    return int(int(realtime) / 1000)


def read_cursor() -> str | None:
    if not CURSOR_FILE.exists():
        return None
    return CURSOR_FILE.read_text(encoding="utf-8").strip() or None


def write_cursor(cursor: str | None) -> None:
    if cursor:
        CURSOR_FILE.write_text(cursor, encoding="utf-8")


def main() -> int:
    cursor = read_cursor()
    cmd = ["journalctl", "--user-unit", "openclaw-gateway", "-n", str(MAX_BATCH), "-o", "json"]
    if cursor:
        cmd.extend(["--after-cursor", cursor])

    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())

    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    if not lines:
        print_summary("logs", {"upserted": 0, "cursor": cursor})
        return 0

    entries = [json.loads(line) for line in lines]
    logs = []
    for entry in entries:
        runtime_key = entry.get("__CURSOR")
        if not runtime_key:
            continue
        logs.append(
            {
                "runtimeKey": runtime_key,
                "level": level_from_priority(entry.get("PRIORITY")),
                "source": source_from_entry(entry),
                "message": str(entry.get("MESSAGE") or ""),
                "details": {
                    "unit": entry.get("_SYSTEMD_UNIT"),
                    "identifier": entry.get("SYSLOG_IDENTIFIER"),
                    "priority": entry.get("PRIORITY"),
                },
                "timestamp": timestamp_ms(entry),
                "tenantId": TENANT_ID,
            }
        )

    result = run_convex("features/logs/api:syncRuntimeLogs", {"logs": logs})
    write_cursor(entries[-1].get("__CURSOR"))
    print_summary("logs", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
