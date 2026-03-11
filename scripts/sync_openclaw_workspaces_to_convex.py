#!/usr/bin/env python3
"""Mirror OpenClaw workspace documents into Convex workspaceFiles and agents."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from _runtime_sync import (
    OPENCLAW_ROOT,
    TENANT_ID,
    load_openclaw_config,
    print_summary,
    run_convex,
)

DOC_FILE_CANDIDATES: dict[str, list[str]] = {
    "agentsMd": ["AGENTS.md", "agents.md"],
    "bootstrapMd": ["BOOTSTRAP.md", "bootstrap.md"],
    "heartbeatMd": ["HEARTBEAT.md", "heartbeat.md"],
    "identityMd": ["IDENTITY.md", "identity.md"],
    "memoryMd": ["MEMORY.md", "memory.md"],
    "soulMd": ["SOUL.md", "soul.md"],
    "toolsMd": ["TOOLS.md", "tools.md"],
    "userMd": ["USER.md", "user.md"],
}


def resolve_workspace_path(agent_id: str, workspace_value: Any) -> Path | None:
    candidates: list[Path] = []
    if isinstance(workspace_value, str) and workspace_value.strip():
        raw = Path(workspace_value.strip())
        candidates.append(raw if raw.is_absolute() else OPENCLAW_ROOT / raw)

    if agent_id == "main":
        candidates.append(OPENCLAW_ROOT / "workspace")
    else:
        candidates.append(OPENCLAW_ROOT / f"workspace-{agent_id}")

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists() and candidate.is_dir():
            return candidate
    return None


def read_workspace_docs(workspace_path: Path) -> tuple[dict[str, str], list[dict[str, Any]]]:
    docs: dict[str, str] = {}
    files: list[dict[str, Any]] = []

    for field_name, candidate_names in DOC_FILE_CANDIDATES.items():
        target_path = next((workspace_path / name for name in candidate_names if (workspace_path / name).exists()), None)
        if target_path is None or not target_path.is_file():
            continue

        content = target_path.read_text(encoding="utf-8", errors="ignore")
        docs[field_name] = content
        files.append(
            {
                "category": field_name,
                "content": content,
                "description": f"Runtime mirror of {target_path.name}",
                "fileType": "markdown",
                "parsedData": {
                    "field": field_name,
                    "fileName": target_path.name,
                    "workspacePath": str(workspace_path),
                },
                "path": str(target_path),
                "source": "openclaw-runtime",
                "tags": ["openclaw-runtime", "workspace-doc", field_name],
                "tenantId": TENANT_ID,
            }
        )

    return docs, files


def main() -> int:
    config = load_openclaw_config()
    agents = (config.get("agents") or {}).get("list", []) or []

    files_payload: list[dict[str, Any]] = []
    trees_payload: list[dict[str, Any]] = []
    agent_payload: list[dict[str, Any]] = []

    for agent in agents:
        agent_id = str(agent.get("id") or "").strip()
        if not agent_id:
            continue

        workspace_path = resolve_workspace_path(agent_id, agent.get("workspace"))
        if workspace_path is None:
            continue

        docs, files = read_workspace_docs(workspace_path)
        for entry in files:
            entry["agentId"] = agent_id
        files_payload.extend(files)

        trees_payload.append(
            {
                "agentId": agent_id,
                "description": f"Runtime workspace mirror for {agent.get('name') or agent_id}.",
                "fileCount": len(files),
                "name": agent.get("name") or agent_id,
                "rootPath": str(workspace_path),
                "runtimePath": str(workspace_path),
                "source": "openclaw-runtime",
                "status": "active",
                "type": "agent",
            }
        )

        agent_entry: dict[str, Any] = {
            "agentId": agent_id,
            "name": agent.get("name") or agent_id,
            "type": "main" if agent_id == "main" else "agent",
            "status": "active",
            "workspacePath": str(workspace_path),
            "tenantId": TENANT_ID,
            **docs,
        }
        agent_dir = agent.get("agentDir")
        if isinstance(agent_dir, str) and agent_dir.strip():
            agent_entry["agentDir"] = agent_dir

        config_payload = {
            "workspace": agent.get("workspace"),
            "agentDir": agent_dir,
        }
        agent_entry["config"] = {
            key: value for key, value in config_payload.items() if value is not None
        }
        agent_payload.append(agent_entry)

    workspace_result = run_convex(
        "features/workspace/api:syncRuntimeWorkspaceSnapshot",
        {"files": files_payload, "trees": trees_payload},
    )
    agents_result = run_convex(
        "features/agents/api:syncRuntimeAgents",
        {"agents": agent_payload},
    )
    print_summary(
        "workspaces",
        {
            "workspace": workspace_result,
            "agents": agents_result,
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
