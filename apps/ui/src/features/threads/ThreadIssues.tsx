import { IssueChip, useIssue, parseIssueUrl, type Issue } from "../issues";
import "./ThreadPullRequests.css";

/** One line per issue: its chip (state) and title. */
export function ThreadIssueList({ issues }: { issues: Issue[] }): React.JSX.Element {
  return (
    <ul className="thread-pull-requests">
      {issues.map((issue) => (
        <ThreadIssueRow key={issue.id} url={issue.url} />
      ))}
    </ul>
  );
}

function ThreadIssueRow({ url }: { url: string }) {
  const entry = useIssue(parseIssueUrl(url));
  const title = entry?.status === "ready" ? entry.issue.title : null;
  return (
    <li className="thread-pull-requests__row">
      <IssueChip url={url} variant="compact" />
      {title ? <span className="thread-pull-requests__title truncate" title={title}>{title}</span> : null}
    </li>
  );
}
