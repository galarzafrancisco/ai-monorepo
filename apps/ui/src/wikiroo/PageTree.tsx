import { useState, memo, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WikiPageTree } from './types';

interface PageTreeProps {
  pages: WikiPageTree[];
  currentPageId?: string;
  onPageClick: (pageId: string) => void;
}

interface PageTreeItemProps {
  page: WikiPageTree;
  level: number;
  isActive: boolean;
  currentPageId?: string;
  onPageClick: (pageId: string) => void;
  onAddChild: (parentId: string) => void;
}

// Helper function to check if current page is in this subtree
function hasCurrentPageInSubtree(page: WikiPageTree, currentPageId?: string): boolean {
  if (!currentPageId) return false;
  if (page.id === currentPageId) return true;
  if (page.children) {
    return page.children.some(child => hasCurrentPageInSubtree(child, currentPageId));
  }
  return false;
}

const PageTreeItem = memo(function PageTreeItem({ page, level, isActive, currentPageId, onPageClick, onAddChild }: PageTreeItemProps) {
  const hasChildren = page.children && page.children.length > 0;

  // Check if current page is in this page's subtree
  const shouldAutoExpand = hasChildren && hasCurrentPageInSubtree(page, currentPageId);

  const [expanded, setExpanded] = useState(shouldAutoExpand);

  // Auto-expand when current page changes and is in this subtree
  useEffect(() => {
    if (shouldAutoExpand) {
      setExpanded(true);
    }
  }, [shouldAutoExpand]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onPageClick(page.id);
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddChild(page.id);
  };

  // Sort children by order field - memoized to avoid re-sorting on every render
  const sortedChildren = useMemo(
    () => hasChildren ? [...page.children].sort((a, b) => a.order - b.order) : [],
    [hasChildren, page.children]
  );

  return (
    <div className="page-tree-item">
      <div
        className={`tree-item-content ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 20}px` }}
      >
        {hasChildren ? (
          <button
            className="tree-toggle"
            onClick={handleToggle}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <a
          href="#"
          className="tree-item-link"
          onClick={handleClick}
          aria-current={isActive ? 'page' : undefined}
        >
          {page.title}
        </a>
        <button
          className="tree-item-add-child"
          onClick={handleAddChild}
          aria-label={`Add child page to ${page.title}`}
          title="Add child page"
        >
          +
        </button>
      </div>
      {expanded && hasChildren && (
        <div className="tree-item-children">
          {sortedChildren.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              level={level + 1}
              isActive={child.id === currentPageId}
              currentPageId={currentPageId}
              onPageClick={onPageClick}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function PageTree({ pages, currentPageId, onPageClick }: PageTreeProps) {
  const navigate = useNavigate();

  // Sort root-level pages by order - memoized to avoid re-sorting on every render
  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.order - b.order),
    [pages]
  );

  const handleAddChild = (parentId: string) => {
    navigate(`/wikiroo/page/${parentId}/new`);
  };

  return (
    <div className="page-tree">
      {sortedPages.map((page) => (
        <PageTreeItem
          key={page.id}
          page={page}
          level={0}
          isActive={page.id === currentPageId}
          currentPageId={currentPageId}
          onPageClick={onPageClick}
          onAddChild={handleAddChild}
        />
      ))}
    </div>
  );
}
