#!/usr/bin/env python3
"""Production smoke tests for dashboard features backed by Convex."""

from __future__ import annotations

import json
import subprocess
import time
import uuid

from _runtime_sync import run_convex


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    scopes = run_convex("openclawNavigator:listScopes", {})
    require(isinstance(scopes, dict), "navigator response must be an object")
    roots = scopes.get("roots", [])
    require(isinstance(roots, list), "navigator roots must be a list")

    scope_agent_ids = roots[0]["agentIds"] if roots else []

    agents = run_convex(
        "features/agents/api:getAgents",
        {"agentIds": scope_agent_ids} if scope_agent_ids else {},
    )
    require(isinstance(agents, list), "agents response must be a list")
    require(len(agents) > 0, "agents must be non-empty")

    skills = run_convex("features/skills/api:listSkills", {})
    require(isinstance(skills, list) and len(skills) > 0, "skills must be non-empty")
    first_skill = skills[0]
    original_enabled = first_skill["enabled"]
    run_convex(
        "features/skills/api:toggleSkill",
        {"id": first_skill["_id"], "enabled": not original_enabled},
    )
    subprocess.run(
        ["python3", "scripts/sync_openclaw_skills_to_convex.py"],
        check=True,
    )
    toggled_skills = run_convex("features/skills/api:listSkills", {})
    toggled = next(skill for skill in toggled_skills if skill["_id"] == first_skill["_id"])
    require(
        toggled["enabled"] == (not original_enabled),
        "skill toggle did not persist after runtime sync",
    )
    run_convex(
        "features/skills/api:toggleSkill",
        {"id": first_skill["_id"], "enabled": original_enabled},
    )

    channels = run_convex("features/channels/api:listChannels", {})
    require(isinstance(channels, list) and len(channels) > 0, "channels must be non-empty")

    config_entries = run_convex("features/config/api:listConfig", {"tenantId": "rahman-main"})
    require(
        isinstance(config_entries, list) and len(config_entries) > 0,
        "config entries must be non-empty",
    )

    workspace_docs = run_convex(
        "features/workspace/api:getFiles",
        {"category": "identityMd", "tenantId": "rahman-main"},
    )
    require(
        isinstance(workspace_docs, list) and len(workspace_docs) > 0,
        "workspace runtime documents must be non-empty",
    )

    cron_jobs = run_convex("features/crons/api:listJobs", {})
    require(isinstance(cron_jobs, list), "cron jobs response must be a list")

    logs = run_convex("features/logs/api:getRecentLogs", {"limit": 5})
    require(isinstance(logs, list), "logs response must be a list")
    if logs:
        source = logs[0]["source"]
        filtered_logs = run_convex(
            "features/logs/api:getRecentLogs",
            {"limit": 20, "source": source},
        )
        require(
            all(entry["source"] == source for entry in filtered_logs),
            "log source filter returned mismatched source",
        )

    session_key = f"smoke:{uuid.uuid4().hex}"
    runtime_sessions = run_convex(
        "features/sessions/api:getSessions",
        {"includeUnknown": True, "limit": 20},
    )
    require(isinstance(runtime_sessions, list), "runtime sessions response must be a list")

    session_id = run_convex(
        "features/sessions/api:createSession",
        {"sessionKey": session_key},
    )
    require(session_id, "session create did not return an id")
    sessions = run_convex(
        "features/sessions/api:getSessions",
        {"includeUnknown": True, "limit": 200},
    )
    require(
        any(session["sessionKey"] == session_key for session in sessions),
        "created session not visible in sessions list",
    )
    run_convex("features/sessions/api:deleteSession", {"id": session_id})
    sessions_after_delete = run_convex(
        "features/sessions/api:getSessions",
        {"includeUnknown": True, "limit": 200},
    )
    require(
        all(session["sessionKey"] != session_key for session in sessions_after_delete),
        "deleted session still visible in sessions list",
    )

    nodes = run_convex("features/nodes/api:listNodes", {})
    require(isinstance(nodes, list), "nodes response must be a list")
    approvals = run_convex(
        "features/nodes/api:getExecApprovals",
        {"host": "gateway", "agentId": (scope_agent_ids[0] if scope_agent_ids else "main")},
    )
    require(approvals is None or isinstance(approvals, dict), "approval response invalid")

    print(
        json.dumps(
            {
                "ok": True,
                "roots": len(roots),
                "agents": len(agents),
                "skills": len(skills),
                "channels": len(channels),
                "configEntries": len(config_entries),
                "workspaceDocs": len(workspace_docs),
                "cronJobs": len(cron_jobs),
                "logsChecked": len(logs),
                "nodes": len(nodes),
                "timestamp": int(time.time() * 1000),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
