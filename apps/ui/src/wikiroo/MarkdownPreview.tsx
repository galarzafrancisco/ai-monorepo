import type { ReactNode } from 'react';
import './Wikiroo.css';

type MarkdownNode =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; language: string; code: string };

function parseMarkdown(source: string): MarkdownNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const nodes: MarkdownNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].startsWith('```')) {
        index += 1;
      }
      nodes.push({ type: 'code', language, code: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      nodes.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ''));
        index += 1;
      }
      nodes.push({ type: 'list', items });
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() !== '') {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    nodes.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return nodes;
}

function renderInline(text: string): ReactNode {
  const segments: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const inlinePattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let key = 0;

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      segments.push(
        <strong key={`strong-${key}`}>{match[2]}</strong>,
      );
    } else if (match[4]) {
      segments.push(
        <em key={`em-${key}`}>{match[4]}</em>,
      );
    } else if (match[6]) {
      segments.push(
        <code key={`code-${key}`}>{match[6]}</code>,
      );
    }

    lastIndex = inlinePattern.lastIndex;
    key += 1;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.length > 0 ? segments : text;
}

export function MarkdownPreview({ content }: { content: string }) {
  const nodes = parseMarkdown(content);

  return (
    <div className="wikiroo-markdown">
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'heading': {
            const HeadingTag = `h${Math.min(node.level, 6)}` as keyof JSX.IntrinsicElements;
            return (
              <HeadingTag key={`heading-${index}`}>{renderInline(node.text)}</HeadingTag>
            );
          }
          case 'list':
            return (
              <ul key={`list-${index}`}>
                {node.items.map((item, itemIndex) => (
                  <li key={`list-${index}-${itemIndex}`}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'code':
            return (
              <pre key={`code-${index}`}>
                <code>{node.code}</code>
              </pre>
            );
          case 'paragraph':
          default:
            return (
              <p key={`paragraph-${index}`}>
                {renderInline(node.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
