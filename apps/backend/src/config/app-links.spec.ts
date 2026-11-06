const config = { issuerUrl: 'https://taico.example.com/' };

jest.mock('./env.config', () => ({
  getConfig: () => config,
}));

import {
  contextBlockUrl,
  taskUrl,
  withContextBlockTreeUrls,
  withContextBlockUrl,
  withTaskUrl,
} from './app-links';

describe('app links', () => {
  it('builds task and block pages on the issuer URL, without a double slash', () => {
    expect(taskUrl('abc-1')).toBe('https://taico.example.com/tasks/task/abc-1');
    expect(contextBlockUrl('def-2')).toBe('https://taico.example.com/context/block/def-2');
  });

  it('puts the url right after the id and keeps the rest', () => {
    const task = withTaskUrl({ name: 'Ship it', id: 't1' });
    expect(task).toEqual({ id: 't1', url: 'https://taico.example.com/tasks/task/t1', name: 'Ship it' });
    expect(Object.keys(task)).toEqual(['id', 'url', 'name']);
    expect(withContextBlockUrl({ id: 'b1', title: 'Notes' }).url).toBe(
      'https://taico.example.com/context/block/b1',
    );
  });

  it('adds a url to every block in a tree', () => {
    const tree = withContextBlockTreeUrls({
      id: 'root',
      children: [{ id: 'child', children: [] as never[] }],
    });
    expect(tree.url).toBe('https://taico.example.com/context/block/root');
    expect((tree.children[0] as { url?: string }).url).toBe(
      'https://taico.example.com/context/block/child',
    );
  });
});
