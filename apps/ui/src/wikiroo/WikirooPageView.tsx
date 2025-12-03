import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams, useNavigate } from "react-router";
import { HomeLink } from "../components/HomeLink";
import "./Wikiroo.css";
import { useWikiroo } from "./useWikiroo";
import { MarkdownPreview } from "./MarkdownPreview";
import { usePageTitle } from "../hooks/usePageTitle";
import { WikiPageForm } from "./WikiPageForm";
import { TagBadge } from "./TagBadge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { UpdatePageDto } from "shared";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function WikirooPageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const {
    pages,
    selectedPage,
    isLoadingPage,
    error,
    selectPage,
    updatePage,
    deletePage,
    isUpdating,
    isDeleting,
  } = useWikiroo();
  const [showEditForm, setShowEditForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const pageSummary = pages.find((page) => page.id === pageId);
  const pageTitle = selectedPage?.title || pageSummary?.title;
  usePageTitle(pageTitle ? `Wikiroo — ${pageTitle}` : "Wikiroo");

  useEffect(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  if (!pageId) {
    return <Navigate to="/wikiroo" replace />;
  }

  const showNotFound =
    !isLoadingPage && !selectedPage && !error && pages.length > 0 && !pageSummary;

  const handleUpdate = useCallback(
    async (payload: UpdatePageDto) => {
      if (!pageId) return;
      await updatePage(pageId, payload);
      setShowEditForm(false);
      setErrorMessage("");
    },
    [pageId, updatePage]
  );

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pageId) return;
    try {
      await deletePage(pageId);
      setShowDeleteConfirm(false);
      navigate("/wikiroo");
    } catch (err: any) {
      const errorMsg =
        err?.body?.detail || err?.message || "Failed to delete page";
      setErrorMessage(errorMsg);
      setShowDeleteConfirm(false);
    }
  }, [pageId, deletePage, navigate]);

  return (
    <div className="wikiroo-page">
      <div className="wikiroo-container">
        <header className="wikiroo-header">
          <div className="header-content">
            <Link to="/wikiroo" className="back-link">
              ← All pages
            </Link>
            <div className="header-actions">
              <HomeLink />
            </div>
          </div>
        </header>

        {isLoadingPage && (
          <div className="loading-state">
            <span className="spinner"></span>
            <p>Loading page…</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
          </div>
        )}

        {errorMessage && (
          <div className="error-state">
            <p>{errorMessage}</p>
          </div>
        )}

        {showNotFound && (
          <div className="empty-state">
            <div className="empty-state-icon">◈</div>
            <h2 className="empty-state-title">Page not found</h2>
            <p className="empty-state-description">
              The requested page may have been removed or never existed
            </p>
          </div>
        )}

        {selectedPage && !showEditForm && (
          <article className="page-detail">
            <div className="page-detail-header">
              <h1 className="page-detail-title">{selectedPage.title}</h1>
              <div className="page-detail-meta">
                <span>By {selectedPage.author}</span>
                <span className="meta-separator">•</span>
                <span>Created {formatDate(selectedPage.createdAt)}</span>
                <span className="meta-separator">•</span>
                <span>Updated {formatDate(selectedPage.updatedAt)}</span>
              </div>
            </div>

            {selectedPage.tags && selectedPage.tags.length > 0 && (
              <div className="page-detail-tags">
                {selectedPage.tags.map((tag) => (
                  <TagBadge key={tag.name} tag={tag} />
                ))}
              </div>
            )}

            <div className="page-detail-content">
              <MarkdownPreview content={selectedPage.content} />
            </div>

            <div className="page-detail-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowEditForm(true)}
                disabled={isUpdating || isDeleting}
              >
                Edit page
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={handleDeleteClick}
                disabled={isUpdating || isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete page"}
              </button>
            </div>
          </article>
        )}

        {showEditForm && selectedPage && (
          <div className="edit-form-container">
            <div className="edit-form-header">
              <h2>Edit Page</h2>
              <button
                onClick={() => setShowEditForm(false)}
                className="btn btn-ghost btn-sm"
              >
                Close
              </button>
            </div>
            <WikiPageForm
              mode="edit"
              page={selectedPage}
              onSubmit={handleUpdate}
              onCancel={() => setShowEditForm(false)}
              isSubmitting={isUpdating}
            />
          </div>
        )}

        {showDeleteConfirm && (
          <ConfirmDialog
            message="Are you sure you want to delete this page? This action cannot be undone."
            onConfirm={handleDeleteConfirm}
            onCancel={() => setShowDeleteConfirm(false)}
            confirmText="Delete"
            cancelText="Cancel"
          />
        )}
      </div>
    </div>
  );
}
