export enum AiProviderConnectionStatus {
  /** Tokens are stored and the plan can be used. */
  CONNECTED = 'connected',
  /** The account is known but did not grant use of its plan. No requests are made. */
  PLAN_ACCESS_NOT_GRANTED = 'plan_access_not_granted',
  /** The provider rejected the stored grant. Tokens are cleared; the person must sign in again. */
  NEEDS_REAUTHORIZATION = 'needs_reauthorization',
  DISCONNECTED = 'disconnected',
}
