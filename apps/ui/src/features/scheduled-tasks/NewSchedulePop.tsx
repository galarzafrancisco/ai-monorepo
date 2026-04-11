import { useMemo, useState } from 'react';
import { PopShell } from '../../app/shells/PopShell';
import { Avatar, Button, Text } from '../../ui/primitives';
import type { TaskBlueprint } from './types';
import './NewSchedulePop.css';

type NewSchedulePopProps = {
  blueprints: TaskBlueprint[];
  onCancel?: () => void;
  onSave: (blueprint: TaskBlueprint) => Promise<boolean>;
  onRequestNewBlueprint: () => void;
};

export function NewSchedulePop({
  blueprints,
  onCancel,
  onSave,
  onRequestNewBlueprint,
}: NewSchedulePopProps) {
  const [query, setQuery] = useState('');
  const [selectedBlueprint, setSelectedBlueprint] = useState<TaskBlueprint | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) {
      return blueprints;
    }
    return blueprints.filter((blueprint) => {
      const haystack = [
        blueprint.name,
        blueprint.description || '',
        blueprint.assigneeActor?.displayName || '',
        blueprint.assigneeActor?.slug || '',
      ].join(' ').toLowerCase();
      return haystack.includes(clean);
    });
  }, [blueprints, query]);

  const handleSave = async () => {
    if (!selectedBlueprint) {
      return false;
    }
    return onSave(selectedBlueprint);
  };

  return (
    <PopShell title="Create Schedule" onCancel={onCancel} onSave={handleSave}>
      <div className="new-schedule-pop">
        {selectedBlueprint ? (
          <div className="new-schedule-pop__selected" onClick={() => setSelectedBlueprint(null)}>
            <Avatar
              size="md"
              name={selectedBlueprint.name}
              src={selectedBlueprint.assigneeActor?.avatarUrl || undefined}
            />
            <div className="new-schedule-pop__selected-meta">
              <Text weight="medium" size="3">{selectedBlueprint.name}</Text>
              <Text tone="muted" size="2">
                {selectedBlueprint.description || 'No description'}
              </Text>
            </div>
            <Text size="2" tone="muted">tap to change</Text>
          </div>
        ) : (
          <>
            <input
              className="new-schedule-pop__input"
              placeholder="Search blueprint by name..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setHighlightedIndex((index) => Math.min(index + 1, filtered.length - 1));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setHighlightedIndex((index) => Math.max(index - 1, 0));
                }
                if (event.key === 'Enter' && filtered[highlightedIndex]) {
                  event.preventDefault();
                  setSelectedBlueprint(filtered[highlightedIndex]);
                }
              }}
            />
            <div className="new-schedule-pop__list">
              {filtered.length === 0 ? (
                <div className="new-schedule-pop__empty">
                  <Text tone="muted" size="2">No blueprints found</Text>
                </div>
              ) : (
                filtered.map((blueprint, index) => (
                  <div
                    key={blueprint.id}
                    className={`new-schedule-pop__item ${index === highlightedIndex ? 'new-schedule-pop__item--highlighted' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => setSelectedBlueprint(blueprint)}
                  >
                    <Avatar
                      size="sm"
                      name={blueprint.name}
                      src={blueprint.assigneeActor?.avatarUrl || undefined}
                    />
                    <div className="new-schedule-pop__item-meta">
                      <Text size="2" weight="medium">{blueprint.name}</Text>
                      <Text size="1" tone="muted">
                        {blueprint.assigneeActor
                          ? `@${blueprint.assigneeActor.slug}`
                          : 'Unassigned'}
                      </Text>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <Button size="sm" variant="secondary" onClick={onRequestNewBlueprint}>
          + New blueprint
        </Button>
      </div>
    </PopShell>
  );
}
