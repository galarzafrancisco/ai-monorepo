// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectSelector } from './ProjectSelector';
import type { Project } from '../projects/types';

vi.mock('../../app/hooks/useIsDesktop', () => ({ useIsDesktop: () => false }));

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ProjectSelector on mobile', () => {
  it('opens on the list without focusing search, then navigates and selects with the keyboard', async () => {
    const projects = [
      { id: 'one', slug: 'alpha', tagName: 'project:alpha' },
      { id: 'two', slug: 'beta', tagName: 'project:beta' },
    ] as Project[];
    const onPick = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <ProjectSelector
        taskName="Example"
        projects={projects}
        projectsState="ready"
        selectedProjectIds={[]}
        hasProjectTag={false}
        tasks={[]}
        onPick={onPick}
        onClose={onClose}
      />,
    );

    const list = screen.getByRole('listbox', { name: 'Projects' });
    await waitFor(() => expect(document.activeElement).toBe(list));
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Search projects' }));
    expect(list.getAttribute('aria-activedescendant')).toBe('project-option-one');

    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toBe('project-option-two');
    fireEvent.keyDown(list, { key: 'Enter' });
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(projects[1]));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
