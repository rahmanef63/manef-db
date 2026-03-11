#!/usr/bin/env python3
"""Mirror OpenClaw agent registry into project Convex agents."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from _runtime_sync import TENANT_ID, load_openclaw_config, print_summary, redact_config, run_convex


def main() -> int:
    config = load_openclaw_config()
    agents = (config.get("agents") or {}).get("list", []) or []
    bindings = config.get("bindings", []) or []

    channels_by_agent: dict[str, set[str]] = defaultdict(set)
    for binding in bindings:
        agent_id = str(binding.get("agentId") or "").strip()
        channel = str(((binding.get("match") or {}).get("channel")) or "").strip()
        if agent_id and channel:
            channels_by_agent[agent_id].add(channel)

    payload: list[dict[str, Any]] = []
    for agent in agents:
        agent_id = str(agent.get("id") or "").strip()
        if not agent_id:
            continue
        workspace = agent.get("workspace")
        agent_dir = agent.get("agentDir")
        runtime_config = redact_config(agent)
        runtime_config["workspace"] = workspace
        runtime_config["agentDir"] = agent_dir
        runtime_config["boundChannels"] = sorted(channels_by_agent.get(agent_id, set()))

        payload.append(
            {
                "agentId": agent_id,
                "name": agent.get("name") or agent_id,
                "type": "main" if agent_id == "main" else "agent",
                "status": "active",
                "model": agent.get("model"),
                "capabilities": sorted(channels_by_agent.get(agent_id, set())),
                "config": runtime_config,
                "tenantId": TENANT_ID,
            }
        )

    result = run_convex("features/agents/api:syncRuntimeAgents", {"agents": payload})
    print_summary("agents", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
