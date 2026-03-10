import { CustomCtx } from "convex-helpers/server/customFunctions";
import { GenericEnt, GenericEntWriter } from "convex-ents";
import { TableNames } from "./_generated/dataModel";
import { mutation, query } from "./functions";
import { entDefinitions } from "./schema";

export type QueryCtx = CustomCtx<typeof query>;
export type MutationCtx = CustomCtx<typeof mutation>;

type EntTableNames = keyof typeof entDefinitions;

export type Ent<TableName extends EntTableNames> = GenericEnt<
  typeof entDefinitions,
  TableName
>;
export type EntWriter<TableName extends EntTableNames> = GenericEntWriter<
  typeof entDefinitions,
  TableName
>;
