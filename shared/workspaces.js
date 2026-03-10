export const PERSONAL_WORKSPACE_PREFIX = "main";

export function normalizeWorkspaceHandle(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : "user";
}

export function buildPersonalWorkspaceName(email) {
  return `${PERSONAL_WORKSPACE_PREFIX} ${normalizeWorkspaceHandle(email)}`;
}

export function buildPersonalWorkspaceSlugSource(email) {
  return buildPersonalWorkspaceName(email);
}
