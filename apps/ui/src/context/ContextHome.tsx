import { useNavigate } from 'react-router-dom';
import { useContext } from './useContext';
import { TagBadge } from './TagBadge';

export function ContextHome() {
  const navigate = useNavigate();
  const { pages, isLoadingList } = useContext();

  if (isLoadingList) {
    return (
      <div className="context-welcome">
        <p>Loading pages...</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="context-welcome">
        <h2>Context</h2>
        <br />
        <button
          className="context-button primary"
          type="button"
          onClick={() => navigate('/context/new')}
          title="Create new page"
        >
          + New page
        </button>
      </div>
    );
  }

  return (
    <div className="context-content" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>All Pages</h2>
        <button
          className="context-button primary"
          type="button"
          onClick={() => navigate('/context/new')}
          title="Create new page"
        >
          + New page
        </button>
      </div>

      <div className="context-grid">
        {pages.map((page) => (
          <div
            key={page.id}
            className="context-card"
            onClick={() => navigate(`/context/page/${page.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <h3>{page.title}</h3>

            {page.tags && page.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {page.tags.map((tag) => (
                  <TagBadge key={tag.name} tag={tag} />
                ))}
              </div>
            )}

            <div className="context-card-meta">
              <span>By {page.author}</span>
              <span>Created {new Date(page.createdAt).toLocaleDateString()}</span>
              {page.updatedAt !== page.createdAt && (
                <span>Updated {new Date(page.updatedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
