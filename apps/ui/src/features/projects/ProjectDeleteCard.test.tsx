// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectDeleteCard } from './ProjectDeleteCard';
import { SELECTED_PROJECT_STORAGE_KEY } from '../tasks/selectedProject';
import type { Project } from './types';

const project = { id: 'project-1', slug: 'acme', tagName: 'project:acme' } as unknown as Project;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
  return screen.getByLabelText(/to confirm/);
}

function confirmButton() {
  const dialog = screen.getByRole('dialog');
  return Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Delete project') as HTMLButtonElement;
}

describe('ProjectDeleteCard', () => {
  it('only deletes once the slug is typed, then clears the board selection', async () => {
    localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, project.id);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<ProjectDeleteCard project={project} taskCount={3} onDelete={onDelete} onDeleted={onDeleted} />);

    const input = openDialog();
    expect(screen.getByText(/Its 3 tasks will lose/)).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'acm' } });
    fireEvent.submit(input.closest('form')!);
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'acme' } });
    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(onDelete).toHaveBeenCalledWith('project-1');
    expect(localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY)).toBeNull();
  });

  it('keeps the dialog open and shows the reason when deletion fails', async () => {
    const onDelete = vi.fn().mockRejectedValue({ body: { detail: 'Insufficient scope' } });
    const onDeleted = vi.fn();
    render(<ProjectDeleteCard project={project} taskCount={null} onDelete={onDelete} onDeleted={onDeleted} />);

    const input = openDialog();
    fireEvent.change(input, { target: { value: 'acme' } });
    fireEvent.click(confirmButton());

    expect(await screen.findByText('Insufficient scope')).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(confirmButton().disabled).toBe(false);
  });

  it('closes on Escape and outside click when idle', async () => {
    render(<ProjectDeleteCard project={project} taskCount={1} onDelete={vi.fn()} onDeleted={vi.fn()} />);

    openDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    openDialog();
    await pressOutside();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('cannot be dismissed while the delete is in flight, so it is never sent twice', async () => {
    let reject!: (reason: unknown) => void;
    const onDelete = vi.fn(() => new Promise<void>((_, r) => { reject = r; }));
    const onDeleted = vi.fn();
    render(<ProjectDeleteCard project={project} taskCount={1} onDelete={onDelete} onDeleted={onDeleted} />);

    const input = openDialog();
    fireEvent.change(input, { target: { value: 'acme' } });
    fireEvent.click(confirmButton());
    await screen.findByText('Deleting...');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await pressOutside();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Deleting...')).toBeTruthy();
    expect(onDelete).toHaveBeenCalledTimes(1);

    // The first request's failure still reaches the (still mounted) dialog.
    reject({ body: { detail: 'Insufficient scope' } });
    expect(await screen.findByText('Insufficient scope')).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();

    // Once idle again, the dialog can be dismissed.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

/** Radix registers its outside-pointer listener on the next tick after opening. */
async function pressOutside() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.pointerDown(document.body);
}
