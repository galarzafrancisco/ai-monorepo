export type BlueprintTag = { id: string; name: string };

/**
 * Blueprint tag edits replace the whole tagNames list. Each edit must start
 * from the last list the server accepted, not the tags the page rendered with:
 * clearing projects removes several tags in a row, and a second removal built
 * from the stale list would put the first tag back.
 */
export function createBlueprintTagEditor(
  getTags: () => BlueprintTag[],
  setTags: (tags: BlueprintTag[]) => void,
  write: (tagNames: string[]) => Promise<{ tags: BlueprintTag[] }>,
) {
  const commit = async (tagNames: string[]) => {
    const saved = await write(tagNames);
    setTags(saved.tags);
  };
  return {
    addTag: async (tagName: string) => {
      const current = getTags().map((tag) => tag.name);
      if (current.includes(tagName)) return;
      await commit([...current, tagName]);
    },
    removeTag: async (tagId: string) => {
      const current = getTags();
      if (!current.some((tag) => tag.id === tagId)) return;
      await commit(current.filter((tag) => tag.id !== tagId).map((tag) => tag.name));
    },
  };
}
