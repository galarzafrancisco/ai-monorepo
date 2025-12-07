import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';
import { usePageTitle } from '../hooks/usePageTitle';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { WikiPageForm } from './WikiPageForm';
import { PageTree } from './PageTree';
import type { CreatePageDto } from 'shared';
import type { WikiPageTree } from './types';

export function WikirooHomePage() {
  const {
    pages,
    isLoadingList,
    isCreating,
    error,
    loadPages,
    createPage,
    getPageTree,
  } = useWikiroo();

  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [pageTree, setPageTree] = useState<WikiPageTree[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  usePageTitle('Wikiroo');

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

  const handleCreatePage = async (data: CreatePageDto) => {
    const created = await createPage(data);
    setShowForm(false);
    // Reload tree to show new page
    const tree = await getPageTree();
    setPageTree(tree);
    navigate(`/wikiroo/page/${created.id}`);
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
            onClick={handleRefresh}
            disabled={isLoadingList || isLoadingTree}
          >
            {isLoadingList || isLoadingTree ? 'Refreshing…' : 'Refresh'}
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
          pages={pages}
          onSubmit={handleCreatePage}
          onCancel={() => setShowForm(false)}
          isSubmitting={isCreating}
        />
      )}

      <section className="wikiroo-tree-container" aria-live="polite">
        {pageTree.length > 0 && (
          <PageTree
            pages={pageTree}
            currentPageId={undefined}
            onPageClick={(id) => navigate(`/wikiroo/page/${id}`)}
          />
        )}
      </section>

      {pageTree.length === 0 && !isLoadingTree && (
        <div className="wikiroo-empty">
          <strong>No pages yet</strong>
          <span>Create your first entry to share knowledge.</span>
        </div>
      )}

      {isLoadingTree && <div className="wikiroo-status">Loading pages…</div>}
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
