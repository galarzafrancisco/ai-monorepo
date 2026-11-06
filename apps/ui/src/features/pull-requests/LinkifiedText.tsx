import { Fragment } from 'react';
import { PullRequestChip } from './PullRequestChip';
import { IssueChip } from '../issues/IssueChip';
import { parseIssueUrl } from '../issues/issueLinks';
import { parsePullRequestUrl, splitLinks } from './pullRequestLinks';
import { TaicoLinkChip } from '../taico-links/TaicoLinkChip';
import { parseTaicoUrl } from '../taico-links/taicoLinks';
import './LinkifiedText.css';

/**
 * Plain text with its links made clickable. Links to GitHub pull requests and
 * issues are drawn as live chips, and links to tasks and context blocks in
 * this Taico show their names.
 */
export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((segment, index) => {
        if (segment.kind === 'text') return <Fragment key={index}>{segment.text}</Fragment>;
        if (parsePullRequestUrl(segment.url)) {
          return <PullRequestChip key={index} url={segment.url} variant="inline" />;
        }
        if (parseIssueUrl(segment.url)) {
          return <IssueChip key={index} url={segment.url} variant="inline" />;
        }
        if (parseTaicoUrl(segment.url)) {
          return <TaicoLinkChip key={index} url={segment.url} />;
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
