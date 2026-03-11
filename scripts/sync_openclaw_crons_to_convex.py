#!/usr/bin/env python3
"""Mirror OpenClaw cron job store into project Convex cron jobs."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from _runtime_sync import TENANT_ID, print_summary, run_convex

CRON_STORE_PATH = Path(os.path.expanduser("~/.openclaw/cron/jobs.json"))


def format_interval(ms: int | None) -> str | None:
    if not ms:
        return None
    units = [
        ("d", 86_400_000),
        ("h", 3_600_000),
        ("m", 60_000),
        ("s", 1_000),
    ]
    for suffix, unit_ms in units:
        if ms % unit_ms == 0:
            return f"{ms // unit_ms}{suffix}"
    return f"{ms}ms"


def compact(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def main() -> int:
    with CRON_STORE_PATH.open("r", encoding="utf-8") as fh:
        store = json.load(fh)

    jobs = store.get("jobs", []) or []
    payload = []

    for job in jobs:
        schedule = job.get("schedule") or {}
        state = job.get("state") or {}
        delivery = job.get("delivery") or {}
        payload_config = job.get("payload") or {}
        session_target = job.get("sessionTarget")
        every_ms = schedule.get("everyMs")

        payload.append(
            compact(
                {
                    "runtimeJobId": job.get("id"),
                    "name": job.get("name") or job.get("id") or "unnamed job",
                    "description": job.get("description"),
                    "agentId": payload_config.get("agentId"),
                    "schedule": schedule.get("kind") or "every",
                    "interval": format_interval(every_ms),
                    "intervalMs": every_ms,
                    "cronExpression": schedule.get("cron"),
                    "prompt": payload_config.get("message"),
                    "delivery": delivery.get("mode"),
                    "enabled": bool(job.get("enabled", False)),
                    "isolated": session_target == "isolated",
                    "deleteAfterRun": job.get("deleteAfterRun"),
                    "sessionTarget": session_target,
                    "wakeMode": job.get("wakeMode"),
                    "failureAlert": job.get("failureAlert"),
                    "lastRunAt": state.get("lastRunAtMs"),
                    "lastRunStatus": state.get("lastRunStatus") or state.get("lastStatus"),
                    "nextRunAt": state.get("nextRunAtMs"),
                    "runCount": state.get("runCount"),
                    "tenantId": TENANT_ID,
                    "source": "openclaw-runtime",
                    "createdAt": job.get("createdAtMs"),
                    "updatedAt": job.get("updatedAtMs"),
                }
            )
        )

    result = run_convex("features/crons/api:syncRuntimeJobs", {"jobs": payload})
    print_summary("crons", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
