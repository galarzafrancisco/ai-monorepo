import React, { useState, useEffect } from 'react';
import type { TagResponseDto } from 'shared';
import { TaskerooService } from './api';

interface TagSelectorProps {
  taskId: string;
  onTagAdded: () => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({ taskId, onTagAdded }) => {
  const [allTags, setAllTags] = useState<TagResponseDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadAllTags();
  }, []);

  const loadAllTags = async () => {
    try {
      const tags = await TaskerooService.taskerooControllerGetAllTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleAddExistingTag = async (tagName: string) => {
    try {
      setIsSubmitting(true);
      await TaskerooService.taskerooControllerAddTagToTask(taskId, {
        name: tagName,
      });
      onTagAdded();
    } catch (error) {
      console.error('Failed to add tag:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      setIsSubmitting(true);
      await TaskerooService.taskerooControllerAddTagToTask(taskId, {
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDescription.trim() || undefined,
      });
      setNewTagName('');
      setNewTagColor('#3B82F6');
      setNewTagDescription('');
      setShowForm(false);
      onTagAdded();
      loadAllTags(); // Refresh the tag list
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: '10px' }}>
      {!showForm ? (
        <div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Add existing tag:</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {allTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleAddExistingTag(tag.name)}
                disabled={isSubmitting}
                style={{
                  backgroundColor: tag.color || '#6B7280',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  opacity: isSubmitting ? 0.6 : 1,
                }}
                title={tag.description}
              >
                {tag.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              backgroundColor: '#10B981',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            + Create New Tag
          </button>
        </div>
      ) : (
        <form onSubmit={handleCreateNewTag} style={{ border: '1px solid #ddd', padding: '12px', borderRadius: '6px' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
              Tag Name *
            </label>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
              placeholder="e.g., bug, feature, urgent"
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
              Color
            </label>
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              style={{
                width: '60px',
                height: '32px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
              Description (optional)
            </label>
            <input
              type="text"
              value={newTagDescription}
              onChange={(e) => setNewTagDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
              placeholder="Brief description of this tag"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              Create & Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNewTagName('');
                setNewTagColor('#3B82F6');
                setNewTagDescription('');
              }}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
