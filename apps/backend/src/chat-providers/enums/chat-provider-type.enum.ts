export enum ChatProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  GOOGLE_VERTEX = 'google_vertex',
  OPENAI_COMPATIBLE = 'openai_compatible',
  /** Legacy Google provider configured only through environment variables. */
  ADK = 'adk',
}
