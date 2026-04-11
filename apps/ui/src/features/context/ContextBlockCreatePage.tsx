import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Button, Text } from '../../ui/primitives';
import { useContextCtx } from './ContextProvider';
import { ContextService } from './api';
import { useToast } from '../../shared/context/ToastContext';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import './ContextBlockCreatePage.css';

// Used for both create (/context/new) and edit (/context/block/:id/edit).
// Edit mode is detected by the presence of the :id route param.
export function ContextBlockCreatePage() {
  const { id: editId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(editId);

  const { setSectionTitle } = useContextCtx();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parentId') ?? undefined;
  const { showError, showToast } = useToast();
  const isDesktop = useIsDesktop();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBlock, setIsLoadingBlock] = useState(isEditMode);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Load existing block in edit mode
  useEffect(() => {
    if (!editId) return;

    setIsLoadingBlock(true);
    ContextService.ContextController_getBlock({ id: editId })
      .then((block) => {
        setTitle(block.title);
        setContent(block.content);
      })
      .catch((err) => {
        showError(err);
        navigate('/context/home');
      })
      .finally(() => setIsLoadingBlock(false));
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSectionTitle(isDesktop ? 'Context' : isEditMode ? 'Edit Block' : 'New Block');
  }, [setSectionTitle, isDesktop, isEditMode]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.md')) {
      showError(new Error('Please select a markdown (.md) file'));
      return;
    }

    setSelectedFileName(file.name);

    try {
      const text = await file.text();
      setContent(text);

      const h1Match = text.match(/^#\s+(.+)$/m);
      if (h1Match) {
        setTitle(h1Match[1].trim());
      } else {
        setTitle(file.name.replace(/\.md$/, ''));
      }
    } catch (err) {
      showError(err);
      setSelectedFileName(null);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showError(new Error('Title is required'));
      return;
    }

    if (!content.trim()) {
      showError(new Error('Content is required'));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && editId) {
        await ContextService.ContextController_updateBlock({
          id: editId,
          body: {
            title: title.trim(),
            content: content.trim(),
          },
        });
        showToast('Context block updated', 'success');
        navigate(`/context/block/${editId}`);
      } else {
        const block = await ContextService.ContextController_createBlock({
          body: {
            title: title.trim(),
            content: content.trim(),
            tagNames: tagNames.length > 0 ? tagNames : undefined,
            parentId,
          },
        });
        showToast('Context block created', 'success');
        navigate(`/context/block/${block.id}`);
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelTarget = isEditMode && editId ? `/context/block/${editId}` : '/context/home';

  if (isLoadingBlock) {
    return (
      <div className="context-block-create">
        <Text tone="muted">Loading…</Text>
      </div>
    );
  }

  return (
    <div className="context-block-create">
      {/* Breadcrumbs (desktop only) */}
      {isDesktop && (
        <div className="context-block-create__breadcrumbs">
          <button
            type="button"
            className="context-block-create__breadcrumb"
            onClick={() => navigate('/context/home')}
          >
            Home
          </button>
          <span className="context-block-create__breadcrumb-separator">›</span>
          <span className="context-block-create__breadcrumb context-block-create__breadcrumb--current">
            {isEditMode ? 'Edit Block' : 'New Block'}
          </span>
        </div>
      )}

      {/* Title row */}
      <div className="context-block-create__title-row">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="context-block-create__title-input"
          maxLength={255}
          aria-label="Block title"
          autoFocus
        />

        {/* File upload button */}
        <Button
          type="button"
          size="lg"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          title={selectedFileName ? `File: ${selectedFileName}` : 'Upload markdown file'}
          tabIndex={-1}
        >
          {selectedFileName ? `↑ ${selectedFileName}` : '↑ Upload .md'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          onChange={handleFileSelect}
          className="context-block-create__file-input-hidden"
          aria-hidden="true"
        />
      </div>

      {/* Markdown editor — fills remaining space */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write markdown content here, or upload a .md file above…"
        className="context-block-create__editor"
        aria-label="Block content (Markdown)"
      />

      {/* Bottom bar: actions */}
      <div className="context-block-create__bottom-bar">
        <div className="context-block-create__actions">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={() => navigate(cancelTarget)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !content.trim()}
          >
            {isSubmitting ? (isEditMode ? 'Saving…' : 'Creating…') : isEditMode ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
