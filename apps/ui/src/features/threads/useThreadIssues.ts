import { useEffect, useState } from "react";
import { issueStore, type Issue } from "../issues";
import { ThreadsService } from "./api";
import type { Thread } from "./types";

/**
 * Issues attached as links to the thread's tasks. Fetched again when the thread changes (tasks
 * attached), when a task artefact is added (`linksRevision`), and when the window regains focus.
 */
export function useThreadIssues(thread: Thread, linksRevision = 0): Issue[] {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [focusCount, setFocusCount] = useState(0);
  const threadId = thread.id;
  const version = `${thread.updatedAt}|${thread.tasks.map((task) => task.id).join(",")}|${focusCount}|${linksRevision}`;

  useEffect(() => {
    const controller = new AbortController();
    ThreadsService.ThreadsController_listIssues({ id: threadId, signal: controller.signal })
      .then((found) => {
        issueStore.seed(found);
        setIssues(found);
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

  return issues;
}
