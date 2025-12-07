import { useState, memo, useMemo } from 'react';
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
}

const PageTreeItem = memo(function PageTreeItem({ page, level, isActive, currentPageId, onPageClick }: PageTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = page.children && page.children.length > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onPageClick(page.id);
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
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function PageTree({ pages, currentPageId, onPageClick }: PageTreeProps) {
  // Sort root-level pages by order - memoized to avoid re-sorting on every render
  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.order - b.order),
    [pages]
  );

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
        />
      ))}
    </div>
  );
}
