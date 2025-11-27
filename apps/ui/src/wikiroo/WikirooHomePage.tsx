import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';
import { usePageTitle } from '../hooks/usePageTitle';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { TagBadge } from './TagBadge';
import { WikiPageForm } from './WikiPageForm';
import type { CreatePageDto } from 'shared';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export function WikirooHomePage() {
  const {
    pages,
    isLoadingList,
    isCreating,
    error,
    loadPages,
    createPage,
  } = useWikiroo();

  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const [showForm, setShowForm] = useState(false);

  usePageTitle('Wikiroo');

  const handleCreatePage = async (data: CreatePageDto) => {
    const created = await createPage(data);
    setShowForm(false);
    navigate(`/wikiroo/${created.id}`);
  };

  return (
    <div className="wikiroo wikiroo-home">
      <header className="wikiroo-header">
        <div>
          <h1>Wikiroo</h1>
          <p>Lightweight knowledge base for agents</p>
        </div>
        <div className="wikiroo-actions">
          <HomeLink />
          <button
            className="wikiroo-button secondary"
            type="button"
            onClick={loadPages}
            disabled={isLoadingList}
          >
            {isLoadingList ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="wikiroo-button primary"
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? 'Close form' : 'New page'}
          </button>
        </div>
      </header>

      {showForm && (
        <WikiPageForm
          mode="create"
          onSubmit={handleCreatePage}
          onCancel={() => setShowForm(false)}
          isSubmitting={isCreating}
        />
      )}

      <section className="wikiroo-grid" aria-live="polite">
        {pages.map((page) => (
          <Link key={page.id} to={`/wikiroo/${page.id}`} className="wikiroo-card">
            <h3>{page.title}</h3>
            <p>By {page.author}</p>
            {page.tags && page.tags.length > 0 && (
              <div style={{ margin: '8px 0', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {page.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} small />
                ))}
              </div>
            )}
            <div className="wikiroo-card-meta">
              <span>Updated {formatDate(page.updatedAt)}</span>
              <span>Created {formatDate(page.createdAt)}</span>
            </div>
          </Link>
        ))}
      </section>

      {pages.length === 0 && !isLoadingList && (
        <div className="wikiroo-empty">
          <strong>No pages yet</strong>
          <span>Create your first entry to share knowledge.</span>
        </div>
      )}

      {isLoadingList && <div className="wikiroo-status">Loading pages…</div>}
      {error && <div className="wikiroo-error">{error}</div>}

      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
