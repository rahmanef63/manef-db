#!/usr/bin/env python3
"""Process dashboard syncOutbox items and write safe local metadata to openclaw.json."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from _runtime_sync import OPENCLAW_CONFIG_PATH, ensure_state_dir, print_summary, run_convex

HANDLED_ENTITY_TYPES = {
    "channel_binding",
    "identity_binding",
    "channel_binding_policy",
    "config",
    "agent",
}


def load_config() -> dict[str, Any]:
    with OPENCLAW_CONFIG_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_config(config: dict[str, Any]) -> None:
    ensure_state_dir()
    backup_dir = ensure_state_dir()
    backup_path = backup_dir / f"openclaw.json.{int(time.time() * 1000)}.bak"
    if OPENCLAW_CONFIG_PATH.exists():
        backup_path.write_text(OPENCLAW_CONFIG_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    tmp_path = Path(f"{OPENCLAW_CONFIG_PATH}.tmp")
    tmp_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp_path.replace(OPENCLAW_CONFIG_PATH)


def ensure_dashboard_section(config: dict[str, Any]) -> dict[str, Any]:
    manef = config.setdefault("manef", {})
    dashboard = manef.setdefault("dashboard", {})
    dashboard.setdefault("workspaceChannelBindings", [])
    dashboard.setdefault("identityWorkspaceBindings", [])
    dashboard.setdefault("channelBindingPolicies", [])
    return dashboard


def upsert_by_key(items: list[dict[str, Any]], key_fn, payload: dict[str, Any]) -> None:
    key = key_fn(payload)
    for index, item in enumerate(items):
        if key_fn(item) == key:
            items[index] = payload
            return
    items.append(payload)


def delete_by_key(items: list[dict[str, Any]], key_fn, payload: dict[str, Any]) -> None:
    key = key_fn(payload)
    items[:] = [item for item in items if key_fn(item) != key]


def set_nested(obj: dict[str, Any], dot_path: str, value: Any) -> None:
    """Set a value at a dot-notation path, creating intermediate dicts as needed."""
    parts = dot_path.split(".")
    for part in parts[:-1]:
        if part not in obj or not isinstance(obj[part], dict):
            obj[part] = {}
        obj = obj[part]
    obj[parts[-1]] = value


def delete_nested(obj: dict[str, Any], dot_path: str) -> None:
    """Delete a key at a dot-notation path if it exists."""
    parts = dot_path.split(".")
    for part in parts[:-1]:
        if part not in obj or not isinstance(obj[part], dict):
            return
        obj = obj[part]
    obj.pop(parts[-1], None)


def handle_config(config: dict[str, Any], item: dict[str, Any], payload: dict[str, Any]) -> None:
    """Write config entry to openclaw.json via runtimePath or skip if no path."""
    runtime_path = payload.get("runtimePath")
    if not runtime_path:
        # No runtime path — store in manef.dashboard.configOverrides only
        overrides = config.setdefault("manef", {}).setdefault("dashboard", {}).setdefault("configOverrides", {})
        key = payload.get("key", "")
        if item["operation"] == "delete":
            overrides.pop(key, None)
        else:
            overrides[key] = payload.get("value", "")
        return

    if item["operation"] == "delete":
        delete_nested(config, runtime_path)
    else:
        value_str = payload.get("value", "")
        # Try to parse as JSON for non-string types
        value_type = payload.get("valueType", "string")
        if value_type == "boolean":
            value = value_str.lower() in ("true", "1", "yes")
        elif value_type == "number":
            try:
                value = float(value_str) if "." in value_str else int(value_str)
            except (ValueError, TypeError):
                value = value_str
        elif value_type == "json":
            try:
                value = json.loads(value_str)
            except (json.JSONDecodeError, TypeError):
                value = value_str
        else:
            value = value_str
        set_nested(config, runtime_path, value)


def handle_agent(config: dict[str, Any], item: dict[str, Any], payload: dict[str, Any]) -> None:
    """Update agent fields in openclaw.json agents.list."""
    agent_id = payload.get("agentId")
    if not agent_id:
        return

    agents_section = config.setdefault("agents", {})
    agent_list: list[dict[str, Any]] = agents_section.setdefault("list", [])

    # Find existing agent entry
    existing = next((a for a in agent_list if a.get("id") == agent_id), None)

    if item["operation"] == "archive":
        # Mark agent as disabled in manef dashboard overlay only (don't remove from list)
        overrides = config.setdefault("manef", {}).setdefault("dashboard", {}).setdefault("agentOverrides", {})
        overrides[agent_id] = {"status": "archived", "archivedAt": int(time.time() * 1000)}
        return

    if item["operation"] == "update" and existing is not None:
        # Only update fields that are safe to change from dashboard
        if payload.get("model") is not None:
            existing["model"] = payload["model"]
        if payload.get("name") is not None:
            existing["name"] = payload["name"]


def main() -> int:
    outbox = run_convex("features/core/api:listPendingOutbox", {"limit": 100})
    if not outbox:
        print_summary("outbox", {"processed": 0, "status": "idle"})
        return 0

    config = load_config()
    dashboard = ensure_dashboard_section(config)
    processed = 0
    skipped = 0

    for item in outbox:
        if item.get("entityType") not in HANDLED_ENTITY_TYPES:
            skipped += 1
            continue
        run_convex(
            "features/core/api:markOutboxStatus",
            {"id": item["_id"], "status": "processing"},
        )
        try:
            payload = item.get("payload") or {}
            if item["entityType"] == "channel_binding":
                key_fn = lambda row: f'{row.get("channelId")}::{row.get("workspaceId")}'
                if item["operation"] == "delete":
                    delete_by_key(dashboard["workspaceChannelBindings"], key_fn, payload)
                else:
                    upsert_by_key(
                        dashboard["workspaceChannelBindings"],
                        key_fn,
                        {
                            "access": payload.get("access") or "manual",
                            "agentId": payload.get("agentId"),
                            "channelId": payload.get("channelId"),
                            "source": payload.get("source") or "manual-file",
                            "workspaceId": payload.get("workspaceId"),
                            "workspaceName": payload.get("workspaceName"),
                        },
                    )
            elif item["entityType"] == "identity_binding":
                key_fn = lambda row: f'{row.get("workspaceId")}::{row.get("channel")}::{row.get("externalUserId")}'
                if item["operation"] == "delete":
                    delete_by_key(dashboard["identityWorkspaceBindings"], key_fn, payload)
                else:
                    upsert_by_key(
                        dashboard["identityWorkspaceBindings"],
                        key_fn,
                        {
                            "access": payload.get("access") or "manual",
                            "agentId": payload.get("agentId"),
                            "channel": payload.get("channel"),
                            "externalUserId": payload.get("externalUserId"),
                            "normalizedPhone": payload.get("normalizedPhone"),
                            "source": payload.get("source") or "manual-file",
                            "workspaceId": payload.get("workspaceId"),
                            "workspaceName": payload.get("workspaceName"),
                        },
                    )
            elif item["entityType"] == "channel_binding_policy":
                key_fn = lambda row: row.get("channelId")
                upsert_by_key(
                    dashboard["channelBindingPolicies"],
                    key_fn,
                    {
                        "channelId": payload.get("channelId"),
                        "mode": payload.get("mode") or "multi-workspace",
                        "primaryWorkspaceId": payload.get("primaryWorkspaceId"),
                        "source": "manual-file",
                    },
                )
            elif item["entityType"] == "config":
                handle_config(config, item, payload)
            elif item["entityType"] == "agent":
                handle_agent(config, item, payload)

            save_config(config)
            run_convex(
                "features/core/api:markOutboxStatus",
                {"id": item["_id"], "status": "done"},
            )
            processed += 1
        except Exception as exc:  # pragma: no cover - operational path
            run_convex(
                "features/core/api:markOutboxStatus",
                {"id": item["_id"], "status": "failed", "lastError": str(exc)},
            )
            raise

    print_summary("outbox", {"processed": processed, "skipped": skipped, "status": "done"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
