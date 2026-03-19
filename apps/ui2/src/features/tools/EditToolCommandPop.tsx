import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text, Stack } from "../../ui/primitives";
import "./EditToolCommandPop.css";

type EditToolCommandPopProps = {
  initialCmd: string;
  initialArgs: string[];
  onCancel?: () => void;
  onSave: (payload: { cmd: string; args: string[] }) => Promise<boolean>;
};

export function EditToolCommandPop({ initialCmd, initialArgs, onCancel, onSave }: EditToolCommandPopProps) {
  const [cmd, setCmd] = useState(initialCmd);
  const [argsText, setArgsText] = useState(initialArgs.join('\n'));

  const cmdRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    cmdRef.current?.focus();
  }, []);

  async function handleSave(): Promise<boolean> {
    if (!cmd.trim()) {
      return false;
    }

    // Split args by newlines and filter empty lines
    const args = argsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return onSave({ cmd: cmd.trim(), args });
  }

  return (
    <PopShell
      title="Edit Command"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        <div className="edit-tool-command-pop__wrapper">
          <Stack spacing="3">
            <div>
              <Text size="2" weight="medium">Command</Text>
              <input
                type="text"
                className="edit-tool-command-pop__input"
                ref={cmdRef}
                placeholder="npx"
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
              />
            </div>

            <div>
              <Text size="2" weight="medium">Arguments (one per line)</Text>
              <textarea
                className="edit-tool-command-pop__textarea"
                placeholder="-y&#10;@modelcontextprotocol/server-memory"
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
                rows={5}
              />
            </div>
          </Stack>
        </div>
      </>
    </PopShell>
  );
}
