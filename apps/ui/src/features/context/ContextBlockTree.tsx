import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Text } from "../../ui/primitives";
import type { ContextBlockSummary } from "./types";
import "./ContextBlockTree.css";

type TreeNode = {
  block: ContextBlockSummary;
  children: TreeNode[];
  latestUpdatedAt: number;
};

const MAX_DEPTH = 6;

type ContextBlockTreeProps = {
  blocks: ContextBlockSummary[];
  onOpenBlock: (blockId: string) => void;
  onAddChild?: (parentBlockId: string) => void;
  selectedBlockId?: string;
  compact?: boolean;
};

export function normalizeParentId(parentId: ContextBlockSummary["parentId"]): string | null {
  if (typeof parentId === "string") {
    return parentId;
  }

  if (parentId && typeof parentId === "object" && "id" in parentId && typeof parentId.id === "string") {
    return parentId.id;
  }

  return null;
}

function compareBlocks(a: ContextBlockSummary, b: ContextBlockSummary): number {
  if (a.order !== b.order) {
    return b.order - a.order;
  }

  return a.title.localeCompare(b.title);
}

function buildTree(blocks: ContextBlockSummary[]): TreeNode[] {
  const nodeById = new Map<string, TreeNode>();

  blocks.forEach((block) => {
    nodeById.set(block.id, {
      block,
      children: [],
      latestUpdatedAt: new Date(block.updatedAt).getTime(),
    });
  });

  const roots: TreeNode[] = [];

  blocks.forEach((block) => {
    const node = nodeById.get(block.id);
    if (!node) {
      return;
    }

    const parentId = normalizeParentId(block.parentId);
    if (!parentId) {
      roots.push(node);
      return;
    }

    const parentNode = nodeById.get(parentId);
    if (!parentNode) {
      roots.push(node);
      return;
    }

    parentNode.children.push(node);
  });

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => compareBlocks(a.block, b.block));
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);

  const updateLatest = (node: TreeNode): number => {
    if (node.children.length === 0) {
      return node.latestUpdatedAt;
    }

    let latest = node.latestUpdatedAt;
    node.children.forEach((child) => {
      const childLatest = updateLatest(child);
      if (childLatest > latest) {
        latest = childLatest;
      }
    });

    node.latestUpdatedAt = latest;
    return latest;
  };

  roots.forEach((node) => {
    updateLatest(node);
  });

  roots.sort((a, b) => {
    const updatedDiff = b.latestUpdatedAt - a.latestUpdatedAt;
    if (updatedDiff !== 0) {
      return updatedDiff;
    }
    return compareBlocks(a.block, b.block);
  });
  return roots;
}

