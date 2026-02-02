import { useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContext } from './useContext';
import { ContextPageForm } from './ContextPageForm';
import type { UpdateBlockDto } from "@taico/client";

export function ContextPageEdit() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { selectedPage, pages, isUpdating, updatePage, getPageTree, selectPage } = useContext();

  useEffect(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  const handleUpdate = useCallback(
    async (payload: UpdateBlockDto) => {
      if (!pageId) return;
      await updatePage(pageId, payload);
      // Reload tree in case title changed
      await getPageTree();
      // Navigate back to page view
      navigate(`/context/page/${pageId}`);
    },
    [pageId, updatePage, getPageTree, navigate],
  );

  if (!selectedPage) {
    return <div className="context-status">Loading...</div>;
  }

  return (
    <div className="context-edit-container">
      <div className="context-edit-header">
        <h2>Edit Page</h2>
        <button
          onClick={() => navigate(`/context/page/${pageId}`)}
          className="context-button secondary"
        >
          Close
        </button>
      </div>
      <ContextPageForm
        mode="edit"
        page={selectedPage}
        pages={pages}
        onSubmit={handleUpdate}
        onCancel={() => navigate(`/context/page/${pageId}`)}
        isSubmitting={isUpdating}
      />
    </div>
  );
}
