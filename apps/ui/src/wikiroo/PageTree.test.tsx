import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageTree } from './PageTree';
import type { WikiPageTree } from './types';

describe('PageTree', () => {
  const mockOnPageClick = vi.fn();

  beforeEach(() => {
    mockOnPageClick.mockClear();
  });

  it('renders flat list (no nesting)', () => {
    const pages = [
      {
        id: '1',
        title: 'Page 1',
        author: 'Author 1',
        parentId: null,
        order: 0,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Page 2',
        author: 'Author 2',
        parentId: null,
        order: 1,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as any;

    render(<PageTree pages={pages} onPageClick={mockOnPageClick} />);

    expect(screen.getByText('Page 1')).toBeTruthy();
    expect(screen.getByText('Page 2')).toBeTruthy();
  });

  it('renders nested structure', () => {
    const pages = [
      {
        id: '1',
        title: 'Parent Page',
        author: 'Author',
        parentId: null,
        order: 0,
        children: [
          {
            id: '2',
            title: 'Child Page',
            author: 'Author',
            parentId: '1',
            order: 0,
            children: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as any;

    render(<PageTree pages={pages} onPageClick={mockOnPageClick} />);

    expect(screen.getByText('Parent Page')).toBeTruthy();
    expect(screen.getByText('Child Page')).toBeTruthy();
  });

  it('respects order field', () => {
    const pages = [
      {
        id: '2',
        title: 'Second',
        author: 'Author',
        parentId: null,
        order: 1,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '1',
        title: 'First',
        author: 'Author',
        parentId: null,
        order: 0,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as any;

    render(<PageTree pages={pages} onPageClick={mockOnPageClick} />);

    const items = screen.getAllByRole('link');
    expect(items[0]).toHaveTextContent('First');
    expect(items[1]).toHaveTextContent('Second');
  });

  it('sorts children by order field', () => {
    const pages = [
      {
        id: '1',
        title: 'Parent',
        author: 'Author',
        parentId: null,
        order: 0,
        children: [
          {
            id: '3',
            title: 'Child 2',
            author: 'Author',
            parentId: '1',
            order: 1,
            children: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            title: 'Child 1',
            author: 'Author',
            parentId: '1',
            order: 0,
            children: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as any;

    render(<PageTree pages={pages} onPageClick={mockOnPageClick} />);

    const items = screen.getAllByRole('link');
    expect(items[0]).toHaveTextContent('Parent');
    expect(items[1]).toHaveTextContent('Child 1');
    expect(items[2]).toHaveTextContent('Child 2');
  });

  it('expand/collapse functionality', () => {
    const pages = [
      {
        id: '1',
        title: 'Parent',
        author: 'Author',
        parentId: null,
        order: 0,
        children: [
          {
            id: '2',
            title: 'Child',
            author: 'Author',
            parentId: null,
            order: 0,
            children: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any,
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
    ] as any;

    render(<PageTree pages={pages} onPageClick={mockOnPageClick} />);

    // Child should be visible initially (expanded by default)
    expect(screen.getByText('Child')).toBeTruthy();

    // Find and click the collapse button
    const toggleButton = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(toggleButton);

    // Child should no longer be visible
    expect(screen.queryByText('Child')).toBeFalsy();

    // Click to expand again
    const expandButton = screen.getByRole('button', { name: /expand/i });
    fireEvent.click(expandButton);

    // Child should be visible again
    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('highlights active page', () => {
    const pages = [
      {
        id: '1',
        title: 'Active Page',
        author: 'Author',
        parentId: null,
        order: 0,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Inactive Page',
        author: 'Author',
        parentId: null,
        order: 1,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as any;

    render(<PageTree pages={pages} currentPageId="1" onPageClick={mockOnPageClick} />);

    const activeLink = screen.getByText('Active Page').closest('.tree-item-content');
    const inactiveLink = screen.getByText('Inactive Page').closest('.tree-item-content');

    expect(activeLink?.classList.contains('active')).toBe(true);
    expect(inactiveLink?.classList.contains('active')).toBe(false);
  });

  it('calls click handler with correct pageId', () => {
    const pages = [
      {
        id: 'page-123',
        title: 'Test Page',
        author: 'Author',
        parentId: null,
        order: 0,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as any;

    render(<PageTree pages={pages} onPageClick={mockOnPageClick} />);

    const link = screen.getByText('Test Page');
    fireEvent.click(link);

    expect(mockOnPageClick).toHaveBeenCalledWith('page-123');
  });

  it('prevents event default when clicking page link', () => {
    const pages = [
      {
        id: '1',
        title: 'Test Page',
        author: 'Author',
        parentId: null,
        order: 0,
        children: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as any;

    render(<PageTree pages={pages} onPageClick={mockOnPageClick} />);

    const link = screen.getByText('Test Page');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    link.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('renders empty tree when no pages provided', () => {
    const { container } = render(<PageTree pages={[]} onPageClick={mockOnPageClick} />);

    const tree = container.querySelector('.page-tree');
    expect(tree).toBeTruthy();
    expect(tree?.children.length).toBe(0);
  });
});
