import { useState, useEffect } from "react";
import { TaskService } from "../lib/api";
import { TaskResponseDto } from "shared";
import type { CreateTaskDto } from "shared";

type TaskStatus = TaskResponseDto.status;

const STATUS_COLUMNS: TaskStatus[] = [
  TaskResponseDto.status.NOT_STARTED,
  TaskResponseDto.status.IN_PROGRESS,
  TaskResponseDto.status.FOR_REVIEW,
  TaskResponseDto.status.DONE,
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskResponseDto.status.NOT_STARTED]: "Not Started",
  [TaskResponseDto.status.IN_PROGRESS]: "In Progress",
  [TaskResponseDto.status.FOR_REVIEW]: "For Review",
  [TaskResponseDto.status.DONE]: "Done",
};

export default function TaskerooPage() {
  const [tasks, setTasks] = useState<TaskResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskResponseDto | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await TaskService.taskerooControllerListTasks();
      setTasks(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: CreateTaskDto = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      createdBy: "portal-user",
    };

    setCreating(true);
    setError(null);
    try {
      await TaskService.taskerooControllerCreateTask(data);
      await loadTasks();
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const tasksByStatus = STATUS_COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status);
    return acc;
  }, {} as Record<TaskStatus, TaskResponseDto[]>);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white/60">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Taskeroo</h1>
          <p className="text-white/60">Manage and track your tasks</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 rounded-lg"
        >
          + Create Task
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {STATUS_COLUMNS.map((status) => (
          <div key={status} className="flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{STATUS_LABELS[status]}</h2>
              <span className="px-2 py-1 bg-white/10 rounded text-sm">
                {tasksByStatus[status].length}
              </span>
            </div>
            <div className="flex-1 space-y-3">
              {tasksByStatus[status].map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <h3 className="font-semibold mb-2">{task.name}</h3>
                  {task.description && (
                    <p className="text-white/60 text-sm line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  {task.assignee && (
                    <div className="mt-2 text-xs text-white/50">
                      Assigned to: {task.assignee}
                    </div>
                  )}
                  {task.tags && task.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {task.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded"
                          style={{
                            backgroundColor: tag.color ? `${tag.color}20` : "#ffffff20",
                            color: tag.color || "#ffffff",
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b1220] border border-white/10 rounded-2xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-bold">Create New Task</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-white/60 hover:text-white"
                disabled={creating}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-white/70 mb-2">
                  Task Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Task title"
                  disabled={creating}
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-white/70 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Task description..."
                  disabled={creating}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 rounded-lg disabled:opacity-50"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b1220] border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-bold">{selectedTask.name}</h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white/70 mb-2">Status</h3>
                <span className="px-3 py-1 bg-sky-500/20 text-sky-300 rounded-lg">
                  {STATUS_LABELS[selectedTask.status]}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/70 mb-2">Description</h3>
                <p className="text-white/80">{selectedTask.description}</p>
              </div>

              {selectedTask.assignee && (
                <div>
                  <h3 className="text-sm font-semibold text-white/70 mb-2">Assignee</h3>
                  <p className="text-white/80">{selectedTask.assignee}</p>
                </div>
              )}

              {selectedTask.tags && selectedTask.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/70 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-lg"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : "#ffffff20",
                          color: tag.color || "#ffffff",
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.comments && selectedTask.comments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/70 mb-2">Comments</h3>
                  <div className="space-y-3">
                    {selectedTask.comments.map((comment) => (
                      <div key={comment.id} className="bg-white/5 rounded-lg p-4">
                        <div className="text-sm text-white/60 mb-1">
                          {comment.commenterName} • {new Date(comment.createdAt).toLocaleString()}
                        </div>
                        <p className="text-white/80">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
