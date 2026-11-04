// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover } from './Popover';

afterEach(cleanup);

describe('Popover link trigger', () => {
  const url = 'https://github.com/acme/api/issues/12';

  function renderLink() {
    render(<Popover trigger="Issue #12" triggerHref={url}>Issue details</Popover>);
    return screen.getByRole('link', { name: 'Issue #12' });
  }

  function pointerDown(element: Element, pointerType: string) {
    const event = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    fireEvent(element, event);
  }

  it('follows the link on mouse click without toggling the card', () => {
    const link = renderLink();
    expect(link.getAttribute('href')).toBe(url);
    expect(link.getAttribute('target')).toBe('_blank');
    pointerDown(link, 'mouse');
    expect(fireEvent.click(link)).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens and closes the card on touch without following the link', () => {
    const link = renderLink();
    pointerDown(link, 'touch');
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByRole('dialog').textContent).toBe('Issue details');
    pointerDown(link, 'touch');
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps button triggers interactive', () => {
    render(<Popover trigger="Details">Card</Popover>);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('dialog').textContent).toBe('Card');
  });
});
