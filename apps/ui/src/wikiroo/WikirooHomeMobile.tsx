import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { TagInput } from './TagInput';
import './WikirooMobile.css';

export function WikirooHomeMobile() {
  const { pages, isLoadingList, error, createPage, isCreating } = useWikiroo();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [tagNames, setTagNames] = useState<string[]>([]);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !content.trim()) {
      return;
    }

    await createPage({
      title: title.trim(),
      author: author.trim(),
      content: content.trim(),
      ...(tagNames.length > 0 && { tagNames }),
    });

    // Reset form and close modal
    setTitle('');
    setAuthor('');
    setContent('');
    setTagNames([]);
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
    <div className="wikiroo-mobile">
      <HamburgerMenu />

      {/* Header */}
      <div className="mobile-wikiroo-header">
        <div className="mobile-wikiroo-header-content">
          <div style={{ width: '40px' }}></div>
          <h1 className="mobile-wikiroo-title">Wikiroo</h1>
          <button
            className="mobile-wikiroo-new-button"
            onClick={() => setShowCreateModal(true)}
          >
            + New
          </button>
        </div>
      </div>

      {/* Page List */}
      <div className="mobile-wikiroo-list">
        {isLoadingList && (
          <div className="mobile-wikiroo-loading">Loading pages...</div>
        )}

        {error && (
          <div className="mobile-wikiroo-error">{error}</div>
        )}

        {!isLoadingList && !error && pages.length === 0 && (
          <div className="mobile-wikiroo-empty">
            <div className="mobile-wikiroo-empty-icon">📚</div>
            <p className="mobile-wikiroo-empty-text">No pages yet</p>
          </div>
        )}

        {!isLoadingList && !error && pages.map((page) => (
          <Link
            key={page.id}
            to={`/wikiroo/${page.id}`}
            className="mobile-wikiroo-page-item"
          >
            <h3 className="mobile-wikiroo-page-title">{page.title}</h3>

            {page.tags && page.tags.length > 0 && (
              <div className="mobile-wikiroo-page-tags">
                {page.tags.map((tag, index) => (
                  <span
                    key={tag.name}
                    className="mobile-wikiroo-page-tag"
                    style={{ backgroundColor: getTagColor(index) }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mobile-wikiroo-page-meta">
              <span className="mobile-wikiroo-page-author">
                👤 {page.author}
              </span>
              <span className="mobile-wikiroo-page-time">
                {formatTime(page.updatedAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Create Page Modal */}
      {showCreateModal && (
        <div
          className="mobile-wikiroo-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="mobile-wikiroo-modal">
            <div className="mobile-wikiroo-modal-header">
              <h2 className="mobile-wikiroo-modal-title">New Page</h2>
              <button
                className="mobile-wikiroo-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreatePage}>
              <div className="mobile-wikiroo-modal-content">
                <div className="mobile-wikiroo-form-group">
                  <label className="mobile-wikiroo-form-label">Title</label>
                  <input
                    type="text"
                    className="mobile-wikiroo-form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Page title"
                    required
                  />
                </div>

                <div className="mobile-wikiroo-form-group">
                  <label className="mobile-wikiroo-form-label">Author</label>
                  <input
                    type="text"
                    className="mobile-wikiroo-form-input"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="mobile-wikiroo-form-group">
                  <label className="mobile-wikiroo-form-label">Content</label>
                  <textarea
                    className="mobile-wikiroo-form-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your page content (Markdown supported)"
                    required
                  />
                </div>

                <div className="mobile-wikiroo-form-group">
                  <label className="mobile-wikiroo-form-label">Tags</label>
                  <TagInput
                    value={tagNames}
                    onChange={setTagNames}
                    placeholder="Add tags"
                  />
                </div>
              </div>

              <div className="mobile-wikiroo-form-actions">
                <button
                  type="button"
                  className="mobile-wikiroo-button-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="mobile-wikiroo-button-primary"
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
