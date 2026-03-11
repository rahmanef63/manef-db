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


def extract_owner_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    if not digits:
        return None
    if digits.startswith("62"):
        return f"+{digits}"
    if digits.startswith("0"):
        return f"+62{digits[1:]}"
    if digits.startswith("8"):
        return f"+62{digits}"
    return f"+{digits}"


def derive_owner_name(agent_name: str | None, agent_id: str) -> str:
    base = (agent_name or agent_id).strip()
    for suffix in (" Agent", " Workspace"):
        if base.endswith(suffix):
            return base[: -len(suffix)].strip()
    return base


def infer_parent_agent_id(agent_id: str, known_agent_ids: set[str]) -> str | None:
    parts = [part for part in agent_id.split("-") if part]
    if len(parts) <= 1:
        return None

    for end in range(len(parts) - 1, 0, -1):
        candidate = "-".join(parts[:end])
        if candidate in known_agent_ids:
            return candidate
    return None


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
    known_agent_ids = {
        str(agent.get("id") or "").strip()
        for agent in agents
        if str(agent.get("id") or "").strip()
    }
    runtime_paths_by_agent: dict[str, str] = {}
    owner_meta_by_agent: dict[str, dict[str, Any]] = {}

    files_payload: list[dict[str, Any]] = []
    trees_payload: list[dict[str, Any]] = []
    agent_payload: list[dict[str, Any]] = []
    bindings_payload: list[dict[str, Any]] = []

    for binding in config.get("bindings", []) or []:
        agent_id = str(binding.get("agentId") or "").strip()
        if not agent_id:
            continue
        match = binding.get("match") or {}
        channel = str(match.get("channel") or "").strip()
        peer = match.get("peer") or {}
        peer_id = str(peer.get("id") or "").strip()
        peer_kind = str(peer.get("kind") or "").strip()
        if channel != "whatsapp" or peer_kind != "direct" or not peer_id:
            continue
        owner_meta_by_agent[agent_id] = {
            "ownerChannel": channel,
            "ownerExternalId": peer_id,
            "ownerPhone": extract_owner_phone(peer_id),
        }

    for agent in agents:
        agent_id = str(agent.get("id") or "").strip()
        if not agent_id:
            continue

        workspace_path = resolve_workspace_path(agent_id, agent.get("workspace"))
        if workspace_path is None:
            continue
        runtime_paths_by_agent[agent_id] = str(workspace_path)

    for agent in agents:
        agent_id = str(agent.get("id") or "").strip()
        if not agent_id:
            continue

        workspace_path_value = runtime_paths_by_agent.get(agent_id)
        if workspace_path_value is None:
            continue
        workspace_path = Path(workspace_path_value)

        docs, files = read_workspace_docs(workspace_path)
        for entry in files:
            entry["agentId"] = agent_id
        files_payload.extend(files)

        parent_agent_id = infer_parent_agent_id(agent_id, known_agent_ids)
        owner_meta = owner_meta_by_agent.get(agent_id)
        if owner_meta is None and parent_agent_id:
            owner_meta = owner_meta_by_agent.get(parent_agent_id)
        if owner_meta is None:
            owner_meta = {}
        owner_name_source = (
            next(
                (
                    candidate.get("name")
                    for candidate in agents
                    if str(candidate.get("id") or "").strip() == parent_agent_id
                ),
                agent.get("name"),
            )
            if parent_agent_id and owner_meta
            else agent.get("name")
        )

        tree_entry: dict[str, Any] = {
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
        if owner_meta:
            tree_entry["ownerChannel"] = owner_meta.get("ownerChannel")
            tree_entry["ownerExternalId"] = owner_meta.get("ownerExternalId")
            tree_entry["ownerName"] = derive_owner_name(owner_name_source, agent_id)
            tree_entry["ownerPhone"] = owner_meta.get("ownerPhone")
        if parent_agent_id:
            tree_entry["parentAgentId"] = parent_agent_id
            parent_runtime_path = runtime_paths_by_agent.get(parent_agent_id)
            if parent_runtime_path:
                tree_entry["parentRuntimePath"] = parent_runtime_path
        trees_payload.append(tree_entry)
        bindings_payload.append(
            {
                "agentId": agent_id,
                "inheritToChildren": True,
                "isPrimary": True,
                "relation": "primary",
                "runtimePath": str(workspace_path),
                "source": "openclaw-runtime",
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
        {"bindings": bindings_payload, "files": files_payload, "trees": trees_payload},
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
