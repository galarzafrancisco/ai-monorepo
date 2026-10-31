import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FolderGit2, KanbanSquare } from 'lucide-react';
import { Avatar, Button, Card, Chip, DataRow, DataRowContainer, ErrorText, Row, Stack, Text } from '../../ui/primitives';
import type { DataRowTag } from '../../ui/primitives';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { elapsedTime } from '../../shared/helpers/elapsedTime';
import { TaskStatus, TASKS_STATUS } from '../../shared/const/taskStatus';
import { storeSelectedProjectId } from '../tasks/selectedProject';
import { TagSearchPop } from '../tasks/TagSearchPop';
import { MetaService, ProjectsService, TasksService } from './api';
import type { MetaTagResponseDto } from '@taico/client/v2';
import { useProjectsCtx } from './ProjectsProvider';
import { errorDetail } from './useProjects';
import { toRepoLink } from './repoLink';
import { ProjectGithubCard } from './ProjectGithubCard';
import type { Project, ProjectTask } from './types';
import '../../auth/LoginPage.css';
import './ProjectsPage.css';

/** Matches the Tasks board's page size; the API caps a page at 100. */
const TASKS_LIMIT = 100;
const RECENT_TASKS = 8;
const isAutoTagAvailable = (name: string) => !name.toLowerCase().startsWith('project:');
const loadAutoTags = () => MetaService.MetaController_getAllTags({});

const STATUS_ORDER: ProjectTask['status'][] = [
  TaskStatus.NOT_STARTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.FOR_REVIEW,
  TaskStatus.DONE,
];

const STATUS_CHIP: Record<ProjectTask['status'], DataRowTag['color']> = {
  NOT_STARTED: 'gray',
  IN_PROGRESS: 'blue',
  FOR_REVIEW: 'purple',
  DONE: 'green',
};

