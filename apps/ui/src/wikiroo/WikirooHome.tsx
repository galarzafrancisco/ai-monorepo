import { useNavigate } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
import { TagBadge } from './TagBadge';

export function WikirooHome() {
  const navigate = useNavigate();
  const { pages, isLoadingList } = useWikiroo();

  if (isLoadingList) {
    return (
      <div className="wikiroo-welcome">
        <p>Loading pages...</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="wikiroo-welcome">
        <h2>Wikiroo</h2>
        <br />
        <button
          className="wikiroo-button primary"
          type="button"
          onClick={() => navigate('/wikiroo/new')}
          title="Create new page"
        >
          + New page
        </button>
      </div>
    );
  }

  return (
    <div className="wikiroo-content" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>All Pages</h2>
        <button
          className="wikiroo-button primary"
          type="button"
          onClick={() => navigate('/wikiroo/new')}
          title="Create new page"
        >
          + New page
        </button>
      </div>

      <div className="wikiroo-grid">
        {pages.map((page) => (
          <div
            key={page.id}
            className="wikiroo-card"
            onClick={() => navigate(`/wikiroo/page/${page.id}`)}
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

            <div className="wikiroo-card-meta">
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
