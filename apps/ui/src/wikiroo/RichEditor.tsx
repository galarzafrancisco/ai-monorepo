import { MarkdownPreview } from './MarkdownPreview';
import './Wikiroo.css';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichEditor({ value, onChange, placeholder, disabled }: RichEditorProps) {
  return (
    <div className="rich-editor">
      <div className="rich-editor-panes">
        <div className="rich-editor-pane rich-editor-edit">
          <div className="rich-editor-label">Edit</div>
          <textarea
            className="rich-editor-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Write in markdown...'}
            disabled={disabled}
            aria-label="Markdown editor"
          />
        </div>

        <div className="rich-editor-pane rich-editor-preview">
          <div className="rich-editor-label">Preview</div>
          <div className="rich-editor-preview-content">
            {value ? (
              <MarkdownPreview content={value} />
            ) : (
              <div className="rich-editor-empty">Nothing to preview yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
