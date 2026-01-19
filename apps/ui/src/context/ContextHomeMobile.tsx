import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useContext } from './useContext';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { TagInput } from './TagInput';
import './ContextMobile.css';

export function ContextHomeMobile() {
  const { pages, isLoadingList, error, createPage, isCreating } = useContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !content.trim()) {
      return;
    }

    await createPage({
      title: title.trim(),
      content: content.trim(),
      ...(tagNames.length > 0 && { tagNames }),
      ...(parentId && { parentId }),
    });

    // Reset form and close modal
    setTitle('');
    setAuthor('');
    setContent('');
    setTagNames([]);
    setParentId(null);
    setShowCreateModal(false);
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (diff < oneDayMs) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };


  const getTagColor = (index: number): string => {
    const colors = [
      '#007aff', // blue
      '#34c759', // green
      '#ff9500', // orange
      '#af52de', // purple
      '#ff2d55', // pink
      '#5ac8fa', // teal
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="context-mobile">
      <HamburgerMenu />

      {/* Header */}
      <div className="mobile-context-header">
        <div className="mobile-context-header-content">
          <div style={{ width: '40px' }}></div>
          <h1 className="mobile-context-title">Context</h1>
          <button
            className="mobile-context-new-button"
            onClick={() => setShowCreateModal(true)}
          >
            + New
          </button>
        </div>
      </div>

      {/* Page List */}
      <div className="mobile-context-list">
        {isLoadingList && (
          <div className="mobile-context-loading">Loading pages...</div>
        )}

        {error && (
          <div className="mobile-context-error">{error}</div>
        )}

        {!isLoadingList && !error && pages.length === 0 && (
          <div className="mobile-context-empty">
            <div className="mobile-context-empty-icon">📚</div>
            <p className="mobile-context-empty-text">No pages yet</p>
          </div>
        )}

        {!isLoadingList && !error && pages.map((page) => (
          <Link
            key={page.id}
            to={`/context/page/${page.id}`}
            className="mobile-context-page-item"
          >
            <h3 className="mobile-context-page-title">{page.title}</h3>

            {page.tags && page.tags.length > 0 && (
              <div className="mobile-context-page-tags">
                {page.tags.map((tag, index) => (
                  <span
                    key={tag.name}
                    className="mobile-context-page-tag"
                    style={{ backgroundColor: getTagColor(index) }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mobile-context-page-meta">
              <span className="mobile-context-page-author">
                👤 {page.author}
              </span>
              <span className="mobile-context-page-time">
                {formatTime(page.updatedAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Create Page Modal */}
      {showCreateModal && (
        <div
          className="mobile-context-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="mobile-context-modal">
            <div className="mobile-context-modal-header">
              <h2 className="mobile-context-modal-title">New Page</h2>
              <button
                className="mobile-context-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreatePage}>
              <div className="mobile-context-modal-content">
                <div className="mobile-context-form-group">
                  <label className="mobile-context-form-label">Title</label>
                  <input
                    type="text"
                    className="mobile-context-form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Page title"
                    required
                  />
                </div>

                <div className="mobile-context-form-group">
                  <label className="mobile-context-form-label">Author</label>
                  <input
                    type="text"
                    className="mobile-context-form-input"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="mobile-context-form-group">
                  <label className="mobile-context-form-label">Parent Page</label>
                  <select
                    className="mobile-context-form-input"
                    value={parentId ?? ''}
                    onChange={(e) => setParentId(e.target.value || null)}
                  >
                    <option value="">None (top level)</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mobile-context-form-group">
                  <label className="mobile-context-form-label">Content</label>
                  <textarea
                    className="mobile-context-form-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your page content (Markdown supported)"
                    required
                  />
                </div>

                <div className="mobile-context-form-group">
                  <label className="mobile-context-form-label">Tags</label>
                  <TagInput
                    value={tagNames}
                    onChange={setTagNames}
                    placeholder="Add tags"
                  />
                </div>
              </div>

              <div className="mobile-context-form-actions">
                <button
                  type="button"
                  className="mobile-context-button-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="mobile-context-button-primary"
                  disabled={isCreating || !title.trim() || !author.trim() || !content.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
