import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Pencil } from 'lucide-react';
import { useAgentsCtx } from './AgentsProvider';
import { Text, Stack, Button, Avatar, Chip, InsetGroup, InsetRow } from '../../ui/primitives';
import { Agent, AgentAvatarDto } from './types';
import type { PatchAgentDto, MetaTagResponseDto, AgentToolPermissionResponseDto } from "@taico/client/v2";
import { AgentsService, AgentToolPermissionsService, MetaService } from './api';
import { EditSystemPromptPop } from './EditSystemPromptPop';
import { EditStatusTriggersPop } from './EditStatusTriggersPop';
import { EditTagTriggersPop } from './EditTagTriggersPop';
import { EditIntroductionPop } from './EditIntroductionPop';
import { EditAgentTypePop } from './EditAgentTypePop';
import { EditAgentModelPop } from './EditAgentModelPop';
import { EditConcurrencyLimitPop } from './EditConcurrencyLimitPop';
import { EditAgentAvatarPop } from './EditAgentAvatarPop';
import { AgentTokensSection } from './AgentTokensSection';
import { TaskStatus } from '../../shared/const/taskStatus';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { AGENT_TYPE_COLORS, agentTypeLabel, concurrencyLimitOf, statusTriggersLabel } from './agentDisplay';
import './AgentDetailPage.css';

type EditField =
  | 'avatar'
  | 'systemPrompt'
  | 'introduction'
  | 'type'
  | 'model'
  | 'concurrency'
  | 'statusTriggers'
  | 'tagTriggers';

