/*
Starts during client registration.
 - "I am this client, I want to connect to that server."
*/
export type CreateAuthJourneyInput = {
  mcpClientId: string;
  mcpServerId: string;
};
