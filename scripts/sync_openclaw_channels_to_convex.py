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

    binding_counts: dict[str, int] = defaultdict(int)
    for binding in bindings:
        channel_id = ((binding.get("match") or {}).get("channel") or "").strip()
        if channel_id:
            binding_counts[channel_id] += 1

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

    result = run_convex("features/channels/api:syncRuntimeChannels", {"channels": payload})
    print_summary("channels", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
