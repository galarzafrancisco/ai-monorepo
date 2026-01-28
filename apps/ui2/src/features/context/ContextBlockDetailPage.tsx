import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContextBlock } from './useContextBlocks';
import { useContextCtx } from './ContextProvider';
import './ContextBlockDetailPage.css';

export function ContextBlockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSectionTitle } = useContextCtx();
  const { block, isLoading, error } = useContextBlock(id || '');

  useEffect(() => {
    if (block) {
      setSectionTitle(block.title);
    }
  }, [block, setSectionTitle]);

  if (isLoading) {
    return <div className="context-block-detail__loading">Loading...</div>;
  }

  if (error) {
    return <div className="context-block-detail__error">Error: {error}</div>;
  }

  if (!block) {
    return <div className="context-block-detail__error">Context block not found</div>;
  }

  return (
    <div className="context-block-detail">
      <button className="context-block-detail__back" onClick={() => navigate('/context/home')}>
        ← Back to list
      </button>

      <div className="context-block-detail__header">
        <h1 className="context-block-detail__title">{block.title}</h1>
        <div className="context-block-detail__tags">
          {block.tags.map((tag) => (
            <span
              key={tag.id}
              className="context-block-detail__tag"
              style={{ backgroundColor: tag.color || '#ccc' }}
            >
              {tag.name}
            </span>
          ))}
        </div>
        <div className="context-block-detail__meta">
          <span>by {block.author}</span>
          <span>•</span>
          <span>{new Date(block.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="context-block-detail__content">
        <pre>{block.content}</pre>
      </div>
    </div>
  );
}
