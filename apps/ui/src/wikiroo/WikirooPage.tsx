import { FormEvent, useEffect, useState } from 'react';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function WikirooPage() {
  const {
    pages,
    selectedPage,
    isLoadingList,
    isLoadingPage,
    isCreating,
    error,
    loadPages,
    createPage,
    selectPage,
  } = useWikiroo();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!selectedPage && pages.length > 0) {
      selectPage(pages[0].id);
    }
  }, [pages, selectedPage, selectPage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !author.trim() || !content.trim()) {
      return;
    }

    try {
      await createPage({
        title: title.trim(),
        author: author.trim(),
        content: content.trim(),
      });
      setTitle('');
      setAuthor('');
      setContent('');
      setShowForm(false);
    } catch (err: any) {
      const message = err?.body?.detail || err?.message || 'Failed to create page';
      alert(message);
    }
  };

  const handleRefresh = () => {
    loadPages();
  };

  return (
    <div className="wikiroo">
      <div className="wikiroo-header">
        <div>
          <h1>Wikiroo</h1>
          <p>Lightweight knowledge base for agents</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="wikiroo-button secondary"
            type="button"
            onClick={handleRefresh}
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
      </div>

      <div className="wikiroo-layout">
        <aside className="wikiroo-sidebar">
          <div className="wikiroo-sidebar-header">
            <h2>Pages</h2>
            <span style={{ fontSize: 13, color: '#95a5a6' }}>{pages.length} total</span>
          </div>

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

          <div className="wikiroo-list">
            {pages.map((page) => {
              const isActive = selectedPage?.id === page.id;
              return (
                <button
                  key={page.id}
                  className={`wikiroo-list-item ${isActive ? 'active' : ''}`}
                  onClick={() => selectPage(page.id)}
                  type="button"
                >
                  <h3>{page.title}</h3>
                  <p>By {page.author}</p>
                </button>
              );
            })}
            {pages.length === 0 && !isLoadingList && (
              <div className="wikiroo-empty">
                <strong>No pages yet</strong>
                <span>Create your first entry to share knowledge.</span>
              </div>
            )}
          </div>

          {isLoadingList && <div className="wikiroo-status">Loading pages…</div>}
          {error && <div className="wikiroo-error">{error}</div>}
        </aside>

        <section className="wikiroo-content">
          {selectedPage ? (
            <>
              <header>
                <h2>{selectedPage.title}</h2>
                <div className="wikiroo-meta">
                  <span>By {selectedPage.author}</span>
                  <span>Created {formatDate(selectedPage.createdAt)}</span>
                  <span>Updated {formatDate(selectedPage.updatedAt)}</span>
                </div>
              </header>
              {isLoadingPage ? (
                <div className="wikiroo-status">Loading page…</div>
              ) : (
                <div className="wikiroo-body-text">{selectedPage.content}</div>
              )}
            </>
          ) : (
            <div className="wikiroo-empty" style={{ minHeight: 240 }}>
              <strong>Select a page</strong>
              <span>Choose a page from the left to read its content.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
