import React, { useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { TaskStatus, TASKS_STATUS } from "../../shared/const/taskStatus";
import { Text } from "../../ui/primitives";
import "./EditStatusTriggersPop.css";

type EditStatusTriggersPopProps = {
  initialValue: TaskStatus[];
  onCancel?: () => void;
  onSave: (payload: { statusTriggers: TaskStatus[] }) => Promise<boolean>;
};

export function EditStatusTriggersPop({ initialValue, onCancel, onSave }: EditStatusTriggersPopProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<TaskStatus>>(
    new Set(initialValue)
  );

  const toggleStatus = (status: TaskStatus) => {
    setSelectedStatuses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  async function handleSave(): Promise<boolean> {
    return onSave({ statusTriggers: Array.from(selectedStatuses) });
  }

  const allStatuses = [
    TaskStatus.NOT_STARTED,
    TaskStatus.IN_PROGRESS,
    TaskStatus.FOR_REVIEW,
    TaskStatus.DONE,
  ];

  return (
    <PopShell
      title="Edit Status Triggers"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="edit-status-triggers-pop__content">
        <Text size="2" tone="muted" className="edit-status-triggers-pop__description">
          Select which task statuses will trigger this agent to activate
        </Text>
        <div className="edit-status-triggers-pop__checklist">
          {allStatuses.map((status) => {
            const statusInfo = TASKS_STATUS[status];
            return (
              <label
                key={status}
                className="edit-status-triggers-pop__checklist-item"
              >
                <input
                  type="checkbox"
                  checked={selectedStatuses.has(status)}
                  onChange={() => toggleStatus(status)}
                  className="edit-status-triggers-pop__checkbox"
                />
                <div className="edit-status-triggers-pop__status-info">
                  <span className="edit-status-triggers-pop__status-icon">
                    {statusInfo.icon}
                  </span>
                  <Text size="3" weight="medium">
                    {statusInfo.label}
                  </Text>
                  <Text size="2" tone="muted">
                    {status}
                  </Text>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </PopShell>
  );
}
