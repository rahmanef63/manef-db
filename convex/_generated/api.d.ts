/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentOps from "../agentOps.js";
import type * as features_agents_api from "../features/agents/api.js";
import type * as features_auth_api from "../features/auth/api.js";
import type * as features_calendar_api from "../features/calendar/api.js";
import type * as features_channels_api from "../features/channels/api.js";
import type * as features_config_api from "../features/config/api.js";
import type * as features_core_api from "../features/core/api.js";
import type * as features_crons_api from "../features/crons/api.js";
import type * as features_dashboard_api from "../features/dashboard/api.js";
import type * as features_debug_api from "../features/debug/api.js";
import type * as features_inbox_api from "../features/inbox/api.js";
import type * as features_instances_api from "../features/instances/api.js";
import type * as features_knowledge_api from "../features/knowledge/api.js";
import type * as features_logs_api from "../features/logs/api.js";
import type * as features_nodes_api from "../features/nodes/api.js";
import type * as features_projects_api from "../features/projects/api.js";
import type * as features_sessions_api from "../features/sessions/api.js";
import type * as features_skills_api from "../features/skills/api.js";
import type * as features_tasks_api from "../features/tasks/api.js";
import type * as features_usage_api from "../features/usage/api.js";
import type * as features_users_api from "../features/users/api.js";
import type * as features_workspace_api from "../features/workspace/api.js";
import type * as features_workspace_tasks_api from "../features/workspace_tasks/api.js";
import type * as functions from "../functions.js";
import type * as init from "../init.js";
import type * as menu from "../menu.js";
import type * as migrations from "../migrations.js";
import type * as onboarding from "../onboarding.js";
import type * as openclawNavigator from "../openclawNavigator.js";
import type * as permissions from "../permissions.js";
import type * as permissions_schema from "../permissions_schema.js";
import type * as seed from "../seed.js";
import type * as types from "../types.js";
import type * as user_invites from "../user_invites.js";
import type * as users from "../users.js";
import type * as users_workspaces from "../users/workspaces.js";
import type * as users_workspaces_members from "../users/workspaces/members.js";
import type * as users_workspaces_members_invites from "../users/workspaces/members/invites.js";
import type * as users_workspaces_messages from "../users/workspaces/messages.js";
import type * as users_workspaces_roles from "../users/workspaces/roles.js";
import type * as utils from "../utils.js";
import type * as validations from "../validations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentOps: typeof agentOps;
  "features/agents/api": typeof features_agents_api;
  "features/auth/api": typeof features_auth_api;
  "features/calendar/api": typeof features_calendar_api;
  "features/channels/api": typeof features_channels_api;
  "features/config/api": typeof features_config_api;
  "features/core/api": typeof features_core_api;
  "features/crons/api": typeof features_crons_api;
  "features/dashboard/api": typeof features_dashboard_api;
  "features/debug/api": typeof features_debug_api;
  "features/inbox/api": typeof features_inbox_api;
  "features/instances/api": typeof features_instances_api;
  "features/knowledge/api": typeof features_knowledge_api;
  "features/logs/api": typeof features_logs_api;
  "features/nodes/api": typeof features_nodes_api;
  "features/projects/api": typeof features_projects_api;
  "features/sessions/api": typeof features_sessions_api;
  "features/skills/api": typeof features_skills_api;
  "features/tasks/api": typeof features_tasks_api;
  "features/usage/api": typeof features_usage_api;
  "features/users/api": typeof features_users_api;
  "features/workspace/api": typeof features_workspace_api;
  "features/workspace_tasks/api": typeof features_workspace_tasks_api;
  functions: typeof functions;
  init: typeof init;
  menu: typeof menu;
  migrations: typeof migrations;
  onboarding: typeof onboarding;
  openclawNavigator: typeof openclawNavigator;
  permissions: typeof permissions;
  permissions_schema: typeof permissions_schema;
  seed: typeof seed;
  types: typeof types;
  user_invites: typeof user_invites;
  users: typeof users;
  "users/workspaces": typeof users_workspaces;
  "users/workspaces/members": typeof users_workspaces_members;
  "users/workspaces/members/invites": typeof users_workspaces_members_invites;
  "users/workspaces/messages": typeof users_workspaces_messages;
  "users/workspaces/roles": typeof users_workspaces_roles;
  utils: typeof utils;
  validations: typeof validations;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
