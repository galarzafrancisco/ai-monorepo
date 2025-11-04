import ReactMarkdown from 'react-markdown';
import './Wikiroo.css';

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="wikiroo-markdown">
      <ReactMarkdown
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
