import { useEffect, useMemo, useState } from "react";
import { Button, Card, Row, Stack, Text } from "../../ui/primitives";
import { ErrorText } from "../../ui/primitives/ErrorText";
import { BFF_BASE_URL } from "../../config/api";
import { useHomeCtx } from "./HomeProvider";
import "./SettingsPage.css";
import "./SettingsDataPage.css";

type ImportResponse = {
  importedCount?: number;
};

type DataSet = "blocks" | "projects";

export function SettingsDataPage() {
  const { setSectionTitle } = useHomeCtx();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProjectFile, setSelectedProjectFile] = useState<File | null>(
    null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setSectionTitle("Import / Export");
  }, [setSectionTitle]);

  const exportUrl = useMemo(
    () => `${BFF_BASE_URL}/api/v1/context/blocks/export`,
    [],
  );
  const importUrl = useMemo(
    () => `${BFF_BASE_URL}/api/v1/context/blocks/import`,
    [],
  );
  const projectsExportUrl = useMemo(
    () => `${BFF_BASE_URL}/api/v1/meta/projects/export`,
    [],
  );
  const projectsImportUrl = useMemo(
    () => `${BFF_BASE_URL}/api/v1/meta/projects/import`,
    [],
  );

  const handleExport = async (url: string, dataSet: DataSet) => {
    setIsExporting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to export ${dataSet}`);
      }

      const blob = await response.blob();
      const headerFileName = response.headers
        .get("content-disposition")
        ?.match(/filename="?([^";]+)"?/)?.[1];
      const fileName =
        headerFileName ||
        (dataSet === "blocks" ? "context-blocks.zip" : "projects.json");

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);

      setSuccess(
        `${dataSet === "blocks" ? "Blocks" : "Projects"} export downloaded successfully.`,
      );
    } catch {
      setError(`Failed to export ${dataSet}. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (
    url: string,
    file: File | null,
    dataSet: DataSet,
  ) => {
    if (!file) {
      setError(
        `Please choose a ${dataSet === "blocks" ? ".zip" : ".json"} file first.`,
      );
      setSuccess("");
      return;
    }

    setIsImporting(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as ImportResponse;
      if (!response.ok) {
        throw new Error(`Failed to import ${dataSet}`);
      }

      const importedCount = payload.importedCount ?? 0;
      const noun = dataSet === "blocks" ? "block" : "project";
      setSuccess(
        `Import complete. ${importedCount} ${noun}${importedCount === 1 ? "" : "s"} imported.`,
      );
      if (dataSet === "blocks") {
        setSelectedFile(null);
      } else {
        setSelectedProjectFile(null);
      }
    } catch {
      setError(
        `Failed to import ${dataSet}. Verify the file format and try again.`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Stack spacing="6" className="settings-subpage">
      <Text tone="muted" className="settings-subpage__intro">
        Import and export workspace data for backup or migration.
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
            <Text size="4" weight="semibold">
              Export Blocks
            </Text>
            <Text tone="muted">
              Download all context blocks as a nested markdown zip archive.
            </Text>
          </Stack>
          <Row justify="end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport(exportUrl, "blocks")}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export Blocks"}
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">
              Import Blocks
            </Text>
            <Text tone="muted">
              Upload a blocks archive to create context blocks in this
              workspace.
            </Text>
          </Stack>

          <label
            htmlFor="blocks-import-file"
            className="settings-data__file-label"
          >
            Select archive (.zip)
          </label>
          <input
            id="blocks-import-file"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] ?? null)
            }
            className="settings-data__file-input"
          />
          <Text size="1" tone="muted">
            {selectedFile
              ? `Selected: ${selectedFile.name}`
              : "No file selected"}
          </Text>

          <Row justify="end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleImport(importUrl, selectedFile, "blocks")}
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import Blocks"}
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">
              Export Projects
            </Text>
            <Text tone="muted">Download all projects as a JSON file.</Text>
          </Stack>
          <Row justify="end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport(projectsExportUrl, "projects")}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export Projects"}
            </Button>
          </Row>
        </Stack>
      </Card>

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <Stack spacing="1">
            <Text size="4" weight="semibold">
              Import Projects
            </Text>
            <Text tone="muted">
              Upload a projects JSON file to create or update projects.
            </Text>
          </Stack>

          <label
            htmlFor="projects-import-file"
            className="settings-data__file-label"
          >
            Select projects file (.json)
          </label>
          <input
            id="projects-import-file"
            type="file"
            accept=".json,application/json"
            onChange={(event) =>
              setSelectedProjectFile(event.target.files?.[0] ?? null)
            }
            className="settings-data__file-input"
          />
          <Text size="1" tone="muted">
            {selectedProjectFile
              ? `Selected: ${selectedProjectFile.name}`
              : "No file selected"}
          </Text>

          <Row justify="end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                handleImport(projectsImportUrl, selectedProjectFile, "projects")
              }
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import Projects"}
            </Button>
          </Row>
        </Stack>
      </Card>
    </Stack>
  );
}
