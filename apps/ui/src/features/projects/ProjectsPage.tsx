import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderGit2, FolderKanban, Plus, Search } from 'lucide-react';
import { Button, Card, Chip, ErrorText, Row, Stack, Text } from '../../ui/primitives';
import { useCommandPalette } from '../../ui/components';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useProjectsCtx } from './ProjectsProvider';
import { toRepoLink } from './repoLink';
import type { Project } from './types';
import './ProjectsPage.css';

export function ProjectsPage() {
  const { projects, isLoading, error, loadProjects, setSectionTitle } = useProjectsCtx();
  const navigate = useNavigate();
  const { registerCommands } = useCommandPalette();
  const [query, setQuery] = useState('');

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('Projects');
  }, [setSectionTitle]);

  useEffect(() => registerCommands([
    {
      id: 'projects-new',
      label: 'New project',
      description: 'Create a project and link a repository',
      aliases: ['create project', 'add project', 'repository'],
      onSelect: () => navigate('/projects/new'),
    },
  ]), [registerCommands, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((project) =>
      project.slug.toLowerCase().includes(q)
      || (project.description ?? '').toLowerCase().includes(q)
      || (project.repoUrl ?? '').toLowerCase().includes(q),
    );
  }, [projects, query]);

  const linkedCount = projects.filter((project) => Boolean(project.repoUrl?.trim())).length;

  return (
    <div className="projects-page">
      <div className="projects-page__header">
        <Stack spacing="1">
          <Text tone="muted">
            A project groups tasks under a <code>project:&lt;name&gt;</code> tag. Link a repository and
            agents get it cloned into their working directory for every task with that tag.
          </Text>
          {projects.length > 0 ? (
            <Text size="1" tone="muted">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} · {linkedCount} with a repository
            </Text>
          ) : null}
        </Stack>
        <Button variant="primary" size="sm" onClick={() => navigate('/projects/new')} className="projects-page__new">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          <span>New project</span>
        </Button>
      </div>

      {projects.length > 0 ? (
        <label className="projects-page__search">
          <Search size={16} strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter projects"
            aria-label="Filter projects"
          />
        </label>
      ) : null}

      {isLoading && projects.length === 0 ? (
        <Text tone="muted">Loading projects...</Text>
      ) : error && projects.length === 0 ? (
        <Stack spacing="3">
          <ErrorText>{error}</ErrorText>
          <Row>
            <Button variant="secondary" size="sm" onClick={() => loadProjects()}>Retry</Button>
          </Row>
        </Stack>
      ) : projects.length === 0 ? (
        <ProjectsEmptyState onCreate={() => navigate('/projects/new')} />
      ) : filtered.length === 0 ? (
        <Text tone="muted">No projects match “{query.trim()}”.</Text>
      ) : (
        <div className="projects-page__grid">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => navigate(`/projects/project/${project.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const repo = toRepoLink(project.repoUrl);

  return (
    <button type="button" className="projects-card" onClick={onOpen}>
      <span className="projects-card__swatch" style={{ background: project.tagColor }} aria-hidden="true" />
      <span className="projects-card__body">
        <Text size="4" weight="semibold" as="span" className="projects-card__title">{project.slug}</Text>
        <Text size="2" tone="muted" as="span" className="projects-card__description">
          {project.description?.trim() || 'No description yet'}
        </Text>
        <span className="projects-card__meta">
          {repo ? (
            <span className="projects-card__repo" title={project.repoUrl}>
              <FolderGit2 size={14} strokeWidth={1.8} aria-hidden="true" />
              <span>{repo.label}</span>
            </span>
          ) : (
            <Chip color="yellow">No repository</Chip>
          )}
          <Chip color="gray">{project.tagName}</Chip>
        </span>
      </span>
    </button>
  );
}

function ProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card padding="6" className="projects-page__empty">
      <Stack spacing="3">
        <span className="projects-page__empty-icon" aria-hidden="true">
          <FolderKanban size={24} strokeWidth={1.8} />
        </span>
        <Text size="4" weight="semibold">No projects yet</Text>
        <Text tone="muted">
          Create a project here, or add a tag like <code>project:my-app</code> to any task and Taico
          creates the project for you. Then link a repository so agents can work on its code.
        </Text>
        <Row>
          <Button variant="primary" size="sm" onClick={onCreate}>Create project</Button>
        </Row>
      </Stack>
    </Card>
  );
}
