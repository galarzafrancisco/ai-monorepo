// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectAutoTagsCard } from './ProjectDetailPage';
import type { Project } from './types';

const { getAllTags } = vi.hoisted(() => ({ getAllTags: vi.fn() }));
vi.mock('./api', () => ({ MetaService: { MetaController_getAllTags: getAllTags } }));

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ProjectAutoTagsCard', () => {
  it('recovers from a picker fetch failure after the card has loaded tags', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const existing = { id: 'tag-0', name: 'existing', color: '#999', createdAt: '', updatedAt: '' };
    const tag = { id: 'tag-1', name: 'priority', color: '#999', createdAt: '', updatedAt: '' };
    getAllTags.mockResolvedValueOnce([existing, tag]).mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce([existing, tag]);
    const project = { id: 'project-1', autoTagIds: [existing.id] } as unknown as Project;
    const updated = { ...project, autoTagIds: [existing.id, tag.id] };
    const onSave = vi.fn().mockResolvedValue(updated);
    const onSaved = vi.fn();

    render(<ProjectAutoTagsCard project={project} onSave={onSave} onSaved={onSaved} />);
    await screen.findByText('existing');
    fireEvent.click(screen.getByText('+ add tag'));
    await waitFor(() => expect(screen.getByText('Failed to load tags')).toBeTruthy());
    expect(screen.queryByText('No tags found')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search or create tag...'), { target: { value: 'priority' } });
    expect(screen.queryByText('Create new tag:')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    const option = await screen.findByRole('option', { name: 'priority' });
    fireEvent.click(option);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('project-1', { autoTagIds: ['tag-0', 'tag-1'] }));
    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(getAllTags).toHaveBeenCalledTimes(3);
  });
});
