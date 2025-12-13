import { useState, useEffect, FormEvent, useMemo } from 'react';
import type { WikiPage, WikiPageSummary } from './types';
import type { CreatePageDto, UpdatePageDto } from 'shared';
import { TagInput } from './TagInput';
import { RichEditor } from './RichEditor';

// Helper to get all descendant IDs of a page (to prevent circular references)
function getDescendantIds(pageId: string, allPages: WikiPageSummary[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [pageId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    descendants.add(currentId);

    // Find all children of current page
    const children = allPages.filter(p => {
      const pid = p.parentId;
      return typeof pid === 'string' && pid === currentId;
    });
    children.forEach(child => queue.push(child.id));
  }

  return descendants;
}

type WikiPageFormProps =
  | {
      mode: 'create';
      page?: never;
      pages: WikiPageSummary[];
      onSubmit: (data: CreatePageDto) => Promise<void>;
      onCancel: () => void;
      isSubmitting: boolean;
      defaultParentId?: string;
    }
  | {
      mode: 'edit';
      page: WikiPage;
      pages: WikiPageSummary[];
      onSubmit: (data: UpdatePageDto) => Promise<void>;
      onCancel: () => void;
      isSubmitting: boolean;
      defaultParentId?: never;
    };

export function WikiPageForm({
  mode,
  page,
  pages,
  onSubmit,
  onCancel,
  isSubmitting,
  defaultParentId,
}: WikiPageFormProps) {
  const [title, setTitle] = useState(page?.title || '');
  const [content, setContent] = useState(page?.content || '');
  const [author, setAuthor] = useState(page?.author || '');
  const [tagNames, setTagNames] = useState<string[]>(page?.tags?.map(t => t.name) || []);
  const [parentId, setParentId] = useState<string | null>(() => {
    if (mode === 'create' && defaultParentId) {
      return defaultParentId;
    }
    const pid = page?.parentId;
    return typeof pid === 'string' ? pid : null;
  });
  const [errorMessage, setErrorMessage] = useState('');

  // Compute available parents based on mode
  const availableParents = useMemo(() => {
    if (mode === 'create') {
      // When creating, all pages are valid parents
      return pages;
    } else {
      // When editing, exclude current page and its descendants
      const excludedIds = getDescendantIds(page.id, pages);
      return pages.filter(p => !excludedIds.has(p.id));
    }
  }, [mode, pages, page]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (mode === 'create') {
        // Create mode: send all fields
        const payload: CreatePageDto = {
          title: title.trim(),
          author: author.trim(),
          content: content.trim(),
          ...(tagNames.length > 0 && { tagNames }),
          ...(parentId && { parentId }),
        };
        await onSubmit(payload);
      } else {
        // Edit mode: only send changed fields
        const payload: UpdatePageDto = {};
        let hasChanges = false;

        if (title !== page.title) {
          payload.title = title;
          hasChanges = true;
        }
        if (content !== page.content) {
          payload.content = content;
          hasChanges = true;
        }
        if (author !== page.author) {
          payload.author = author;
          hasChanges = true;
        }

        const currentTagNames = page.tags?.map(t => t.name) || [];
        const tagsChanged = JSON.stringify(tagNames.sort()) !== JSON.stringify(currentTagNames.sort());
        if (tagsChanged) {
          payload.tagNames = tagNames;
          hasChanges = true;
        }

        const currentParentId = typeof page.parentId === 'string' ? page.parentId : null;
        if (parentId !== currentParentId) {
          payload.parentId = parentId;
          hasChanges = true;
        }

        if (!hasChanges) {
          setErrorMessage('No changes to save');
          return;
        }

        await onSubmit(payload);
      }
      setErrorMessage('');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || `Failed to ${mode === 'create' ? 'create' : 'update'} page`;
      setErrorMessage(errorMsg);
    }
  };

  return (
    <form className="wikiroo-form" onSubmit={handleSubmit}>
      {errorMessage && (
        <div className="wikiroo-error" style={{ margin: '0 0 16px 0' }}>
          {errorMessage}
        </div>
      )}

      <div className="wikiroo-form-group">
        <label htmlFor={`${mode}-title`}>Title *</label>
        <input
          id={`${mode}-title`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your page a headline"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="wikiroo-form-group">
        <label htmlFor={`${mode}-author`}>Author *</label>
        <input
          id={`${mode}-author`}
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Who wrote this?"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="wikiroo-form-group">
        <label htmlFor={`${mode}-parent`}>Parent Page</label>
        <select
          id={`${mode}-parent`}
          value={parentId ?? ''}
          onChange={(e) => setParentId(e.target.value || null)}
          disabled={isSubmitting}
        >
          <option value="">None (top level)</option>
          {availableParents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <div className="wikiroo-form-group">
        <label htmlFor={`${mode}-content`}>Content *</label>
        <RichEditor
          value={content}
          onChange={setContent}
          placeholder="Write in markdown or use / for commands"
          disabled={isSubmitting}
        />
      </div>

      <div className="wikiroo-form-group">
        <label htmlFor={`${mode}-tags`}>Tags</label>
        <TagInput
          value={tagNames}
          onChange={setTagNames}
          placeholder="Type to add tags..."
        />
      </div>

      <div className="wikiroo-form-actions">
        <button
          type="button"
          className="wikiroo-button secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="wikiroo-button primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create page' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
