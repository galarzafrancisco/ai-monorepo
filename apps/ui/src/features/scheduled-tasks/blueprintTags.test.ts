import { describe, expect, it } from 'vitest';
import { applyProjectTagChange } from '../tasks/projectPicker';
import { createBlueprintTagEditor, type BlueprintTag } from './blueprintTags';

/** A blueprint server: every write replaces tagNames, like the real update endpoint. */
function fakeBlueprint(initial: BlueprintTag[]) {
  let persisted = initial;
  let nextId = 0;
  const write = async (tagNames: string[]) => {
    persisted = tagNames.map((name) => persisted.find((tag) => tag.name === name) ?? { id: `new-${nextId++}`, name });
    return { tags: persisted };
  };
  return { write, persisted: () => persisted.map((tag) => tag.name) };
}

describe('blueprint tag editor', () => {
  const initial: BlueprintTag[] = [
    { id: 'a', name: 'project:alpha' },
    { id: 'urgent', name: 'urgent' },
    { id: 'b', name: 'project:beta' },
  ];

  it('clears every project tag and keeps ordinary tags', async () => {
    const server = fakeBlueprint(initial);
    let latest = initial;
    const editor = createBlueprintTagEditor(() => latest, (tags) => { latest = tags; }, server.write);

    // The picker clears from the tags it rendered with, one removal at a time.
    const renderedProjectTags = initial.filter((tag) => tag.name.startsWith('project:'));
    await applyProjectTagChange(renderedProjectTags, null, editor.addTag, editor.removeTag);

    expect(server.persisted()).toEqual(['urgent']);
    expect(latest.map((tag) => tag.name)).toEqual(['urgent']);
  });

  it('chains adds and removals from the last saved list', async () => {
    const server = fakeBlueprint(initial);
    let latest = initial;
    const editor = createBlueprintTagEditor(() => latest, (tags) => { latest = tags; }, server.write);

    await editor.addTag('project:gamma');
    await editor.removeTag('a');
    await editor.addTag('project:gamma');

    expect(server.persisted()).toEqual(['urgent', 'project:beta', 'project:gamma']);
  });

  it('keeps the last saved list when a write fails', async () => {
    let latest = initial;
    const editor = createBlueprintTagEditor(
      () => latest,
      (tags) => { latest = tags; },
      async () => { throw new Error('offline'); },
    );
    await expect(editor.removeTag('a')).rejects.toThrow('offline');
    expect(latest).toBe(initial);
  });
});
