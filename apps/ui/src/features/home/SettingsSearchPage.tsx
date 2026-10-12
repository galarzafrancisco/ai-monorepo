import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SearchIndexStatusDto, SearchSettingsDto } from '@taico/client/v2';
import { Button, Card, Chip, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useHomeCtx } from './HomeProvider';
import { SearchService } from './search-api';
import './SettingsPage.css';
import './SettingsSearchPage.css';

type NumericSetting = {
  [K in keyof SearchSettingsDto]: SearchSettingsDto[K] extends number ? K : never;
}[keyof SearchSettingsDto];

type NumberField = {
  key: NumericSetting;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
};

type FieldGroup = {
  title: string;
  description: string;
  fields: NumberField[];
};

/** Bounds mirror the backend's; the backend is what enforces them. */
const GROUPS: FieldGroup[] = [
  {
    title: 'Matching',
    description: 'How close something has to be to the query to count as a match at all.',
    fields: [
      {
        key: 'semanticMinSimilarity',
        label: 'Semantic similarity floor',
        help: 'Lowest similarity (0 to 1) at which a passage counts as a match by meaning. Raise it if loosely related results show up; lower it if good results are missing. The right value depends on the embedding model.',
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: 'semanticMaxGap',
        label: 'Semantic gap to the best match',
        help: 'How far below the best semantic match a passage may be and still count. Trims the tail when something matches well. 1 turns it off.',
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: 'keywordMinDensity',
        label: 'Keyword proximity floor',
        help: 'Drops keyword matches whose terms are scattered far apart in a long text. Higher is stricter. 0 turns it off.',
        min: 0,
        max: 1,
        step: 0.001,
      },
      {
        key: 'fuzzyMinSimilarity',
        label: 'Fuzzy title floor',
        help: 'Lowest similarity (0.1 to 1) at which a title counts as a match despite typos. Lower forgives more typos and lets in more unrelated titles.',
        min: 0.1,
        max: 1,
        step: 0.01,
      },
    ],
  },
  {
    title: 'Ranking',
    description:
      'Each strategy ranks its own matches; the lists are merged by position. Weights decide how much each list counts.',
    fields: [
      {
        key: 'keywordWeight',
        label: 'Keyword weight',
        help: 'Weight of exact-word matches. 0 turns keyword search off.',
        min: 0,
        max: 10,
        step: 0.1,
      },
      {
        key: 'semanticWeight',
        label: 'Semantic weight',
        help: 'Weight of matches by meaning. 0 turns semantic search off.',
        min: 0,
        max: 10,
        step: 0.1,
      },
      {
        key: 'fuzzyTitleWeight',
        label: 'Fuzzy title weight',
        help: 'Weight of titles that look like the query. 0 turns fuzzy title search off.',
        min: 0,
        max: 10,
        step: 0.1,
      },
      {
        key: 'exactTitleBoost',
        label: 'Exact title boost',
        help: 'Added to the score when the query is the title, and half of it when the title starts with the query.',
        min: 0,
        max: 1,
        step: 0.005,
      },
      {
        key: 'doneTaskMultiplier',
        label: 'Finished task multiplier',
        help: 'Score multiplier for done tasks, so open work wins ties. 1 treats them the same.',
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: 'rrfK',
        label: 'Rank fusion constant',
        help: 'Higher values make the position within a list matter less. 60 is the usual value.',
        min: 1,
        max: 1000,
        step: 1,
      },
      {
        key: 'candidatesPerStrategy',
        label: 'Candidates per strategy',
        help: 'How many matches each strategy contributes before the lists are merged.',
        min: 5,
        max: 500,
        step: 1,
      },
    ],
  },
  {
    title: 'Indexing',
    description:
      'Long text is split into passages and each passage is embedded. Changing these re-embeds everything in the background.',
    fields: [
      {
        key: 'chunkSizeChars',
        label: 'Passage size (characters)',
        help: 'Target size of a passage. Smaller passages match more precisely and cost more embeddings.',
        min: 200,
        max: 8000,
        step: 100,
      },
      {
        key: 'chunkOverlapChars',
        label: 'Passage overlap (characters)',
        help: 'Characters repeated between consecutive pieces when one long paragraph has to be cut.',
        min: 0,
        max: 1000,
        step: 10,
      },
    ],
  },
  {
    title: 'Results',
    description: 'What a search returns.',
    fields: [
      {
        key: 'excerptMaxChars',
        label: 'Excerpt length (characters)',
        help: 'Longest excerpt returned with a result. Anything shorter than this is returned whole.',
        min: 100,
        max: 20000,
        step: 100,
      },
      {
        key: 'defaultLimit',
        label: 'Default number of results',
        help: 'Used when a search does not ask for a number.',
        min: 1,
        max: 100,
        step: 1,
      },
      {
        key: 'queryEmbeddingTimeoutMs',
        label: 'Query embedding timeout (ms)',
        help: 'How long a search waits for the embedding model before answering without semantic matches.',
        min: 100,
        max: 30000,
        step: 100,
      },
    ],
  },
];

