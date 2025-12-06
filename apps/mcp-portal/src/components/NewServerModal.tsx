import { useState } from "react";
import { createPortal } from "react-dom";
import { McpRegistryService } from "../lib/api";
import type { CreateServerDto } from "shared";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewServerModal({ onClose, onSuccess }: Props) {
  const [providedId, setProvidedId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setApiErr(null);
    try {
      const payload: CreateServerDto = {
        providedId,
        name,
        description,
      };

      await McpRegistryService.mcpRegistryControllerCreateServer(payload);
      onSuccess();
    } catch (err: any) {
      setApiErr(err.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const ready = providedId.trim() && name.trim() && description.trim();

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
      <div className="w-full max-w-md rounded-xl bg-[#0e0f19] p-8 text-white border border-white/10">
        <h2 className="text-2xl font-semibold mb-6">New MCP Server</h2>

        <label className="block text-sm mb-2">Server ID *</label>
        <input
          value={providedId}
          onChange={(e) => setProvidedId(e.target.value)}
          placeholder="e.g., github-integration"
          className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 mb-4 text-white placeholder-white/50"
        />

        <label className="block text-sm mb-2">Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., GitHub Integration"
          className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 mb-4 text-white placeholder-white/50"
        />

        <label className="block text-sm mb-2">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe what this server does"
          className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 mb-4 text-white placeholder-white/50"
        />

        {apiErr && <p className="text-red-400 text-sm mb-4">{apiErr}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 bg-white/10 hover:bg-white/20 text-white"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !ready}
            className="rounded-md px-4 py-2 text-white disabled:opacity-50 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400"
          >
            {saving ? "Creating…" : "Create Server"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
