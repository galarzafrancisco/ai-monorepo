import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AiProviderConnectionsService, AiProvidersService } from '@taico/client';
import { Stack, Text } from '../../ui/primitives';
import { ErrorText } from '../../ui/primitives/ErrorText';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useHomeCtx } from './HomeProvider';
import './SettingsPage.css';

const errorDetail = (err: unknown, fallback: string): string =>
  (err as { body?: { detail?: string } })?.body?.detail || fallback;

/**
 * Where the browser lands after signing in at OpenAI. Hands what OpenAI sent
 * to the API as the signed-in Taico user, then returns to model settings.
 */
export function ChatgptCallbackPage() {
  const { setSectionTitle } = useHomeCtx();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  // The callback works once, so it must not be posted twice by a re-run effect.
  const started = useRef(false);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle('AI models');
    if (started.current) {
      return;
    }
    started.current = true;

    const query = new URLSearchParams(window.location.search);
    // The code is single use; still, it has no business staying in the address bar or history.
    window.history.replaceState(null, '', window.location.pathname);

    const finish = async () => {
      const state = query.get('state');
      if (!state) {
        setError('This address is missing what OpenAI sends back. Start again from model settings.');
        return;
      }

      try {
        const providers = await AiProvidersService.aiProvidersControllerListAiProviders();
        const provider = providers.find((p) => p.type === 'chatgpt_subscription');
        if (!provider) {
          setError('There is no ChatGPT plan provider to connect to any more.');
          return;
        }

        await AiProviderConnectionsService.aiProviderConnectionsControllerCompleteAuthorization(
          provider.id,
          {
            state,
            code: query.get('code') ?? undefined,
            clientId: query.get('client_id') ?? undefined,
            error: query.get('error') ?? undefined,
            errorDescription: query.get('error_description') ?? undefined,
          },
        );
        navigate('/settings/models', { replace: true, state: { chatgptConnected: true } });
      } catch (err) {
        setError(errorDetail(err, 'Could not finish signing in to ChatGPT.'));
      }
    };

    void finish();
  }, [navigate, setSectionTitle]);

  return (
    <Stack spacing="4" className="settings-subpage">
      {error ? (
        <>
          <ErrorText size="2" weight="medium">
            {error}
          </ErrorText>
          <Text size="2">
            <Link to="/settings/models" replace>
              Back to AI models
            </Link>
          </Text>
        </>
      ) : (
        <Text>Finishing your ChatGPT sign-in…</Text>
      )}
    </Stack>
  );
}