function TreeBranch({
  nodes,
  depth,
  onOpenBlock,
  onAddChild,
  collapsedIds,
  onToggleNode,
  selectedBlockId,
  compact = false,
}: {
  nodes: TreeNode[];
  depth: number;
  onOpenBlock: (blockId: string) => void;
  onAddChild?: (parentBlockId: string) => void;
  collapsedIds: Set<string>;
  onToggleNode: (blockId: string) => void;
  selectedBlockId?: string;
  compact?: boolean;
}) {
  return (
    <ul className="context-tree__branch" role={depth === 0 ? "tree" : "group"}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = hasChildren ? !collapsedIds.has(node.block.id) : false;
        const clampedDepth = Math.min(depth, MAX_DEPTH);
        const isSelected = selectedBlockId === node.block.id;

        return (
          <li key={node.block.id} className="context-tree__item" role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
            <div
              className={`context-tree__row ${isSelected ? "context-tree__row--selected" : ""} ${compact ? "context-tree__row--compact" : ""}`}
              style={{ ["--tree-depth" as string]: clampedDepth }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="context-tree__toggle"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Collapse ${node.block.title}` : `Expand ${node.block.title}`}
                  onClick={() => onToggleNode(node.block.id)}
                >
                  <span className="context-tree__marker" aria-hidden="true">
                    {isExpanded ? "▼" : "►"}
                  </span>
                </button>
              ) : (
                <span className="context-tree__spacer" aria-hidden="true" />
              )}
              <button type="button" className="context-tree__open" onClick={() => onOpenBlock(node.block.id)}>
                <div className="context-tree__main">
                  <Text
                    weight={isSelected ? "bold" : "medium"}
                    size={compact ? "2" : "3"}
                    tone="default"
                    className="context-tree__title"
                  >
                    {node.block.title}
                  </Text>
                  {!compact ? (
                    <div className="context-tree__meta">
                      <span className="context-tree__id">#{node.block.id.slice(0, 6)}</span>
                      <span>{node.block.createdBy || "unknown"}</span>
                    </div>
                  ) : null}
                </div>
                {!compact && node.block.tags.length > 0 ? (
                  <div className="context-tree__tags" aria-label="Block tags">
                    {node.block.tags.slice(0, 2).map((tag) => (
                      <span key={`${node.block.id}-${tag.id}`} className="context-tree__tag">
                        {tag.name}
                      </span>
                    ))}
                    {node.block.tags.length > 2 ? (
                      <span className="context-tree__tag context-tree__tag--count">+{node.block.tags.length - 2}</span>
                    ) : null}
                  </div>
                ) : null}
              </button>
              {onAddChild ? (
                <button
                  type="button"
                  className="context-tree__add-child"
                  aria-label={`Add child block under ${node.block.title}`}
                  onClick={(e) => { e.stopPropagation(); onAddChild(node.block.id); }}
                >
                  +
                </button>
              ) : null}
            </div>

            {hasChildren && isExpanded ? (
              <TreeBranch
                nodes={node.children}
                depth={depth + 1}
                onOpenBlock={onOpenBlock}
                onAddChild={onAddChild}
                collapsedIds={collapsedIds}
                onToggleNode={onToggleNode}
                selectedBlockId={selectedBlockId}
                compact={compact}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function getAllParentIds(tree: TreeNode[]): Set<string> {
  const parentIds = new Set<string>();

  const traverse = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        parentIds.add(node.block.id);
        traverse(node.children);
      }
    }
  };

  traverse(tree);
  return parentIds;
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Centers the row in its scroll container, only if it is not already fully
 * visible. Scrolls just that container, so the page itself never moves.
 */
function scrollRowIntoView(row: HTMLElement): void {
  const scrollParent = findScrollParent(row);
  if (!scrollParent) {
    return;
  }

  const rowRect = row.getBoundingClientRect();
  const parentRect = scrollParent.getBoundingClientRect();
  if (rowRect.top >= parentRect.top && rowRect.bottom <= parentRect.bottom) {
    return;
  }

  const rowCenter = rowRect.top + rowRect.height / 2;
  const parentCenter = parentRect.top + scrollParent.clientHeight / 2;
  scrollParent.scrollTop += rowCenter - parentCenter;
}

export function ContextBlockTree({
  blocks,
  onOpenBlock,
  onAddChild,
  selectedBlockId,
  compact = false,
}: ContextBlockTreeProps): React.JSX.Element {
  const tree = useMemo(() => buildTree(blocks), [blocks]);
  // Start with all parent nodes collapsed
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => getAllParentIds(tree));
  // Track whether we've initialized the collapsed state after data loads
  const hasInitializedRef = useRef(false);

  // Update collapsed state when tree loads for the first time
  useEffect(() => {
    if (!hasInitializedRef.current && tree.length > 0) {
      setCollapsedIds(getAllParentIds(tree));
      hasInitializedRef.current = true;
    }
  }, [tree]);

  // Reveal the selected block once per selection (and per mount), so that
  // opening a block from a URL or a search result shows it in the tree:
  // first expand its ancestors, then scroll its row into view. Doing each
  // step only once keeps later manual collapsing/scrolling under user control.
  const treeRef = useRef<HTMLElement>(null);
  const expandedForIdRef = useRef<string | undefined>(undefined);
  const scrolledForIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedBlockId) {
      expandedForIdRef.current = undefined;
      return;
    }
    if (expandedForIdRef.current === selectedBlockId) {
      return;
    }

    const parentById = new Map<string, string | null>();
    blocks.forEach((block) => {
      parentById.set(block.id, normalizeParentId(block.parentId));
    });

    // The block may not be in the list yet; try again when the list changes.
    if (!parentById.has(selectedBlockId)) {
      return;
    }
    expandedForIdRef.current = selectedBlockId;

    const ancestorIds = new Set<string>();
    let currentParentId = parentById.get(selectedBlockId) ?? null;
    while (currentParentId && !ancestorIds.has(currentParentId)) {
      ancestorIds.add(currentParentId);
      currentParentId = parentById.get(currentParentId) ?? null;
    }

    if (ancestorIds.size === 0) {
      return;
    }

    setCollapsedIds((previous) => {
      const next = new Set(previous);
      ancestorIds.forEach((ancestorId) => next.delete(ancestorId));
      return next;
    });
  }, [blocks, selectedBlockId]);

  // Runs after every render that could have made the selected row appear
  // (list loaded, ancestors expanded) until it has scrolled to it once.
  useLayoutEffect(() => {
    if (!selectedBlockId) {
      scrolledForIdRef.current = undefined;
      return;
    }
    if (scrolledForIdRef.current === selectedBlockId) {
      return;
    }

    const row = treeRef.current?.querySelector<HTMLElement>(".context-tree__row--selected");
    if (!row) {
      return;
    }
    scrolledForIdRef.current = selectedBlockId;
    scrollRowIntoView(row);
  }, [selectedBlockId, collapsedIds, tree]);

  const handleToggleNode = (blockId: string) => {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  return (
    <section ref={treeRef} className={`context-tree ${compact ? "context-tree--compact" : ""}`}>
      <TreeBranch
        nodes={tree}
        depth={0}
        onOpenBlock={onOpenBlock}
        onAddChild={onAddChild}
        collapsedIds={collapsedIds}
        onToggleNode={handleToggleNode}
        selectedBlockId={selectedBlockId}
        compact={compact}
      />
    </section>
  );
}
