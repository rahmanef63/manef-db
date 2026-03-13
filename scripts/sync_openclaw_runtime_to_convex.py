#!/usr/bin/env python3
"""Run all available OpenClaw runtime -> Convex sync jobs."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS = [
    "process_openclaw_outbox.py",
    "sync_openclaw_agents_to_convex.py",
    "sync_openclaw_workspaces_to_convex.py",
    "sync_openclaw_sessions_to_convex.py",
    "sync_openclaw_config_to_convex.py",
    "sync_openclaw_crons_to_convex.py",
    "sync_openclaw_skills_to_convex.py",
    "sync_openclaw_channels_to_convex.py",
    "sync_openclaw_logs_to_convex.py",
    "sync_openclaw_nodes_to_convex.py",
]


def main() -> int:
    root = Path(__file__).resolve().parent
    for script in SCRIPTS:
        proc = subprocess.run([sys.executable, str(root / script)], check=False)
        if proc.returncode != 0:
            return proc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
