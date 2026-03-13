#!/usr/bin/env python3
"""Mirror OpenClaw gateway node info into Convex nodes table."""

from __future__ import annotations

import json
import platform
import socket
import subprocess
from typing import Any

from _runtime_sync import TENANT_ID, load_openclaw_config, print_summary, run_convex


def get_gateway_status() -> dict:
    """Run `openclaw gateway status --json` and return parsed output."""
    try:
        result = subprocess.run(
            ["openclaw", "gateway", "status", "--json"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception:
        pass
    return {}


def get_paired_nodes() -> list[dict]:
    """Run `openclaw nodes list --json` and return parsed output."""
    try:
        result = subprocess.run(
            ["openclaw", "nodes", "list", "--json"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return data.get("nodes", [])
    except Exception:
        pass
    return []


def main() -> int:
    hostname = socket.gethostname()
    sys_platform = platform.system() + " " + platform.release()

    gateway_status = get_gateway_status()
    paired_nodes = get_paired_nodes()

    payload: list[dict[str, Any]] = []

    # Always include the gateway node (local machine)
    gateway_online = gateway_status.get("running", False) or bool(gateway_status)
    payload.append({
        "nodeId": f"gateway:{hostname}",
        "name": hostname,
        "host": "gateway",
        "online": gateway_online,
        "capabilities": ["gateway", "agent-runner"],
        "platform": sys_platform,
        "tenantId": TENANT_ID,
    })

    # Add paired remote nodes
    for node in paired_nodes:
        node_id = str(node.get("id") or node.get("nodeId") or "").strip()
        if not node_id:
            continue
        payload.append({
            "nodeId": node_id,
            "name": str(node.get("name") or node_id),
            "host": str(node.get("host") or node_id),
            "online": bool(node.get("online", False)),
            "capabilities": node.get("capabilities") or [],
            "platform": str(node.get("platform") or ""),
            "tenantId": TENANT_ID,
        })

    result = run_convex("features/nodes/api:syncRuntimeNodes", {"nodes": payload})
    print_summary("nodes", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
