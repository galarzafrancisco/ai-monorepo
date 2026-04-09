import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Text } from '../../ui/primitives';
import { useContextCtx } from './ContextProvider';
import { ContextService } from './api';
import { useToast } from '../../shared/context/ToastContext';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import './ContextBlockCreatePage.css';

export function ContextBlockCreatePage() {
  const { setSectionTitle } = useContextCtx();
  const navigate = useNavigate();
  const { showError, showToast } = useToast();
  const isDesktop = useIsDesktop();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    setSectionTitle(isDesktop ? 'Context' : 'New Block');
  }, [setSectionTitle, isDesktop]);

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
      const block = await ContextService.ContextController_createBlock({
        body: {
          title: title.trim(),
          content: content.trim(),
          tagNames: tagNames.length > 0 ? tagNames : undefined,
        },
      });

      showToast('Context block created successfully', 'success');
      navigate(`/context/block/${block.id}`);
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            New Block
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
            onClick={() => navigate('/context/home')}
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
            {isSubmitting ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
