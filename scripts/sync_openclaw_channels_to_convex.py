#!/usr/bin/env python3
"""Mirror OpenClaw channel config and bindings into project Convex."""

from __future__ import annotations

from collections import defaultdict

from _runtime_sync import TENANT_ID, load_openclaw_config, print_summary, redact_config, run_convex


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def infer_mode(channel_id: str, config: dict) -> str | None:
    if channel_id == "telegram":
        return "streaming" if config.get("streaming") else "polling"
    if channel_id == "whatsapp":
        return "multi-account" if config.get("accounts") else "single-account"
    return None


def main() -> int:
    cfg = load_openclaw_config()
    channels = cfg.get("channels", {}) or {}
    bindings = cfg.get("bindings", []) or []
    manual_cfg = (((cfg.get("manef") or {}).get("dashboard") or {}))
    manual_workspace_bindings = manual_cfg.get("workspaceChannelBindings", []) or []
    manual_identity_bindings = manual_cfg.get("identityWorkspaceBindings", []) or []
    manual_policies = manual_cfg.get("channelBindingPolicies", []) or []

    binding_counts: dict[str, int] = defaultdict(int)
    workspace_bindings = []
    identity_bindings = []
    for binding in bindings:
        channel_id = ((binding.get("match") or {}).get("channel") or "").strip()
        if channel_id:
            binding_counts[channel_id] += 1
        agent_id = str(binding.get("agentId") or "").strip()
        match = binding.get("match") or {}
        peer = match.get("peer") or {}
        peer_id = str(peer.get("id") or "").strip()
        peer_kind = str(peer.get("kind") or "").strip()
        if channel_id and agent_id:
            workspace_bindings.append(
                {
                    "access": "runtime",
                    "agentId": agent_id,
                    "channelId": channel_id,
                    "source": "openclaw-runtime",
                    "tenantId": TENANT_ID,
                }
            )
        if channel_id and agent_id and peer_id and peer_kind == "direct":
            identity_bindings.append(
                {
                    "access": "owner",
                    "agentId": agent_id,
                    "channel": channel_id,
                    "externalUserId": peer_id,
                    "source": "openclaw-runtime",
                    "tenantId": TENANT_ID,
                }
            )

    for binding in manual_workspace_bindings:
        channel_id = str(binding.get("channelId") or "").strip()
        workspace_id = binding.get("workspaceId")
        if not channel_id or not workspace_id:
            continue
        workspace_bindings.append(
            {
                "access": binding.get("access") or "manual",
                "agentId": binding.get("agentId"),
                "channelId": channel_id,
                "source": binding.get("source") or "manual-file",
                "tenantId": TENANT_ID,
                "workspaceId": workspace_id,
            }
        )

    for binding in manual_identity_bindings:
        channel = str(binding.get("channel") or "").strip()
        external_user_id = str(binding.get("externalUserId") or "").strip()
        workspace_id = binding.get("workspaceId")
        if not channel or not external_user_id or not workspace_id:
            continue
        identity_bindings.append(
            {
                "access": binding.get("access") or "manual",
                "agentId": binding.get("agentId"),
                "channel": channel,
                "externalUserId": external_user_id,
                "source": binding.get("source") or "manual-file",
                "tenantId": TENANT_ID,
                "workspaceId": workspace_id,
            }
        )

    payload = []
    for channel_id, config in channels.items():
        allow_list = [str(item) for item in as_list(config.get("allowFrom")) if str(item).strip()]
        payload.append(
            {
                "channelId": channel_id,
                "type": channel_id,
                "label": config.get("name") or channel_id,
                "configured": bool(config.get("enabled", False)),
                "running": bool(config.get("enabled", False)),
                "linked": binding_counts.get(channel_id, 0) > 0,
                "connected": bool(config.get("enabled", False)),
                "mode": infer_mode(channel_id, config),
                "lastProbeAt": 0,
                "config": {
                    "bindingCount": binding_counts.get(channel_id, 0),
                    "allowListCount": len(allow_list),
                    "runtimeSource": "openclaw.json",
                    "sanitized": redact_config(config),
                },
                "tenantId": TENANT_ID,
                "allowList": allow_list,
            }
        )

    for channel in payload:
        channel["lastProbeAt"] = __import__("time").time_ns() // 1_000_000

    result = run_convex(
        "features/channels/api:syncRuntimeChannels",
        {
            "channels": payload,
            "channelPolicies": [
                {
                    "channelId": str(policy.get("channelId") or "").strip(),
                    "mode": policy.get("mode") or "multi-workspace",
                    "primaryWorkspaceId": policy.get("primaryWorkspaceId"),
                    "source": policy.get("source") or "manual-file",
                    "tenantId": TENANT_ID,
                }
                for policy in manual_policies
                if str(policy.get("channelId") or "").strip()
            ],
            "identityBindings": identity_bindings,
            "workspaceBindings": workspace_bindings,
        },
    )
    print_summary("channels", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
