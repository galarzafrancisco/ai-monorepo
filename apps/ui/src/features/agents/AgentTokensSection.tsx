import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, KeyRound, Plus } from 'lucide-react';
import type { ScopeDto } from '@taico/client/v2';
import { Button, Chip, InsetGroup, InsetRow } from '../../ui/primitives';
import { useToast } from '../../shared/context/ToastContext';
import { DEFAULT_AGENT_TOKEN_SCOPES } from '../../shared/const/scopes';
import { AgentTokensService, AuthorizationServerService } from './api';
import { AgentSheet } from './AgentSheet';
import type { AgentToken } from './types';
import {
  formatDate,
  isTokenActive,
  lastUsedLabel,
  tokenState,
  tokenSummary,
  type TokenState,
} from './agentDisplay';
import './AgentTokensSection.css';

/** Rows shown before "Show all" — the list grows with every worker and reissue. */
const VISIBLE_TOKENS = 5;
const EXPIRATION_OPTIONS = [7, 30, 90, 365];
const DEFAULT_EXPIRATION_DAYS = 30;

const STATE_LABELS: Record<TokenState, string> = {
  active: 'Active',
  expiring: 'Expiring soon',
  expired: 'Expired',
  revoked: 'Revoked',
};

type AgentTokensSectionProps = {
  slug: string;
  isDesktop: boolean;
};

