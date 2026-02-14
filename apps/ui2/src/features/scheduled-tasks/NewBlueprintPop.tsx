import { useEffect, useMemo, useRef, useState } from 'react';
import { PopShell } from '../../app/shells/PopShell';
import { ActorSearchPop, Actor } from '../actors';
import { TagSearchPop } from '../tasks/TagSearchPop';
import './NewBlueprintPop.css';

type BlueprintDraft = {
  name: string;
  description: string;
  assigneeActorId?: string;
  tagNames?: string[];
  dependsOnIds?: string[];
};

type TagLike = {
  id?: string;
  name: string;
  color?: string;
};

type NewBlueprintPopProps = {
  onCancel?: () => void;
  onSave: (payload: BlueprintDraft) => Promise<boolean>;
  title?: string;
  initialValues?: {
    name?: string;
    description?: string;
    assigneeActor?: Actor | null;
    tags?: TagLike[];
    dependsOnIds?: string[];
  };
};

export function NewBlueprintPop({ onCancel, onSave, title = 'Create Blueprint', initialValues }: NewBlueprintPopProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [assignee, setAssignee] = useState<Actor | null>(initialValues?.assigneeActor ?? null);
  const [tags, setTags] = useState<TagLike[]>(initialValues?.tags ?? []);
  const [dependsOnRaw, setDependsOnRaw] = useState((initialValues?.dependsOnIds ?? []).join(', '));

  const [showAssigneePop, setShowAssigneePop] = useState(false);
  const [showTagPop, setShowTagPop] = useState(false);

  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const existingTags = useMemo(() => {
    return tags.map((tag) => ({ id: tag.id || tag.name }));
  }, [tags]);

  const handleSave = async () => {
    const dependsOnIds = dependsOnRaw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    return onSave({
      name: name.trim(),
      description: description.trim(),
      assigneeActorId: assignee?.id,
      tagNames: tags.map((tag) => tag.name),
      dependsOnIds: dependsOnIds.length ? dependsOnIds : undefined,
    });
  };

  return (
    <PopShell title={title} onCancel={onCancel} onSave={handleSave}>
      <div className="new-blueprint-pop">
        <label className="new-blueprint-pop__label" htmlFor="blueprint-name">Name</label>
        <input
          id="blueprint-name"
          ref={nameRef}
          className="new-blueprint-pop__input"
          placeholder="Blueprint name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label className="new-blueprint-pop__label" htmlFor="blueprint-description">Description</label>
        <textarea
          id="blueprint-description"
          className="new-blueprint-pop__textarea"
          placeholder="Describe the task blueprint"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="new-blueprint-pop__section">
          <div className="new-blueprint-pop__section-title">Assignee</div>
          {assignee ? (
            <div className="new-blueprint-pop__assignee" onClick={() => setShowAssigneePop(true)}>
              <div>
                <div className="new-blueprint-pop__assignee-name">{assignee.displayName}</div>
                <div className="new-blueprint-pop__assignee-slug">@{assignee.slug}</div>
              </div>
              <button
                type="button"
                className="new-blueprint-pop__ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  setAssignee(null);
                }}
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="new-blueprint-pop__ghost"
              onClick={() => setShowAssigneePop(true)}
            >
              + Assign
            </button>
          )}
        </div>

        <div className="new-blueprint-pop__section">
          <div className="new-blueprint-pop__section-title">Tags</div>
          <div className="new-blueprint-pop__tags">
            {tags.length === 0 ? (
              <span className="new-blueprint-pop__muted">No tags yet</span>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.id || tag.name}
                  type="button"
                  className="new-blueprint-pop__tag"
                  style={{ backgroundColor: tag.color || 'var(--border)' }}
                  onClick={() => setTags((prev) => prev.filter((item) => item.name !== tag.name))}
                >
                  {tag.name}
                  <span className="new-blueprint-pop__tag-remove">x</span>
                </button>
              ))
            )}
            <button
              type="button"
              className="new-blueprint-pop__ghost"
              onClick={() => setShowTagPop(true)}
            >
              + Add tag
            </button>
          </div>
        </div>

        <div className="new-blueprint-pop__section">
          <div className="new-blueprint-pop__section-title">Dependencies</div>
          <input
            className="new-blueprint-pop__input"
            placeholder="Task IDs, comma separated"
            value={dependsOnRaw}
            onChange={(event) => setDependsOnRaw(event.target.value)}
          />
          <div className="new-blueprint-pop__helper">Example: 8a3b1f, 8a3b20</div>
        </div>
      </div>

      {showAssigneePop ? (
        <ActorSearchPop
          onCancel={() => setShowAssigneePop(false)}
          onSave={async (actor) => {
            setAssignee(actor);
            return true;
          }}
        />
      ) : null}
      {showTagPop ? (
        <TagSearchPop
          onCancel={() => setShowTagPop(false)}
          onSave={async (tag) => {
            setTags((prev) => {
              if (prev.some((existing) => existing.name === tag.name)) {
                return prev;
              }
              return [...prev, tag];
            });
            return true;
          }}
          existingTags={existingTags}
        />
      ) : null}
    </PopShell>
  );
}
