import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Cpu, Plus, Search, X, Zap } from "lucide-react";
import { Avatar, Chip, InsetGroup, InsetRow, Text } from "../../ui/primitives";
import { useAgentsCtx } from "./AgentsProvider";
import { Agent } from "./types";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { AGENT_TYPE_COLORS, agentTypeLabel, modelSummary, statusTriggersLabel } from "./agentDisplay";
import "./AgentsPage.css";

export function AgentsPage() {
  const { agents, setSectionTitle, isLoading, error } = useAgentsCtx();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState('');

  // Set document title (browser tab)
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("Agents");
  }, [setSectionTitle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) =>
      [agent.name, agent.slug, agent.description ?? '', agent.type]
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [agents, query]);

  const active = filtered.filter((agent) => agent.isActive);
  const inactive = filtered.filter((agent) => !agent.isActive);
  const open = (agent: Agent) => navigate(`/agents/agent/${agent.slug}`);

  let body: React.ReactNode;
  if (isLoading && agents.length === 0) {
    body = <EmptyState title="Loading agents…" />;
  } else if (error) {
    body = <EmptyState title="Couldn't load agents" detail={error} />;
  } else if (agents.length === 0) {
    body = (
      <EmptyState
        title="No agents yet"
        detail="Agents pick up tasks for you. Create one to get started."
        action={{ label: 'New agent', onClick: () => navigate('/agents/new') }}
      />
    );
  } else if (filtered.length === 0) {
    body = <EmptyState title="No results" detail={`No agents match “${query.trim()}”.`} />;
  } else if (isDesktop) {
    body = (
      <>
        <AgentGrid title="Active" agents={active} onOpen={open} />
        <AgentGrid title="Inactive" agents={inactive} onOpen={open} />
      </>
    );
  } else {
    body = (
      <>
        <AgentList title={inactive.length > 0 ? 'Active' : undefined} agents={active} onOpen={open} />
        <AgentList title="Inactive" agents={inactive} onOpen={open} />
      </>
    );
  }

  return (
    <div className={`agents-page ${isDesktop ? 'agents-page--desktop' : 'agents-page--mobile'}`}>
      {agents.length > 0 && (
        <SearchField value={query} onChange={setQuery} placeholder="Search agents" />
      )}
      {body}
      {!isDesktop && (
        <button
          type="button"
          className="agents-fab"
          onClick={() => navigate('/agents/new')}
          aria-label="New agent"
        >
          <Plus size={26} strokeWidth={2.4} aria-hidden />
        </button>
      )}
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="agents-search">
      <Search size={16} className="agents-search__icon" aria-hidden />
      <input
        type="search"
        className="agents-search__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" className="agents-search__clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={12} strokeWidth={3} aria-hidden />
        </button>
      )}
    </label>
  );
}

function AgentList({ title, agents, onOpen }: { title?: string; agents: Agent[]; onOpen: (agent: Agent) => void }) {
  if (agents.length === 0) return null;
  return (
    <InsetGroup title={title} className="agents-list">
      {agents.map((agent) => {
        const model = modelSummary(agent);
        return (
          <InsetRow
            key={agent.actorId}
            leading={<Avatar name={agent.name} src={agent.avatarUrl || undefined} size={40} inactive={!agent.isActive} />}
            label={<span className="agents-list__name">{agent.name}</span>}
            value={<span className="agents-list__type">{agentTypeLabel(agent.type)}</span>}
            detail={
              <>
                <span className="agents-list__slug">@{agent.slug}</span>
                {agent.description ? ` · ${String(agent.description)}` : ''}
              </>
            }
            onClick={() => onOpen(agent)}
          >
            {model && (
              <span className="agents-list__model">
                <Cpu size={12} aria-hidden />
                <span>{model}</span>
              </span>
            )}
          </InsetRow>
        );
      })}
    </InsetGroup>
  );
}

function AgentGrid({ title, agents, onOpen }: { title: string; agents: Agent[]; onOpen: (agent: Agent) => void }) {
  if (agents.length === 0) return null;
  return (
    <section className="agents-grid__section">
      <h2 className="agents-grid__title">
        {title}
        <span className="agents-grid__count">{agents.length}</span>
      </h2>
      <div className="agents-grid">
        {agents.map((agent) => (
          <AgentCard key={agent.actorId} agent={agent} onClick={() => onOpen(agent)} />
        ))}
      </div>
    </section>
  );
}

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const model = modelSummary(agent);
  return (
    <button
      type="button"
      className={`agent-card ${agent.isActive ? '' : 'agent-card--inactive'}`}
      onClick={onClick}
    >
      <div className="agent-card__head">
        <Avatar name={agent.name} src={agent.avatarUrl || undefined} size={44} inactive={!agent.isActive} />
        <div className="agent-card__identity">
          <span className="agent-card__name">{agent.name}</span>
          <span className="agent-card__slug">@{agent.slug}</span>
        </div>
        <Chip color={AGENT_TYPE_COLORS[agent.type]}>{agentTypeLabel(agent.type)}</Chip>
      </div>
      <p className="agent-card__description">
        {agent.description ? String(agent.description) : <span className="agent-card__muted">No description</span>}
      </p>
      <div className="agent-card__foot">
        {model && (
          <span className="agent-card__foot-item agent-card__model" title={model}>
            <Cpu size={13} aria-hidden />
            <span>{model}</span>
          </span>
        )}
        <span className="agent-card__foot-item agent-card__triggers" title={triggerTitle(agent)}>
          <Zap size={13} aria-hidden />
          <span>
            {agent.statusTriggers.length > 0
              ? statusTriggersLabel(agent.statusTriggers)
              : agent.tagTriggers && agent.tagTriggers.length > 0
                ? agent.tagTriggers.map((tag) => `#${tag}`).join(' ')
                : 'No triggers'}
          </span>
        </span>
      </div>
    </button>
  );
}

function triggerTitle(agent: Agent): string {
  const parts = [];
  if (agent.statusTriggers.length > 0) parts.push(`statuses: ${statusTriggersLabel(agent.statusTriggers)}`);
  if (agent.tagTriggers && agent.tagTriggers.length > 0) parts.push(`tags: ${agent.tagTriggers.join(', ')}`);
  return parts.length > 0 ? `Picks up tasks by ${parts.join('; ')}` : 'No triggers';
}

function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="agents-empty">
      <Bot size={36} strokeWidth={1.5} className="agents-empty__icon" aria-hidden />
      <Text size="3" weight="semibold">{title}</Text>
      {detail && <Text size="2" tone="muted">{detail}</Text>}
      {action && (
        <button type="button" className="agents-empty__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