const errorDetail = (err: unknown, fallback: string): string =>
  (err as { body?: { detail?: string } })?.body?.detail || fallback;

/** The settings whose value differs from what is saved. */
function changedSettings(
  saved: SearchSettingsDto,
  draft: SearchSettingsDto,
): Partial<SearchSettingsDto> {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as Array<keyof SearchSettingsDto>) {
    if (draft[key] !== saved[key]) {
      changes[key] = draft[key];
    }
  }
  return changes as Partial<SearchSettingsDto>;
}

export function SettingsSearchPage() {
  const { setSectionTitle } = useHomeCtx();
  const [saved, setSaved] = useState<SearchSettingsDto | null>(null);
  const [draft, setDraft] = useState<SearchSettingsDto | null>(null);
  const [status, setStatus] = useState<SearchIndexStatusDto | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  useEffect(() => {
    setSectionTitle('Search');
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await SearchService.SearchAdminController_getSearchIndexStatus());
    } catch (err) {
      setError(errorDetail(err, 'Failed to load the state of the search index.'));
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await SearchService.SearchAdminController_getSearchSettings();
        setSaved(settings);
        setDraft(settings);
      } catch (err) {
        setError(errorDetail(err, 'Failed to load the search settings.'));
      }
    };
    void load();
    void loadStatus();
  }, [loadStatus]);

  // While items are being embedded, keep the counts moving.
  const isEmbedding = (status?.pending ?? 0) > 0;
  useEffect(() => {
    if (!isEmbedding) {
      return;
    }
    const timer = setInterval(() => void loadStatus(), 2000);
    return () => clearInterval(timer);
  }, [isEmbedding, loadStatus]);

  const changes = useMemo(
    () => (saved && draft ? changedSettings(saved, draft) : {}),
    [saved, draft],
  );
  const hasChanges = Object.keys(changes).length > 0;

  const handleSave = async () => {
    setError('');
    setNotice('');
    setIsSaving(true);
    try {
      const settings = await SearchService.SearchAdminController_updateSearchSettings({
        body: changes,
      });
      setSaved(settings);
      setDraft(settings);
      setNotice('Search settings saved.');
      await loadStatus();
    } catch (err) {
      setError(errorDetail(err, 'Failed to save the search settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setNotice('');
    setIsSaving(true);
    try {
      const settings = await SearchService.SearchAdminController_resetSearchSettings();
      setSaved(settings);
      setDraft(settings);
      setNotice('Search settings are back to their defaults.');
      await loadStatus();
    } catch (err) {
      setError(errorDetail(err, 'Failed to reset the search settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRebuild = async () => {
    setError('');
    setNotice('');
    setIsRebuilding(true);
    try {
      setStatus(await SearchService.SearchAdminController_rebuildSearchIndex());
      setNotice('The index was rebuilt. Embeddings are being recreated in the background.');
    } catch (err) {
      setError(errorDetail(err, 'Failed to rebuild the search index.'));
    } finally {
      setIsRebuilding(false);
    }
  };

  const setNumber = (key: NumericSetting, raw: string) => {
    if (!draft || raw === '') {
      return;
    }
    const value = Number(raw);
    if (Number.isFinite(value)) {
      setDraft({ ...draft, [key]: value });
    }
  };

  return (
    <Stack spacing="6" className="settings-subpage">
      <Text tone="muted" className="settings-subpage__intro">
        Search looks through tasks and their comments, context blocks, tools, agents and projects.
        It combines exact words, titles that look like the query, and meaning.
      </Text>

      {error ? (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      ) : null}
      {notice ? <Text size="2">{notice}</Text> : null}

      <Card padding="5" className="settings-panel-card">
        <Stack spacing="4">
          <div className="settings-search__title-row">
            <Stack spacing="1">
              <Text size="4" weight="semibold">
                Index
              </Text>
              <Text size="2" tone="muted">
                Everything searchable is indexed as it is created or changed.
              </Text>
            </Stack>
            {status ? (
              <Chip color={status.semanticActive ? 'green' : 'yellow'}>
                {status.semanticActive ? 'Semantic search on' : 'Keyword search only'}
              </Chip>
            ) : null}
          </div>

          {status && !status.semanticActive && status.semanticInactiveReason ? (
            <div className="settings-search__notice">
              <Text size="2" wrap>
                {status.semanticInactiveReason}
              </Text>
            </div>
          ) : null}

          {status?.lastError ? (
            <div className="settings-search__notice settings-search__notice--error">
              <Text size="2" wrap>
                Embedding is failing and will be retried: {status.lastError}
              </Text>
            </div>
          ) : null}

          {status ? (
            <div className="settings-search__status-grid">
              <Stat label="Indexed items" value={String(status.documents)} />
              <Stat label="Embedded" value={String(status.embedded)} />
              <Stat label="Waiting to embed" value={String(status.pending)} />
              <Stat label="Failing" value={String(status.failed)} />
              <Stat label="Embedding model" value={status.embeddingModelId ?? 'None'} />
            </div>
          ) : (
            <Text tone="muted">Loading…</Text>
          )}

          <div className="settings-search__actions">
            <Button variant="secondary" size="sm" onClick={handleRebuild} disabled={isRebuilding}>
              {isRebuilding ? 'Rebuilding…' : 'Rebuild index'}
            </Button>
            <Text size="1" tone="muted">
              Rebuilding re-reads everything and embeds it again. Search keeps working meanwhile.
            </Text>
          </div>
        </Stack>
      </Card>

      {draft ? (
        <>
          <Card padding="5" className="settings-panel-card">
            <Stack spacing="4">
              <Stack spacing="1">
                <Text size="4" weight="semibold">
                  Semantic search
                </Text>
                <Text size="2" tone="muted">
                  Finds things by meaning, using the model selected for the Embeddings job under AI
                  models.
                </Text>
              </Stack>

              <label className="settings-search__toggle">
                <input
                  type="checkbox"
                  checked={draft.semanticEnabled}
                  onChange={(e) => setDraft({ ...draft, semanticEnabled: e.target.checked })}
                />
                <Text size="2" weight="medium">
                  Use embeddings
                </Text>
              </label>

              <div className="settings-search__fields">
                <div className="settings-search__field settings-search__field--wide">
                  <Text size="2" weight="medium">
                    Query instruction
                  </Text>
                  <input
                    type="text"
                    className="settings-search__control"
                    value={draft.queryInstruction}
                    maxLength={500}
                    onChange={(e) => setDraft({ ...draft, queryInstruction: e.target.value })}
                    aria-label="Query instruction"
                  />
                  <Text size="1" tone="muted" wrap>
                    Sent with each query to embedding models that take an instruction (Qwen3, E5).
                    Leave empty for models that take none.
                  </Text>
                </div>
              </div>
            </Stack>
          </Card>

          {GROUPS.map((group) => (
            <Card key={group.title} padding="5" className="settings-panel-card">
              <Stack spacing="4">
                <Stack spacing="1">
                  <Text size="4" weight="semibold">
                    {group.title}
                  </Text>
                  <Text size="2" tone="muted">
                    {group.description}
                  </Text>
                </Stack>
                <div className="settings-search__fields">
                  {group.fields.map((field) => (
                    <div key={field.key} className="settings-search__field">
                      <Text size="2" weight="medium">
                        {field.label}
                      </Text>
                      <input
                        type="number"
                        className="settings-search__control"
                        value={draft[field.key]}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        onChange={(e) => setNumber(field.key, e.target.value)}
                        aria-label={field.label}
                      />
                      <Text size="1" tone="muted" wrap>
                        {field.help}
                      </Text>
                    </div>
                  ))}
                </div>
              </Stack>
            </Card>
          ))}

          <div className="settings-search__actions">
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={isSaving}>
              Reset to defaults
            </Button>
          </div>
        </>
      ) : null}
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-search__stat">
      <Text size="1" tone="muted">
        {label}
      </Text>
      <Text size="3" weight="semibold">
        {value}
      </Text>
    </div>
  );
}
