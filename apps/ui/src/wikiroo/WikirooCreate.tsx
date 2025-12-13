import { useNavigate, useParams } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
import { WikiPageForm } from './WikiPageForm';
import type { CreatePageDto } from 'shared';

export function WikirooCreate() {
  const navigate = useNavigate();
  const { pageId } = useParams<{ pageId: string }>();
  const { pages, isCreating, createPage, getPageTree } = useWikiroo();

  const handleCreatePage = async (data: CreatePageDto) => {
    const created = await createPage(data);
    // Reload tree to show new page
    await getPageTree();
    navigate(`/wikiroo/page/${created.id}`);
  };

  return (
    <div className="wikiroo-edit-container">
      <div className="wikiroo-edit-header">
        <h2>New Page</h2>
        <button
          onClick={() => navigate('/wikiroo')}
          className="wikiroo-button secondary"
        >
          Close
        </button>
      </div>
      <WikiPageForm
        mode="create"
        pages={pages}
        onSubmit={handleCreatePage}
        onCancel={() => navigate('/wikiroo')}
        isSubmitting={isCreating}
        defaultParentId={pageId}
      />
    </div>
  );
}
