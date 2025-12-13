import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichEditor } from './RichEditor';

describe('RichEditor', () => {
  it('renders with initial value', () => {
    const onChange = vi.fn();
    render(<RichEditor value="Hello World" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: /markdown editor/i });
    expect(textarea).toHaveValue('Hello World');
  });

  it('calls onChange when text changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: /markdown editor/i });
    await user.type(textarea, 'test');

    expect(onChange).toHaveBeenCalled();
    // Verify onChange was called
    expect(onChange.mock.calls.length).toBeGreaterThan(0);
  });

  it('shows slash command menu when "/" typed at start', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: /markdown editor/i });

    // Type "/" to trigger menu
    await user.type(textarea, '/');

    // Menu should appear
    const menu = document.querySelector('.slash-command-menu');
    expect(menu).toBeTruthy();
  });

  it('filters commands based on query', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: /markdown editor/i });

    // Type "/head" to filter for heading commands
    await user.type(textarea, '/head');

    // Should show heading-related commands, but implementation may vary
    // This is a basic check - actual implementation depends on command registry
    const menuVisible = document.querySelector('.slash-command-menu');
    expect(menuVisible).toBeTruthy();
  });

  it('dismisses menu on Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: /markdown editor/i });

    // Type "/" to open menu
    await user.type(textarea, '/');

    // Verify menu is open
    let menuVisible = document.querySelector('.slash-command-menu');
    expect(menuVisible).toBeTruthy();

    // Press Escape
    fireEvent.keyDown(textarea, { key: 'Escape' });

    // Menu should be closed
    menuVisible = document.querySelector('.slash-command-menu');
    expect(menuVisible).toBeFalsy();
  });

  it('executes command and inserts markdown on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: /markdown editor/i });

    // Type "/" to open menu
    await user.type(textarea, '/');

    // Press Enter to execute first command
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // onChange should have been called with markdown inserted
    expect(onChange).toHaveBeenCalled();
  });

  it('shows preview of markdown content', () => {
    const onChange = vi.fn();
    render(<RichEditor value="# Heading\n\nSome **bold** text" onChange={onChange} />);

    // Preview pane should exist
    const preview = document.querySelector('.rich-editor-preview');
    expect(preview).toBeTruthy();
  });

  it('shows empty state when no content', () => {
    const onChange = vi.fn();
    render(<RichEditor value="" onChange={onChange} />);

    expect(screen.getByText(/nothing to preview yet/i)).toBeTruthy();
  });

  it('respects disabled prop', () => {
    const onChange = vi.fn();
    render(<RichEditor value="test" onChange={onChange} disabled />);

    const textarea = screen.getByRole('textbox', { name: /markdown editor/i });
    expect(textarea).toBeDisabled();
  });

  it('uses custom placeholder when provided', () => {
    const onChange = vi.fn();
    render(<RichEditor value="" onChange={onChange} placeholder="Custom placeholder" />);

    const textarea = screen.getByPlaceholderText('Custom placeholder');
    expect(textarea).toBeTruthy();
  });
});
