import { useCallback, useEffect, useState } from 'react';
import { ChatProvidersService, type ChatProviderResponseDto } from '@taico/client';

export type ChatReadiness = {
  isReady: boolean;
  title: string;
  description: string;
  ctaLabel: string;
};

const getChatReadiness = (
  providers: ChatProviderResponseDto[],
): ChatReadiness => {
  const hasActiveConfiguredProvider = providers.some(
    (provider) => provider.isActive && provider.isConfigured,
  );

  if (hasActiveConfiguredProvider) {
    return {
      isReady: true,
      title: 'Thread chat is ready',
      description: 'Your conversation tools are online.',
      ctaLabel: 'Open chat settings',
    };
  }

  if (providers.length === 0) {
    return {
      isReady: false,
      title: 'Thread chat is waiting at the gate',
      description:
        'Connect your first chat provider in settings to unlock new threads and live conversation.',
      ctaLabel: 'Set up chat',
    };
  }

  const hasConfiguredProvider = providers.some((provider) => provider.isConfigured);

  if (hasConfiguredProvider) {
    return {
      isReady: false,
      title: 'Your next level is one switch away',
      description:
        'A provider is configured, but none is active yet. Pick one in chat settings to open the thread portal.',
      ctaLabel: 'Choose active provider',
    };
  }

  return {
    isReady: false,
    title: 'Thread chat needs one more step',
    description:
      'A provider exists, but it still needs credentials before threads can talk back.',
    ctaLabel: 'Finish chat setup',
  };
};

export function useChatReadiness() {
  const [readiness, setReadiness] = useState<ChatReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const providers = await ChatProvidersService.chatProvidersControllerListChatProviders();
      setReadiness(getChatReadiness(providers));
    } catch {
      setReadiness(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    readiness,
    isLoading,
    isReady: readiness?.isReady ?? true,
    refresh,
  };
}
