import { useNavigate, useParams } from 'react-router-dom';
import { useContext } from './useContext';
import { ContextPageForm } from './ContextPageForm';
import type { CreateBlockDto } from 'shared';

export function ContextCreate() {
  const navigate = useNavigate();
  const { pageId } = useParams<{ pageId: string }>();
  const { pages, isCreating, createPage, getPageTree } = useContext();

  const handleCreatePage = async (data: CreateBlockDto) => {
    const created = await createPage(data);
    // Reload tree to show new page
    await getPageTree();
    navigate(`/context/page/${created.id}`);
  };

  return (
    <div className="context-edit-container">
      <div className="context-edit-header">
        <h2>New Page</h2>
        <button
          onClick={() => navigate('/context')}
          className="context-button secondary"
        >
          Close
        </button>
      </div>
      <ContextPageForm
        mode="create"
        pages={pages}
        onSubmit={handleCreatePage}
        onCancel={() => navigate('/context')}
        isSubmitting={isCreating}
        defaultParentId={pageId}
      />
    </div>
  );
}
