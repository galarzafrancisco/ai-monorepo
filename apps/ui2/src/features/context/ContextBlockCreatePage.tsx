import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Text, Stack } from '../../ui/primitives';
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
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    setSectionTitle(isDesktop ? 'Context' : 'New Block');
  }, [setSectionTitle, isDesktop]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.md')) {
      showError(new Error('Please select a markdown (.md) file'));
      return;
    }

    setSelectedFileName(file.name);

    try {
      const text = await file.text();
      setContent(text);

      // Try to extract title from first H1 heading
      const h1Match = text.match(/^#\s+(.+)$/m);
      if (h1Match) {
        setTitle(h1Match[1].trim());
      } else {
        // Fallback to filename without extension
        const titleFromFilename = file.name.replace(/\.md$/, '');
        setTitle(titleFromFilename);
      }
    } catch (err) {
      showError(err);
      setSelectedFileName(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

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

  const handleTagsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // Split by comma and trim each tag
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setTagNames(tags);
  };

  return (
    <div className="context-block-create">
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

      <form onSubmit={handleSubmit} className="context-block-create__form">
        <Stack spacing="4">
          {isDesktop && (
            <Text as="div" size="6" weight="bold">
              Create Context Block
            </Text>
          )}

          <div className="context-block-create__field">
            <label htmlFor="file-upload" className="context-block-create__label">
              <Text size="3" weight="medium">
                Upload Markdown File
              </Text>
            </label>
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".md"
              onChange={handleFileSelect}
              className="context-block-create__file-input"
            />
            {selectedFileName && (
              <Text size="2" tone="muted">
                Selected: {selectedFileName}
              </Text>
            )}
          </div>

          <div className="context-block-create__field">
            <label htmlFor="title" className="context-block-create__label">
              <Text size="3" weight="medium">
                Title
              </Text>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter block title"
              className="context-block-create__input"
              required
              maxLength={255}
            />
          </div>

          <div className="context-block-create__field">
            <label htmlFor="content" className="context-block-create__label">
              <Text size="3" weight="medium">
                Content (Markdown)
              </Text>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter markdown content or upload a file above"
              className="context-block-create__textarea"
              required
              rows={15}
            />
          </div>

          <div className="context-block-create__field">
            <label htmlFor="tags" className="context-block-create__label">
              <Text size="3" weight="medium">
                Tags (optional)
              </Text>
            </label>
            <input
              id="tags"
              type="text"
              onChange={handleTagsChange}
              placeholder="Enter tags separated by commas (e.g., documentation, onboarding)"
              className="context-block-create__input"
            />
            {tagNames.length > 0 && (
              <Text size="2" tone="muted">
                Tags: {tagNames.join(', ')}
              </Text>
            )}
          </div>

          <div className="context-block-create__actions">
            <Button
              type="submit"
              size="lg"
              variant="primary"
              disabled={isSubmitting || !title.trim() || !content.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Block'}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => navigate('/context/home')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </Stack>
      </form>
    </div>
  );
}
