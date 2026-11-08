// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  AgentsService: { AgentsController_listAgentTemplates: vi.fn() },
}));
vi.mock('./AgentsProvider', () => ({
  useAgentsCtx: () => ({ setSectionTitle: () => undefined, createAgent: vi.fn() }),
}));

import { DraftScopeContext } from '../../shared/context/DraftScopeContext';
import { AgentsService } from './api';
import { NewAgentWizardPage } from './NewAgentWizardPage';

const SCOPE = 'person-1:ws-a';
const STORAGE_KEY = `draft:${SCOPE}:new-agent-wizard-draft`;

const customTemplate = {
  id: 'custom',
  label: 'Custom',
  description: 'Start from scratch',
  type: 'other',
  agentDescription: '',
  systemPrompt: 'TEMPLATE DEFAULT',
  followUpPrompt: '',
  providerId: '',
  modelId: '',
  statusTriggers: [],
  tagTriggers: [],
  avatarUrl: '/avatar/default.png',
  concurrencyLimit: 1,
};
const catalog = { templates: [customTemplate], harnesses: [], avatars: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function savedDraft(systemPrompt: string) {
  return {
    stepIndex: 0,
    draft: {
      name: 'Mine',
      slug: 'mine',
      type: 'other',
      templateId: 'custom',
      systemPrompt,
      statusTriggers: [],
      tagTriggers: [],
      allowedTools: [],
      isActive: true,
      concurrencyLimit: 1,
    },
    selectedModelOptionId: 'default',
    customProviderId: '',
    customModelId: '',
    tagText: '',
    slugTouched: true,
    avatarTouched: false,
  };
}

/** Lets the catalog promise, the re-render and then the draft save (a 0 ms timer) run. */
async function flush() {
  for (let round = 0; round < 2; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

function storedPrompt(): string | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ReturnType<typeof savedDraft>).draft.systemPrompt : undefined;
}

function Scoped({ scope, children }: { scope: string | null; children: ReactNode }) {
  return (
    <MemoryRouter>
      <DraftScopeContext.Provider value={scope}>{children}</DraftScopeContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.mocked(AgentsService.AgentsController_listAgentTemplates).mockReset();
});

describe('NewAgentWizardPage drafts', () => {
  it('keeps a saved draft when the catalog arrives after it', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDraft('MY SAVED PROMPT')));
    const pending = deferred<typeof catalog>();
    vi.mocked(AgentsService.AgentsController_listAgentTemplates).mockReturnValue(pending.promise as never);

    render(<Scoped scope={SCOPE}><NewAgentWizardPage /></Scoped>);
    await act(async () => pending.resolve(catalog));
    await flush();

    expect(storedPrompt()).toBe('MY SAVED PROMPT');
  });

  it('keeps a saved draft restored after mount (scope resolves, then the catalog)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDraft('MY SAVED PROMPT')));
    const pending = deferred<typeof catalog>();
    vi.mocked(AgentsService.AgentsController_listAgentTemplates).mockReturnValue(pending.promise as never);

    const view = render(<Scoped scope={null}><NewAgentWizardPage /></Scoped>);
    view.rerender(<Scoped scope={SCOPE}><NewAgentWizardPage /></Scoped>);
    await act(async () => pending.resolve(catalog));
    await flush();

    expect(storedPrompt()).toBe('MY SAVED PROMPT');
  });

  it('starts a new draft from the custom template', async () => {
    vi.mocked(AgentsService.AgentsController_listAgentTemplates).mockResolvedValue(catalog as never);

    render(<Scoped scope={SCOPE}><NewAgentWizardPage /></Scoped>);
    await flush();

    expect(storedPrompt()).toBe('TEMPLATE DEFAULT');
  });
});
