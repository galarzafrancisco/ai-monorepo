import type { ReactNode } from 'react';
import { PullRequestChip } from './PullRequestChip';
import { parsePullRequestUrl } from './pullRequestLinks';

/**
 * marked-react renderer that draws pull request links as live chips. A link
 * whose text is the URL itself (an autolink) shows owner/repo#n; a link with
 * its own text keeps that text.
 */
export const pullRequestMarkdownRenderer = {
  link(this: { elementId: string }, href: string, text: ReactNode) {
    const key = `pr-link-${this.elementId}`;
    if (parsePullRequestUrl(href)) {
      const label = typeof text === 'string' && text !== href ? text : undefined;
      return <PullRequestChip key={key} url={href} variant="inline" label={label} />;
    }
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    );
  },
};
