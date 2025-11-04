import type { ReactNode } from 'react';

export interface ReactMarkdownComponents {
  [element: string]: (props: Record<string, unknown> & { children?: ReactNode }) => ReactNode;
}

export interface ReactMarkdownProps {
  children?: string;
  components?: ReactMarkdownComponents;
}

export default function ReactMarkdown(props: ReactMarkdownProps): ReactNode;