export function AgentTokensSection({ slug, isDesktop }: AgentTokensSectionProps) {
  const { showError } = useToast();
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      setTokens(await AgentTokensService.AgentTokensController_listTokens({ slug }));
    } catch (err) {
      console.error('Failed to load tokens:', err);
      showError(err);
    } finally {
      setIsLoading(false);
    }
  }, [slug, showError]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const { active, inactive } = useMemo(() => {
    const newestFirst = [...tokens].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      active: newestFirst.filter(isTokenActive),
      inactive: newestFirst.filter((token) => !isTokenActive(token)),
    };
  }, [tokens]);

  const listed = showInactive ? inactive : active;
  const visible = showAll ? listed : listed.slice(0, VISIBLE_TOKENS);
  const hiddenCount = listed.length - visible.length;
  const selectedToken = tokens.find((token) => token.id === selectedTokenId) ?? null;

  const revoke = async (token: AgentToken): Promise<boolean> => {
    try {
      await AgentTokensService.AgentTokensController_revokeToken({ slug, tokenId: token.id });
      await loadTokens();
      return true;
    } catch (err) {
      console.error('Failed to revoke token:', err);
      showError(err);
      return false;
    }
  };

  const issue = async (body: { name: string; scopes: string[]; expirationDays: number }): Promise<boolean> => {
    try {
      const result = await AgentTokensService.AgentTokensController_issueToken({ slug, body });
      setRevealedToken(result.token);
      await loadTokens();
      return true;
    } catch (err) {
      console.error('Failed to issue token:', err);
      showError(err);
      return false;
    }
  };

  /** A new token with the same name and scopes, for a revoked or expired one. */
  const reissue = (token: AgentToken) =>
    issue({ name: token.name, scopes: token.scopes, expirationDays: DEFAULT_EXPIRATION_DAYS });

  const switchList = (inactiveList: boolean) => {
    setShowInactive(inactiveList);
    setShowAll(false);
  };

  const sheets = (
    <>
      {isCreating && (
        <CreateTokenSheet onClose={() => setIsCreating(false)} onCreate={issue} />
      )}
      {revealedToken && (
        <RevealTokenSheet token={revealedToken} onClose={() => setRevealedToken(null)} />
      )}
      {!isDesktop && selectedToken && (
        <TokenDetailsSheet
          token={selectedToken}
          onClose={() => setSelectedTokenId(null)}
          onRevoke={() => revoke(selectedToken)}
          onReissue={() => reissue(selectedToken)}
        />
      )}
    </>
  );

  if (isDesktop) {
    return (
      <section className="tokens-card">
        <header className="tokens-card__header">
          <div className="tokens-card__heading">
            <h2 className="tokens-card__title">Access tokens</h2>
            <p className="tokens-card__subtitle">Workers use these to act as this agent.</p>
          </div>
          <div className="tokens-card__controls">
            {inactive.length > 0 && (
              <Segmented
                value={showInactive ? 'inactive' : 'active'}
                onChange={(value) => switchList(value === 'inactive')}
                options={[
                  { value: 'active', label: `Active ${active.length}` },
                  { value: 'inactive', label: `Inactive ${inactive.length}` },
                ]}
              />
            )}
            <Button size="sm" variant="secondary" onClick={() => setIsCreating(true)}>
              <Plus size={14} aria-hidden />
              New token
            </Button>
          </div>
        </header>

        {isLoading && tokens.length === 0 ? (
          <p className="tokens-card__empty">Loading tokens…</p>
        ) : listed.length === 0 ? (
          <p className="tokens-card__empty">
            {showInactive ? 'No revoked or expired tokens.' : 'No active tokens. Create one to connect a worker.'}
          </p>
        ) : (
          <div className="tokens-table" role="table" aria-label="Access tokens">
            <div className="tokens-table__head" role="row">
              <span role="columnheader">Name</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">{showInactive ? 'Ended' : 'Expires'}</span>
              <span role="columnheader">Last used</span>
              <span role="columnheader" aria-label="Actions" />
            </div>
            {visible.map((token) => (
              <TokenTableRow
                key={token.id}
                token={token}
                expanded={selectedTokenId === token.id}
                onToggle={() => setSelectedTokenId(selectedTokenId === token.id ? null : token.id)}
                onRevoke={() => revoke(token)}
                onReissue={() => reissue(token)}
              />
            ))}
          </div>
        )}

        {hiddenCount > 0 && (
          <button type="button" className="tokens-card__more" onClick={() => setShowAll(true)}>
            Show {hiddenCount} more
          </button>
        )}
        {sheets}
      </section>
    );
  }

  return (
    <>
      <InsetGroup
        title="Access tokens"
        footer="Workers use these tokens to act as this agent."
        className="tokens-group"
      >
        {isLoading && tokens.length === 0 ? (
          <InsetRow label={<span className="tokens-group__muted">Loading…</span>} />
        ) : (
          visible.map((token) => (
            <InsetRow
              key={token.id}
              leading={<TokenIcon state={tokenState(token)} />}
              label={token.name}
              detail={`${tokenSummary(token)} · ${lastUsedLabel(token)}`}
              onClick={() => setSelectedTokenId(token.id)}
            />
          ))
        )}
        {hiddenCount > 0 && (
          <InsetRow
            tone="accent"
            leading={<span />}
            label={`Show ${hiddenCount} more`}
            onClick={() => setShowAll(true)}
          />
        )}
        {!showInactive && (
          <InsetRow
            tone="accent"
            leading={<Plus size={20} aria-hidden />}
            label="New token"
            onClick={() => setIsCreating(true)}
          />
        )}
      </InsetGroup>

      {inactive.length > 0 && (
        <InsetGroup className="tokens-group">
          <InsetRow
            label={showInactive ? 'Show active tokens' : 'Revoked & expired'}
            value={showInactive ? active.length : inactive.length}
            onClick={() => switchList(!showInactive)}
          />
        </InsetGroup>
      )}
      {sheets}
    </>
  );
}

function TokenIcon({ state }: { state: TokenState }) {
  return (
    <span className={`token-icon token-icon--${state}`}>
      <KeyRound size={15} strokeWidth={2.2} aria-hidden />
    </span>
  );
}

function StatusPill({ state }: { state: TokenState }) {
  return (
    <span className={`token-status token-status--${state}`}>
      <span className="token-status__dot" aria-hidden />
      {STATE_LABELS[state]}
    </span>
  );
}

