import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AgentTemplateCatalogResponseDto,
  AgentTemplateDto,
  AgentTemplateHarnessDto,
  AgentTemplateModelOptionDto,
  CreateAgentDto,
} from "@taico/client/v2";
import { TaskStatus, TASKS_STATUS } from "../../shared/const/taskStatus";
import { Button, DataRow, DataRowContainer, Stack, Text } from "../../ui/primitives";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useDraftState } from "../../shared/hooks/useDraftState";
import { AgentsService } from "./api";
import { useAgentsCtx } from "./AgentsProvider";
import "./NewAgentWizardPage.css";

type WizardStep = "template" | "harness" | "model" | "status" | "tags" | "prompt" | "identity";
type AgentType = CreateAgentDto["type"];

type Draft = CreateAgentDto & {
  templateId?: string;
};

type WizardState = {
  stepIndex: number;
  draft: Draft;
  selectedModelOptionId: string;
  customProviderId: string;
  customModelId: string;
  tagText: string;
  slugTouched: boolean;
};

const BASE_STEPS: WizardStep[] = ["template", "harness", "model", "status", "tags"];
const STATUS_OPTIONS = [
  TaskStatus.NOT_STARTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.FOR_REVIEW,
  TaskStatus.DONE,
];

const emptyDraft: Draft = {
  name: "",
  slug: "",
  type: "other",
  description: undefined,
  systemPrompt: "",
  providerId: undefined,
  modelId: undefined,
  statusTriggers: [],
  tagTriggers: [],
  allowedTools: [],
  isActive: true,
  concurrencyLimit: 1,
};

const defaultWizardState: WizardState = {
  stepIndex: 0,
  draft: emptyDraft,
  selectedModelOptionId: "default",
  customProviderId: "",
  customModelId: "",
  tagText: "",
  slugTouched: false,
};

