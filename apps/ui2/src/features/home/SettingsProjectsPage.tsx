import { Stack, Text, Card, Button, Row } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { ProjectsService } from '../projects/api';
import type { ProjectResponseDto } from 'shared';
import { ErrorText } from '../../ui/primitives/ErrorText';
import '../../auth/LoginPage.css';

export function SettingsProjectsPage() {
  const { setSectionTitle } = useHomeCtx();
  const [projects, setProjects] = useState<ProjectResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editRepoUrl, setEditRepoUrl] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    setSectionTitle('Projects');
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await ProjectsService.projectsControllerGetAllProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (project: ProjectResponseDto) => {
    setEditingProject(project.id);
    setEditDescription(project.description || '');
    setEditRepoUrl(project.repoUrl || '');
    setSaveError('');
    setSaveSuccess('');
  };

  const handleCancel = () => {
    setEditingProject(null);
    setEditDescription('');
    setEditRepoUrl('');
    setSaveError('');
    setSaveSuccess('');
  };

  const handleSave = async (projectId: string) => {
    setSaveError('');
    setSaveSuccess('');

    try {
      await ProjectsService.projectsControllerUpdateProject(projectId, {
        description: editDescription,
        repoUrl: editRepoUrl,
      });

      setSaveSuccess('Project updated successfully!');
      setEditingProject(null);
      await loadProjects();

      setTimeout(() => {
        setSaveSuccess('');
      }, 3000);
    } catch (err: any) {
      setSaveError(err?.body?.detail || 'Failed to update project');
    }
  };

  if (isLoading) {
    return (
      <Stack spacing="6">
        <Text tone="muted">Loading projects...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack spacing="6">
        <ErrorText>{error}</ErrorText>
        <Button variant="secondary" onClick={loadProjects}>
          Retry
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing="6">
      <Text tone="muted">Manage your projects</Text>

      {projects.length === 0 ? (
        <Card padding="5">
          <Text tone="muted">No projects found</Text>
        </Card>
      ) : (
        projects.map((project) => (
          <Card key={project.id} padding="5">
            <Stack spacing="4">
              <Stack spacing="2">
                <Text size="4" weight="semibold">{project.slug}</Text>
                <Text size="2" tone="muted">Tag: {project.tagName}</Text>
              </Stack>

              {editingProject === project.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave(project.id);
                  }}
                >
                  <Stack spacing="4">
                    <Stack spacing="2">
                      <label htmlFor={`description-${project.id}`} className="login-label">
                        <Text size="2" weight="medium">Description</Text>
                      </label>
                      <textarea
                        id={`description-${project.id}`}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="login-input"
                        placeholder="Project description"
                        rows={3}
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </Stack>

                    <Stack spacing="2">
                      <label htmlFor={`repo-url-${project.id}`} className="login-label">
                        <Text size="2" weight="medium">Repository URL</Text>
                      </label>
                      <input
                        id={`repo-url-${project.id}`}
                        type="url"
                        value={editRepoUrl}
                        onChange={(e) => setEditRepoUrl(e.target.value)}
                        className="login-input"
                        placeholder="https://github.com/username/repo"
                      />
                    </Stack>

                    {saveError && (
                      <ErrorText size="2" weight="medium">
                        {saveError}
                      </ErrorText>
                    )}

                    {saveSuccess && (
                      <div style={{ color: 'var(--accent)' }}>
                        <Text size="2" weight="medium">
                          {saveSuccess}
                        </Text>
                      </div>
                    )}

                    <Row spacing="3">
                      <Button type="submit" variant="primary" size="md">
                        Save Changes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                    </Row>
                  </Stack>
                </form>
              ) : (
                <>
                  <Stack spacing="2">
                    <Text size="2" weight="medium">Description</Text>
                    <Text size="2" tone="muted">
                      {project.description || 'No description'}
                    </Text>
                  </Stack>

                  <Stack spacing="2">
                    <Text size="2" weight="medium">Repository URL</Text>
                    <Text size="2" tone="muted">
                      {project.repoUrl || 'No repository URL'}
                    </Text>
                  </Stack>

                  <Row justify="end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(project)}
                    >
                      Edit Project
                    </Button>
                  </Row>
                </>
              )}
            </Stack>
          </Card>
        ))
      )}
    </Stack>
  );
}
