import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Row, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { BFF_BASE_URL } from '../../config/api';
import { useHomeCtx } from './HomeProvider';
import './SettingsDataPage.css';

type ImportResponse = {
  importedCount?: number;
};

export function SettingsDataPage() {
  const { setSectionTitle } = useHomeCtx();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    <Stack spacing="6">
      <Text tone="muted">
        Import and export workspace data. Blocks are available now; task support can be added in this section later.
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

      <Card padding="5">
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

      <Card padding="5">
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
    </Stack>
  );
}
