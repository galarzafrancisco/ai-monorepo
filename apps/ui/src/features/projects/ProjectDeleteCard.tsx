import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, ErrorText, Modal, Row, Stack, Text } from '../../ui/primitives';
import { readStoredSelectedProjectId, storeSelectedProjectId } from '../tasks/selectedProject';
import { errorDetail } from './useProjects';
import type { Project } from './types';
import '../../auth/LoginPage.css';

/**
 * Danger zone for a project. Deleting needs the slug typed out, because it
 * takes the project tag off every task in the project (the tasks are kept).
 */
export function ProjectDeleteCard({ project, taskCount, onDelete, onDeleted }: {
  project: Project;
  /** Tasks in the project, if known; shown so the user sees what is affected. */
  taskCount: number | null;
  /** Deletes the project. Throws on failure. */
  onDelete: (projectId: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Lives here, not in the form: while a delete is in flight the dialog must
  // not close (Escape, outside click), or a reopen would allow a second DELETE
  // and the first request's outcome would land on an unmounted form.
  const [isDeleting, setIsDeleting] = useState(false);
  const handleOpenChange = (next: boolean) => {
    if (!next && isDeleting) return;
    setOpen(next);
  };

  return (
    <Card padding="4">
      <Stack spacing="3">
        <Text size="3" weight="semibold">Delete project</Text>
        <Text size="1" tone="muted">
          Removes the project and its <code>{project.tagName}</code> tag. Tasks are kept, but they leave the project.
        </Text>
        <Row>
          <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Delete project</span>
          </Button>
        </Row>
      </Stack>
      <Modal open={open} onOpenChange={handleOpenChange} title={`Delete ${project.slug}?`}>
        {/* Remounted each time it opens, so the confirmation starts empty. */}
        {open ? (
          <DeleteProjectForm
            project={project}
            taskCount={taskCount}
            isDeleting={isDeleting}
            setIsDeleting={setIsDeleting}
            onCancel={() => handleOpenChange(false)}
            onDelete={onDelete}
            onDeleted={() => {
              setOpen(false);
              onDeleted();
            }}
          />
        ) : null}
      </Modal>
    </Card>
  );
}

function DeleteProjectForm({ project, taskCount, isDeleting, setIsDeleting, onCancel, onDelete, onDeleted }: {
  project: Project;
  taskCount: number | null;
  isDeleting: boolean;
  setIsDeleting: (isDeleting: boolean) => void;
  onCancel: () => void;
  onDelete: (projectId: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const confirmed = confirmation.trim() === project.slug;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmed || isDeleting) return;
    setIsDeleting(true);
    setError('');
    try {
      await onDelete(project.id);
      // Don't leave the Tasks board filtered to a project that no longer exists.
      if (readStoredSelectedProjectId() === project.id) storeSelectedProjectId(null);
      setIsDeleting(false);
      onDeleted();
    } catch (err) {
      setError(errorDetail(err, 'Failed to delete project'));
      setIsDeleting(false);
    }
  };

  const affected = taskCount === null
    ? 'Every task in this project'
    : taskCount === 1 ? 'Its 1 task' : `Its ${taskCount} tasks`;

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing="4">
        <Stack spacing="2">
          <Text size="2" wrap>
            This can&apos;t be undone. {affected} will lose the <code>{project.tagName}</code> tag and any
            automatic tags this project added. The tasks themselves are not deleted.
          </Text>
          <Text size="2" wrap>
            Repository and GitHub settings for this project are removed too.
          </Text>
        </Stack>
        <Stack spacing="2">
          <label htmlFor="project-delete-confirm" className="login-label">
            <Text size="2" weight="medium">Type <code>{project.slug}</code> to confirm</Text>
          </label>
          <input
            id="project-delete-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="login-input"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={isDeleting}
          />
        </Stack>
        {error ? <ErrorText size="2" weight="medium">{error}</ErrorText> : null}
        <Row justify="end" spacing="3">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" disabled={!confirmed || isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete project'}
          </Button>
        </Row>
      </Stack>
    </form>
  );
}
