import { useEffect, useState } from 'react';
import { ExecutionsService } from './api';
import type { Execution } from './types';
import type { ExecutionListResponseDto } from "@taico/client/v2";

export type ExecutionStatus = 'READY' | 'CLAIMED' | 'RUNNING' | 'STOP_REQUESTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALE';

export const useExecutions = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [executions, setExecutions] = useState<Execution[]>([]);

  // Boot
  useEffect(() => {
    loadExecutions();
  }, []);

  // Filtered load
  const loadExecutions = async (statusFilter?: ExecutionStatus) => {
    setIsLoading(true);
    setError(null);
    try {
      const response: ExecutionListResponseDto = await ExecutionsService.ExecutionsController_listExecutions({
        status: statusFilter,
        page: 1,
        limit: 50,
      });
      setExecutions(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load executions');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    executions,
    loadExecutions,
  };
};