export function NewAgentWizardPage() {
  const navigate = useNavigate();
  const { setSectionTitle, createAgent } = useAgentsCtx();
  const [catalog, setCatalog] = useState<AgentTemplateCatalogResponseDto | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [wizardState, setWizardState, clearWizardDraft] = useDraftState<WizardState>({
    key: "new-agent-wizard-draft",
    defaultValue: defaultWizardState,
    debounceMs: 0,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const {
    stepIndex,
    draft,
    selectedModelOptionId,
    customProviderId,
    customModelId,
    tagText,
    slugTouched,
  } = wizardState;

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle("New Agent");
  }, [setSectionTitle]);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      try {
        const response = await AgentsService.AgentsController_listAgentTemplates({});
        if (!isMounted) return;
        setCatalog(response);
        const customTemplate =
          response.templates.find((template) => template.id === "custom") ?? response.templates[0];
        if (customTemplate && !wizardState.draft.templateId) {
          applyTemplate(customTemplate);
        }
      } catch (error) {
        if (!isMounted) return;
        setCatalogError(error instanceof Error ? error.message : "Failed to load agent templates");
      } finally {
        if (isMounted) {
          setIsLoadingCatalog(false);
        }
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo<WizardStep[]>(() => {
    return draft.templateId === "custom"
      ? [...BASE_STEPS, "prompt", "identity"]
      : [...BASE_STEPS, "identity"];
  }, [draft.templateId]);
  const effectiveStepIndex = Math.min(stepIndex, steps.length - 1);
  const currentStep = steps[effectiveStepIndex];
  const selectedHarness = useMemo(
    () => catalog?.harnesses.find((harness) => harness.type === draft.type) ?? null,
    [catalog, draft.type],
  );
  const canGoNext = getCanGoNext(currentStep, draft);
  const isLastStep = effectiveStepIndex === steps.length - 1;

  function applyTemplate(template: AgentTemplateDto) {
    setWizardState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        templateId: template.id,
        type: template.type ?? current.draft.type ?? "other",
        description: template.agentDescription || undefined,
        systemPrompt: template.systemPrompt,
        providerId: template.providerId || undefined,
        modelId: template.modelId || undefined,
        statusTriggers: template.statusTriggers,
        tagTriggers: template.tagTriggers,
        avatarUrl: template.avatarUrl,
        concurrencyLimit: template.concurrencyLimit,
        allowedTools: [],
        isActive: true,
      },
      tagText: template.tagTriggers.join(", "),
      selectedModelOptionId:
        template.providerId || template.modelId
          ? `${template.providerId || "default-provider"}:${template.modelId}`
          : "default",
      customProviderId: "",
      customModelId: "",
    }));
  }

  function selectHarness(harness: AgentTemplateHarnessDto) {
    setWizardState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        type: harness.type,
        providerId: undefined,
        modelId: undefined,
      },
      selectedModelOptionId: "default",
      customProviderId: "",
      customModelId: "",
    }));
  }

  function selectModelOption(option: AgentTemplateModelOptionDto | "custom") {
    if (option === "custom") {
      setWizardState((current) => ({
        ...current,
        selectedModelOptionId: "custom",
        draft: {
          ...current.draft,
          providerId: current.customProviderId.trim() || undefined,
          modelId: current.customModelId.trim() || undefined,
        },
      }));
      return;
    }

    setWizardState((current) => ({
      ...current,
      selectedModelOptionId: option.id,
      draft: {
        ...current.draft,
        providerId: option.providerId,
        modelId: option.modelId,
      },
    }));
  }

  function updateCustomModel(nextProviderId: string, nextModelId: string) {
    setWizardState((current) => ({
      ...current,
      customProviderId: nextProviderId,
      customModelId: nextModelId,
      draft: {
        ...current.draft,
        providerId: nextProviderId.trim() || undefined,
        modelId: nextModelId.trim() || undefined,
      },
    }));
  }

  function toggleStatus(status: TaskStatus) {
    setWizardState((current) => {
      const selected = new Set(current.draft.statusTriggers ?? []);
      if (selected.has(status)) {
        selected.delete(status);
      } else {
        selected.add(status);
      }
      return {
        ...current,
        draft: {
          ...current.draft,
          statusTriggers: Array.from(selected),
        },
      };
    });
  }

  function updateTagText(value: string) {
    setWizardState((current) => ({
      ...current,
      tagText: value,
      draft: {
        ...current.draft,
        tagTriggers: value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
    }));
  }

  function updateName(value: string) {
    setWizardState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        name: value,
        slug: current.slugTouched ? current.draft.slug : slugify(value),
      },
    }));
  }

  function updateSlug(value: string) {
    setWizardState((current) => ({
      ...current,
      slugTouched: true,
      draft: { ...current.draft, slug: normalizeSlug(value) },
    }));
  }

  function goNext() {
    if (!canGoNext) return;
    setWizardState((current) => ({
      ...current,
      stepIndex: Math.min(current.stepIndex + 1, steps.length - 1),
    }));
  }

  function goBack() {
    setWizardState((current) => ({
      ...current,
      stepIndex: Math.max(current.stepIndex - 1, 0),
    }));
  }

  async function submitAgent() {
    if (!getCanGoNext("identity", draft) || isCreating) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const agent = await createAgent({
        name: draft.name.trim(),
        slug: draft.slug.trim(),
        type: draft.type,
        description: draft.description,
        avatarUrl: draft.avatarUrl,
        systemPrompt: draft.systemPrompt,
        providerId: draft.providerId,
        modelId: draft.modelId,
        statusTriggers: draft.statusTriggers ?? [],
        tagTriggers: draft.tagTriggers ?? [],
        allowedTools: [],
        isActive: true,
        concurrencyLimit: draft.concurrencyLimit,
      });
      if (agent) {
        clearWizardDraft();
        navigate(`/agents/agent/${agent.slug}`);
      } else {
        setCreateError("Agent creation failed");
      }
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoadingCatalog) {
    return (
      <DataRowContainer>
        <DataRow>
          <Text tone="muted">Loading agent templates...</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  if (catalogError || !catalog) {
    return (
      <DataRowContainer>
        <DataRow>
          <Stack spacing="3">
            <Text tone="muted">{catalogError ?? "Agent templates are unavailable"}</Text>
            <Button variant="secondary" onClick={() => navigate("/agents")}>
              Back to Agents
            </Button>
          </Stack>
        </DataRow>
      </DataRowContainer>
    );
  }

  return (
    <div className="new-agent-wizard">
      <div className="new-agent-wizard__header">
        <Text size="1" tone="muted">
          Step {effectiveStepIndex + 1} of {steps.length}
        </Text>
        <div className="new-agent-wizard__progress" aria-hidden="true">
          <div
            className="new-agent-wizard__progress-fill"
            style={{ width: `${((effectiveStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="new-agent-wizard__body">
        {currentStep === "template" && (
          <WizardSection
            title="What kind of agent are you making?"
            support="Pick a starting point. You can adjust the agent from its page later."
          >
            <div className="new-agent-wizard__option-grid">
              {catalog.templates.map((template) => (
                <OptionButton
                  key={template.id}
                  title={template.label}
                  description={template.description}
                  selected={draft.templateId === template.id}
                  onClick={() => applyTemplate(template)}
                />
              ))}
            </div>
          </WizardSection>
        )}

        {currentStep === "harness" && (
          <WizardSection
            title="What harness do you want to use?"
            support="Choose the runtime that will execute this agent."
          >
            <div className="new-agent-wizard__option-grid">
              {catalog.harnesses.map((harness) => (
                <OptionButton
                  key={harness.type}
                  title={harness.label}
                  description={harness.description}
                  selected={draft.type === harness.type}
                  onClick={() => selectHarness(harness)}
                />
              ))}
            </div>
          </WizardSection>
        )}

        {currentStep === "model" && (
          <WizardSection
            title="Which model should it use?"
            support="Default lets the harness choose. You can also pick a preset or enter a model."
          >
            <div className="new-agent-wizard__option-grid">
              {(selectedHarness?.modelOptions ?? []).map((option) => (
                <OptionButton
                  key={option.id}
                  title={option.label}
                  description={option.isDefault ? "Use the harness default" : formatModel(option)}
                  selected={selectedModelOptionId === option.id}
                  onClick={() => selectModelOption(option)}
                />
              ))}
              <OptionButton
                title="Custom"
                description="Use a provider and model ID"
                selected={selectedModelOptionId === "custom"}
                onClick={() => selectModelOption("custom")}
              />
            </div>
            {selectedModelOptionId === "custom" && (
              <div className="new-agent-wizard__field-grid">
                <label className="new-agent-wizard__field">
                  <Text size="1" tone="muted">Provider ID</Text>
                  <input
                    value={customProviderId}
                    onChange={(event) => updateCustomModel(event.target.value, customModelId)}
                    placeholder="openai"
                  />
                </label>
                <label className="new-agent-wizard__field">
                  <Text size="1" tone="muted">Model ID</Text>
                  <input
                    value={customModelId}
                    onChange={(event) => updateCustomModel(customProviderId, event.target.value)}
                    placeholder="gpt-5.3-codex"
                  />
                </label>
              </div>
            )}
          </WizardSection>
        )}

        {currentStep === "status" && (
          <WizardSection
            title="When should this agent react?"
            support="These task statuses trigger the agent. Select none if it should only run manually."
          >
            <div className="new-agent-wizard__option-grid">
              {STATUS_OPTIONS.map((status) => {
                const statusInfo = TASKS_STATUS[status];
                return (
                  <OptionButton
                    key={status}
                    title={`${statusInfo.icon} ${statusInfo.label}`}
                    description={status}
                    selected={(draft.statusTriggers ?? []).includes(status)}
                    onClick={() => toggleStatus(status)}
                  />
                );
              })}
            </div>
          </WizardSection>
        )}

        {currentStep === "tags" && (
          <WizardSection
            title="Should this only run for certain tags?"
            support="Leave this blank to react to every task with the selected status."
          >
            <label className="new-agent-wizard__field">
              <Text size="1" tone="muted">Tag names</Text>
              <input
                value={tagText}
                onChange={(event) => updateTagText(event.target.value)}
                placeholder="code, review"
              />
            </label>
          </WizardSection>
        )}

        {currentStep === "prompt" && (
          <WizardSection
            title="What should this agent do?"
            support="Write the system prompt for this custom agent."
          >
            <textarea
              className="new-agent-wizard__prompt-editor"
              value={draft.systemPrompt}
              onChange={(event) =>
                setWizardState((current) => ({
                  ...current,
                  draft: { ...current.draft, systemPrompt: event.target.value },
                }))
              }
              placeholder="You are an agent that..."
              aria-label="System prompt"
            />
          </WizardSection>
        )}

        {currentStep === "identity" && (
          <WizardSection
            title="Almost done. Name your agent."
            support="Tools can be added from the agent page after creation."
          >
            <div className="new-agent-wizard__identity-fields">
              <label className="new-agent-wizard__identity-field">
                <Text size="1" tone="muted">Display name</Text>
                <input
                  className="new-agent-wizard__name-input"
                  value={draft.name}
                  onChange={(event) => updateName(event.target.value)}
                  placeholder="Code Reviewer"
                  autoFocus
                />
              </label>
              <label className="new-agent-wizard__identity-field">
                <Text size="1" tone="muted">Slug</Text>
                <div className="new-agent-wizard__slug-row">
                  <Text as="span" size="4" tone="muted">@</Text>
                  <input
                    className="new-agent-wizard__slug-input"
                    value={draft.slug}
                    onChange={(event) => updateSlug(event.target.value)}
                    placeholder="code-reviewer"
                  />
                </div>
              </label>
            </div>
            <div className="new-agent-wizard__summary">
              <Text size="2" weight="medium">Summary</Text>
              <Text size="2" tone="muted">Template: {getTemplateLabel(catalog.templates, draft.templateId)}</Text>
              <Text size="2" tone="muted">Harness: {selectedHarness?.label ?? draft.type ?? "Other"}</Text>
              <Text size="2" tone="muted">Model: {draft.modelId ? formatModel(draft) : "Default"}</Text>
              <Text size="2" tone="muted">
                Triggers: {(draft.statusTriggers ?? []).length > 0 ? draft.statusTriggers?.join(", ") : "Manual"}
              </Text>
              <Text size="2" tone="muted">
                Tags: {(draft.tagTriggers ?? []).length > 0 ? draft.tagTriggers?.join(", ") : "Any tag"}
              </Text>
            </div>
          </WizardSection>
        )}

        {createError && (
          <Text size="2" className="new-agent-wizard__error">
            {createError}
          </Text>
        )}
      </div>

      <div className="new-agent-wizard__footer">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={
            effectiveStepIndex === 0
              ? () => {
                clearWizardDraft();
                navigate("/agents");
              }
              : goBack
          }
        >
          {effectiveStepIndex === 0 ? "Cancel" : "Back"}
        </Button>
        <Button
          size="lg"
          fullWidth
          onClick={isLastStep ? submitAgent : goNext}
          disabled={!canGoNext || isCreating}
        >
          {isLastStep ? (isCreating ? "Creating..." : "Create agent") : "Next"}
        </Button>
      </div>
    </div>
  );
}

function WizardSection({
  title,
  support,
  children,
}: {
  title: string;
  support: string;
  children: ReactNode;
}) {
  return (
    <Stack spacing="4" className="new-agent-wizard__section">
      <Stack spacing="2">
        <Text size="5" weight="bold">{title}</Text>
        <Text size="2" tone="muted">{support}</Text>
      </Stack>
      {children}
    </Stack>
  );
}

function OptionButton({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`new-agent-wizard__option ${selected ? "new-agent-wizard__option--selected" : ""}`}
      type="button"
      onClick={onClick}
    >
      <Text size="3" weight="medium">{title}</Text>
      <Text size="2" tone="muted">{description}</Text>
    </button>
  );
}

function getCanGoNext(step: WizardStep, draft: Draft): boolean {
  if (step === "template") return Boolean(draft.templateId);
  if (step === "harness") return Boolean(draft.type);
  if (step === "prompt") return Boolean(draft.systemPrompt.trim());
  if (step === "identity") return Boolean(draft.name.trim() && draft.slug.trim());
  return true;
}

function getTemplateLabel(templates: AgentTemplateDto[], templateId?: string): string {
  return templates.find((template) => template.id === templateId)?.label ?? "Custom";
}

function formatModel(value: Pick<AgentTemplateModelOptionDto, "providerId" | "modelId">): string {
  const parts = [value.providerId, value.modelId].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Default";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}
