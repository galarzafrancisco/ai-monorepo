import { useEffect, useState } from 'react';
import { ContextService } from './api';
import { ContextBlock, ContextBlockSummary } from './types';

export function useContextBlocks() {
  const [blocks, setBlocks] = useState<ContextBlockSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchBlocks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await ContextService.contextControllerListBlocks();
        if (isMounted) {
          setBlocks(data.items);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch context blocks');
          console.error('Error fetching context blocks:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBlocks();

    return () => {
      isMounted = false;
    };
  }, []);

  return { blocks, isLoading, error };
}

export function useContextBlock(id: string) {
  const [block, setBlock] = useState<ContextBlock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchBlock = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await ContextService.contextControllerGetBlock(id);
        if (isMounted) {
          setBlock(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch context block');
          console.error('Error fetching context block:', err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (id) {
      fetchBlock();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  return { block, isLoading, error };
}
