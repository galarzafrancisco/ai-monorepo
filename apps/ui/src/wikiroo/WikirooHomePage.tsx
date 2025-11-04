import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';
import { usePageTitle } from '../hooks/usePageTitle';

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
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');

  usePageTitle('Wikiroo');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !author.trim() || !content.trim()) {
      return;
    }

    try {
      const created = await createPage({
        title: title.trim(),
        author: author.trim(),
        content: content.trim(),
      });
      setTitle('');
      setAuthor('');
      setContent('');
      setShowForm(false);
      navigate(`/wikiroo/${created.id}`);
    } catch (err: any) {
      const message = err?.body?.detail || err?.message || 'Failed to create page';
      alert(message);
    }
  };

  return (
    <div className="wikiroo wikiroo-home">
      <header className="wikiroo-header">
        <div>
          <h1>Wikiroo</h1>
          <p>Lightweight knowledge base for agents</p>
        </div>
        <div className="wikiroo-actions">
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
        <form className="wikiroo-form" onSubmit={handleSubmit}>
          <div className="wikiroo-form-group">
            <label htmlFor="wikiroo-title">Title *</label>
            <input
              id="wikiroo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Give your page a headline"
              required
            />
          </div>
          <div className="wikiroo-form-group">
            <label htmlFor="wikiroo-author">Author *</label>
            <input
              id="wikiroo-author"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Who wrote this?"
              required
            />
          </div>
          <div className="wikiroo-form-group">
            <label htmlFor="wikiroo-content">Content *</label>
            <textarea
              id="wikiroo-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write in markdown or plain text"
              rows={6}
              required
            />
          </div>
          <div className="wikiroo-form-actions">
            <button
              type="button"
              className="wikiroo-button secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="wikiroo-button primary"
              disabled={isCreating}
            >
              {isCreating ? 'Saving…' : 'Create page'}
            </button>
          </div>
        </form>
      )}

      <section className="wikiroo-grid" aria-live="polite">
        {pages.map((page) => (
          <Link key={page.id} to={`/wikiroo/${page.id}`} className="wikiroo-card">
            <h3>{page.title}</h3>
            <p>By {page.author}</p>
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
    </div>
  );
}
