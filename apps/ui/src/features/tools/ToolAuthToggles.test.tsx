// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewToolPop } from './NewToolPop';
import { ToolAuthSection } from './ToolAuthSection';
import type { Tool } from './types';

afterEach(cleanup);

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 'tool-1',
    providedId: 'example',
    name: 'Example',
    description: 'Example server',
    type: 'http',
    url: 'http://localhost:3000/example/mcp',
    authType: 'taico',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Tool;
}

function taicoSwitch() {
  return screen.getByRole('switch', { name: 'Use Taico authentication' });
}

describe('NewToolPop', () => {
  async function create(name: string) {
    fireEvent.change(screen.getByPlaceholderText('Tool name'), { target: { value: name } });
    await act(async () => {
      // PopShell's Save is a clickable header label, not a button.
      fireEvent.click(screen.getByText('Save'));
    });
  }

  it('registers HTTP tools with Taico auth by default', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<NewToolPop onSave={onSave} />);

    expect(taicoSwitch().getAttribute('aria-checked')).toBe('true');
    await create('Example');

    expect(onSave).toHaveBeenCalledWith({ name: 'Example', type: 'http', authType: 'taico' });
  });

  it('registers an external server when the switch is turned off', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<NewToolPop onSave={onSave} />);

    fireEvent.click(taicoSwitch());
    expect(taicoSwitch().getAttribute('aria-checked')).toBe('false');
    await create('Outside');

    expect(onSave).toHaveBeenCalledWith({ name: 'Outside', type: 'http', authType: 'external' });
  });

  it('hides the switch for stdio tools and keeps the default', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<NewToolPop onSave={onSave} />);

    fireEvent.click(taicoSwitch());
    fireEvent.change(screen.getByLabelText('Transport type'), { target: { value: 'stdio' } });
    expect(screen.queryByRole('switch')).toBeNull();
    await create('Local');

    expect(onSave).toHaveBeenCalledWith({ name: 'Local', type: 'stdio', authType: 'taico' });
  });

  it('shows the error when creating fails', () => {
    render(<NewToolPop onSave={vi.fn()} error="MCP server already exists" />);
    expect(screen.getByText('MCP server already exists')).toBeTruthy();
  });
});

describe('ToolAuthSection', () => {
  it('saves the new auth type and shows the saved tool', async () => {
    const saved = makeTool({ authType: 'external' });
    const onSave = vi.fn().mockResolvedValue(saved);
    const onSaved = vi.fn();
    render(<ToolAuthSection tool={makeTool()} onSave={onSave} onSaved={onSaved} />);

    await act(async () => {
      fireEvent.click(taicoSwitch());
    });

    expect(onSave).toHaveBeenCalledWith('external');
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(screen.queryByText(/Couldn't save/)).toBeNull();
  });

  it('turns Taico auth back on', async () => {
    const onSave = vi.fn().mockResolvedValue(makeTool());
    render(<ToolAuthSection tool={makeTool({ authType: 'external' })} onSave={onSave} onSaved={vi.fn()} />);

    expect(taicoSwitch().getAttribute('aria-checked')).toBe('false');
    await act(async () => {
      fireEvent.click(taicoSwitch());
    });

    expect(onSave).toHaveBeenCalledWith('taico');
  });

  it('says when a save fails and which setting is still in effect', async () => {
    const failure = new Error('Network down');
    const onSave = vi.fn().mockRejectedValue(failure);
    const onSaved = vi.fn();
    const onError = vi.fn();
    render(
      <ToolAuthSection tool={makeTool()} onSave={onSave} onSaved={onSaved} onError={onError} />,
    );

    await act(async () => {
      fireEvent.click(taicoSwitch());
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(failure);
    // The switch stays on the saved value, and the message says so.
    expect(taicoSwitch().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Couldn't save the change. Taico authentication is still on/)).toBeTruthy();
    await waitFor(() => expect((taicoSwitch() as HTMLButtonElement).disabled).toBe(false));
  });

  it('disables the switch while saving', async () => {
    let resolve!: (tool: Tool) => void;
    const onSave = vi.fn(() => new Promise<Tool>((r) => { resolve = r; }));
    render(<ToolAuthSection tool={makeTool()} onSave={onSave} onSaved={vi.fn()} />);

    fireEvent.click(taicoSwitch());
    expect((taicoSwitch() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      resolve(makeTool({ authType: 'external' }));
    });
    expect((taicoSwitch() as HTMLButtonElement).disabled).toBe(false);
  });
});
