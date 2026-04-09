import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Text, Stack, Chip, DataRowContainer } from '../../ui/primitives';
import { useContextBlock } from './useContextBlocks';
import { useContextCtx } from './ContextProvider';
import { ContextService } from './api';
import { ThreadsService } from '../threads/api';
import type { ContextTagResponseDto } from "@taico/client/v2";
import { elapsedTime } from '../../shared/helpers/elapsedTime';
import { useToast } from '../../shared/context/ToastContext';
import './ContextBlockDetailPage.css';
import Markdown from 'marked-react';
import { DeleteWithConfirmation } from '../../ui/components';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';

function normalizeParentId(parentId: { id?: string } | string | null | undefined): string | null {
  if (typeof parentId === 'string') {
    return parentId;
  }

  if (parentId && typeof parentId === 'object' && typeof parentId.id === 'string') {
    return parentId.id;
  }

  return null;
}

export function ContextBlockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSectionTitle, blocks } = useContextCtx();
  const { showError } = useToast();
  const isDesktop = useIsDesktop();

  // useContextBlock already implements the correct pattern:
  // - It fetches the block from the API regardless of cache
  // - It sets up WebSocket subscriptions for real-time updates
  // - It handles deleted blocks appropriately
  const { block, isLoading, error, isDeleted } = useContextBlock(id || '');

  // State for thread detection
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isCheckingThread, setIsCheckingThread] = useState(false);

  useEffect(() => {
    if (block) {
      setSectionTitle(isDesktop ? 'Context' : block.title);
    }
  }, [block, isDesktop, setSectionTitle]);

  // Check if this block is a thread's state memory
  useEffect(() => {
    if (!block?.id) {
      setThreadId(null);
      return;
    }

    let cancelled = false;
    setIsCheckingThread(true);

    // Use the specific endpoint to find threads by state block ID
    ThreadsService.ThreadsController_getThreadsByStateBlockId({ stateBlockId: block.id })
      .then((threads) => {
        if (!cancelled) {
          // Take the first thread if any (typically there should be only one)
          setThreadId(threads.length > 0 ? threads[0].id : null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error('Error checking for thread:', err);
          setThreadId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingThread(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [block?.id]);

  // Redirect to list when block is deleted
  useEffect(() => {
    if (isDeleted) {
      navigate('/context/home');
    }
  }, [isDeleted, navigate]);

  const breadcrumbs = useMemo(() => {
    if (!block) {
      return [];
    }

    const summaryById = new Map(blocks.map((summary) => [summary.id, summary]));
    const trail: Array<{ id: string; title: string }> = [];
    let currentId: string | null = block.id;

    while (currentId) {
      const currentBlock = currentId === block.id ? block : summaryById.get(currentId);
      if (!currentBlock) {
        break;
      }
      trail.unshift({ id: currentBlock.id, title: currentBlock.title });
      currentId = normalizeParentId(currentBlock.parentId);
    }

    return trail;
  }, [block, blocks]);

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
        {isDesktop ? (
          <div className="context-block-detail__breadcrumbs" aria-label="Breadcrumb">
            <button type="button" className="context-block-detail__breadcrumb" onClick={() => navigate('/context/home')}>
              Home
            </button>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id} className="context-block-detail__breadcrumb-segment">
                <span className="context-block-detail__breadcrumb-separator">›</span>
                <button
                  type="button"
                  className={`context-block-detail__breadcrumb ${index === breadcrumbs.length - 1 ? 'context-block-detail__breadcrumb--current' : ''}`}
                  onClick={() => navigate(`/context/block/${crumb.id}`)}
                  disabled={index === breadcrumbs.length - 1}
                >
                  {crumb.title}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {isDesktop ? (
          <div className="context-block-detail__title-wrap">
            <h1 className="context-block-detail__title">{block.title}</h1>
          </div>
        ) : null}

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


      <DeleteWithConfirmation className='context-block-detail__actions'
        onDelete={async () => {
          try {
            await ContextService.ContextController_deleteBlock({ id: block.id });
            navigate('/context');
          } catch (err: unknown) {
            showError(err);
          }
        }}
        deleteLabel="Delete"
        confirmLabel="Confirm Delete"
      />

      <DataRowContainer className='context-block-detail__actions'>
        <Button
          size='lg'
          variant='secondary'
          onClick={() => navigate(`/context/block/${block.id}/edit`)}
        >
          Edit
        </Button>
        {threadId && (
          <Button
            size='lg'
            variant='primary'
            onClick={() => navigate(`/threads/${threadId}`)}
            disabled={isCheckingThread}
          >
            Go to thread
          </Button>
        )}
        {!isDesktop ? (
          <Button
            size='lg'
            variant='secondary'
            onClick={() => navigate('/context')}
          >
            Back to blocks
          </Button>
        ) : null}
      </DataRowContainer>
    </div>
  );
}
