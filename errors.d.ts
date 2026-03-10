export type AppErrorFeature =
  | "auth"
  | "common"
  | "members"
  | "messages"
  | "workspaces";

export type AppErrorCode =
  | "AUTH_SERVICE_UNAVAILABLE"
  | "COMMON_PERMISSION_DENIED"
  | "COMMON_UNAUTHENTICATED"
  | "MEMBERS_INVITE_EMAIL_FAILED"
  | "MEMBERS_INVITE_CONFIG_MISSING"
  | "MEMBERS_LAST_ADMIN"
  | "MESSAGES_EMPTY"
  | "WORKSPACE_BOOTSTRAP_FAILED"
  | "WORKSPACE_NAME_REQUIRED"
  | "WORKSPACE_NAME_TOO_SHORT"
  | "WORKSPACE_NOT_FOUND";

export interface AppErrorDefinition {
  description: string;
  feature: AppErrorFeature;
  title: string;
}

export interface AppErrorData extends AppErrorDefinition {
  code: AppErrorCode | string;
  details?: string[];
  meta?: Record<string, unknown>;
}

export const APP_ERROR_DEFINITIONS: Record<string, AppErrorDefinition>;
export function getAppErrorDefinition(code: string): AppErrorDefinition;
export function createAppError(
  code: AppErrorCode | string,
  overrides?: Partial<AppErrorData>
): AppErrorData;
export function isAppErrorData(value: unknown): value is AppErrorData;
