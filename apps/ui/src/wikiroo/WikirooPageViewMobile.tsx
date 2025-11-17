import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
import { MarkdownPreview } from './MarkdownPreview';
import { WikiPageEditForm } from './WikiPageEditForm';
import { TagSelector } from './TagSelector';
import './WikirooMobile.css';

export function WikirooPageViewMobile() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const {
    selectedPage,
    isLoadingPage,
    error,
    fetchPage,
    removeTagFromPage,
  } = useWikiroo();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);

  useEffect(() => {
    if (pageId) {
      fetchPage(pageId);
    }
  }, [pageId, fetchPage]);

  if (isLoadingPage) {
    return (
      <div className="mobile-wikiroo-page-view">
        <div className="mobile-wikiroo-loading">Loading page...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-wikiroo-page-view">
        <div className="mobile-wikiroo-error">{error}</div>
      </div>
    );
  }

  if (!selectedPage) {
    return (
      <div className="mobile-wikiroo-page-view">
        <div className="mobile-wikiroo-error">Page not found</div>
      </div>
    );
  }

  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedPage) return;
    await removeTagFromPage(selectedPage.id, tagId);
  };

  return (
    <div className="mobile-wikiroo-page-view">
      {/* Header */}
      <div className="mobile-wikiroo-page-header">
        <div className="mobile-wikiroo-page-nav">
          <button
            className="mobile-wikiroo-back-button"
            onClick={() => navigate('/wikiroo')}
          >
            ← Back
          </button>
          <button
            className="mobile-wikiroo-edit-button"
            onClick={() => setShowEditModal(true)}
          >
            Edit
          </button>
        </div>

        <h1 className="mobile-wikiroo-page-view-title">{selectedPage.title}</h1>
        <div className="mobile-wikiroo-page-view-meta">
          By {selectedPage.author} • Updated {formatDateTime(selectedPage.updatedAt)}
        </div>
      </div>

      {/* Tags Section */}
      {selectedPage.tags && selectedPage.tags.length > 0 && (
        <div className="mobile-wikiroo-tags-section">
          <div className="mobile-wikiroo-tags-header">Tags</div>
          <div className="mobile-wikiroo-tags-list">
            {selectedPage.tags.map((tag, index) => (
              <div
                key={tag.id}
                className="mobile-wikiroo-tag-item"
                style={{ backgroundColor: getTagColor(index) }}
              >
                {tag.name}
                <button
                  className="mobile-wikiroo-tag-remove"
                  onClick={() => handleRemoveTag(tag.id)}
                  aria-label={`Remove tag ${tag.name}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="mobile-wikiroo-add-tag-button"
              onClick={() => setShowTagSelector(true)}
            >
              + Add Tag
            </button>
          </div>
        </div>
      )}

      {/* No Tags - Show Add Button */}
      {(!selectedPage.tags || selectedPage.tags.length === 0) && (
        <div className="mobile-wikiroo-tags-section">
          <div className="mobile-wikiroo-tags-header">Tags</div>
          <button
            className="mobile-wikiroo-add-tag-button"
            onClick={() => setShowTagSelector(true)}
          >
            + Add Tag
          </button>
        </div>
      )}

      {/* Content */}
      <div className="mobile-wikiroo-page-content">
        <div className="mobile-wikiroo-markdown">
          <MarkdownPreview content={selectedPage.content} />
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <WikiPageEditForm
          page={selectedPage}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Tag Selector Modal */}
      {showTagSelector && (
        <div
          className="mobile-wikiroo-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTagSelector(false);
            }
          }}
        >
          <div className="mobile-wikiroo-modal">
            <div className="mobile-wikiroo-modal-header">
              <h2 className="mobile-wikiroo-modal-title">Add Tag</h2>
              <button
                className="mobile-wikiroo-modal-close"
                onClick={() => setShowTagSelector(false)}
              >
                Close
              </button>
            </div>
            <div className="mobile-wikiroo-modal-content">
              <TagSelector
                pageId={selectedPage.id}
                onTagAdded={() => {
                  setShowTagSelector(false);
                  fetchPage(selectedPage.id);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
