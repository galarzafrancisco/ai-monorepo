import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { CreateBlockDto, UpdateBlockDto } from 'shared';
import { ContextService } from './api';
import { getUIWebSocketUrl } from '../config/api';
import type { ContextPage, ContextPageSummary, ContextPageTree } from './types';

const SOCKET_URL = getUIWebSocketUrl('/context');

export const useContext = () => {
  const [pages, setPages] = useState<ContextPageSummary[]>([]);
  const [selectedPage, setSelectedPage] = useState<ContextPage | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const loadPages = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const response = await ContextService.contextControllerListBlocks();
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
      const page = await ContextService.contextControllerGetBlock(id);
      setSelectedPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wiki page');
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  const createPage = useCallback(
    async (payload: CreateBlockDto) => {
      setIsCreating(true);
      setError(null);
      try {
        const created = await ContextService.contextControllerCreateBlock(payload);
        setPages((prev) => {
          const withoutCreated = prev.filter((page) => page.id !== created.id);
          return [
            {
              id: created.id,
              title: created.title,
              createdBy: created.createdBy,
              createdByActorId: created.createdByActorId,
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
    async (id: string, payload: UpdateBlockDto) => {
      setIsUpdating(true);
      setError(null);
      try {
        const updated = await ContextService.contextControllerUpdateBlock(id, payload);
        setPages((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  id: updated.id,
                  title: updated.title,
                  createdBy: updated.createdBy,
                  createdByActorId: updated.createdByActorId,
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
        await ContextService.contextControllerDeleteBlock(id);
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
        const updated = await ContextService.contextControllerAppendToBlock(id, { content });
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
        const updated = await ContextService.contextControllerAddTagToBlock(pageId, tagData);
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  id: updated.id,
                  title: updated.title,
                  createdBy: updated.createdBy,
                  createdByActorId: updated.createdByActorId,
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
        const updated = await ContextService.contextControllerRemoveTagFromBlock(pageId, tagId);
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  id: updated.id,
                  title: updated.title,
                  createdBy: updated.createdBy,
                  createdByActorId: updated.createdByActorId,
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

  const getPageTree = useCallback(async (): Promise<ContextPageTree[]> => {
    setError(null);
    try {
      const tree = await ContextService.contextControllerGetBlockTree();
      return tree;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch page tree');
      throw err;
    }
  }, []);

  const reorderPage = useCallback(
    async (pageId: string, newOrder: number) => {
      setError(null);
      try {
        const updated = await ContextService.contextControllerReorderBlock(pageId, {
          newOrder,
        });
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  id: updated.id,
                  title: updated.title,
                  createdBy: updated.createdBy,
                  createdByActorId: updated.createdByActorId,
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
        setError(err instanceof Error ? err.message : 'Failed to reorder page');
        throw err;
      }
    },
    [selectedPage],
  );

  const movePage = useCallback(
    async (pageId: string, newParentId: string | null) => {
      setError(null);
      try {
        const updated = await ContextService.contextControllerMoveBlock(pageId, {
          newParentId: newParentId as any,
        });
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  id: updated.id,
                  title: updated.title,
                  createdBy: updated.createdBy,
                  createdByActorId: updated.createdByActorId,
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
        setError(err instanceof Error ? err.message : 'Failed to move page');
        throw err;
      }
    },
    [selectedPage],
  );

  // Setup WebSocket
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to Context websocket');
      newSocket.emit('context.subscribe', {}, (ack: any) => {
        if (ack.ok) {
          console.log(ack);
          console.log('Subscribed to room:', ack.room);
          setIsConnected(true);
        } else {
          console.error('Failed to subscribe to room');
          setIsConnected(false);
        }
      });
      setIsConnected(true);
      loadPages();
    });

    newSocket.on('disconnect', () => {
      console.log('Context WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('page.created', (page: ContextPage) => {
      setPages((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.id === page.id)) {
          return prev;
        }
        return [
          {
            id: page.id,
            title: page.title,
            createdBy: page.createdBy,
            createdByActorId: page.createdByActorId,
            tags: page.tags,
            parentId: page.parentId,
            order: page.order,
            createdAt: page.createdAt,
            updatedAt: page.updatedAt,
          },
          ...prev,
        ];
      });
    });

    newSocket.on('page.updated', (page: ContextPage) => {
      setPages((prev) =>
        prev.map((p) =>
          p.id === page.id
            ? {
                id: page.id,
                title: page.title,
                createdBy: page.createdBy,
            createdByActorId: page.createdByActorId,
                tags: page.tags,
                parentId: page.parentId,
                order: page.order,
                createdAt: page.createdAt,
                updatedAt: page.updatedAt,
              }
            : p,
        ),
      );
      // Update selected page if it's the one being updated
      if (selectedPage?.id === page.id) {
        setSelectedPage(page);
      }
    });

    newSocket.on('page.deleted', ({ pageId }: { pageId: string }) => {
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      // Clear selected page if it was deleted
      if (selectedPage?.id === pageId) {
        setSelectedPage(null);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [loadPages, selectedPage?.id]);

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
    isConnected,
    socket,
    loadPages,
    createPage,
    selectPage,
    updatePage,
    appendToPage,
    deletePage,
    addTagToPage,
    removeTagFromPage,
    getPageTree,
    reorderPage,
    movePage,
  };
};
