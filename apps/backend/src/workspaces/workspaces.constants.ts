/**
 * The workspace every installation starts with. Existing data and every new
 * user and agent belong to it until Taico can hold more than one workspace.
 *
 * The id is fixed so migrations can backfill `workspace_id` columns without a
 * lookup.
 */
export const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_WORKSPACE_SLUG = 'default';
export const DEFAULT_WORKSPACE_NAME = 'Default workspace';
