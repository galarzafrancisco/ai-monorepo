import { useState, useEffect, FormEvent } from 'react';
import type { WikiPage } from './types';
import type { CreatePageDto, UpdatePageDto } from 'shared';
import { TagInput } from './TagInput';

type WikiPageFormProps =
  | {
      mode: 'create';
      page?: never;
      onSubmit: (data: CreatePageDto) => Promise<void>;
      onCancel: () => void;
      isSubmitting: boolean;
    }
  | {
      mode: 'edit';
      page: WikiPage;
      onSubmit: (data: UpdatePageDto) => Promise<void>;
      onCancel: () => void;
      isSubmitting: boolean;
    };

export function WikiPageForm({
  mode,
  page,
  onSubmit,
  onCancel,
  isSubmitting,
}: WikiPageFormProps) {
  const [title, setTitle] = useState(page?.title || '');
  const [content, setContent] = useState(page?.content || '');
  const [author, setAuthor] = useState(page?.author || '');
  const [tagNames, setTagNames] = useState<string[]>(page?.tags?.map(t => t.name) || []);
  const [errorMessage, setErrorMessage] = useState('');

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
        <label htmlFor={`${mode}-content`}>Content *</label>
        <textarea
          id={`${mode}-content`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write in markdown or plain text"
          rows={mode === 'create' ? 6 : 15}
          required
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
