import React, { useState, useEffect } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text } from "../../ui/primitives";
import { MetaService, MetaTagResponseDto } from "@taico/client";
import "./EditTagTriggersPop.css";

type EditTagTriggersPopProps = {
  initialValue: string[]; // Array of tag IDs
  onCancel?: () => void;
  onSave: (payload: { tagTriggers: string[] }) => Promise<boolean>;
};

export function EditTagTriggersPop({ initialValue, onCancel, onSave }: EditTagTriggersPopProps) {
  const [allTags, setAllTags] = useState<MetaTagResponseDto[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(initialValue)
  );

  // Load all tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await MetaService.metaControllerGetAllTags();
        setAllTags(tags);
      } catch (err) {
        console.error('Failed to load tags:', err);
      } finally {
        setIsLoadingTags(false);
      }
    };
    loadTags();
  }, []);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  async function handleSave(): Promise<boolean> {
    return onSave({ tagTriggers: Array.from(selectedTagIds) });
  }

  return (
    <PopShell
      title="Edit Tag Triggers"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="edit-tag-triggers-pop__content">
        <Text size="2" tone="muted" className="edit-tag-triggers-pop__description">
          Select which tags will trigger this agent to activate when added to a task
        </Text>
        <div className="edit-tag-triggers-pop__checklist">
          {isLoadingTags ? (
            <div className="edit-tag-triggers-pop__empty">
              <Text tone="muted">Loading tags...</Text>
            </div>
          ) : allTags.length === 0 ? (
            <div className="edit-tag-triggers-pop__empty">
              <Text tone="muted">No tags available</Text>
            </div>
          ) : (
            allTags.map((tag) => (
              <label
                key={tag.id}
                className="edit-tag-triggers-pop__checklist-item"
              >
                <input
                  type="checkbox"
                  checked={selectedTagIds.has(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="edit-tag-triggers-pop__checkbox"
                />
                <div className="edit-tag-triggers-pop__tag-info">
                  <div
                    className="edit-tag-triggers-pop__tag-badge"
                    style={{ backgroundColor: tag.color || '#999' }}
                  >
                    {tag.name}
                  </div>
                  <Text size="1" tone="muted" style="mono">
                    #{tag.id.slice(0, 8)}
                  </Text>
                </div>
              </label>
            ))
          )}
        </div>
      </div>
    </PopShell>
  );
}
