import { BellRing } from "lucide-react";
import { Link } from "react-router-dom";
import { TaskSubscriptionResponseDto } from "@taico/client/v2";
import { TASKS_STATUS, TaskStatus } from "../../shared/const/taskStatus";
import "./ThreadTaskSubscriptionList.css";

/** Tasks the threads agent is waiting to hear about: a compact list, not full task cards. */
export function ThreadTaskSubscriptionList({
  subscriptions,
}: {
  subscriptions: TaskSubscriptionResponseDto[];
}): React.JSX.Element {
  return (
    <ul className="thread-task-subscription-list">
      {subscriptions.map((subscription) => (
        <li key={subscription.taskId}>
          <Link
            to={`/tasks/task/${subscription.taskId}`}
            className="thread-task-subscription-list__item"
            title="The agent is notified when this task is in review or done"
          >
            <BellRing
              size={14}
              className="thread-task-subscription-list__icon"
              aria-hidden="true"
            />
            <span className="thread-task-subscription-list__name truncate">
              {subscription.name}
            </span>
            <span className="thread-task-subscription-list__status">
              {TASKS_STATUS[subscription.status as TaskStatus]?.label ?? subscription.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
