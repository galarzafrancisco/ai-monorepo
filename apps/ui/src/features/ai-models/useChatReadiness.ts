import { useCallback, useEffect, useState } from 'react';
import {
  AiModelSelectionsService,
  AiProvidersService,
  type AiModelSelectionResponseDto,
  type AiProviderResponseDto,
} from '@taico/client';

export type ChatReadiness = {
  isReady: boolean;
  title: string;
  description: string;
  ctaLabel: string;
};

const getChatReadiness = (
  providers: AiProviderResponseDto[],
  selections: AiModelSelectionResponseDto[],
): ChatReadiness => {
  const conversation = selections.find((selection) => selection.job === 'conversation');

  if (conversation?.isReady) {
    return {
      isReady: true,
      title: 'Thread chat is ready',
      description: 'Your conversation tools are online.',
      ctaLabel: 'Open model settings',
    };
  }

  if (conversation?.modelId) {
    return {
      isReady: false,
      title: 'Thread chat needs one more step',
      description:
        'A conversation model is picked, but its provider still needs credentials before threads can talk back.',
      ctaLabel: 'Finish provider setup',
    };
  }

  if (providers.some((provider) => provider.isConfigured)) {
    return {
      isReady: false,
      title: 'Your next level is one pick away',
      description:
        'A provider is connected, but no conversation model is picked yet. Choose one in model settings to open the thread portal.',
      ctaLabel: 'Pick a model',
    };
  }

  return {
    isReady: false,
    title: 'Thread chat is waiting at the gate',
    description:
      'Connect an AI provider and pick a conversation model to unlock new threads and live conversation.',
    ctaLabel: 'Set up chat',
  };
};

export function useChatReadiness() {
  const [readiness, setReadiness] = useState<ChatReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const [providers, selections] = await Promise.all([
        AiProvidersService.aiProvidersControllerListAiProviders(),
        AiModelSelectionsService.aiModelSelectionsControllerListAiModelSelections(),
      ]);
      setReadiness(getChatReadiness(providers, selections));
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
