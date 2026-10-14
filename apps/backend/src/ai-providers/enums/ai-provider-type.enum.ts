export enum AiProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  GOOGLE_VERTEX = 'google_vertex',
  XAI = 'xai',
  OPENAI_COMPATIBLE = 'openai_compatible',
  /** Sign in with ChatGPT: each person's own ChatGPT plan, not an API key. */
  CHATGPT_SUBSCRIPTION = 'chatgpt_subscription',
}

/**
 * Provider types that hold no shared credentials. Each person connects their
 * own account, and a request runs on the plan of the person it is for. They
 * only answer in threads; see AiModelSelectionsService and ChatModelFactory.
 */
export const USER_CONNECTED_PROVIDER_TYPES: readonly AiProviderType[] = [
  AiProviderType.CHATGPT_SUBSCRIPTION,
];

export function isUserConnectedProviderType(type: AiProviderType): boolean {
  return USER_CONNECTED_PROVIDER_TYPES.includes(type);
}
