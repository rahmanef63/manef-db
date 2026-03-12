#!/usr/bin/env python3
"""Mirror `openclaw skills list --json` into project Convex skills."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess

from _runtime_sync import OPENCLAW_BIN, TENANT_ID, print_summary, run_convex


MANAGED_SKILLS_DIR = Path("/home/rahman/.openclaw/skills")
WORKSPACE_DIR = Path("/home/rahman/.openclaw/workspace")
CLAWHUB_LOCK_CANDIDATES = (
    WORKSPACE_DIR / ".clawhub" / "lock.json",
    MANAGED_SKILLS_DIR / ".clawhub" / "lock.json",
)


def compact(payload):
    return {key: value for key, value in payload.items() if value is not None}


def read_clawhub_lock_names():
    names: set[str] = set()
    for candidate in CLAWHUB_LOCK_CANDIDATES:
        if not candidate.exists():
            continue
        try:
            payload = json.loads(candidate.read_text())
        except Exception:
            continue
        stack = [payload]
        while stack:
            current = stack.pop()
            if isinstance(current, dict):
                maybe_name = current.get("name") or current.get("skill") or current.get("id")
                if isinstance(maybe_name, str):
                    names.add(maybe_name)
                stack.extend(current.values())
            elif isinstance(current, list):
                stack.extend(current)
    return names


def managed_skill_exists(skill_name: str) -> bool:
    direct_dir = MANAGED_SKILLS_DIR / skill_name
    direct_file = MANAGED_SKILLS_DIR / f"{skill_name}.skill"
    return direct_dir.exists() or direct_file.exists()


def classify_skill(skill: dict, clawhub_names: set[str]):
    source = skill.get("source") or "openclaw-runtime"
    name = skill["name"]

    if name in clawhub_names or "clawhub" in source.lower():
        return {
            "sourceType": "clawhub",
            "publisherLabel": "by ClawHub",
            "publisherHandle": "clawhub",
            "trustLevel": "clawhub-public",
            "skillScope": "general/shared",
            "installState": "installed",
        }

    if source == "openclaw-managed" or managed_skill_exists(name):
        return {
            "sourceType": "rahman_local",
            "publisherLabel": "by Rahman",
            "publisherHandle": "rahmanef63",
            "trustLevel": "local",
            "skillScope": "workspace-shared",
            "installState": "installed",
        }

    return {
        "sourceType": "openclaw_bundled",
        "publisherLabel": "by OpenClaw",
        "publisherHandle": "openclaw",
        "trustLevel": "bundled",
        "skillScope": "general/shared",
        "installState": "available",
    }


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
    clawhub_names = read_clawhub_lock_names()

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
                        **classify_skill(skill, clawhub_names),
                        "enabled": not bool(skill.get("disabled")),
                        "version": skill.get("version"),
                        "toolCount": skill.get("toolCount"),
                        "homepage": skill.get("homepage"),
                        "config": {
                            "bundled": skill.get("bundled"),
                            "eligible": skill.get("eligible"),
                            "blockedByAllowlist": skill.get("blockedByAllowlist"),
                            "missing": skill.get("missing"),
                            "emoji": skill.get("emoji"),
                            "homepage": skill.get("homepage"),
                            "sourceLabel": skill.get("source"),
                            "clawhubLockDetected": skill["name"] in clawhub_names,
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
