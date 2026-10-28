import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import type { ThreadWatchResponseDto } from "@taico/client/v2";
import { PullRequestChip, usePullRequest, parsePullRequestUrl, type PullRequest } from "../pull-requests";
import { ThreadsService } from "./api";
import "./ThreadWaitLists.css";
import "./ThreadPullRequests.css";

const CONDITION_LABEL: Record<string, string> = {
  checks_finished: "CI finishes",
  checks_failed: "CI fails",
  checks_passed: "CI passes",
  approved: "approved",
  changes_requested: "changes requested",
  new_comments: "new comments",
  new_commits: "new commits",
  ready_for_review: "ready for review",
  merged: "merged",
  closed: "closed",
};

/** One line per pull request: its chip (state, CI, approval) and title. */
export function ThreadPullRequestList({ pullRequests }: { pullRequests: PullRequest[] }): React.JSX.Element {
  return (
    <ul className="thread-pull-requests">
      {pullRequests.map((pullRequest) => (
        <ThreadPullRequestRow key={pullRequest.id} url={pullRequest.url} />
      ))}
    </ul>
  );
}

function ThreadPullRequestRow({ url }: { url: string }) {
  const entry = usePullRequest(parsePullRequestUrl(url));
  const title = entry?.status === "ready" ? entry.pullRequest.title : null;
  return (
    <li className="thread-pull-requests__row">
      <PullRequestChip url={url} variant="compact" />
      {title ? <span className="thread-pull-requests__title truncate" title={title}>{title}</span> : null}
    </li>
  );
}

/** Pull requests the agent is watching, with what it waits for. Each can be stopped from a trash icon. */
export function ThreadPullRequestWatchList({
  threadId,
  watches,
}: {
  threadId: string;
  watches: ThreadWatchResponseDto[];
}): React.JSX.Element {
  return (
    <ul className="thread-wait-list">
      {watches.map((watch) => (
        <WatchRow key={watch.id} threadId={threadId} watch={watch} />
      ))}
    </ul>
  );
}

function WatchRow({ threadId, watch }: { threadId: string; watch: ThreadWatchResponseDto }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const conditions = watch.conditions.map((condition) => CONDITION_LABEL[condition] ?? condition).join(", ");
  const until = new Date(watch.expiresAt).toLocaleString();
  const description = `${watch.once ? "Until the first of" : "Every time"}: ${conditions}, or until it is merged or closed. Stops at ${until}.${watch.waitingFor ? ` ${watch.waitingFor}` : ""}`;

  const remove = async () => {
    setIsRemoving(true);
    setFailed(false);
    try {
      await ThreadsService.ThreadsController_cancelWatch({ id: threadId, watchId: watch.id });
    } catch {
      setFailed(true);
      setIsRemoving(false);
    }
  };

  return (
    <li className={`thread-wait-list__row ${isRemoving ? "thread-wait-list__row--removing" : ""}`}>
      <div className="thread-wait-list__item" title={description}>
        <span className="thread-wait-list__icon"><Eye size={14} aria-hidden="true" /></span>
        {watch.targetUrl ? (
          <PullRequestChip url={watch.targetUrl} variant="compact" />
        ) : (
          <span className="thread-wait-list__lead">{watch.targetLabel}</span>
        )}
        <span className="thread-wait-list__text truncate">{conditions}</span>
      </div>
      <button
        type="button"
        className={`thread-wait-list__remove ${failed ? "thread-wait-list__remove--failed" : ""}`}
        onClick={() => void remove()}
        disabled={isRemoving}
        aria-label="Stop watching"
        title={failed ? "Stop watching failed. Try again." : "Stop watching"}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
