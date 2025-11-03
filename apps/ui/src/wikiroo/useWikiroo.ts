import { useCallback, useEffect, useState } from 'react';
import type { CreatePageDto } from 'shared';
import { WikirooService } from './api';
import type { WikiPage, WikiPageSummary } from './types';

export const useWikiroo = () => {
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const response = await WikirooService.wikirooControllerListPages();
      setPages(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wiki pages');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const fetchPage = useCallback(async (id: string) => {
    setIsLoadingPage(true);
    setError(null);
    setSelectedPage(null);
    try {
      const page = await WikirooService.wikirooControllerGetPage(id);
      setSelectedPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wiki page');
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  const createPage = useCallback(
    async (payload: CreatePageDto) => {
      setIsCreating(true);
      setError(null);
      try {
        const created = await WikirooService.wikirooControllerCreatePage(payload);
        setPages((prev) => {
          const withoutCreated = prev.filter((page) => page.id !== created.id);
          return [
            {
              id: created.id,
              title: created.title,
              author: created.author,
              createdAt: created.createdAt,
              updatedAt: created.updatedAt,
            },
            ...withoutCreated,
          ];
        });
        setSelectedPage(created);
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create wiki page');
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  const selectPage = useCallback(
    (id: string) => {
      fetchPage(id);
    },
    [fetchPage],
  );

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  return {
    pages,
    selectedPage,
    isLoadingList,
    isLoadingPage,
    isCreating,
    error,
    loadPages,
    createPage,
    selectPage,
  };
};
