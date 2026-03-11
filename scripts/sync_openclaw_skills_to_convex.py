#!/usr/bin/env python3
"""Mirror `openclaw skills list --json` into project Convex skills."""

from __future__ import annotations

import json
import subprocess

from _runtime_sync import OPENCLAW_BIN, TENANT_ID, print_summary, run_convex


def compact(payload):
    return {key: value for key, value in payload.items() if value is not None}


def main() -> int:
    proc = subprocess.run(
        [OPENCLAW_BIN, "skills", "list", "--json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())

    payload = json.loads((proc.stdout or "").strip())
    skills = payload.get("skills", [])

    result = run_convex(
        "features/skills/api:syncRuntimeSkills",
        {
            "skills": [
                compact(
                    {
                        "skillId": skill["name"],
                        "name": skill["name"],
                        "description": skill.get("description"),
                        "source": skill.get("source") or "openclaw-runtime",
                        "enabled": not bool(skill.get("disabled")),
                        "version": skill.get("version"),
                        "toolCount": skill.get("toolCount"),
                        "config": {
                            "bundled": skill.get("bundled"),
                            "eligible": skill.get("eligible"),
                            "blockedByAllowlist": skill.get("blockedByAllowlist"),
                            "missing": skill.get("missing"),
                            "emoji": skill.get("emoji"),
                            "homepage": skill.get("homepage"),
                            "workspaceDir": payload.get("workspaceDir"),
                            "managedSkillsDir": payload.get("managedSkillsDir"),
                        },
                        "tenantId": TENANT_ID,
                    }
                )
                for skill in skills
            ]
        },
    )
    print_summary("skills", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
