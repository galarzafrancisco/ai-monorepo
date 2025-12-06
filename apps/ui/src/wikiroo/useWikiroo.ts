import { useCallback, useEffect, useState } from 'react';
import type { CreatePageDto, UpdatePageDto } from 'shared';
import { WikirooService } from './api';
import type { WikiPage, WikiPageSummary } from './types';

export const useWikiroo = () => {
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
              tags: created.tags,
              parentId: created.parentId,
              order: created.order,
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

  const updatePage = useCallback(
    async (id: string, payload: UpdatePageDto) => {
      setIsUpdating(true);
      setError(null);
      try {
        const updated = await WikirooService.wikirooControllerUpdatePage(id, payload);
        setPages((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  id: updated.id,
                  title: updated.title,
                  author: updated.author,
                  tags: updated.tags,
                  parentId: updated.parentId,
                  order: updated.order,
                  createdAt: updated.createdAt,
                  updatedAt: updated.updatedAt,
                }
              : p,
          ),
        );
        if (selectedPage?.id === id) {
          setSelectedPage(updated);
        }
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update page');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [selectedPage],
  );

  const deletePage = useCallback(
    async (id: string) => {
      setIsDeleting(true);
      setError(null);
      try {
        await WikirooService.wikirooControllerDeletePage(id);
        setPages((prev) => prev.filter((p) => p.id !== id));
        if (selectedPage?.id === id) {
          setSelectedPage(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete page');
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [selectedPage],
  );

  const appendToPage = useCallback(
    async (id: string, content: string) => {
      setIsUpdating(true);
      setError(null);
      try {
        const updated = await WikirooService.wikirooControllerAppendToPage(id, { content });
        if (selectedPage?.id === id) {
          setSelectedPage(updated);
        }
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to append content');
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [selectedPage],
  );

  const addTagToPage = useCallback(
    async (pageId: string, tagData: { name: string; color?: string; description?: string }) => {
      setError(null);
      try {
        const updated = await WikirooService.wikirooControllerAddTagToPage(pageId, tagData);
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  id: updated.id,
                  title: updated.title,
                  author: updated.author,
                  tags: updated.tags,
                  parentId: updated.parentId,
                  order: updated.order,
                  createdAt: updated.createdAt,
                  updatedAt: updated.updatedAt,
                }
              : p,
          ),
        );
        if (selectedPage?.id === pageId) {
          setSelectedPage(updated);
        }
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add tag');
        throw err;
      }
    },
    [selectedPage],
  );

  const removeTagFromPage = useCallback(
    async (pageId: string, tagId: string) => {
      setError(null);
      try {
        const updated = await WikirooService.wikirooControllerRemoveTagFromPage(pageId, tagId);
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  id: updated.id,
                  title: updated.title,
                  author: updated.author,
                  tags: updated.tags,
                  parentId: updated.parentId,
                  order: updated.order,
                  createdAt: updated.createdAt,
                  updatedAt: updated.updatedAt,
                }
              : p,
          ),
        );
        if (selectedPage?.id === pageId) {
          setSelectedPage(updated);
        }
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove tag');
        throw err;
      }
    },
    [selectedPage],
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
    isUpdating,
    isDeleting,
    error,
    loadPages,
    createPage,
    selectPage,
    updatePage,
    appendToPage,
    deletePage,
    addTagToPage,
    removeTagFromPage,
  };
};