export function ProjectDetailPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, updateProject, setSectionTitle } = useProjectsCtx();

  const cached = projects.find((p) => p.id === projectId) ?? null;
  const [fetched, setFetched] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState('');
  const project = cached ?? fetched;

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState('');

  useDocumentTitle(project ? { project: { name: project.slug } } : undefined);

  useEffect(() => {
    setSectionTitle(project?.slug ?? 'Project');
  }, [project?.slug, setSectionTitle]);

  // The list may not be loaded yet (deep link), so fetch the project directly.
  useEffect(() => {
    if (cached || !projectId) return;
    let cancelled = false;
    setLoadError('');
    ProjectsService.ProjectsController_getProject({ projectId })
      .then((data) => { if (!cancelled) setFetched(data); })
      .catch((err) => { if (!cancelled) setLoadError(errorDetail(err, 'Project not found')); });
    return () => { cancelled = true; };
  }, [cached, projectId]);

  const tagName = project?.tagName;
  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    if (!tagName) return;
    setTasksLoading(true);
    setTasksError('');
    try {
      const response = await TasksService.TasksController_listTasks({ tag: tagName, page: 1, limit: TASKS_LIMIT, signal });
      setTasks(response.items);
      setTaskTotal(response.total);
    } catch (err) {
      if (signal?.aborted) return;
      setTasksError(errorDetail(err, 'Failed to load tasks'));
    } finally {
      if (!signal?.aborted) setTasksLoading(false);
    }
  }, [tagName]);

  useEffect(() => {
    const controller = new AbortController();
    loadTasks(controller.signal);
    return () => controller.abort();
  }, [loadTasks]);

  const counts = useMemo(() => {
    const result: Record<ProjectTask['status'], number> = { NOT_STARTED: 0, IN_PROGRESS: 0, FOR_REVIEW: 0, DONE: 0 };
    for (const task of tasks) result[task.status] += 1;
    return result;
  }, [tasks]);

  const recentTasks = useMemo(
    () => [...tasks]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, RECENT_TASKS),
    [tasks],
  );

  const openInTasks = () => {
    if (!project) return;
    storeSelectedProjectId(project.id);
    navigate('/tasks');
  };

  if (!project) {
    return (
      <div className="projects-page projects-page--narrow">
        {loadError ? (
          <Stack spacing="3">
            <ErrorText>{loadError}</ErrorText>
            <Row>
              <Button variant="secondary" size="sm" onClick={() => navigate('/projects')}>Back to projects</Button>
            </Row>
          </Stack>
        ) : (
          <Text tone="muted">Loading project...</Text>
        )}
      </div>
    );
  }

  const handleSaved = (updated: Project) => {
    setFetched(updated);
  };

  return (
    <div className="projects-page">
      <Row justify="space-between" align="center" className="projects-detail__toolbar">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>All projects</span>
        </Button>
        <Button variant="primary" size="sm" onClick={openInTasks}>
          <KanbanSquare size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Open in Tasks</span>
        </Button>
      </Row>

      <div className="projects-detail__hero">
        <span className="projects-detail__swatch" style={{ background: project.tagColor }} aria-hidden="true" />
        <Stack spacing="1">
          <Text size="5" weight="bold">{project.slug}</Text>
          <Row spacing="2">
            <Chip color="gray">{project.tagName}</Chip>
            <Text size="1" tone="muted" as="span">Updated {elapsedTime(project.updatedAt)}</Text>
          </Row>
        </Stack>
      </div>

      <div className="projects-detail__layout">
        <Stack spacing="4" className="projects-detail__main">
          <Card padding="0">
            <div className="projects-detail__stats">
              {STATUS_ORDER.map((status) => {
                const meta = TASKS_STATUS[status];
                const Icon = meta.icon;
                return (
                  <div key={status} className="projects-detail__stat">
                    <span className="projects-detail__stat-label">
                      <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                      <Text size="1" tone="muted" as="span">{meta.label}</Text>
                    </span>
                    <Text size="5" weight="semibold" as="span">{tasksLoading ? '–' : counts[status]}</Text>
                  </div>
                );
              })}
            </div>
            {!tasksLoading && taskTotal > tasks.length ? (
              <Text size="1" tone="muted" className="projects-detail__stats-note">
                Counting the {tasks.length} most recent of {taskTotal} tasks.
              </Text>
            ) : null}
          </Card>

          <DataRowContainer title="Recent tasks">
            {tasksLoading && tasks.length === 0 ? (
              <DataRow><Text tone="muted">Loading tasks...</Text></DataRow>
            ) : tasksError ? (
              <DataRow><ErrorText size="2">{tasksError}</ErrorText></DataRow>
            ) : recentTasks.length === 0 ? (
              <DataRow>
                <Text tone="muted">
                  No tasks yet. Add the <code>{project.tagName}</code> tag to a task, or open the Tasks
                  board with this project selected and create one there.
                </Text>
              </DataRow>
            ) : (
              recentTasks.map((task) => (
                <DataRow
                  key={task.id}
                  leading={<Avatar name={task.assigneeActor?.displayName ?? task.assignee ?? '?'} src={task.assigneeActor?.avatarUrl ?? undefined} size="md" />}
                  topRight={elapsedTime(task.updatedAt)}
                  tags={[{ label: TASKS_STATUS[task.status].label, color: STATUS_CHIP[task.status] }]}
                  onClick={() => navigate(`/tasks/task/${task.id}`)}
                >
                  <Text weight="semibold" size="2">{task.name}</Text>
                </DataRow>
              ))
            )}
          </DataRowContainer>
        </Stack>

        <Stack spacing="4" className="projects-detail__side">
          <ProjectSettingsCard project={project} onSave={updateProject} onSaved={handleSaved} />
          <ProjectAutoTagsCard project={project} onSave={updateProject} onSaved={handleSaved} />
          <ProjectGithubCard project={project} onSave={updateProject} onSaved={handleSaved} />
        </Stack>
      </div>
    </div>
  );
}

