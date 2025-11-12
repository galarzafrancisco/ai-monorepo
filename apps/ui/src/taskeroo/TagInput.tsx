import React, { useState, useEffect, useRef } from 'react';
import type { TagResponseDto } from 'shared';
import { TaskerooService } from './api';

interface TagInputProps {
  value: string[]; // Array of tag names
  onChange: (tagNames: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  placeholder = 'Type to add tags...'
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagResponseDto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search for tags as user types
  useEffect(() => {
    const searchTags = async () => {
      if (inputValue.trim().length > 0) {
        try {
          // Get all tags and filter locally
          const allTags = await TaskerooService.taskerooControllerGetAllTags();
          const query = inputValue.trim().toLowerCase();
          const filtered = allTags
            .filter((tag: TagResponseDto) =>
              tag.name.toLowerCase().includes(query) && !value.includes(tag.name)
            );
          setSuggestions(filtered);
          setShowSuggestions(true);
        } catch (error) {
          console.error('Failed to search tags:', error);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timeoutId = setTimeout(searchTags, 150); // Debounce
    return () => clearTimeout(timeoutId);
  }, [inputValue, value]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const removeTag = (tagName: string) => {
    onChange(value.filter(t => t !== tagName));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && inputValue.trim()) {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        // Select highlighted suggestion
        addTag(suggestions[selectedIndex].name);
      } else {
        // Create new tag with current input
        addTag(inputValue);
      }
    } else if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        addTag(suggestions[selectedIndex].name);
      } else {
        addTag(inputValue);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when backspace on empty input
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          padding: '6px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          minHeight: '38px',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tagName) => (
          <span
            key={tagName}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#3B82F6',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '3px',
              fontSize: '0.875rem',
            }}
          >
            {tagName}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tagName);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: '1rem',
                lineHeight: '1',
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setShowSuggestions(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{
            flex: '1',
            minWidth: '120px',
            border: 'none',
            outline: 'none',
            fontSize: '0.875rem',
            padding: '2px',
          }}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginTop: '2px',
            maxHeight: '200px',
            overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
          }}
        >
          {suggestions.map((tag, index) => (
            <div
              key={tag.id}
              onClick={() => addTag(tag.name)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? '#EFF6FF' : 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: tag.color || '#6B7280',
                }}
              />
              <span style={{ fontSize: '0.875rem' }}>{tag.name}</span>
            </div>
          ))}
        </div>
      )}

      {showSuggestions && inputValue && suggestions.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginTop: '2px',
            padding: '8px 12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            fontSize: '0.875rem',
            color: '#6B7280',
          }}
        >
          Press Tab or Enter to create "{inputValue}"
        </div>
      )}
    </div>
  );
};
