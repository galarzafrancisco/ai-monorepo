import { Stack, Text, Card, Button, Row } from '../../ui/primitives';
import { useHomeCtx } from './HomeProvider';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectsService } from '../projects/api';
import { ErrorText } from '../../ui/primitives/ErrorText';
import '../../auth/LoginPage.css';
import './SettingsPage.css';
import './SettingsProjectsPage.css';

export function SettingsProjectCreatePage() {
  const { setSectionTitle } = useHomeCtx();
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [color, setColor] = useState('#0969da');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSectionTitle('Create Project');
  }, []);

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsCreating(true);

    try {
      await ProjectsService.projectsControllerCreateProject({
        slug: slug.trim(),
        description: description.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        color,
      });

      navigate('/settings/projects');
    } catch (err: any) {
      setError(err?.body?.detail || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Stack spacing="6" className="settings-subpage">
      <Text tone="muted" className="settings-subpage__intro">
        Add a project tag and optional repository link.
      </Text>

      <Card padding="5" className="settings-panel-card">
        <form onSubmit={handleCreateProject}>
          <Stack spacing="4">
            <Stack spacing="2">
              <label htmlFor="project-slug" className="login-label">
                <Text size="2" weight="medium">Slug</Text>
              </label>
              <input
                id="project-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="login-input"
                placeholder="taico"
                required
                disabled={isCreating}
              />
            </Stack>

            <Stack spacing="2">
              <label htmlFor="project-description" className="login-label">
                <Text size="2" weight="medium">Description</Text>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="login-input"
                placeholder="Project description"
                rows={3}
                disabled={isCreating}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </Stack>

            <Stack spacing="2">
              <label htmlFor="project-repo-url" className="login-label">
                <Text size="2" weight="medium">Repository URL</Text>
              </label>
              <input
                id="project-repo-url"
                type="url"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                className="login-input"
                placeholder="https://github.com/username/repo"
                disabled={isCreating}
              />
            </Stack>

            <Stack spacing="2">
              <label htmlFor="project-color" className="login-label">
                <Text size="2" weight="medium">Color</Text>
              </label>
              <input
                id="project-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="settings-projects__color-input"
                disabled={isCreating}
              />
            </Stack>

            {error ? (
              <ErrorText size="2" weight="medium">
                {error}
              </ErrorText>
            ) : null}

            <Row justify="end" spacing="3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => navigate('/settings/projects')}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isCreating || !slug.trim()}
              >
                {isCreating ? 'Creating...' : 'Create project'}
              </Button>
            </Row>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