export function ProjectAutoTagsCard({ project, onSave, onSaved }: {
  project: Project;
  onSave: (projectId: string, input: { autoTagIds: string[] }) => Promise<Project>;
  onSaved: (project: Project) => void;
}) {
  const [tags, setTags] = useState<MetaTagResponseDto[]>([]);
  const [selected, setSelected] = useState<string[]>(project.autoTagIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showTagPop, setShowTagPop] = useState(false);

  useEffect(() => { setSelected(project.autoTagIds); }, [project.autoTagIds]);
  useEffect(() => {
    let cancelled = false;
    MetaService.MetaController_getAllTags({})
      .then((result) => { if (!cancelled) setTags(result.filter((tag) => isAutoTagAvailable(tag.name))); })
      .catch((err) => { if (!cancelled) setError(errorDetail(err, 'Failed to load tags')); });
    return () => { cancelled = true; };
  }, []);

  const save = async (ids: string[]): Promise<boolean> => {
    setSaving(true);
    setError('');
    try {
      onSaved(await onSave(project.id, { autoTagIds: ids }));
      return true;
    } catch (err) {
      setError(errorDetail(err, 'Failed to update auto tags'));
      setSelected(project.autoTagIds);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addTag = async (tag: MetaTagResponseDto): Promise<boolean> => {
    setSaving(true);
    setError('');
    try {
      const created = tag.id ? tag : await MetaService.MetaController_createTag({ body: { name: tag.name } });
      if (!isAutoTagAvailable(created.name)) return false;
      setTags((current) => current.some((item) => item.id === created.id) ? current : [...current, created]);
      const ids = [...selected, created.id];
      setSelected(ids);
      return await save(ids);
    } catch (err) {
      setError(errorDetail(err, 'Failed to create tag'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="4">
      <Stack spacing="3">
        <Text size="3" weight="semibold">Automatic task tags</Text>
        <Text size="1" tone="muted">Applied when a task is added to this project; removed when it leaves, unless another project supplies the same tag.</Text>
        <div className="projects-detail__auto-tags">
          {selected.map((id) => {
            const name = tags.find((tag) => tag.id === id)?.name ?? id;
            return (
              <Chip key={id} color="gray" onRemove={saving ? undefined : () => {
                const ids = selected.filter((tagId) => tagId !== id);
                setSelected(ids);
                void save(ids);
              }} removeLabel={`Remove tag ${name}`}>{name}</Chip>
            );
          })}
          {!saving ? <Chip onClick={() => setShowTagPop(true)} clickLabel="Add tag">+ add tag</Chip> : null}
        </div>
        {error ? <ErrorText size="2">{error}</ErrorText> : null}
      </Stack>
      {showTagPop ? (
        <TagSearchPop
          onCancel={() => setShowTagPop(false)}
          onSave={addTag}
          existingTags={selected.map((id) => ({ id }))}
          loadTags={loadAutoTags}
          isTagAvailable={isAutoTagAvailable}
          error={error}
        />
      ) : null}
    </Card>
  );
}

function ProjectSettingsCard({
  project,
  onSave,
  onSaved,
}: {
  project: Project;
  onSave: (projectId: string, input: { description: string; repoUrl: string }) => Promise<Project>;
  onSaved: (project: Project) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const repo = toRepoLink(project.repoUrl);

  const startEditing = () => {
    setDescription(project.description ?? '');
    setRepoUrl(project.repoUrl ?? '');
    setError('');
    setIsEditing(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const updated = await onSave(project.id, { description: description.trim(), repoUrl: repoUrl.trim() });
      onSaved(updated);
      setIsEditing(false);
    } catch (err) {
      setError(errorDetail(err, 'Failed to update project'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Card padding="4">
        <form onSubmit={handleSubmit}>
          <Stack spacing="4">
            <Text size="3" weight="semibold">Edit project</Text>
            <Stack spacing="2">
              <label htmlFor="project-edit-description" className="login-label">
                <Text size="2" weight="medium">Description</Text>
              </label>
              <textarea
                id="project-edit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="login-input projects-form__textarea"
                placeholder="What is this project about?"
                rows={4}
                disabled={isSaving}
              />
            </Stack>
            <Stack spacing="2">
              <label htmlFor="project-edit-repo-url" className="login-label">
                <Text size="2" weight="medium">Repository URL</Text>
              </label>
              <input
                id="project-edit-repo-url"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                className="login-input"
                placeholder="https://github.com/acme/my-app"
                disabled={isSaving}
              />
            </Stack>
            {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}
            <Row justify="end" spacing="3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </Row>
          </Stack>
        </form>
      </Card>
    );
  }

  return (
    <Card padding="4">
      <Stack spacing="4">
        <Row justify="space-between" align="center">
          <Text size="3" weight="semibold">About</Text>
          <Button variant="secondary" size="sm" onClick={startEditing}>Edit</Button>
        </Row>

        <Stack spacing="1">
          <Text size="1" tone="muted">Description</Text>
          <Text size="2" wrap tone={project.description?.trim() ? 'default' : 'muted'}>
            {project.description?.trim() || 'No description yet'}
          </Text>
        </Stack>

        <Stack spacing="1">
          <Text size="1" tone="muted">Repository</Text>
          {repo ? (
            repo.href ? (
              <a href={repo.href} target="_blank" rel="noreferrer noopener" className="projects-detail__repo">
                <FolderGit2 size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>{repo.label}</span>
                <ExternalLink size={12} strokeWidth={1.8} aria-hidden="true" />
              </a>
            ) : (
              <span className="projects-detail__repo" title={project.repoUrl}>
                <FolderGit2 size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>{repo.label}</span>
              </span>
            )
          ) : (
            <Stack spacing="2">
              <Text size="2" tone="muted">No repository linked</Text>
              <Text size="1" tone="muted">
                Link one and Taico clones it into the agent&apos;s working directory for every task in this project.
              </Text>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
