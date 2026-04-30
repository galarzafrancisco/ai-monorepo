import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Chip, Text } from "../../ui/primitives";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { TaskStatus } from "./const";
import { useTasksCtx } from "./TasksProvider";
import type { Task } from "./types";
import { useExecutions } from "../executions/useExecutions";
import { getTaskStatusTag } from "./taskStatusTag";
import { MetaService } from "./api";
import type { MetaTagResponseDto } from "@taico/client/v2";
import type { TaskActivityWireEvent } from "@taico/events";
import "./TaskDependenciesPage.css";

type GraphConnection = {
  fromTaskId: string;
  toTaskId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type GraphNode = {
  task: Task;
  layer: number;
  x: number;
  y: number;
  height: number;
};

type DependencyGraph = {
  nodes: GraphNode[];
  connections: GraphConnection[];
  width: number;
  height: number;
};

type GraphMode = "dependencies" | "all";

type GraphTagFilter = {
  name: string;
  count: number;
};

const NODE_WIDTH = 228;
const COMPACT_NODE_HEIGHT = 48;
const TAGGED_NODE_HEIGHT = 60;
const ASSIGNEE_NODE_HEIGHT = 74;
const LAYER_GAP = 112;
const ROW_GAP = 20;
const CANVAS_PADDING = 48;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.15;
const WHEEL_ZOOM_SENSITIVITY = 0.0025;

export function TaskDependenciesPage(): React.JSX.Element {
  const { tasks, isLoading, error, setSectionTitle, activityByTaskId } = useTasksCtx();
  const { active } = useExecutions();
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const panDragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startPanX: number; startPanY: number } | null>(null);
  const tagPickerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphMode>("dependencies");
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<MetaTagResponseDto[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle("Dependencies");
  }, [setSectionTitle]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    const abortController = new AbortController();

    void MetaService.MetaController_getAllTags({ signal: abortController.signal })
      .then(setAvailableTags)
      .catch((tagsError: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }
        console.error("Failed to load dependency graph tags:", tagsError);
      });

    return () => abortController.abort();
  }, []);

  const availableTagFilters = useMemo(() => getAvailableTagFilters(tasks, availableTags), [availableTags, tasks]);
  const availableTagFilterByName = useMemo(() => new Map(availableTagFilters.map((tag) => [tag.name, tag])), [availableTagFilters]);
  const selectedTagFilters = useMemo(() => {
    return selectedTagNames.map((tagName) => availableTagFilterByName.get(tagName) ?? { name: tagName, count: 0 });
  }, [availableTagFilterByName, selectedTagNames]);
  const tagPickerOptions = useMemo(() => {
    const selectedTagNameSet = new Set(selectedTagNames);
    const normalizedQuery = tagSearchQuery.trim().toLowerCase();

    return availableTagFilters
      .filter((tag) => !selectedTagNameSet.has(tag.name))
      .filter((tag) => normalizedQuery.length === 0 || tag.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [availableTagFilters, selectedTagNames, tagSearchQuery]);
  const filteredTasks = useMemo(() => filterTasksByTags(tasks, selectedTagNames), [tasks, selectedTagNames]);
  const activeTaskIds = useMemo(() => new Set(active.map((execution) => execution.taskId)), [active]);
  const activeStatusByTaskId = useMemo(() => {
    return new Map(active.map((execution) => [execution.taskId, execution.taskStatus as TaskStatus]));
  }, [active]);
  const activityActiveTaskIds = useMemo(() => {
    return new Set(Object.values(activityByTaskId).filter(isActiveExecutionActivity).map((activity) => activity.taskId));
  }, [activityByTaskId]);
  const graph = useMemo(
    () => buildDependencyGraph(filteredTasks, activeStatusByTaskId, activeTaskIds, activityActiveTaskIds, { includeAllTasks: graphMode === "all" }),
    [activeStatusByTaskId, activeTaskIds, activityActiveTaskIds, filteredTasks, graphMode],
  );
  const hasSelectedTags = selectedTagNames.length > 0;
  const graphModeLabel = graphMode === "all" ? "all tasks" : "tasks with dependencies";

  useEffect(() => {
    if (!isTagPickerOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (tagPickerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsTagPickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isTagPickerOpen]);

  const addTagFilter = useCallback((tagName: string) => {
    setSelectedTagNames((currentTagNames) => {
      if (currentTagNames.includes(tagName)) {
        return currentTagNames;
      }
      return [...currentTagNames, tagName];
    });
    setTagSearchQuery("");
    setIsTagPickerOpen(false);
  }, []);

  const removeTagFilter = useCallback((tagName: string) => {
    setSelectedTagNames((currentTagNames) => currentTagNames.filter((currentTagName) => currentTagName !== tagName));
  }, []);

  const clearTagFilters = useCallback(() => {
    setSelectedTagNames([]);
  }, []);

  const handleTagSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const [firstOption] = tagPickerOptions;
      if (firstOption) {
        addTagFilter(firstOption.name);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsTagPickerOpen(false);
    }
  }, [addTagFilter, tagPickerOptions]);

  const applyZoom = useCallback((nextZoomValue: number, focusPoint?: { x: number; y: number }) => {
    const viewport = viewportRef.current;
    const nextZoom = clampZoom(nextZoomValue);

    if (!viewport || nextZoom === zoom) {
      setZoom(nextZoom);
      return;
    }

    const focus = focusPoint ?? {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    };

    setPan((currentPan) => {
      const graphX = (focus.x - currentPan.x) / zoom;
      const graphY = (focus.y - currentPan.y) / zoom;
      return {
        x: focus.x - graphX * nextZoom,
        y: focus.y - graphY * nextZoom,
      };
    });
    setZoom(nextZoom);
  }, [zoom]);

  const updateZoom = useCallback((delta: number) => {
    setZoom((currentZoom) => clampZoom(currentZoom + delta));
  }, []);
  const resetZoom = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleCanvasWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (graph.nodes.length === 0) {
      return;
    }

    const viewport = event.currentTarget;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      applyZoom(zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      return;
    }

    if (event.deltaX !== 0 || event.deltaY !== 0) {
      event.preventDefault();
      const deltaMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      setPan((currentPan) => ({
        x: currentPan.x - event.deltaX * deltaMultiplier,
        y: currentPan.y - event.deltaY * deltaMultiplier,
      }));
    }
  }, [applyZoom, graph.nodes.length, zoom]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (graph.nodes.length === 0 || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest(".dependency-task-card")) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
    };
    setIsPanning(true);
  }, [graph.nodes.length]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    setPan({
      x: drag.startPanX + event.clientX - drag.startClientX,
      y: drag.startPanY + event.clientY - drag.startClientY,
    });
  }, []);

  const finishPointerPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panDragRef.current = null;
    setIsPanning(false);
  }, []);

  if (isLoading && tasks.length === 0) {
    return (
      <div className="task-dependencies-page task-dependencies-page--state">
        <Text tone="muted">Loading dependencies...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="task-dependencies-page task-dependencies-page--state">
        <Text tone="muted">Could not load dependencies: {error}</Text>
      </div>
    );
  }

  return (
    <div className="task-dependencies-page">
      <div className="task-dependencies-canvas" aria-label="Task dependency graph">
        <div className="task-dependencies-controls" aria-label="Dependency graph filters">
          <div className="task-dependencies-controls__row">
            <span className="task-dependencies-controls__label">Show</span>
            <div className="task-dependencies-segmented" role="group" aria-label="Graph task scope">
              <button
                className={`task-dependencies-segmented__button ${graphMode === "dependencies" ? "task-dependencies-segmented__button--active" : ""}`}
                type="button"
                onClick={() => setGraphMode("dependencies")}
              >
                With dependencies
              </button>
              <button
                className={`task-dependencies-segmented__button ${graphMode === "all" ? "task-dependencies-segmented__button--active" : ""}`}
                type="button"
                onClick={() => setGraphMode("all")}
              >
                All tasks
              </button>
            </div>
          </div>
          <div className="task-dependencies-controls__row task-dependencies-controls__row--tags">
            <span className="task-dependencies-controls__label">Tags</span>
            <div className="task-dependencies-tags" aria-label="Tag filters">
              <div className="task-dependencies-selected-tags" aria-label="Selected tag filters">
                {selectedTagFilters.length === 0 ? (
                  <span className="task-dependencies-tags__empty">No filters</span>
                ) : (
                  selectedTagFilters.map((tag) => (
                    <button
                      key={tag.name}
                      className="task-dependencies-tag task-dependencies-tag--selected"
                      type="button"
                      onClick={() => removeTagFilter(tag.name)}
                      aria-label={`Remove ${tag.name} filter`}
                    >
                      {tag.name}
                      <span className="task-dependencies-tag__count">{tag.count}</span>
                      <span className="task-dependencies-tag__remove" aria-hidden="true">×</span>
                    </button>
                  ))
                )}
                {hasSelectedTags ? (
                  <button className="task-dependencies-tags__clear" type="button" onClick={clearTagFilters}>
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="task-dependencies-tag-picker" ref={tagPickerRef}>
                <input
                  className="task-dependencies-tag-picker__input"
                  type="search"
                  value={tagSearchQuery}
                  placeholder="Add tag filter"
                  aria-label="Add tag filter"
                  aria-expanded={isTagPickerOpen}
                  aria-controls="task-dependencies-tag-picker-list"
                  onChange={(event) => {
                    setTagSearchQuery(event.target.value);
                    setIsTagPickerOpen(true);
                  }}
                  onFocus={() => setIsTagPickerOpen(true)}
                  onKeyDown={handleTagSearchKeyDown}
                />
                {isTagPickerOpen ? (
                  <div
                    id="task-dependencies-tag-picker-list"
                    className="task-dependencies-tag-picker__menu"
                    role="listbox"
                    aria-label="Available tag filters"
                  >
                    {tagPickerOptions.length === 0 ? (
                      <span className="task-dependencies-tag-picker__empty">
                        {availableTagFilters.length === selectedTagNames.length ? "No more tags" : "No matching tags"}
                      </span>
                    ) : (
                      tagPickerOptions.map((tag) => (
                        <button
                          key={tag.name}
                          className="task-dependencies-tag-picker__option"
                          type="button"
                          role="option"
                          aria-selected="false"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => addTagFilter(tag.name)}
                        >
                          <span className="task-dependencies-tag-picker__option-name">{tag.name}</span>
                          <span className="task-dependencies-tag-picker__option-count">{tag.count}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <span className="task-dependencies-controls__summary">
            Showing {graph.nodes.length} {graphModeLabel}{hasSelectedTags ? ` matching ${selectedTagNames.length} tag${selectedTagNames.length === 1 ? "" : "s"}` : ""}.
          </span>
        </div>
        {graph.nodes.length === 0 ? (
          <div className="task-dependencies-empty">
            <Text size="3" weight="semibold">No tasks match this graph</Text>
            <Text tone="muted">Adjust the task scope or tag filters to show more tasks.</Text>
          </div>
        ) : (
          <>
            <div className="task-dependencies-toolbar" aria-label="Dependency graph controls">
              <button className="task-dependencies-toolbar__button" type="button" onClick={() => updateZoom(-ZOOM_STEP)} aria-label="Zoom out" title="Zoom out">
                <ZoomOut size={16} strokeWidth={1.8} />
              </button>
              <span className="task-dependencies-toolbar__zoom">{Math.round(zoom * 100)}%</span>
              <button className="task-dependencies-toolbar__button" type="button" onClick={() => updateZoom(ZOOM_STEP)} aria-label="Zoom in" title="Zoom in">
                <ZoomIn size={16} strokeWidth={1.8} />
              </button>
              <button className="task-dependencies-toolbar__button" type="button" onClick={resetZoom} aria-label="Reset zoom" title="Reset zoom">
                <Maximize2 size={16} strokeWidth={1.8} />
              </button>
            </div>
            <div
              ref={viewportRef}
              className={`task-dependencies-viewport${isPanning ? " task-dependencies-viewport--panning" : ""}`}
              onWheel={handleCanvasWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointerPan}
              onPointerCancel={finishPointerPan}
            >
              <div
                className="task-dependencies-graph"
                style={{
                  width: graph.width,
                  height: graph.height,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                <ConnectionLayer connections={graph.connections} width={graph.width} height={graph.height} />
                {graph.nodes.map((node) => (
                  <DependencyTaskCard
                    key={node.task.id}
                    node={node}
                    status={activeStatusByTaskId.get(node.task.id) ?? (node.task.status as TaskStatus)}
                    hasActiveExecution={activeTaskIds.has(node.task.id) || activityActiveTaskIds.has(node.task.id)}
                    onOpen={() => navigate(`/tasks/task/${node.task.id}`)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DependencyTaskCard({
  node,
  status,
  hasActiveExecution,
  onOpen,
}: {
  node: GraphNode;
  status: TaskStatus;
  hasActiveExecution: boolean;
  onOpen: () => void;
}) {
  const { task } = node;
  const statusTag = getVisibleGraphStatusTag(status, hasActiveExecution);
  const assigneeSlug = task.assigneeActor?.slug;
  const shouldShowAssigneeSlug = Boolean(assigneeSlug && (status === TaskStatus.IN_PROGRESS || status === TaskStatus.FOR_REVIEW));

  return (
    <button
      className={`dependency-task-card dependency-task-card--${status.toLowerCase().replaceAll("_", "-")}`}
      type="button"
      onClick={onOpen}
      style={{
        left: node.x,
        top: node.y,
        height: node.height,
      }}
    >
      <span className="dependency-task-card__content">
        <span className="dependency-task-card__title">{task.name}</span>
        {shouldShowAssigneeSlug ? <span className="dependency-task-card__assignee">@{assigneeSlug}</span> : null}
        {statusTag ? (
          <span className="dependency-task-card__status-row">
            <Chip color={statusTag.color} className="dependency-task-card__status-chip">
              {statusTag.label}
            </Chip>
          </span>
        ) : null}
      </span>
      <span className="dependency-task-card__meta">
        {status === TaskStatus.DONE ? <DoneStatusIcon /> : null}
        {hasActiveExecution ? <span className="dependency-task-card__spinner" aria-label="Active execution" title="Active execution" /> : null}
      </span>
    </button>
  );
}

function DoneStatusIcon() {
  return <span className="dependency-run-status-icon dependency-run-status-icon--success" aria-label="Done">✓</span>;
}

function getVisibleGraphStatusTag(status: TaskStatus, hasActiveExecution = false) {
  if (hasActiveExecution && status === TaskStatus.NOT_STARTED) {
    return getTaskStatusTag(TaskStatus.IN_PROGRESS);
  }

  if (status === TaskStatus.IN_PROGRESS || status === TaskStatus.FOR_REVIEW) {
    return getTaskStatusTag(status);
  }

  return null;
}

function ConnectionLayer({ connections, width, height }: { connections: GraphConnection[]; width: number; height: number }) {
  return (
    <svg className="task-dependencies-connections" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <marker
          id="task-dependencies-connection-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path className="task-dependencies-connection-arrow" d="M 0 0 L 8 4 L 0 8 Z" />
        </marker>
      </defs>
      {connections.map((connection) => {
        const distance = Math.max(80, connection.endX - connection.startX);
        const handle = Math.min(140, distance * 0.5);
        return (
          <path
            key={`${connection.fromTaskId}-${connection.toTaskId}`}
            d={`M ${connection.startX} ${connection.startY} C ${connection.startX + handle} ${connection.startY}, ${connection.endX - handle} ${connection.endY}, ${connection.endX} ${connection.endY}`}
            className="task-dependencies-connection"
            markerEnd="url(#task-dependencies-connection-arrow)"
          />
        );
      })}
    </svg>
  );
}

function buildDependencyGraph(
  tasks: Task[],
  activeStatusByTaskId: Map<string, TaskStatus>,
  activeTaskIds: Set<string>,
  activityActiveTaskIds: Set<string>,
  options: { includeAllTasks: boolean },
): DependencyGraph {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const graphTaskIds = new Set<string>(options.includeAllTasks ? tasks.map((task) => task.id) : []);

  for (const task of tasks) {
    const knownDependencies = task.dependsOnIds.filter((dependencyId) => taskById.has(dependencyId));
    if (knownDependencies.length === 0) {
      continue;
    }
    graphTaskIds.add(task.id);
    for (const dependencyId of knownDependencies) {
      graphTaskIds.add(dependencyId);
    }
  }

  if (graphTaskIds.size === 0) {
    return { nodes: [], connections: [], width: 0, height: 0 };
  }

  const orderByTaskId = new Map(tasks.map((task, index) => [task.id, index]));
  const layerByTaskId = new Map<string, number>();
  const visitingTaskIds = new Set<string>();

  const getLayer = (taskId: string): number => {
    const cachedLayer = layerByTaskId.get(taskId);
    if (cachedLayer !== undefined) {
      return cachedLayer;
    }
    if (visitingTaskIds.has(taskId)) {
      return 0;
    }

    visitingTaskIds.add(taskId);
    const task = taskById.get(taskId);
    const dependencyLayers = task?.dependsOnIds
      .filter((dependencyId) => graphTaskIds.has(dependencyId))
      .map((dependencyId) => getLayer(dependencyId)) ?? [];
    visitingTaskIds.delete(taskId);

    const layer = dependencyLayers.length === 0 ? 0 : Math.max(...dependencyLayers) + 1;
    layerByTaskId.set(taskId, layer);
    return layer;
  };

  for (const taskId of graphTaskIds) {
    getLayer(taskId);
  }

  moveDirectBlockersNearDependents(graphTaskIds, taskById, layerByTaskId);

  const taskIdsByLayer = new Map<number, string[]>();
  for (const taskId of graphTaskIds) {
    const layer = layerByTaskId.get(taskId) ?? 0;
    const layerTaskIds = taskIdsByLayer.get(layer) ?? [];
    layerTaskIds.push(taskId);
    taskIdsByLayer.set(layer, layerTaskIds);
  }

  for (const [layer, layerTaskIds] of taskIdsByLayer) {
    layerTaskIds.sort((firstId, secondId) => {
      const firstTask = taskById.get(firstId);
      const secondTask = taskById.get(secondId);
      const firstParentOrder = getConnectedOrder(firstTask, orderByTaskId);
      const secondParentOrder = getConnectedOrder(secondTask, orderByTaskId);
      if (firstParentOrder !== secondParentOrder) {
        return firstParentOrder - secondParentOrder;
      }
      return (orderByTaskId.get(firstId) ?? 0) - (orderByTaskId.get(secondId) ?? 0);
    });
    taskIdsByLayer.set(layer, layerTaskIds);
  }

  const nodes: GraphNode[] = [];
  const nodeByTaskId = new Map<string, GraphNode>();
  const sortedLayers = Array.from(taskIdsByLayer.keys()).sort((first, second) => first - second);
  const layerHeights = new Map<number, number>();

  for (const [layer, layerTaskIds] of taskIdsByLayer) {
    const layerHeight = getLayerHeight(layerTaskIds, taskById, activeStatusByTaskId, activeTaskIds, activityActiveTaskIds);
    layerHeights.set(layer, layerHeight);
  }

  const graphBodyHeight = Math.max(...Array.from(layerHeights.values()));

  for (const layer of sortedLayers) {
    const layerTaskIds = taskIdsByLayer.get(layer) ?? [];
    const layerHeight = layerHeights.get(layer) ?? 0;
    const layerYOffset = Math.max(0, (graphBodyHeight - layerHeight) / 2);
    let nextY = CANVAS_PADDING + layerYOffset;

    layerTaskIds.forEach((taskId) => {
      const task = taskById.get(taskId);
      if (!task) {
        return;
      }
      const nodeHeight = getGraphNodeHeight(task, activeStatusByTaskId, activeTaskIds, activityActiveTaskIds);
      const node = {
        task,
        layer,
        x: CANVAS_PADDING + layer * (NODE_WIDTH + LAYER_GAP),
        y: nextY,
        height: nodeHeight,
      };
      nodes.push(node);
      nodeByTaskId.set(taskId, node);
      nextY += nodeHeight + ROW_GAP;
    });
  }

  const connections: GraphConnection[] = [];
  for (const node of nodes) {
    for (const dependencyId of node.task.dependsOnIds) {
      const dependencyNode = nodeByTaskId.get(dependencyId);
      if (!dependencyNode) {
        continue;
      }
      connections.push({
        fromTaskId: dependencyId,
        toTaskId: node.task.id,
        startX: dependencyNode.x + NODE_WIDTH,
        startY: dependencyNode.y + dependencyNode.height / 2,
        endX: node.x,
        endY: node.y + node.height / 2,
      });
    }
  }

  const maxLayer = sortedLayers.at(-1) ?? 0;
  const width = CANVAS_PADDING * 2 + NODE_WIDTH + maxLayer * (NODE_WIDTH + LAYER_GAP);
  const height = CANVAS_PADDING * 2 + graphBodyHeight;

  return { nodes, connections, width, height };
}

function getAvailableTagFilters(tasks: Task[], availableTags: MetaTagResponseDto[]): GraphTagFilter[] {
  const countByTagName = new Map<string, number>();

  for (const task of tasks) {
    for (const tag of task.tags) {
      countByTagName.set(tag.name, (countByTagName.get(tag.name) ?? 0) + 1);
    }
  }

  for (const tag of availableTags) {
    if (!countByTagName.has(tag.name)) {
      countByTagName.set(tag.name, 0);
    }
  }

  return Array.from(countByTagName.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((firstTag, secondTag) => firstTag.name.localeCompare(secondTag.name));
}

function filterTasksByTags(tasks: Task[], selectedTagNames: string[]): Task[] {
  if (selectedTagNames.length === 0) {
    return tasks;
  }

  const selectedTagNameSet = new Set(selectedTagNames);
  return tasks.filter((task) => task.tags.some((tag) => selectedTagNameSet.has(tag.name)));
}

function getLayerHeight(
  taskIds: string[],
  taskById: Map<string, Task>,
  activeStatusByTaskId: Map<string, TaskStatus>,
  activeTaskIds: Set<string>,
  activityActiveTaskIds: Set<string>,
): number {
  return taskIds.reduce((height, taskId, index) => {
    const task = taskById.get(taskId);
    const nodeHeight = task ? getGraphNodeHeight(task, activeStatusByTaskId, activeTaskIds, activityActiveTaskIds) : COMPACT_NODE_HEIGHT;
    return height + nodeHeight + (index > 0 ? ROW_GAP : 0);
  }, 0);
}

function getGraphNodeHeight(
  task: Task,
  activeStatusByTaskId: Map<string, TaskStatus>,
  activeTaskIds: Set<string>,
  activityActiveTaskIds: Set<string>,
): number {
  const status = activeStatusByTaskId.get(task.id) ?? (task.status as TaskStatus);
  const hasActiveExecution = activeTaskIds.has(task.id) || activityActiveTaskIds.has(task.id);
  if (task.assigneeActor?.slug && (status === TaskStatus.IN_PROGRESS || status === TaskStatus.FOR_REVIEW)) {
    return ASSIGNEE_NODE_HEIGHT;
  }

  return getVisibleGraphStatusTag(status, hasActiveExecution) ? TAGGED_NODE_HEIGHT : COMPACT_NODE_HEIGHT;
}

function isActiveExecutionActivity(activity: TaskActivityWireEvent): boolean {
  if (!activity.kind.startsWith("execution.")) {
    return false;
  }

  return activity.kind !== "execution.stopped"
    && activity.kind !== "execution.history.added"
    && activity.kind !== "execution.unclaimed";
}

function getConnectedOrder(task: Task | undefined, orderByTaskId: Map<string, number>): number {
  if (!task || task.dependsOnIds.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.min(...task.dependsOnIds.map((dependencyId) => orderByTaskId.get(dependencyId) ?? Number.MAX_SAFE_INTEGER));
}

function moveDirectBlockersNearDependents(graphTaskIds: Set<string>, taskById: Map<string, Task>, layerByTaskId: Map<string, number>) {
  const dependentIdsByBlockerId = new Map<string, string[]>();

  for (const taskId of graphTaskIds) {
    const task = taskById.get(taskId);
    if (!task) {
      continue;
    }

    for (const dependencyId of task.dependsOnIds) {
      if (!graphTaskIds.has(dependencyId)) {
        continue;
      }
      const dependentIds = dependentIdsByBlockerId.get(dependencyId) ?? [];
      dependentIds.push(taskId);
      dependentIdsByBlockerId.set(dependencyId, dependentIds);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const taskId of graphTaskIds) {
      const dependentIds = dependentIdsByBlockerId.get(taskId);
      if (!dependentIds || dependentIds.length === 0) {
        continue;
      }

      const closestDependentLayer = Math.min(...dependentIds.map((dependentId) => layerByTaskId.get(dependentId) ?? 0));
      const furthestAllowedLayer = Math.max(0, closestDependentLayer - 1);
      const currentLayer = layerByTaskId.get(taskId) ?? 0;

      if (furthestAllowedLayer > currentLayer) {
        layerByTaskId.set(taskId, furthestAllowedLayer);
        changed = true;
      }
    }
  }
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(zoom.toFixed(2))));
}
