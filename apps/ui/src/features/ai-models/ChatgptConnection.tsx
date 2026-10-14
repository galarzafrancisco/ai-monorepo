import { useCallback, useEffect, useState } from 'react';
import { AiProviderConnectionsService, type AiProviderConnectionResponseDto } from '@taico/client';
import { Button, Row, Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import './ChatgptConnection.css';

const errorDetail = (err: unknown, fallback: string): string =>
  (err as { body?: { detail?: string } })?.body?.detail || fallback;

const USAGE_LIMIT_CODE = 'subscription_sharing_usage_limit_exceeded';

type Props = {
  providerId: string;
  /** False when the server has Sign in with ChatGPT turned off. */
  isEnabled: boolean;
  /** Called when the connection changed, so the model list can be reloaded. */
  onChanged: () => void;
};

/**
 * The signed-in person's own ChatGPT connection: sign in, see which account is
 * connected, choose whether task updates may use the plan, and disconnect.
 */
export function ChatgptConnection({ providerId, isEnabled, onChanged }: Props) {
  const [connection, setConnection] = useState<AiProviderConnectionResponseDto | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);
  const [pastedAddress, setPastedAddress] = useState('');

  const load = useCallback(async () => {
    try {
      setConnection(
        await AiProviderConnectionsService.aiProviderConnectionsControllerGetConnection(providerId),
      );
    } catch (err) {
      setError(errorDetail(err, 'Could not load your ChatGPT connection.'));
    }
  }, [providerId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one action with the buttons disabled and any failure shown in place. */
  const run = async (action: () => Promise<void>, fallback: string) => {
    setError('');
    setNotice('');
    setIsBusy(true);
    try {
      await action();
    } catch (err) {
      setError(errorDetail(err, fallback));
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * Opens OpenAI in a new tab and keeps this page open, because the sign-in is
   * finished here: OpenAI's redirect goes to 127.0.0.1, which nothing answers,
   * and the person pastes that address below.
   */
  const signIn = () => {
    // Opened before the request so the browser treats it as part of the click.
    const tab = window.open('', '_blank');
    return run(async () => {
      try {
        const { authorizationUrl } =
          await AiProviderConnectionsService.aiProviderConnectionsControllerStartAuthorization(
            providerId,
          );
        if (tab) {
          tab.opener = null;
          tab.location.href = authorizationUrl;
        } else {
          // Pop-ups blocked: go there in this tab and paste the address when back.
          window.location.assign(authorizationUrl);
        }
      } catch (err) {
        tab?.close();
        throw err;
      }
      setPastedAddress('');
      await load();
    }, 'Could not start signing in to ChatGPT.');
  };

  const finishWithPastedAddress = () =>
    run(async () => {
      setConnection(
        await AiProviderConnectionsService.aiProviderConnectionsControllerCompleteAuthorization(
          providerId,
          { callbackUrl: pastedAddress.trim() },
        ),
      );
      setPastedAddress('');
      setNotice("You're using your ChatGPT plan.");
      onChanged();
    }, 'Could not finish signing in.').then(load);

  const setAutomatedTurns = (allowed: boolean) =>
    run(async () => {
      setConnection(
        await AiProviderConnectionsService.aiProviderConnectionsControllerUpdateConnection(
          providerId,
          { automatedTurnsAllowed: allowed },
        ),
      );
    }, 'Could not save this setting.');

  const disconnect = () =>
    run(async () => {
      const { revokedAtProvider } =
        await AiProviderConnectionsService.aiProviderConnectionsControllerDisconnect(providerId);
      setIsConfirmingDisconnect(false);
      setNotice(
        revokedAtProvider
          ? 'Disconnected. Taico no longer has access to your ChatGPT plan.'
          : 'Disconnected here, but OpenAI could not be told. To be sure, remove Taico from the connected apps in your ChatGPT settings.',
      );
      await load();
      onChanged();
    }, 'Could not disconnect.');

  if (!isEnabled) {
    return (
      <Text size="1" tone="muted" className="chatgpt-connection">
        Sign in with ChatGPT is turned off on this server. It is only for a Taico you run yourself:
        the server operator can turn it on with CHATGPT_SUBSCRIPTION_ENABLED=true.
      </Text>
    );
  }

  if (!connection) {
    return error ? (
      <ErrorText size="2" weight="medium">
        {error}
      </ErrorText>
    ) : null;
  }

  const { status } = connection;
  const isConnected = status === 'connected';
  const hasAccount = status !== 'disconnected';
  const hitUsageLimit = isConnected && connection.lastErrorCode === USAGE_LIMIT_CODE;


  const manageUsage = (
    <a
      className={`chatgpt-connection__link${hitUsageLimit ? ' chatgpt-connection__link--primary' : ''}`}
      href={connection.manageUsageUrl}
      target="_blank"
      rel="noreferrer"
    >
      Manage usage
    </a>
  );

  return (
    <Stack spacing="3" className="chatgpt-connection">
      {notice ? (
        <div role="status">
          <Text size="2" weight="medium" className="chatgpt-connection__notice">
            {notice}
          </Text>
        </div>
      ) : null}

      {isConnected ? (
        <Stack spacing="1">
          <Row spacing="2" align="center" className="chatgpt-connection__line">
            <span className="chatgpt-connection__badge">Using ChatGPT plan</span>
            <Text size="2">
              {connection.accountEmail ? `Connected as ${connection.accountEmail}` : 'Connected'}
            </Text>
            {manageUsage}
          </Row>
          <Text size="1" tone="muted">
            Your plan answers only the messages you write in threads. Other people connect their
            own account. Taico never falls back to a paid API key.
          </Text>
          {hitUsageLimit ? (
            <Text size="2" className="chatgpt-connection__warning">
              You have reached the usage limit of your ChatGPT plan. Threads will not answer you
              until it resets.
            </Text>
          ) : null}
        </Stack>
      ) : (
        <Text size="2">
          {status === 'needs_reauthorization'
            ? 'Your ChatGPT sign-in expired or was removed. Sign in again to keep using your plan in threads.'
            : status === 'plan_access_not_granted'
              ? `You signed in${connection.accountEmail ? ` as ${connection.accountEmail}` : ''}, but did not allow use of your ChatGPT plan. Sign in again and allow it.`
              : 'Not connected. Sign in with your own ChatGPT account and your plan answers the messages you write in threads. Nobody else can use it.'}
        </Text>
      )}

      {isConnected ? (
        <label className="chatgpt-connection__consent">
          <input
            type="checkbox"
            checked={connection.automatedTurnsAllowed}
            disabled={isBusy}
            onChange={(e) => void setAutomatedTurns(e.target.checked)}
          />
          <span>
            <Text size="2">Also answer task updates on my plan</Text>
            <Text size="1" tone="muted">
              When a task a thread is waiting for changes, the agent replies without anyone typing.
              Leave this off and those replies are skipped with a note in the thread. If the middle
              manager runs on this plan, it also keeps the shared notes of the threads you created
              up to date as their tasks change.
            </Text>
          </span>
        </label>
      ) : null}

      {isConfirmingDisconnect ? (
        <Row spacing="2" align="center" className="chatgpt-connection__line">
          <Text size="2">Disconnect and revoke Taico's access to your ChatGPT plan?</Text>
          <Button variant="danger" size="sm" disabled={isBusy} onClick={() => void disconnect()}>
            Disconnect
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsConfirmingDisconnect(false)}>
            Cancel
          </Button>
        </Row>
      ) : (
        <Row spacing="2" align="center" className="chatgpt-connection__line">
          <Button
            variant={isConnected ? 'secondary' : 'primary'}
            size="sm"
            disabled={isBusy}
            onClick={() => void signIn()}
          >
            {isConnected ? 'Reconnect' : 'Continue with ChatGPT'}
          </Button>
          {hasAccount ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => setIsConfirmingDisconnect(true)}
            >
              Disconnect
            </Button>
          ) : null}
        </Row>
      )}

      {connection.isAuthorizationPending ? (
        <Stack spacing="2" className="chatgpt-connection__paste">
          <Text size="2" weight="medium">
            Finish signing in
          </Text>
          <ol className="chatgpt-connection__steps">
            <li>
              <Text size="1" tone="muted">
                Approve Taico at OpenAI in the tab that opened.
              </Text>
            </li>
            <li>
              <Text size="1" tone="muted">
                That tab then shows a page that cannot be reached, at an address starting with
                http://127.0.0.1. This is expected: nothing runs there.
              </Text>
            </li>
            <li>
              <Text size="1" tone="muted">
                Copy the whole address from that tab's address bar, paste it here and click
                Finish. It works once, for you only, within 10 minutes.
              </Text>
            </li>
          </ol>
          <Row spacing="2" align="center">
            <input
              type="text"
              value={pastedAddress}
              onChange={(e) => setPastedAddress(e.target.value)}
              className="settings-models__control"
              placeholder="http://127.0.0.1:…/auth/callback?code=…"
              aria-label="Address you were sent to after signing in"
              spellCheck={false}
              autoComplete="off"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy || !pastedAddress.trim()}
              onClick={() => void finishWithPastedAddress()}
            >
              Finish
            </Button>
          </Row>
        </Stack>
      ) : null}

      {error ? (
        <ErrorText size="2" weight="medium">
          {error}
        </ErrorText>
      ) : null}
    </Stack>
  );
}
