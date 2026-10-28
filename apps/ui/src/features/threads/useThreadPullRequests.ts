import { useEffect, useState } from "react";
import type { ThreadWatchResponseDto } from "@taico/client/v2";
import { pullRequestStore, type PullRequest } from "../pull-requests";
import { ThreadsService } from "./api";
import type { Thread } from "./types";

export const isPullRequestWatch = (watch: ThreadWatchResponseDto) => watch.kind === "pull_request";

/**
 * Pull requests linked from the thread's tasks (links, descriptions, comments)
 * or written in its messages. Fetched again when the thread changes (tasks
 * attached, watches added) and when the window regains focus.
 */
export function useThreadPullRequests(thread: Thread): PullRequest[] {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [focusCount, setFocusCount] = useState(0);
  const threadId = thread.id;
  const version = `${thread.updatedAt}|${thread.tasks.map((task) => task.id).join(",")}|${thread.watches.length}|${focusCount}`;

  useEffect(() => {
    const controller = new AbortController();
    ThreadsService.ThreadsController_listPullRequests({ id: threadId, signal: controller.signal })
      .then((found) => {
        pullRequestStore.seed(found);
        setPullRequests(found);
      })
      .catch(() => {
        // The section stays as it was; it is extra information.
      });
    return () => controller.abort();
  }, [threadId, version]);

  useEffect(() => {
    const onFocus = () => setFocusCount((count) => count + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return pullRequests;
}
