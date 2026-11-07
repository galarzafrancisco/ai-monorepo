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

/**
 * The workspace used by modules that are not scoped by workspace yet (agents,
 * executions, integrations...) when they call a service that is. Each
 * later phase 3 task replaces its module's uses with the workspace of the row
 * it works on, and this constant goes away. Grep for it to find them.
 */
export const UNSCOPED_MODULE_WORKSPACE_ID = DEFAULT_WORKSPACE_ID;