export function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { agents, setSectionTitle, loadAgentDetails, updateAgent, deleteAgent } = useAgentsCtx();
  const { showError } = useToast();

  // Find agent from context first (for quick load)
  const agentFromList = agents.find(a => a.slug === slug);
  const [agent, setAgent] = useState<Agent | null>(agentFromList || null);
  const [isLoading, setIsLoading] = useState(!agentFromList);

  // All tags for displaying tag triggers
  const [allTags, setAllTags] = useState<MetaTagResponseDto[]>([]);

  // Tool permissions state
  const [toolPermissions, setToolPermissions] = useState<AgentToolPermissionResponseDto[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Edit agent state
  const [editing, setEditing] = useState<EditField | null>(null);
  const [avatarCatalog, setAvatarCatalog] = useState<AgentAvatarDto[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const loadAvatarCatalog = useCallback(async () => {
    try {
      const response = await AgentsService.AgentsController_listAgentTemplates({});
      setAvatarCatalog(response.avatars);
    } catch (err) {
      console.error('Failed to load avatar catalog:', err);
    }
  }, []);

  // Load all tags for displaying tag triggers
  const loadTags = useCallback(async () => {
    try {
      setAllTags(await MetaService.MetaController_getAllTags({}));
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, []);

  // Load tool permissions for this agent
  const loadToolPermissions = useCallback(async () => {
    if (!agent) return;
    setPermissionsLoading(true);
    try {
      const permissions = await AgentToolPermissionsService.AgentToolPermissionsController_listAgentToolPermissions({
        actorId: agent.actorId,
      });
      setToolPermissions(permissions);
    } catch (err) {
      console.error('Failed to load tool permissions:', err);
    } finally {
      setPermissionsLoading(false);
    }
  }, [agent]);

  // Load agent details if not in list
  useEffect(() => {
    if (!agentFromList && slug) {
      setIsLoading(true);
      loadAgentDetails(slug).then((loadedAgent) => {
        setAgent(loadedAgent);
        setIsLoading(false);
      }).catch(() => {
        setAgent(null);
        setIsLoading(false);
      });
    } else if (agentFromList) {
      setAgent(agentFromList);
    }
  }, [slug, agentFromList, loadAgentDetails]);

  // Load tags and permissions when agent is loaded
  useEffect(() => {
    if (agent) {
      loadTags();
      loadToolPermissions();
      if (avatarCatalog.length === 0) {
        loadAvatarCatalog();
      }
    }
  }, [agent, avatarCatalog.length, loadTags, loadToolPermissions, loadAvatarCatalog]);

  // Set document title (browser tab)
  useDocumentTitle({ agent: { name: agent?.name } });

  // Set section title for IosShell
  useEffect(() => {
    setSectionTitle(agent ? agent.name : 'Agent');
  }, [agent, setSectionTitle]);

  // Drop the delete confirmation if the user doesn't follow through
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  /** Saves one change from an edit pop and closes it. */
  const save = async (patch: PatchAgentDto): Promise<boolean> => {
    if (!agent) return false;
    try {
      const updated = await updateAgent(agent.actorId, patch);
      if (updated) {
        setAgent(updated);
        setEditing(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update agent:', err);
      showError(err);
      return false;
    }
  };

  const handleDelete = () => {
    if (!agent) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    // TODO: Hack! I redirect before getting confirmation of delete.
    // This is intentionally hacky, because when I get confirmation of deletion,
    // this page renders again which throws an error for whatever reason. Fix!
    deleteAgent(agent.actorId);
    navigate('/agents');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="agent-detail-page agent-detail-page--status">
        <Text size="3" tone="muted">Loading agent…</Text>
      </div>
    );
  }

  // If agent not found
  if (!agent) {
    return (
      <div className="agent-detail-page agent-detail-page--status">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Agent not found</Text>
          <Button variant="secondary" onClick={() => navigate('/agents')}>
            Back to agents
          </Button>
        </Stack>
      </div>
    );
  }

  const introductionValue = agent.introduction as unknown;
  const introductionText = typeof introductionValue === 'string' ? introductionValue.trim() : '';
  const providerLabel = agent.providerId?.trim() || 'Default';
  const modelLabel = agent.modelId?.trim() || 'Default';
  const concurrencyLimit = concurrencyLimitOf(agent);
  const concurrencyLabel = concurrencyLimit === null
    ? 'Unlimited'
    : `${concurrencyLimit} ${concurrencyLimit === 1 ? 'task' : 'tasks'}`;
  const tagColorsByName = new Map(allTags.map((tag) => [tag.name, tag.color]));
  const tagTriggers = agent.tagTriggers ?? [];
  const systemToolCount = toolPermissions.filter((permission) =>
    permission.server.providedId === 'tasks' || permission.server.providedId === 'context'
  ).length;
  const additionalToolCount = toolPermissions.length - systemToolCount;
  const toolDetail = permissionsLoading
    ? 'Loading…'
    : `${systemToolCount} system · ${additionalToolCount} additional`;

  const avatar = (
    <button
      type="button"
      className="agent-hero__avatar"
      onClick={() => setEditing('avatar')}
      aria-label="Change avatar"
    >
      <Avatar size={isDesktop ? 72 : 64} name={agent.name} src={agent.avatarUrl || undefined} inactive={!agent.isActive} />
      <span className="agent-hero__avatar-edit"><Pencil size={12} aria-hidden /></span>
    </button>
  );

  const badges = (
    <div className="agent-hero__badges">
      <Chip color={AGENT_TYPE_COLORS[agent.type]}>{agentTypeLabel(agent.type)}</Chip>
      <Chip color={agent.isActive ? 'green' : 'gray'}>{agent.isActive ? 'Active' : 'Inactive'}</Chip>
    </div>
  );

  const runtimeRows = (
    <>
      <InsetRow label="Type" value={agentTypeLabel(agent.type)} onClick={() => setEditing('type')} />
      {isDesktop ? (
        <>
          <InsetRow label="Provider" value={providerLabel} onClick={() => setEditing('model')} />
          <InsetRow label="Model" value={modelLabel} onClick={() => setEditing('model')} />
        </>
      ) : (
        <InsetRow
          label="Model"
          value={modelLabel === 'Default' && providerLabel === 'Default' ? 'Default' : modelLabel}
          onClick={() => setEditing('model')}
        />
      )}
      <InsetRow label="Concurrency" value={concurrencyLabel} onClick={() => setEditing('concurrency')} />
    </>
  );

  const triggerRows = (
    <>
      <InsetRow
        label="Statuses"
        value={statusTriggersLabel(agent.statusTriggers)}
        onClick={() => setEditing('statusTriggers')}
      />
      <InsetRow
        label="Tags"
        value={tagTriggers.length === 0 ? 'None' : undefined}
        onClick={() => setEditing('tagTriggers')}
      >
        {tagTriggers.length > 0 && (
          <span className="agent-detail-page__chips">
            {tagTriggers.map((tag) => (
              <Chip key={tag} color={getChipColorFromHex(tagColorsByName.get(tag))}>{tag}</Chip>
            ))}
          </span>
        )}
      </InsetRow>
    </>
  );

  const toolsRow = (
    <InsetRow
      label="Tools"
      detail={toolDetail}
      value={permissionsLoading ? undefined : toolPermissions.length}
      onClick={() => navigate(`/agents/agent/${agent.slug}/tools`)}
    />
  );

  const deleteRow = (
    <InsetRow
      tone="danger"
      centered={!isDesktop}
      label={confirmingDelete ? (isDesktop ? 'Click again to delete' : 'Tap again to delete') : 'Delete agent'}
      onClick={handleDelete}
    />
  );

  const pops = (
    <>
      {editing === 'systemPrompt' && (
        <EditSystemPromptPop
          initialValue={agent.systemPrompt}
          onCancel={() => setEditing(null)}
          onSave={({ systemPrompt }) => save({ systemPrompt })}
        />
      )}
      {editing === 'statusTriggers' && (
        <EditStatusTriggersPop
          initialValue={agent.statusTriggers as TaskStatus[]}
          onCancel={() => setEditing(null)}
          onSave={({ statusTriggers }) => save({ statusTriggers })}
        />
      )}
      {editing === 'tagTriggers' && (
        <EditTagTriggersPop
          initialValue={tagTriggers}
          onCancel={() => setEditing(null)}
          onSave={({ tagTriggers }) => save({ tagTriggers })}
        />
      )}
      {editing === 'type' && (
        <EditAgentTypePop
          initialValue={agent.type}
          onCancel={() => setEditing(null)}
          onSave={({ type }) => save({ type })}
        />
      )}
      {editing === 'introduction' && (
        <EditIntroductionPop
          initialValue={introductionText}
          onCancel={() => setEditing(null)}
          onSave={({ introduction }) => save({ introduction })}
        />
      )}
      {editing === 'model' && (
        <EditAgentModelPop
          initialProviderId={agent.providerId ?? ''}
          initialModelId={agent.modelId ?? ''}
          onCancel={() => setEditing(null)}
          onSave={({ providerId, modelId }) => save({ providerId, modelId })}
        />
      )}
      {editing === 'concurrency' && (
        <EditConcurrencyLimitPop
          initialValue={concurrencyLimit}
          onCancel={() => setEditing(null)}
          onSave={({ concurrencyLimit }) => save({ concurrencyLimit })}
        />
      )}
      {editing === 'avatar' && avatarCatalog.length > 0 && (
        <EditAgentAvatarPop
          avatars={avatarCatalog}
          initialValue={agent.avatarUrl}
          onCancel={() => setEditing(null)}
          onSave={({ avatarUrl }) => save({ avatarUrl })}
        />
      )}
    </>
  );

  if (isDesktop) {
    return (
      <div className="agent-detail-page agent-detail-page--desktop">
        <nav className="agent-detail-page__breadcrumb" aria-label="Breadcrumb">
          <Link to="/agents">Agents</Link>
          <ChevronRight size={14} aria-hidden />
          <span>{agent.name}</span>
        </nav>

        <header className="agent-hero agent-hero--desktop">
          {avatar}
          <div className="agent-hero__text">
            <div className="agent-hero__title-row">
              <h1 className="agent-hero__name">{agent.name}</h1>
              {badges}
            </div>
            <div className="agent-hero__handle">
              @{agent.slug}
              <span className="agent-hero__id" title={agent.actorId}>#{agent.actorId.slice(0, 6)}</span>
            </div>
            <p className="agent-hero__description">
              {agent.description ? String(agent.description) : 'No description'}
            </p>
          </div>
        </header>

        <div className="agent-detail-page__columns">
          <div className="agent-detail-page__main">
            <DocumentCard
              title="System prompt"
              text={agent.systemPrompt}
              empty="No system prompt. The agent runs with its harness defaults."
              mono
              onEdit={() => setEditing('systemPrompt')}
            />
            <DocumentCard
              title="Introduction"
              text={introductionText}
              empty="No introduction. Shown to people when they first talk to this agent."
              onEdit={() => setEditing('introduction')}
            />
            <AgentTokensSection slug={agent.slug} isDesktop />
          </div>

          <aside className="agent-detail-page__side">
            <InsetGroup title="Runtime">{runtimeRows}</InsetGroup>
            <InsetGroup title="Triggers" footer="Tasks that reach these statuses or get these tags are picked up.">
              {triggerRows}
            </InsetGroup>
            <InsetGroup title="Capabilities">{toolsRow}</InsetGroup>
            <InsetGroup>{deleteRow}</InsetGroup>
          </aside>
        </div>
        {pops}
      </div>
    );
  }

  return (
    <div className="agent-detail-page agent-detail-page--mobile">
      <InsetGroup>
        <div className="agent-hero agent-hero--mobile">
          {avatar}
          <div className="agent-hero__text">
            <div className="agent-hero__handle">@{agent.slug}</div>
            <p className="agent-hero__description">
              {agent.description ? String(agent.description) : 'No description'}
            </p>
            {badges}
          </div>
        </div>
      </InsetGroup>

      <InsetGroup title="Instructions">
        <InsetRow label="System prompt" onClick={() => setEditing('systemPrompt')}>
          <span className="agent-detail-page__preview agent-detail-page__preview--mono">
            {agent.systemPrompt || 'None'}
          </span>
        </InsetRow>
        <InsetRow label="Introduction" onClick={() => setEditing('introduction')}>
          <span className="agent-detail-page__preview">
            {introductionText || 'None'}
          </span>
        </InsetRow>
      </InsetGroup>

      <InsetGroup title="Runtime">{runtimeRows}</InsetGroup>

      <InsetGroup title="Triggers" footer="Tasks that reach these statuses or get these tags are picked up by this agent.">
        {triggerRows}
      </InsetGroup>

      <InsetGroup>{toolsRow}</InsetGroup>

      <AgentTokensSection slug={agent.slug} isDesktop={false} />

      <InsetGroup>{deleteRow}</InsetGroup>

      {pops}
    </div>
  );
}

function DocumentCard({
  title,
  text,
  empty,
  mono = false,
  onEdit,
}: {
  title: string;
  text: string;
  empty: string;
  mono?: boolean;
  onEdit: () => void;
}) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflows, setOverflows] = useState(false);

  // Only fade the end when the text is actually cut off
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <section className="agent-doc">
      <header className="agent-doc__header">
        <h2 className="agent-doc__title">{title}</h2>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil size={13} aria-hidden />
          Edit
        </Button>
      </header>
      {text ? (
        <button type="button" className="agent-doc__body" onClick={onEdit}>
          <span
            ref={textRef}
            className={`agent-doc__text ${mono ? 'agent-doc__text--mono' : ''} ${overflows ? 'agent-doc__text--clipped' : ''}`}
          >
            {text}
          </span>
        </button>
      ) : (
        <button type="button" className="agent-doc__body agent-doc__body--empty" onClick={onEdit}>
          {empty}
        </button>
      )}
    </section>
  );
}

// Map hex color to Chip color
function getChipColorFromHex(hex: string | null | undefined): "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" {
  if (!hex) return 'gray';

  // Simple color mapping based on common hex values
  const colorMap: Record<string, "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple"> = {
    '#6B7280': 'gray',
    '#3B82F6': 'blue',
    '#10B981': 'green',
    '#52B788': 'green',
    '#F59E0B': 'yellow',
    '#F97316': 'orange',
    '#EF4444': 'red',
    '#8B5CF6': 'purple',
    '#A855F7': 'purple',
    '#98D8C8': 'green',
  };

  // Try exact match first
  if (colorMap[hex]) return colorMap[hex];

  // Fallback to heuristic based on hex value
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Simple heuristic: which channel dominates
  if (r > g && r > b) {
    if (g > 100) return 'orange';
    return 'red';
  } else if (g > r && g > b) {
    return 'green';
  } else if (b > r && b > g) {
    if (r > 100) return 'purple';
    return 'blue';
  } else if (r > 150 && g > 150 && b < 100) {
    return 'yellow';
  }

  return 'gray';
}
