import React from 'react';
import type { TagResponseDto } from 'shared';

interface TagBadgeProps {
  tag: TagResponseDto;
  onRemove?: () => void;
  small?: boolean;
}

export const TagBadge: React.FC<TagBadgeProps> = ({ tag, onRemove, small = false }) => {
  const backgroundColor = tag.color || '#6B7280';

  return (
    <span
      className={`tag-badge ${small ? 'tag-badge-small' : ''}`}
      style={{
        backgroundColor,
        color: '#ffffff',
        padding: small ? '1px 4px' : '2px 6px',
        borderRadius: '3px',
        fontSize: small ? '0.65rem' : '0.7rem',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        marginRight: '4px',
        marginBottom: '4px',
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '0',
            marginLeft: '1px',
            fontSize: small ? '0.75rem' : '0.85rem',
            lineHeight: '1',
          }}
          aria-label={`Remove ${tag.name} tag`}
        >
          ×
        </button>
      )}
    </span>
  );
};
