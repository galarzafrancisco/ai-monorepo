import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import './Context.css';

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="context-markdownXXX">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content.replace(/\\n/g, '\n')}
      </ReactMarkdown>
    </div >
  );
}
