import { Link } from 'react-router-dom';
import type { ContextPageSummary } from './types';

interface BreadcrumbProps {
  pageId: string;
  pages: ContextPageSummary[];
}

function buildBreadcrumbPath(pageId: string, pages: ContextPageSummary[]): ContextPageSummary[] {
  const path: ContextPageSummary[] = [];
  let currentId: string | null = pageId;

  while (currentId) {
    const page = pages.find((p) => p.id === currentId);
    if (!page) break;

    path.unshift(page); // Add to beginning
    const pid = page.parentId;
    currentId = typeof pid === 'string' ? pid : null;
  }

  return path;
}

export function Breadcrumb({ pageId, pages }: BreadcrumbProps) {
  const breadcrumbs = buildBreadcrumbPath(pageId, pages);

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/context" className="breadcrumb-link">
        Home
      </Link>
      {breadcrumbs.map((page, index) => (
        <span key={page.id} className="breadcrumb-item">
          <span className="breadcrumb-separator"> &gt; </span>
          {index === breadcrumbs.length - 1 ? (
            <span className="breadcrumb-current">{page.title}</span>
          ) : (
            <Link to={`/context/page/${page.id}`} className="breadcrumb-link">
              {page.title}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
