import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { HomeLink } from "../components/HomeLink";
import "./Wikiroo.css";
import { useWikiroo } from "./useWikiroo";
import { usePageTitle } from "../hooks/usePageTitle";
import { useToast } from "../hooks/useToast";
import { Toast } from "../components/Toast";
import { TagBadge } from "./TagBadge";
import { WikiPageForm } from "./WikiPageForm";
import type { CreatePageDto } from "shared";

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

  usePageTitle("Wikiroo");

  const handleCreatePage = async (data: CreatePageDto) => {
    const created = await createPage(data);
    setShowForm(false);
    navigate(`/wikiroo/${created.id}`);
  };

  return (
    <div className="wikiroo-page">
      <div className="wikiroo-container">
        <header className="wikiroo-header">
          <div className="header-content">
            <div className="header-title-section">
              <h1 className="wikiroo-title">Wikiroo</h1>
              <p className="wikiroo-subtitle">Knowledge base and wiki pages</p>
            </div>
            <div className="header-actions">
              <HomeLink />
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={loadPages}
                disabled={isLoadingList}
              >
                {isLoadingList ? (
                  <>
                    <span className="spinner"></span>
                    Refreshing…
                  </>
                ) : (
                  "Refresh"
                )}
              </button>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
              >
                {showForm ? "Cancel" : "+ New page"}
              </button>
            </div>
          </div>
        </header>

        {showForm && (
          <div className="form-container">
            <WikiPageForm
              mode="create"
              onSubmit={handleCreatePage}
              onCancel={() => setShowForm(false)}
              isSubmitting={isCreating}
            />
          </div>
        )}

        {pages.length === 0 && !isLoadingList ? (
          <div className="empty-state">
            <div className="empty-state-icon">◈</div>
            <h2 className="empty-state-title">No pages yet</h2>
            <p className="empty-state-description">
              Create your first wiki page to start building your knowledge base
            </p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowForm(true)}
            >
              + Create first page
            </button>
          </div>
        ) : (
          <div className="pages-grid">
            {pages.map((page, index) => (
              <Link
                key={page.id}
                to={`/wikiroo/${page.id}`}
                className="page-card"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="page-card-header">
                  <h3 className="page-card-title">{page.title}</h3>
                  <div className="page-card-author">by {page.author}</div>
                </div>

                {page.tags && page.tags.length > 0 && (
                  <div className="page-card-tags">
                    {page.tags.map((tag) => (
                      <TagBadge key={tag.name} tag={tag} small />
                    ))}
                  </div>
                )}

                <div className="page-card-footer">
                  <span className="page-card-date">
                    Updated {formatDate(page.updatedAt)}
                  </span>
                  <span className="page-card-arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {isLoadingList && (
          <div className="loading-state">
            <span className="spinner"></span>
            <p>Loading pages…</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
          </div>
        )}
      </div>

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
