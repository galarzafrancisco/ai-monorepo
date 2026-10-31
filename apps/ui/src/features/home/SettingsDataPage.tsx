import { useEffect, useMemo, useState } from 'react';
import { AgentService } from '@taico/client';
import { Button, Card, Row, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { BFF_BASE_URL } from '../../config/api';
import { useHomeCtx } from './HomeProvider';
import './SettingsPage.css';
import './SettingsDataPage.css';

type ImportResponse = {
  importedCount?: number;
};

type AgentImportResponse = {
  created?: string[];
  updated?: string[];
  failed?: Array<{ slug: string; reason: string }>;
  warnings?: Array<{ slug: string; reason: string }>;
};

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function SettingsDataPage() {
  const { setSectionTitle } = useHomeCtx();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isExportingAgents, setIsExportingAgents] = useState(false);
  const [isImportingAgents, setIsImportingAgents] = useState(false);
  const [selectedAgentFile, setSelectedAgentFile] = useState<File | null>(null);
  const [agentFileInputKey, setAgentFileInputKey] = useState(0);
  const [agentError, setAgentError] = useState('');
  const [agentSuccess, setAgentSuccess] = useState('');

  useEffect(() => {
    setSectionTitle('Import / Export');
  }, [setSectionTitle]);

  const exportUrl = useMemo(() => `${BFF_BASE_URL}/api/v1/context/blocks/export`, []);
  const importUrl = useMemo(() => `${BFF_BASE_URL}/api/v1/context/blocks/import`, []);

  const handleExportBlocks = async () => {
    setIsExporting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(exportUrl, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export blocks');
      }

      const blob = await response.blob();
      const headerFileName = response.headers
        .get('content-disposition')
        ?.match(/filename="?([^";]+)"?/)?.[1];
      const fileName = headerFileName || 'context-blocks.zip';

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);

      setSuccess('Blocks export downloaded successfully.');
    } catch {
      setError('Failed to export blocks. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAgents = async () => {
    setIsExportingAgents(true);
    setAgentError('');
    setAgentSuccess('');

    try {
      const document = await AgentService.agentsControllerExportAgents();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJson(`agents-${timestamp}.json`, document);
      setAgentSuccess('Agent definitions downloaded.');
    } catch {
      setAgentError('Failed to export agents. Please try again.');
    } finally {
      setIsExportingAgents(false);
    }
  };

  const handleImportAgents = async () => {
    if (!selectedAgentFile) {
      setAgentError('Please choose a .json file first.');
      setAgentSuccess('');
      return;
    }

    setIsImportingAgents(true);
    setAgentError('');
    setAgentSuccess('');

    try {
      const parsed = JSON.parse(await selectedAgentFile.text()) as Parameters<
        typeof AgentService.agentsControllerImportAgents
      >[0];
      const payload = (await AgentService.agentsControllerImportAgents(
        parsed,
      )) as AgentImportResponse;
      const created = payload.created?.length ?? 0;
      const updated = payload.updated?.length ?? 0;
      const failed = payload.failed ?? [];
      const warnings = payload.warnings ?? [];
      const summary = `Import complete. ${created} created, ${updated} updated.`;
      const details = [
        ...failed.map((item) => `${item.slug}: ${item.reason}`),
        ...warnings.map((item) => `${item.slug}: ${item.reason}`),
      ];
      if (failed.length > 0) {
        setAgentError(details.join(' '));
        setAgentSuccess(summary);
      } else {
        setAgentSuccess(details.length > 0 ? `${summary} ${details.join(' ')}` : summary);
      }
      setSelectedAgentFile(null);
      setAgentFileInputKey((key) => key + 1);
    } catch {
      setAgentError('Failed to import agents. Verify the JSON file and try again.');
    } finally {
      setIsImportingAgents(false);
    }
  };

  const handleImportBlocks = async () => {
    if (!selectedFile) {
      setError('Please choose a .zip file first.');
      setSuccess('');
      return;
    }

    setIsImporting(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(importUrl, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as ImportResponse;
      if (!response.ok) {
        throw new Error('Failed to import blocks');
      }

      const importedCount = payload.importedCount ?? 0;
      setSuccess(`Import complete. ${importedCount} block${importedCount === 1 ? '' : 's'} created.`);
      setSelectedFile(null);
    } catch {
      setError('Failed to import blocks. Verify the archive format and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Stack spacing="6" className="settings-subpage">
      <Text tone="muted" className="settings-subpage__intro">
        Import and export workspace data. Context blocks use a markdown archive. Agent definitions use a portable JSON file with no database IDs or secrets.
      </Text>

      {error ? (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      ) : null}

      {success ? (
        <Text size="2" className="settings-data__success">
          {success}
        </Text>
      ) : null}

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Export Blocks</Text>
            <Text tone="muted">Download all context blocks as a nested markdown zip archive.</Text>
          </Stack>
          <Row justify="end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportBlocks}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export Blocks'}
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Import Blocks</Text>
            <Text tone="muted">Upload a blocks archive to create context blocks in this workspace.</Text>
          </Stack>

          <label htmlFor="blocks-import-file" className="settings-data__file-label">
            Select archive (.zip)
          </label>
          <input
            id="blocks-import-file"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="settings-data__file-input"
          />
          <Text size="1" tone="muted">
            {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
          </Text>

          <Row justify="end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImportBlocks}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import Blocks'}
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Export Agents</Text>
            <Text tone="muted">
              Download agent configuration as JSON. Database IDs, timestamps, and tokens are left out.
            </Text>
          </Stack>
          {agentError ? (
            <ErrorText size="2" weight="medium">
              {agentError}
            </ErrorText>
          ) : null}
          {agentSuccess ? (
            <Text size="2" className="settings-data__success">
              {agentSuccess}
            </Text>
          ) : null}
          <Row justify="end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportAgents}
              disabled={isExportingAgents}
            >
              {isExportingAgents ? 'Exporting...' : 'Export Agents'}
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">Import Agents</Text>
            <Text tone="muted">
              Upload an agent definition file. An existing slug is updated; a new slug is created. Tool grants for MCP servers that are not in this workspace are skipped.
            </Text>
          </Stack>

          <label htmlFor="agents-import-file" className="settings-data__file-label">
            Select definitions (.json)
          </label>
          <input
            id="agents-import-file"
            key={agentFileInputKey}
            type="file"
            accept=".json,application/json"
            onChange={(event) => setSelectedAgentFile(event.target.files?.[0] ?? null)}
            className="settings-data__file-input"
          />
          <Text size="1" tone="muted">
            {selectedAgentFile ? `Selected: ${selectedAgentFile.name}` : 'No file selected'}
          </Text>

          <Row justify="end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImportAgents}
              disabled={isImportingAgents}
            >
              {isImportingAgents ? 'Importing...' : 'Import Agents'}
            </Button>
          </Row>
        </Stack>
      </Card>
    </Stack>
  );
}