function TokenTableRow({
  token,
  expanded,
  onToggle,
  onRevoke,
  onReissue,
}: {
  token: AgentToken;
  expanded: boolean;
  onToggle: () => void;
  onRevoke: () => Promise<boolean>;
  onReissue: () => Promise<boolean>;
}) {
  const state = tokenState(token);
  const active = state === 'active' || state === 'expiring';
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Drop the "Confirm?" state if the user doesn't follow through
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    await action();
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div className={`tokens-table__item ${expanded ? 'tokens-table__item--expanded' : ''}`} role="rowgroup">
      <div className="tokens-table__row" role="row" onClick={onToggle}>
        <span className="tokens-table__name" role="cell">
          <ChevronDown size={14} className="tokens-table__chevron" aria-hidden />
          <span>{token.name}</span>
        </span>
        <span role="cell"><StatusPill state={state} /></span>
        <span role="cell" className="tokens-table__muted" title={formatDate(String(token.revokedAt ?? token.expiresAt))}>
          {tokenSummary(token).replace(/^(Expires|Expired|Revoked) /, '')}
        </span>
        <span role="cell" className="tokens-table__muted">
          {token.lastUsedAt ? lastUsedLabel(token).replace(/^Used /, '') : '—'}
        </span>
        <span role="cell" className="tokens-table__actions" onClick={(event) => event.stopPropagation()}>
          {active ? (
            <button
              type="button"
              className={`tokens-table__action tokens-table__action--danger ${confirming ? 'is-confirming' : ''}`}
              disabled={busy}
              onClick={() => (confirming ? run(onRevoke) : setConfirming(true))}
            >
              {confirming ? 'Confirm revoke' : 'Revoke'}
            </button>
          ) : (
            <button type="button" className="tokens-table__action" disabled={busy} onClick={() => run(onReissue)}>
              Reissue
            </button>
          )}
        </span>
      </div>
      {expanded && (
        <dl className="tokens-table__details">
          <div>
            <dt>Created</dt>
            <dd>{formatDate(token.createdAt)} by {token.issuedByDisplayName}</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{formatDate(token.expiresAt)}</dd>
          </div>
          {token.revokedAt && (
            <div>
              <dt>Revoked</dt>
              <dd>{formatDate(String(token.revokedAt))}</dd>
            </div>
          )}
          <div className="tokens-table__scopes">
            <dt>Scopes</dt>
            <dd>
              {token.scopes.map((scope) => <Chip key={scope} color="gray">{scope}</Chip>)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function TokenDetailsSheet({
  token,
  onClose,
  onRevoke,
  onReissue,
}: {
  token: AgentToken;
  onClose: () => void;
  onRevoke: () => Promise<boolean>;
  onReissue: () => Promise<boolean>;
}) {
  const state = tokenState(token);
  const active = state === 'active' || state === 'expiring';
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <AgentSheet title={token.name} onClose={onClose}>
      <InsetGroup>
        <InsetRow label="Status" value={<StatusPill state={state} />} />
        <InsetRow label="Created" value={formatDate(token.createdAt)} />
        <InsetRow label="Issued by" value={token.issuedByDisplayName} />
        <InsetRow label={token.revokedAt ? 'Revoked' : 'Expires'} value={formatDate(String(token.revokedAt ?? token.expiresAt))} />
        <InsetRow label="Last used" value={token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Never'} />
      </InsetGroup>

      <InsetGroup title={`Scopes · ${token.scopes.length}`}>
        <InsetRow>
          <span className="tokens-group__scopes">
            {token.scopes.map((scope) => <Chip key={scope} color="gray">{scope}</Chip>)}
          </span>
        </InsetRow>
      </InsetGroup>

      <InsetGroup
        footer={active
          ? 'Workers using this token stop working immediately.'
          : 'Creates a new token with the same name and scopes, valid for 30 days.'}
      >
        {active ? (
          <InsetRow
            tone="danger"
            centered
            disabled={busy}
            label={confirming ? 'Tap again to revoke' : 'Revoke token'}
            onClick={() => (confirming ? run(onRevoke) : setConfirming(true))}
          />
        ) : (
          <InsetRow tone="accent" centered disabled={busy} label="Reissue token" onClick={() => run(onReissue)} />
        )}
      </InsetGroup>
    </AgentSheet>
  );
}

function CreateTokenSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (body: { name: string; scopes: string[]; expirationDays: number }) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [expirationDays, setExpirationDays] = useState(DEFAULT_EXPIRATION_DAYS);
  const [customScopes, setCustomScopes] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(DEFAULT_AGENT_TOKEN_SCOPES));
  const [availableScopes, setAvailableScopes] = useState<ScopeDto[]>([]);

  useEffect(() => {
    if (!customScopes || availableScopes.length > 0) return;
    AuthorizationServerService.AuthorizationController_getScopes({})
      .then((response) => setAvailableScopes(response.scopes))
      .catch((err) => console.error('Failed to load scopes:', err));
  }, [customScopes, availableScopes.length]);

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scopeId)) next.delete(scopeId);
      else next.add(scopeId);
      return next;
    });
  };

  const scopes = customScopes ? Array.from(selectedScopes) : [...DEFAULT_AGENT_TOKEN_SCOPES];
  const canCreate = name.trim().length > 0 && scopes.length > 0;

  return (
    <AgentSheet
      title="New Token"
      onClose={onClose}
      primary={{
        label: 'Create',
        disabled: !canCreate,
        onClick: () => onCreate({ name: name.trim(), scopes, expirationDays }),
      }}
    >
      <InsetGroup title="Name" footer="Where this token will be used, e.g. the machine running the worker.">
        <input
          className="agent-sheet__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Office Mac mini"
          autoFocus
        />
      </InsetGroup>

      <InsetGroup title="Expires after">
        <div className="tokens-group__segmented">
          <Segmented
            value={String(expirationDays)}
            onChange={(value) => setExpirationDays(Number(value))}
            options={EXPIRATION_OPTIONS.map((days) => ({
              value: String(days),
              label: days === 365 ? '1 year' : `${days} days`,
            }))}
          />
        </div>
      </InsetGroup>

      <InsetGroup
        title="Permissions"
        footer={customScopes
          ? `${selectedScopes.size} of ${availableScopes.length || '…'} scopes selected.`
          : `The ${DEFAULT_AGENT_TOKEN_SCOPES.length} scopes a worker needs to run this agent.`}
      >
        <InsetRow
          label="Worker defaults"
          detail="Recommended"
          value={!customScopes ? <Check size={18} className="agent-sheet__check" /> : ''}
          onClick={() => setCustomScopes(false)}
          chevron={false}
        />
        <InsetRow
          label="Custom"
          detail="Pick scopes one by one"
          value={customScopes ? <Check size={18} className="agent-sheet__check" /> : ''}
          onClick={() => setCustomScopes(true)}
          chevron={false}
        />
      </InsetGroup>

      {customScopes && (
        <InsetGroup title="Scopes" className="agent-sheet__scopes-group">
          <div className="agent-sheet__scopes">
            {availableScopes.map((scope) => (
              <InsetRow
                key={scope.id}
                label={<span className="agent-sheet__scope-id">{scope.id}</span>}
                detail={scope.description}
                value={selectedScopes.has(scope.id) ? <Check size={18} className="agent-sheet__check" /> : ''}
                onClick={() => toggleScope(scope.id)}
                chevron={false}
              />
            ))}
          </div>
        </InsetGroup>
      )}
    </AgentSheet>
  );
}

function RevealTokenSheet({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  return (
    <AgentSheet title="Token Created" onClose={onClose}>
      <div className="agent-sheet__notice">
        <AlertTriangle size={16} aria-hidden />
        <span>Copy this token now. You won't be able to see it again.</span>
      </div>
      <InsetGroup>
        <pre className="agent-sheet__token">{token}</pre>
        <InsetRow
          tone="accent"
          centered
          leading={copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          label={copied ? 'Copied' : 'Copy token'}
          onClick={copy}
        />
      </InsetGroup>
    </AgentSheet>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="agent-segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`agent-segmented__item ${value === option.value ? 'agent-segmented__item--active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
