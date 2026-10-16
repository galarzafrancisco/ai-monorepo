import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ErrorText, Row, Stack, Text } from '../../ui/primitives';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useProjectsCtx } from './ProjectsProvider';
import { errorDetail } from './useProjects';
import '../../auth/LoginPage.css';
import './ProjectsPage.css';

export function ProjectCreatePage() {
  const { createProject, setSectionTitle } = useProjectsCtx();
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('New project');
  }, [setSectionTitle]);

  const trimmedSlug = slug.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsCreating(true);
    try {
      const project = await createProject({
        slug: trimmedSlug,
        description: description.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
      });
      navigate(`/projects/project/${project.id}`, { replace: true });
    } catch (err) {
      setError(errorDetail(err, 'Failed to create project'));
      setIsCreating(false);
    }
  };

  return (
    <div className="projects-page projects-page--narrow">
      <Text tone="muted">
        Tasks join this project when they carry its tag. Add a repository and agents get it cloned
        for every task in the project.
      </Text>

      <Card padding="5">
        <form onSubmit={handleSubmit}>
          <Stack spacing="4">
            <Stack spacing="2">
              <label htmlFor="project-slug" className="login-label">
                <Text size="2" weight="medium">Name</Text>
              </label>
              <input
                id="project-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="login-input"
                placeholder="my-app"
                required
                autoFocus
                disabled={isCreating}
              />
              <Text size="1" tone="muted">
                Tag: <code>project:{trimmedSlug || 'my-app'}</code>
              </Text>
            </Stack>

            <Stack spacing="2">
              <label htmlFor="project-description" className="login-label">
                <Text size="2" weight="medium">Description</Text>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="login-input projects-form__textarea"
                placeholder="What is this project about?"
                rows={3}
                disabled={isCreating}
              />
            </Stack>

            <Stack spacing="2">
              <label htmlFor="project-repo-url" className="login-label">
                <Text size="2" weight="medium">Repository URL</Text>
              </label>
              <input
                id="project-repo-url"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                className="login-input"
                placeholder="https://github.com/acme/my-app or git@github.com:acme/my-app.git"
                disabled={isCreating}
              />
              <Text size="1" tone="muted">Optional. HTTPS and SSH URLs both work.</Text>
            </Stack>

            {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}

            <Row justify="end" spacing="3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => navigate('/projects')}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={isCreating || !trimmedSlug}>
                {isCreating ? 'Creating...' : 'Create project'}
              </Button>
            </Row>
          </Stack>
        </form>
      </Card>
    </div>
  );
}
