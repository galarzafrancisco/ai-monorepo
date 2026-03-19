import { useEffect, useMemo, useRef, useState } from 'react';
import { PopShell } from '../../app/shells/PopShell';
import './NewToolPop.css';

type NewToolPopPayload = {
  name: string;
  type: 'http' | 'stdio';
};

type NewToolPopProps = {
  onCancel?: () => void;
  onSave: (payload: NewToolPopPayload) => Promise<boolean>;
};

export function NewToolPop({ onCancel, onSave }: NewToolPopProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'http' | 'stdio'>('http');
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSave = useMemo(() => {
    return name.trim().length > 0;
  }, [name]);

  const handleSave = async (): Promise<boolean> => {
    if (!canSave) {
      return false;
    }

    return onSave({
      name: name.trim(),
      type,
    });
  };

  return (
    <PopShell title="Create a Tool" onCancel={onCancel} onSave={handleSave}>
      <div className="new-tool-pop__group">
        <input
          className="new-tool-pop__input"
          ref={nameRef}
          placeholder="Tool name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="new-tool-pop__group">
        <label className="new-tool-pop__label" htmlFor="new-tool-transport-type">
          Transport type
        </label>
        <select
          id="new-tool-transport-type"
          className="new-tool-pop__select"
          value={type}
          onChange={(event) => setType(event.target.value as 'http' | 'stdio')}
        >
          <option value="http">HTTP</option>
          <option value="stdio">STDIO</option>
        </select>
      </div>
    </PopShell>
  );
}
