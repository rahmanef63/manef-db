export const roles = ["Admin", "Member"] as const;

export type Role = (typeof roles)[number];
