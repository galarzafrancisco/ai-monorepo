import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Text } from "../../ui/primitives";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { TaskStatus } from "./const";
import { useTasksCtx } from "./TasksProvider";
import type { Task } from "./types";
import { useExecutions } from "../executions/useExecutions";
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
const NODE_HEIGHT = 48;
const LAYER_GAP = 112;
const ROW_GAP = 18;
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [graphMode, setGraphMode] = useState<GraphMode>("dependencies");
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle("Dependencies");
  }, [setSectionTitle]);

  const availableTagFilters = useMemo(() => getAvailableTagFilters(tasks), [tasks]);
  const filteredTasks = useMemo(() => filterTasksByTags(tasks, selectedTagNames), [tasks, selectedTagNames]);
  const graph = useMemo(() => buildDependencyGraph(filteredTasks, { includeAllTasks: graphMode === "all" }), [filteredTasks, graphMode]);
  const activeTaskIds = useMemo(() => new Set(active.map((execution) => execution.taskId)), [active]);
  const activeStatusByTaskId = useMemo(() => {
    return new Map(active.map((execution) => [execution.taskId, execution.taskStatus as TaskStatus]));
  }, [active]);
  const hasSelectedTags = selectedTagNames.length > 0;
  const graphModeLabel = graphMode === "all" ? "all tasks" : "tasks with dependencies";

  const toggleTagFilter = useCallback((tagName: string) => {
    setSelectedTagNames((currentTagNames) => {
      if (currentTagNames.includes(tagName)) {
        return currentTagNames.filter((currentTagName) => currentTagName !== tagName);
      }
      return [...currentTagNames, tagName];
    });
  }, []);

  const clearTagFilters = useCallback(() => {
    setSelectedTagNames([]);
  }, []);

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
              {availableTagFilters.length === 0 ? (
                <span className="task-dependencies-tags__empty">No tags</span>
              ) : (
                availableTagFilters.map((tag) => {
                  const isSelected = selectedTagNames.includes(tag.name);
                  return (
                    <button
                      key={tag.name}
                      className={`task-dependencies-tag ${isSelected ? "task-dependencies-tag--selected" : ""}`}
                      type="button"
                      onClick={() => toggleTagFilter(tag.name)}
                      aria-pressed={isSelected}
                    >
                      {tag.name}
                      <span className="task-dependencies-tag__count">{tag.count}</span>
                    </button>
                  );
                })
              )}
              {hasSelectedTags ? (
                <button className="task-dependencies-tags__clear" type="button" onClick={clearTagFilters}>
                  Clear
                </button>
              ) : null}
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
              className="task-dependencies-viewport"
              onWheel={handleCanvasWheel}
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
                    hasActiveExecution={activeTaskIds.has(node.task.id) || Boolean(activityByTaskId[node.task.id])}
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
  const statusBadge = getStatusBadge(status) ?? (hasActiveExecution && status !== TaskStatus.DONE ? { label: "In progress", tone: "active" } : null);
  return (
    <button
      className={`dependency-task-card dependency-task-card--${status.toLowerCase().replaceAll("_", "-")}`}
      type="button"
      onClick={onOpen}
      style={{
        left: node.x,
        top: node.y,
      }}
    >
      <span className="dependency-task-card__content">
        <span className="dependency-task-card__title">{task.name}</span>
        {statusBadge ? (
          <span className={`dependency-task-card__status-badge dependency-task-card__status-badge--${statusBadge.tone}`}>
            {statusBadge.label}
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

function getStatusBadge(status: TaskStatus): { label: string; tone: "active" | "review" } | null {
  if (status === TaskStatus.IN_PROGRESS) {
    return { label: "In progress", tone: "active" };
  }

  if (status === TaskStatus.FOR_REVIEW) {
    return { label: "In review", tone: "review" };
  }

  return null;
}

function ConnectionLayer({ connections, width, height }: { connections: GraphConnection[]; width: number; height: number }) {
  return (
    <svg className="task-dependencies-connections" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {connections.map((connection) => {
        const distance = Math.max(80, connection.endX - connection.startX);
        const handle = Math.min(140, distance * 0.5);
        return (
          <path
            key={`${connection.fromTaskId}-${connection.toTaskId}`}
            d={`M ${connection.startX} ${connection.startY} C ${connection.startX + handle} ${connection.startY}, ${connection.endX - handle} ${connection.endY}, ${connection.endX} ${connection.endY}`}
            className="task-dependencies-connection"
          />
        );
      })}
    </svg>
  );
}

function buildDependencyGraph(tasks: Task[], options: { includeAllTasks: boolean }): DependencyGraph {
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
  const maxRows = Math.max(...Array.from(taskIdsByLayer.values()).map((layerTaskIds) => layerTaskIds.length));

  for (const layer of sortedLayers) {
    const layerTaskIds = taskIdsByLayer.get(layer) ?? [];
    const layerHeight = layerTaskIds.length * NODE_HEIGHT + Math.max(layerTaskIds.length - 1, 0) * ROW_GAP;
    const graphBodyHeight = maxRows * NODE_HEIGHT + Math.max(maxRows - 1, 0) * ROW_GAP;
    const layerYOffset = Math.max(0, (graphBodyHeight - layerHeight) / 2);

    layerTaskIds.forEach((taskId, index) => {
      const task = taskById.get(taskId);
      if (!task) {
        return;
      }
      const node = {
        task,
        layer,
        x: CANVAS_PADDING + layer * (NODE_WIDTH + LAYER_GAP),
        y: CANVAS_PADDING + layerYOffset + index * (NODE_HEIGHT + ROW_GAP),
      };
      nodes.push(node);
      nodeByTaskId.set(taskId, node);
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
        startY: dependencyNode.y + NODE_HEIGHT / 2,
        endX: node.x,
        endY: node.y + NODE_HEIGHT / 2,
      });
    }
  }

  const maxLayer = sortedLayers.at(-1) ?? 0;
  const width = CANVAS_PADDING * 2 + NODE_WIDTH + maxLayer * (NODE_WIDTH + LAYER_GAP);
  const height = CANVAS_PADDING * 2 + maxRows * NODE_HEIGHT + Math.max(maxRows - 1, 0) * ROW_GAP;

  return { nodes, connections, width, height };
}

function getAvailableTagFilters(tasks: Task[]): GraphTagFilter[] {
  const countByTagName = new Map<string, number>();

  for (const task of tasks) {
    for (const tag of task.tags) {
      countByTagName.set(tag.name, (countByTagName.get(tag.name) ?? 0) + 1);
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
