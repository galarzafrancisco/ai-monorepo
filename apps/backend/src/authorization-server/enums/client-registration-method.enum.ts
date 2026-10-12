/**
 * How the authorization server came to know an OAuth client.
 */
export enum ClientRegistrationMethod {
  /** The client called the registration endpoint (RFC 7591) and was issued a client_id */
  DYNAMIC_REGISTRATION = 'dynamic_registration',
  /** The client_id is a URL to a Client ID Metadata Document the client hosts */
  METADATA_DOCUMENT = 'metadata_document',
}
