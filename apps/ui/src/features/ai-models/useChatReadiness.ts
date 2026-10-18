import { useCallback, useEffect, useState } from 'react';
import {
  AiModelSelectionsService,
  AiProvidersService,
  type AiModelSelectionResponseDto,
  type AiProviderResponseDto,
} from '@taico/client';

/** What, if anything, stands between threads and a model that answers. */
export type ChatReadinessKind = 'ready' | 'needs-credentials' | 'needs-model' | 'needs-provider';

export type ChatReadiness = {
  kind: ChatReadinessKind;
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
      kind: 'ready',
      isReady: true,
      title: 'Thread chat is ready',
      description: 'Your conversation tools are online.',
      ctaLabel: 'Open model settings',
    };
  }

  if (conversation?.modelId) {
    return {
      kind: 'needs-credentials',
      isReady: false,
      title: 'Thread chat needs one more step',
      description:
        'A conversation model is picked, but its provider still needs credentials before threads can talk back.',
      ctaLabel: 'Finish provider setup',
    };
  }

  if (providers.some((provider) => provider.isConfigured)) {
    return {
      kind: 'needs-model',
      isReady: false,
      title: 'Your next level is one pick away',
      description:
        'A provider is connected, but no conversation model is picked yet. Choose one in model settings to open the thread portal.',
      ctaLabel: 'Pick a model',
    };
  }

  return {
    kind: 'needs-provider',
    isReady: false,
    title: 'Thread chat is waiting at the gate',
    description:
      'Connect an AI provider and pick a conversation model to unlock new threads and live conversation.',
    ctaLabel: 'Set up chat',
  };
};

/** The provider and model that answer in threads. */
export type ConversationModel = {
  providerName: string;
  modelId: string;
  /** True when each person's own ChatGPT plan answers, not a shared API key. */
  usesChatgptPlan: boolean;
};

const getConversationModel = (
  providers: AiProviderResponseDto[],
  selections: AiModelSelectionResponseDto[],
): ConversationModel | null => {
  const conversation = selections.find((selection) => selection.job === 'conversation');
  const provider = providers.find((p) => p.id === conversation?.effectiveAiProviderId);

  return conversation?.isReady && conversation.effectiveModelId && provider
    ? {
        providerName: provider.name,
        modelId: conversation.effectiveModelId,
        usesChatgptPlan: provider.type === 'chatgpt_subscription',
      }
    : null;
};

export function useChatReadiness() {
  const [readiness, setReadiness] = useState<ChatReadiness | null>(null);
  const [conversationModel, setConversationModel] = useState<ConversationModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const [providers, selections] = await Promise.all([
        AiProvidersService.aiProvidersControllerListAiProviders(),
        AiModelSelectionsService.aiModelSelectionsControllerListAiModelSelections(),
      ]);
      setReadiness(getChatReadiness(providers, selections));
      setConversationModel(getConversationModel(providers, selections));
    } catch {
      setReadiness(null);
      setConversationModel(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    readiness,
    conversationModel,
    isLoading,
    isReady: readiness?.isReady ?? true,
    refresh,
  };
}
