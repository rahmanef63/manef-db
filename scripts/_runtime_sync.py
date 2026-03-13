#!/usr/bin/env python3
"""Helpers for mirroring OpenClaw runtime snapshots into project Convex."""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import tempfile
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = Path(os.path.expanduser("~/.local/state/manef-db/openclaw-runtime-sync"))
OPENCLAW_ROOT = Path(os.path.expanduser("~/.openclaw"))
OPENCLAW_CONFIG_PATH = Path(os.path.expanduser("~/.openclaw/openclaw.json"))
OPENCLAW_BIN = os.environ.get("OPENCLAW_BIN", os.path.expanduser("~/.local/bin/openclaw"))
TENANT_ID = os.environ.get("APP_TENANT_ID", "rahman-main")


def ensure_state_dir() -> Path:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    return STATE_DIR


def load_openclaw_config() -> dict[str, Any]:
    with OPENCLAW_CONFIG_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def run_convex(fn: str, args: dict[str, Any]) -> Any:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as fh:
        json.dump(args, fh, ensure_ascii=False)
        args_path = fh.name

    command = (
        f"npx convex run {shlex.quote(fn)} "
        f"\"$(cat {shlex.quote(args_path)})\""
    )
    proc = subprocess.run(
        ["/bin/bash", "-lc", command],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    try:
        os.unlink(args_path)
    except FileNotFoundError:
        pass

    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())

    out = (proc.stdout or "").strip()
    return json.loads(out) if out else None


def redact_config(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, nested in value.items():
            lowered = key.lower()
            if any(token in lowered for token in ("token", "secret", "password", "key")):
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = redact_config(nested)
        return redacted

    if isinstance(value, list):
        return [redact_config(item) for item in value]

    return value


def print_summary(name: str, payload: Any) -> None:
    print(json.dumps({"sync": name, "result": payload}, ensure_ascii=False))
    # Record audit entry in Convex (best-effort, non-blocking)
    try:
        audit_args: dict[str, Any] = {
            "domain": name,
            "status": "ok" if payload else "partial",
            "tenantId": TENANT_ID,
        }
        if isinstance(payload, dict):
            for field in ("inserted", "updated", "unchanged", "deleted", "upserted", "failed"):
                if field in payload:
                    audit_args[field] = payload[field]
        run_convex("features/debug/api:recordSyncAudit", audit_args)
    except Exception:
        pass  # Audit is best-effort; never block main sync on failure


def record_sync_error(name: str, error: Exception) -> None:
    """Record a failed sync run in the audit log."""
    try:
        run_convex("features/debug/api:recordSyncAudit", {
            "domain": name,
            "status": "error",
            "error": str(error),
            "tenantId": TENANT_ID,
        })
    except Exception:
        pass
