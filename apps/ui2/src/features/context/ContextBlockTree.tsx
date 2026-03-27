import { useEffect, useMemo, useRef, useState } from "react";
import { Text } from "../../ui/primitives";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
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
};

function normalizeParentId(parentId: ContextBlockSummary["parentId"]): string | null {
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
  collapsedIds,
  onToggleNode,
}: {
  nodes: TreeNode[];
  depth: number;
  onOpenBlock: (blockId: string) => void;
  collapsedIds: Set<string>;
  onToggleNode: (blockId: string) => void;
}) {
  return (
    <ul className="context-tree__branch" role={depth === 0 ? "tree" : "group"}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = hasChildren ? !collapsedIds.has(node.block.id) : false;
        const clampedDepth = Math.min(depth, MAX_DEPTH);

        return (
          <li key={node.block.id} className="context-tree__item" role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
            <div
              className="context-tree__row"
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
                  <Text weight="semibold" size="3" tone="default">
                    {node.block.title}
                  </Text>
                  <div className="context-tree__meta">
                    <span className="context-tree__id">#{node.block.id.slice(0, 6)}</span>
                    <span>{node.block.createdBy || "unknown"}</span>
                    <span>{elapsedTime(node.block.updatedAt)}</span>
                  </div>
                </div>
                {node.block.tags.length > 0 ? (
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
            </div>

            {hasChildren && isExpanded ? (
              <TreeBranch
                nodes={node.children}
                depth={depth + 1}
                onOpenBlock={onOpenBlock}
                collapsedIds={collapsedIds}
                onToggleNode={onToggleNode}
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

export function ContextBlockTree({ blocks, onOpenBlock }: ContextBlockTreeProps): JSX.Element {
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
    <section className="context-tree">
      <TreeBranch
        nodes={tree}
        depth={0}
        onOpenBlock={onOpenBlock}
        collapsedIds={collapsedIds}
        onToggleNode={handleToggleNode}
      />
    </section>
  );
}
