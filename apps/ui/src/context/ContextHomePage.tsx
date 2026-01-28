import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import './Context.css';
import { useContext } from './useContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { ContextPageForm } from './ContextPageForm';
import { PageTree } from './PageTree';
import type { CreateBlockDto } from 'shared';
import type { ContextPageTree } from './types';

export function ContextHomePage() {
  const {
    pages,
    isLoadingList,
    isCreating,
    error,
    loadPages,
    createPage,
    getPageTree,
  } = useContext();

  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [pageTree, setPageTree] = useState<ContextPageTree[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  usePageTitle('Context');

  useEffect(() => {
    async function loadTree() {
      setIsLoadingTree(true);
      try {
        const tree = await getPageTree();
        setPageTree(tree);
      } catch (err) {
        console.error('Failed to load page tree:', err);
      } finally {
        setIsLoadingTree(false);
      }
    }
    loadTree();
  }, [getPageTree]);

  const handleCreatePage = async (data: CreateBlockDto) => {
    const created = await createPage(data);
    setShowForm(false);
    // Reload tree to show new page
    const tree = await getPageTree();
    setPageTree(tree);
    navigate(`/context/page/${created.id}`);
  };

  const handleRefresh = async () => {
    loadPages();
    setIsLoadingTree(true);
    try {
      const tree = await getPageTree();
      setPageTree(tree);
    } catch (err) {
      console.error('Failed to load page tree:', err);
    } finally {
      setIsLoadingTree(false);
    }
  };

  return (
    <div className="context context-home">
      <header className="context-header">
        <div>
          <h1>Context</h1>
          <p>Lightweight knowledge base for agents</p>
        </div>
        <div className="context-actions">
          <HomeLink />
          <button
            className="context-button secondary"
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingList || isLoadingTree}
          >
            {isLoadingList || isLoadingTree ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="context-button primary"
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? 'Close form' : 'New page'}
          </button>
        </div>
      </header>

      {showForm && (
        <ContextPageForm
          mode="create"
          pages={pages}
          onSubmit={handleCreatePage}
          onCancel={() => setShowForm(false)}
          isSubmitting={isCreating}
        />
      )}

      <section className="context-tree-container" aria-live="polite">
        {pageTree.length > 0 && (
          <PageTree
            pages={pageTree}
            currentPageId={undefined}
            onPageClick={(id) => navigate(`/context/page/${id}`)}
          />
        )}
      </section>

      {pageTree.length === 0 && !isLoadingTree && (
        <div className="context-empty">
          <strong>No pages yet</strong>
          <span>Create your first entry to share knowledge.</span>
        </div>
      )}

      {isLoadingTree && <div className="context-status">Loading pages…</div>}
      {error && <div className="context-error">{error}</div>}

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
