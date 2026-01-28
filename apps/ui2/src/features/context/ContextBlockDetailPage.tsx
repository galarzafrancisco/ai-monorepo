import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Text, Stack, Chip } from '../../ui/primitives';
import { useContextBlock } from './useContextBlocks';
import { useContextCtx } from './ContextProvider';
import { ContextTagResponseDto } from 'shared';
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
    return (
      <div className="context-block-detail__loading">
        <Text>Loading...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="context-block-detail__error">
        <Text className="text--error">Error: {error}</Text>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="context-block-detail__error">
        <Text className="text--error">Context block not found</Text>
      </div>
    );
  }

  return (
    <div className="context-block-detail">
      <Button variant="ghost" size="sm" onClick={() => navigate('/context/home')}>
        ← Back to list
      </Button>

      <Stack spacing="3" className="context-block-detail__header">
        {block.tags.length > 0 && (
          <div className="context-block-detail__tags">
            {block.tags.map((tag: ContextTagResponseDto) => (
              <Chip key={tag.id}>{tag.name}</Chip>
            ))}
          </div>
        )}

        <div className="context-block-detail__meta">
          <Text size="2" tone="muted">by {block.createdBy || 'unknown'}</Text>
          <Text size="2" tone="muted">•</Text>
          <Text size="2" tone="muted">{new Date(block.createdAt).toDateString()}</Text>
        </div>
      </Stack>

      <div className="context-block-detail__content">
        <pre>{block.content}</pre>
      </div>
    </div>
  );
}
