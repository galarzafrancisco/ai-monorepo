import React, { useEffect, useState } from 'react';
import type { TagResponseDto } from 'shared';
import { WikirooService } from './api';

interface TagSelectorProps {
  pageId: string;
  onTagAdded: () => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({ pageId, onTagAdded }) => {
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
      const tags = await WikirooService.wikirooControllerGetAllTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleAddExistingTag = async (tagName: string) => {
    try {
      setIsSubmitting(true);
      await WikirooService.wikirooControllerAddTagToPage(pageId, {
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
      await WikirooService.wikirooControllerAddTagToPage(pageId, {
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDescription.trim() || undefined,
      });
      setNewTagName('');
      setNewTagColor('#3B82F6');
      setNewTagDescription('');
      setShowForm(false);
      onTagAdded();
      loadAllTags();
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600' }}>Add Tag</h4>

      {!showForm && (
        <div>
          <div style={{ marginBottom: '8px' }}>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddExistingTag(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={isSubmitting}
              style={{
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                width: '100%',
                fontSize: '0.9rem',
              }}
            >
              <option value="">Select existing tag...</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            + Create New Tag
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreateNewTag} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            placeholder="Tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            disabled={isSubmitting}
            required
            style={{
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '0.9rem',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem' }}>Color:</label>
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '50px', height: '30px', cursor: 'pointer' }}
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={newTagDescription}
            onChange={(e) => setNewTagDescription(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            style={{
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '0.9rem',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                background: '#3B82F6',
                color: 'white',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {isSubmitting ? 'Adding...' : 'Add Tag'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNewTagName('');
                setNewTagColor('#3B82F6');
                setNewTagDescription('');
              }}
              disabled={isSubmitting}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: '#f5f5f5',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
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
