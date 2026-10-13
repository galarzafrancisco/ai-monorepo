import type { ContextBlockSummary } from "./types";

/** The id of the parent block, or null for a root block. */
export function normalizeParentId(parentId: ContextBlockSummary["parentId"]): string | null {
  if (typeof parentId === "string") {
    return parentId;
  }

  if (parentId && typeof parentId === "object" && "id" in parentId && typeof parentId.id === "string") {
    return parentId.id;
  }

  return null;
}
