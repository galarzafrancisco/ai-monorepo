import { useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
import { WikiPageForm } from './WikiPageForm';
import type { UpdatePageDto } from 'shared';

export function WikirooPageEdit() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { selectedPage, pages, isUpdating, updatePage, getPageTree, selectPage } = useWikiroo();

  useEffect(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  const handleUpdate = useCallback(
    async (payload: UpdatePageDto) => {
      if (!pageId) return;
      await updatePage(pageId, payload);
      // Reload tree in case title changed
      await getPageTree();
      // Navigate back to page view
      navigate(`/wikiroo/page/${pageId}`);
    },
    [pageId, updatePage, getPageTree, navigate],
  );

  if (!selectedPage) {
    return <div className="wikiroo-status">Loading...</div>;
  }

  return (
    <div className="wikiroo-edit-container">
      <div className="wikiroo-edit-header">
        <h2>Edit Page</h2>
        <button
          onClick={() => navigate(`/wikiroo/page/${pageId}`)}
          className="wikiroo-button secondary"
        >
          Close
        </button>
      </div>
      <WikiPageForm
        mode="edit"
        page={selectedPage}
        pages={pages}
        onSubmit={handleUpdate}
        onCancel={() => navigate(`/wikiroo/page/${pageId}`)}
        isSubmitting={isUpdating}
      />
    </div>
  );
}
