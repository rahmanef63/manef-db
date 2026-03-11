#!/usr/bin/env python3
"""Mirror sanitized OpenClaw config into project Convex config entries."""

from __future__ import annotations

import json
from typing import Any

from _runtime_sync import TENANT_ID, load_openclaw_config, print_summary, redact_config, run_convex


def value_type(value: Any) -> str:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    return "json"


def stringify(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def flatten(entries: list[dict[str, Any]], prefix: str, value: Any, category: str) -> None:
    if isinstance(value, dict):
        if not value:
            entries.append(
                {
                    "key": prefix,
                    "category": category,
                    "value": "{}",
                    "valueType": "json",
                    "source": "openclaw-runtime",
                    "runtimePath": prefix,
                    "tenantId": TENANT_ID,
                }
            )
            return
        for key, nested in value.items():
            flatten(entries, f"{prefix}.{key}" if prefix else key, nested, category)
        return

    if isinstance(value, list):
        entries.append(
            {
                "key": prefix,
                "category": category,
                "value": stringify(value),
                "valueType": "json",
                "source": "openclaw-runtime",
                "runtimePath": prefix,
                "tenantId": TENANT_ID,
            }
        )
        return

    entries.append(
        {
            "key": prefix,
            "category": category,
            "value": stringify(value),
            "valueType": value_type(value),
            "source": "openclaw-runtime",
            "runtimePath": prefix,
            "tenantId": TENANT_ID,
        }
    )


def main() -> int:
    config = redact_config(load_openclaw_config())
    entries: list[dict[str, Any]] = [
        {
            "key": "__raw__",
            "category": "all",
            "value": stringify(config),
            "valueType": "json",
            "source": "openclaw-runtime",
            "runtimePath": "",
            "tenantId": TENANT_ID,
        }
    ]

    for key, value in config.items():
        category = str(key)
        entries.append(
            {
                "key": category,
                "category": category,
                "value": stringify(value),
                "valueType": value_type(value),
                "source": "openclaw-runtime",
                "runtimePath": category,
                "tenantId": TENANT_ID,
            }
        )
        if isinstance(value, dict):
            for nested_key, nested_value in value.items():
                flatten(entries, f"{category}.{nested_key}", nested_value, category)

    result = run_convex("features/config/api:syncRuntimeConfig", {"entries": entries})
    print_summary("config", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
