import { useEffect, useMemo, useRef, useState } from 'react';
import { PopShell } from '../../app/shells/PopShell';
import { Switch } from '../../ui/primitives';
import { TaicoAuthExplanation } from './TaicoAuthExplanation';
import { authTypeForNewTool, type ToolAuthType } from './toolAuth';
import './NewToolPop.css';

type NewToolPopPayload = {
  name: string;
  type: 'http' | 'stdio';
  authType: ToolAuthType;
};

type NewToolPopProps = {
  onCancel?: () => void;
  onSave: (payload: NewToolPopPayload) => Promise<boolean>;
  error?: string | null;
};

export function NewToolPop({ onCancel, onSave, error }: NewToolPopProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'http' | 'stdio'>('http');
  const [useTaicoAuth, setUseTaicoAuth] = useState(true);
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
      authType: authTypeForNewTool(type, useTaicoAuth),
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

      {error ? (
        <p className="new-tool-pop__error">{error}</p>
      ) : null}

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

      {type === 'http' ? (
        <div className="new-tool-pop__group">
          <div className="new-tool-pop__switch-row">
            <label className="new-tool-pop__label" htmlFor="new-tool-taico-auth">
              Use Taico authentication
            </label>
            <Switch
              id="new-tool-taico-auth"
              checked={useTaicoAuth}
              onCheckedChange={setUseTaicoAuth}
            />
          </div>
          <div className="new-tool-pop__hint">
            <TaicoAuthExplanation />
          </div>
        </div>
      ) : null}
    </PopShell>
  );
}
