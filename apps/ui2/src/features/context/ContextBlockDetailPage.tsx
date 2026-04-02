import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Text, Stack, Chip, DataRowContainer } from '../../ui/primitives';
import { useContextBlock } from './useContextBlocks';
import { useContextCtx } from './ContextProvider';
import type { ContextTagResponseDto } from "@taico/client/v2";
import { elapsedTime } from '../../shared/helpers/elapsedTime';
import './ContextBlockDetailPage.css';
import Markdown from 'marked-react';
import { DeleteWithConfirmation } from 'src/ui/components';

export function ContextBlockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSectionTitle } = useContextCtx();

  // useContextBlock already implements the correct pattern:
  // - It fetches the block from the API regardless of cache
  // - It sets up WebSocket subscriptions for real-time updates
  // - It handles deleted blocks appropriately
  const { block, isLoading, error, isDeleted } = useContextBlock(id || '');

  useEffect(() => {
    if (block) {
      setSectionTitle(block.title);
    }
  }, [block, setSectionTitle]);

  // Redirect to list when block is deleted
  useEffect(() => {
    if (isDeleted) {
      navigate('/context/home');
    }
  }, [isDeleted, navigate]);

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

      <Stack spacing="3" className="context-block-detail__header">
        {block.tags.length > 0 && (
          <div className="context-block-detail__tags">
            {block.tags.map((tag: ContextTagResponseDto) => (
              <Chip key={tag.id}>{tag.name}</Chip>
            ))}
          </div>
        )}

        <div className="context-block-detail__meta">
          <Text size="2" tone="muted">by @{block.createdBy || 'unknown'}</Text>
          <Text size="2" tone="muted">•</Text>
          <Text size="2" tone="muted">{new Date(block.createdAt).toDateString()}</Text>
          <Text size="2" tone="muted">•</Text>
          <Text size="2" tone="muted">Last edited {elapsedTime(block.updatedAt)}</Text>
        </div>
      </Stack>

      <div className="context-block-detail__content">
        <Markdown>
          {block.content}
        </Markdown>
      </div>

      <DataRowContainer className='context-block-detail__actions'>
        <Button
          size='lg'
          variant='secondary'
          onClick={() => navigate('/context')}
        >
          Back to blocks
        </Button>
      </DataRowContainer>
    </div>
  );
}
