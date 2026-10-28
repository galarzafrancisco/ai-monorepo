import { Fragment } from 'react';
import { PullRequestChip } from './PullRequestChip';
import { parsePullRequestUrl, splitLinks } from './pullRequestLinks';
import './LinkifiedText.css';

/**
 * Plain text with its links made clickable. Links to GitHub pull requests are
 * drawn as live pull request chips.
 */
export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((segment, index) => {
        if (segment.kind === 'text') return <Fragment key={index}>{segment.text}</Fragment>;
        if (parsePullRequestUrl(segment.url)) {
          return <PullRequestChip key={index} url={segment.url} variant="inline" />;
        }
        return (
          <a
            key={index}
            className="linkified-text__link"
            href={segment.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {segment.url}
          </a>
        );
      })}
    </>
  );
}
