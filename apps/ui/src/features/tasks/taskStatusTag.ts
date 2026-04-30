import type { DataRowTag } from "../../ui/primitives";
import { TaskStatus } from "./const";

export function getTaskStatusTag(status: TaskStatus): DataRowTag {
  if (status === TaskStatus.DONE) {
    return { label: "done", color: "purple" };
  }

  if (status === TaskStatus.IN_PROGRESS) {
    return { label: "in progress", color: "green" };
  }

  if (status === TaskStatus.NOT_STARTED) {
    return { label: "not started", color: "blue" };
  }

  if (status === TaskStatus.FOR_REVIEW) {
    return { label: "in review", color: "orange" };
  }

  return { label: "unknown", color: "gray" };
}
