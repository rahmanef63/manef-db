#!/usr/bin/env python3
"""Mirror OpenClaw local session stores into project Convex sessions."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from _runtime_sync import TENANT_ID, print_summary, run_convex

AGENTS_DIR = Path.home() / ".openclaw" / "agents"


def parse_timestamp_ms(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            from datetime import datetime

            return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
        except ValueError:
            return 0
    return 0


def summarize_jsonl(path: Path) -> tuple[int, int]:
    message_count = 0
    last_ts = 0
    if not path.exists():
        return message_count, last_ts
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") == "message":
                message_count += 1
            ts = parse_timestamp_ms(entry.get("timestamp"))
            if ts > last_ts:
                last_ts = ts
    return message_count, last_ts


def compact(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def main() -> int:
    payload: list[dict[str, Any]] = []

    for sessions_path in sorted(AGENTS_DIR.glob("*/sessions/sessions.json")):
        agent_id = sessions_path.parent.parent.name
        try:
            store = json.load(sessions_path.open("r", encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(store, dict):
            continue

        for session_key, record in store.items():
            if not isinstance(record, dict):
                continue
            session_file = record.get("sessionFile")
            jsonl_path = Path(session_file) if session_file else None
            message_count, file_last_ts = summarize_jsonl(jsonl_path) if jsonl_path else (0, 0)
            last_active_at = int(record.get("updatedAt") or 0)
            last_active_at = max(last_active_at, file_last_ts)
            created_at = file_last_ts or last_active_at or 0
            origin = record.get("origin") or {}
            payload.append(
                compact({
                    "sessionKey": str(session_key),
                    "agentId": agent_id,
                    "channel": origin.get("provider") or record.get("lastChannel"),
                    "status": "active",
                    "messageCount": message_count,
                    "createdAt": created_at,
                    "lastActiveAt": last_active_at,
                    "tenantId": TENANT_ID,
                    "metadata": {
                        "source": "openclaw-runtime",
                        "runtimeSessionId": record.get("sessionId"),
                        "sessionFile": str(jsonl_path) if jsonl_path else None,
                        "origin": origin,
                        "chatType": record.get("chatType"),
                        "lastChannel": record.get("lastChannel"),
                        "lastTo": record.get("lastTo"),
                        "lastAccountId": record.get("lastAccountId"),
                    },
                })
            )

    result = run_convex("features/sessions/api:syncRuntimeSessions", {"sessions": payload})
    print_summary("sessions", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
