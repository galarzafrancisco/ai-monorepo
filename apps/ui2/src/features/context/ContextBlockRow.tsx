import { useNavigate } from 'react-router-dom';
import { ContextBlock } from './types';
import './ContextBlockRow.css';

export function ContextBlockRow({ block }: { block: ContextBlock }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/context/block/${block.id}`);
  };

  return (
    <div className="context-block-row" onClick={handleClick}>
      <div className="context-block-row__header">
        <h3 className="context-block-row__title">{block.title}</h3>
        <div className="context-block-row__tags">
          {block.tags.map((tag) => (
            <span
              key={tag.id}
              className="context-block-row__tag"
              style={{ backgroundColor: tag.color || '#ccc' }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>
      <div className="context-block-row__meta">
        <span className="context-block-row__author">by {block.author}</span>
        <span className="context-block-row__date">
          {new Date(block.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
