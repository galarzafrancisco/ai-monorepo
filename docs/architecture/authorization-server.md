# Authorization Server Architecture

## Overview

This document outlines the architecture of the OAuth 2.0 Authorization Server that acts as a bridge between MCP (Model Context Protocol) clients and downstream resource providers. The authorization server sits at the intersection of two distinct OAuth flows: authenticating MCP clients and delegating authorization to downstream systems like Google, GitHub, etc.

## Review Date

November 11, 2025

## Purpose

The authorization server enables MCP clients to access resources from downstream providers through a unified authorization mechanism. It:

1. Issues JWTs to MCP clients following OAuth 2.0 + PKCE
2. Obtains and manages access/refresh tokens from downstream providers
3. Maps MCP server scopes to downstream provider scopes
4. Tracks multi-stage authorization flows through persistent state
5. Provides token introspection and JWKS endpoints for verification

## Key Components

### Controllers

#### 1. AuthorizationController
**Location**: `/apps/backend/src/authorization-server/authorization.controller.ts`

**OAuth 2.0 Authorization Flow Endpoints**:
- `GET /auth/authorize/mcp/:serverIdentifier/:version` - Authorization request entry point
- `POST /auth/authorize/mcp/:serverIdentifier/:version` - Consent decision handler
- `GET /auth/flow/:flowId` - Flow details for consent UI
- `POST /auth/token/mcp/:serverIdentifier/:version` - Token exchange endpoint
- `POST /auth/introspect/mcp/:serverIdentifier/:version` - Token introspection (RFC 7662)
- `GET /auth/callback` - Downstream OAuth callback handler

**Responsibilities**:
- Routes authorization requests to appropriate service methods
- Validates OAuth parameters (client_id, redirect_uri, scope, etc.)
- Generates and validates authorization codes
- Coordinates consent flow with user interface
- Handles downstream provider callbacks

#### 2. ClientRegistrationController
**Location**: `/apps/backend/src/authorization-server/client-registration.controller.ts`

**Dynamic Client Registration Endpoints**:
- `POST /register/mcp/:serverIdentifier/:version` - Register new MCP client

**Responsibilities**:
- Implements OAuth 2.0 Dynamic Client Registration Protocol
- Generates client credentials (client_id, client_secret)
- Initializes authorization journey for registered clients

#### 3. JwksController
**Location**: `/apps/backend/src/authorization-server/jwks.controller.ts`

**JWKS Endpoints**:
- `GET /auth/.well-known/jwks.json` - Public key set for JWT verification

**Responsibilities**:
- Exposes public keys in JWK format
- Enables JWT signature verification by MCP servers

### Services

#### 1. AuthorizationService
**Location**: `/apps/backend/src/authorization-server/authorization.service.ts`

**Core Authorization Orchestration**:

**Responsibilities**:
- Processes authorization requests and stores PKCE parameters
- Handles user consent decisions
- Orchestrates downstream OAuth flows sequentially
- Manages authorization code lifecycle
- Maps MCP scopes to downstream provider scopes
- Generates final authorization codes for MCP clients

**Key Methods**:
- `processAuthorizationRequest()` - Validates request, stores PKCE challenge, returns flow ID
- `processConsentDecision()` - Handles user approval/denial
- `processNextDownstreamFlow()` - Iterates through downstream providers sequentially
- `initiateConnectionOAuth()` - Builds downstream authorization URL with scope mapping
- `handleDownstreamCallback()` - Exchanges downstream code for tokens
- `completeMcpAuthFlow()` - Generates authorization code for MCP client

**Critical Flow Logic**:
- Ensures only one downstream flow is active at a time
- Stores code_challenge and code_challenge_method for PKCE validation
- Links MCP scopes to multiple downstream provider scopes via scope_mappings table

#### 2. TokenService
**Location**: `/apps/backend/src/authorization-server/token.service.ts`

**JWT Issuance and Validation**:

**Responsibilities**:
- Exchanges authorization codes for JWTs
- Validates PKCE code_verifier against stored code_challenge
- Signs JWTs with RSA private keys
- Introspects tokens per RFC 7662
- Manages token expiration (1 hour access tokens)

**Key Methods**:
- `exchangeAuthorizationCode()` - Validates code and PKCE, issues JWT
- `generateAccessToken()` - Creates signed JWT with claims
- `introspectToken()` - Returns token metadata and validity status
- `validatePkce()` - Verifies code_verifier matches code_challenge (S256 or plain)

**JWT Claims Structure**:
```json
{
  "iss": "authorization-server-url",
  "sub": "user-id",
  "aud": "mcp-server-id",
  "client_id": "mcp-client-id",
  "scope": "read:tasks write:tasks",
  "server_identifier": "taskeroo",
  "resource": "downstream-resource-url",
  "version": "1.0",
  "exp": 1234567890,
  "iat": 1234567890,
  "jti": "unique-token-id"
}
```

#### 3. JwksService
**Location**: `/apps/backend/src/authorization-server/jwks.service.ts`

**Cryptographic Key Management**:

**Responsibilities**:
- Generates RSA key pairs (2048-bit)
- Manages key lifecycle with TTL-based rotation
- Computes key IDs (kid) from public key thumbprint
- Exports public keys in JWK format for JWKS endpoint

**Key Methods**:
- `getActiveSigningKey()` - Returns current active key for signing
- `getJwks()` - Exports all active keys as JWKS
- `rotateKeys()` - Creates new key pair, deactivates old ones
- `initializeKeys()` - Generates initial key pair on startup

**Key Rotation Strategy**:
- TTL: 24 hours (default)
- Grace period: Old keys kept active for ongoing verifications
- Automatic rotation on expiration

#### 4. ClientRegistrationService
**Location**: `/apps/backend/src/authorization-server/client-registration.service.ts`

**Dynamic Client Registration**:

**Responsibilities**:
- Validates MCP client registration requirements
- Generates client credentials
- Creates RegisteredClientEntity with OAuth metadata
- Initializes AuthorizationJourney for new clients

**Key Methods**:
- `registerClient()` - Validates and creates new client
- `validateRegistrationRequest()` - Ensures required OAuth parameters
- `generateClientCredentials()` - Creates client_id and hashes client_secret

#### 5. AuthJourneysService
**Location**: `/apps/backend/src/auth-journeys/auth-journeys.service.ts`

**Authorization Flow State Management**:

**Responsibilities**:
- Creates and tracks authorization journeys
- Links MCP authorization flows with downstream connection flows
- Provides queries for flow retrieval and status updates
- Manages journey lifecycle across multiple stages

**Key Methods**:
- `createJourneyForMcpRegistration()` - Initializes journey with MCP + connection flows
- `findJourneyByFlowId()` - Retrieves journey for consent UI
- `findMcpFlowByAuthCode()` - Looks up flow for token exchange
- `updateMcpFlowStatus()` - Transitions flow through authorization stages

## Database Schema

### Authorization Flow Tables

#### 1. authorization_journeys (AuthJourneyEntity)
**Purpose**: Parent container for entire multi-stage authorization process

**Schema**:
```typescript
{
  id: uuid (PK),
  status: enum (NOT_STARTED, MCP_AUTH_FLOW_STARTED, MCP_AUTH_FLOW_COMPLETED, ...),
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp (soft delete)
}
```

**Relationships**:
- Has one `mcp_authorization_flows` (1:1)
- Has many `connection_authorization_flows` (1:N)

**Status Enum Values**:
- `NOT_STARTED` - Journey created but not initiated
- `MCP_AUTH_FLOW_STARTED` - MCP client authorization in progress
- `MCP_AUTH_FLOW_COMPLETED` - MCP auth done, downstream flows may follow
- `DOWNSTREAM_FLOWS_COMPLETED` - All downstream auths complete
- `FAILED` - Journey failed at some stage

#### 2. mcp_authorization_flows (McpAuthorizationFlowEntity)
**Purpose**: Tracks OAuth 2.0 + PKCE flow between MCP client and authorization server

**Schema**:
```typescript
{
  id: uuid (PK),
  authorization_journey_id: uuid (FK → authorization_journeys.id),
  server_id: uuid (FK → mcp_servers.id),
  client_id: uuid (FK → registered_clients.id),

  // OAuth Parameters
  state: string,                    // Client-provided CSRF token
  redirect_uri: string,             // Where to send authorization code
  scope: string,                    // Space-separated requested scopes
  resource: string,                 // Optional resource indicator

  // PKCE Parameters
  code_challenge: string,           // Base64-URL encoded challenge
  code_challenge_method: enum,      // 'S256' or 'plain'

  // Authorization Code
  authorization_code: string,       // Generated by server
  authorization_code_expires_at: timestamp,
  authorization_code_used: boolean, // Prevents replay attacks

  // Flow Status
  status: enum,                     // Tracks current stage
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Status Enum Values**:
- `CLIENT_REGISTERED` - Initial state after registration
- `AUTHORIZATION_REQUEST_STARTED` - Request received, PKCE stored
- `USER_CONSENT_OK` - User approved authorization
- `USER_CONSENT_REJECTED` - User denied authorization
- `AUTHORIZATION_CODE_ISSUED` - Code generated and sent to client
- `TOKEN_ISSUED` - JWT issued after code exchange

**PKCE Security**:
- `code_challenge_method='S256'`: SHA-256 hash of code_verifier
- `code_challenge_method='plain'`: Direct comparison (less secure, allowed for compatibility)

#### 3. connection_authorization_flows (ConnectionAuthorizationFlowEntity)
**Purpose**: Tracks OAuth flow with each downstream provider (Google, GitHub, etc.)

**Schema**:
```typescript
{
  id: uuid (PK),
  authorization_journey_id: uuid (FK → authorization_journeys.id),
  mcp_connection_id: uuid (FK → mcp_connections.id),

  // OAuth State
  state: string,                    // Generated by server for CSRF protection
  authorization_code: string,       // Code from downstream provider

  // Downstream Tokens
  access_token: string,             // Encrypted in production
  refresh_token: string,            // Encrypted in production
  token_expires_at: timestamp,

  // Flow Status
  status: enum,                     // 'pending', 'authorized', 'failed'
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Token Storage**:
- `access_token` and `refresh_token` are stored encrypted
- Supports token refresh via downstream provider's token endpoint
- Multiple connections per journey (one per downstream provider)

#### 4. registered_clients (RegisteredClientEntity)
**Purpose**: Stores registered MCP clients and their OAuth metadata

**Schema**:
```typescript
{
  id: uuid (PK),
  client_id: string (unique),       // OAuth 2.0 client identifier
  client_secret: string,            // Hashed (bcrypt)
  client_name: string,

  // OAuth Metadata
  redirect_uris: string[],          // Allowed redirect URIs
  grant_types: string[],            // ['authorization_code', 'refresh_token']
  token_endpoint_auth_method: string, // 'client_secret_post'
  scopes: string[],                 // Allowed scopes for this client

  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Security**:
- `client_secret` is hashed with bcrypt before storage
- `redirect_uris` validated on every authorization request
- `scopes` limits what client can request

#### 5. jwks_keys (JwksKeyEntity)
**Purpose**: Stores RSA key pairs for JWT signing and verification

**Schema**:
```typescript
{
  id: uuid (PK),
  kid: string (unique),             // Key ID (computed from public key thumbprint)
  algorithm: string,                // 'RS256'
  public_key_pem: string,           // PEM-encoded public key
  private_key_pem: string,          // PEM-encoded private key (encrypted at rest)
  is_active: boolean,               // Only active keys used for signing
  expires_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Key Management**:
- Multiple keys can be active simultaneously during rotation
- Old keys kept for verification of existing JWTs
- Private key never exposed via JWKS endpoint

### MCP Registry Tables

#### 6. mcp_servers (McpServerEntity)
**Purpose**: Defines available MCP servers in the system

**Schema**:
```typescript
{
  id: uuid (PK),
  provided_id: string (unique),     // External identifier (e.g., 'taskeroo')
  name: string,
  description: string,
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Relationships**:
- Has many `mcp_scopes` (1:N)
- Has many `mcp_connections` (1:N)

#### 7. mcp_scopes (McpScopeEntity)
**Purpose**: Scopes exposed by MCP servers

**Schema**:
```typescript
{
  scope_id: string,                 // Composite PK
  server_id: uuid,                  // Composite PK (FK → mcp_servers.id)
  description: string,
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Composite Key**: `(scope_id, server_id)`

**Examples**:
- `('read:tasks', 'taskeroo-server-id', 'Read task data')`
- `('write:tasks', 'taskeroo-server-id', 'Create and update tasks')`

#### 8. mcp_connections (McpConnectionEntity)
**Purpose**: Downstream providers that MCP servers connect to

**Schema**:
```typescript
{
  id: uuid (PK),
  server_id: uuid (FK → mcp_servers.id),
  friendly_name: string,            // 'Google Tasks', 'GitHub Issues', etc.

  // OAuth 2.0 Credentials
  client_id: string,                // Registered with downstream provider
  client_secret: string,            // Encrypted at rest
  authorize_url: string,            // https://accounts.google.com/o/oauth2/v2/auth
  token_url: string,                // https://oauth2.googleapis.com/token

  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Relationships**:
- Belongs to one `mcp_servers` (N:1)
- Has many `mcp_scope_mappings` (1:N)

#### 9. mcp_scope_mappings (McpScopeMappingEntity)
**Purpose**: Maps MCP server scopes to downstream provider scopes

**Schema**:
```typescript
{
  scope_id: string,                 // Composite PK (FK → mcp_scopes.scope_id)
  server_id: uuid,                  // Composite PK (FK → mcp_scopes.server_id)
  connection_id: uuid,              // Composite PK (FK → mcp_connections.id)
  downstream_scope: string,         // Provider-specific scope string
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp
}
```

**Composite Key**: `(scope_id, server_id, connection_id)`

**Examples**:
```typescript
{
  scope_id: 'read:tasks',
  server_id: 'taskeroo-server-id',
  connection_id: 'google-connection-id',
  downstream_scope: 'https://www.googleapis.com/auth/tasks.readonly'
}
{
  scope_id: 'write:tasks',
  server_id: 'taskeroo-server-id',
  connection_id: 'google-connection-id',
  downstream_scope: 'https://www.googleapis.com/auth/tasks'
}
```

**Critical Function**:
- When MCP client requests `read:tasks write:tasks`, the server looks up all mappings for these scopes
- Builds downstream authorization URL with `https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/tasks`
- Supports multiple connections per scope (e.g., both Google Tasks and Asana)

## Authorization Flow Sequence

### Phase 1: Client Registration

```
MCP Client
    |
    | POST /register/mcp/taskeroo/1.0
    | { client_name, redirect_uris, grant_types, scopes }
    v
ClientRegistrationController
    |
    v
ClientRegistrationService.registerClient()
    |
    |-- Validate OAuth metadata
    |-- Generate client_id (uuid)
    |-- Generate client_secret (hash with bcrypt)
    |-- Create RegisteredClientEntity
    v
AuthJourneysService.createJourneyForMcpRegistration()
    |
    |-- Create AuthJourneyEntity (status: NOT_STARTED)
    |-- Create McpAuthorizationFlowEntity (status: CLIENT_REGISTERED)
    |-- For each MCP connection:
    |       Create ConnectionAuthorizationFlowEntity (status: pending)
    v
Response: { client_id, client_secret, expires_at }
```

### Phase 2: MCP Client Authorization (OAuth 2.0 + PKCE)

```
MCP Client
    |
    | Generate code_verifier (random 128-char string)
    | Generate code_challenge = base64url(SHA256(code_verifier))
    |
    | Redirect user to:
    | GET /auth/authorize/mcp/taskeroo/1.0
    | ?client_id=...
    | &redirect_uri=...
    | &scope=read:tasks write:tasks
    | &code_challenge=...
    | &code_challenge_method=S256
    | &state=...
    v
AuthorizationController.authorize()
    |
    v
AuthorizationService.processAuthorizationRequest()
    |
    |-- Validate server_id (taskeroo exists)
    |-- Validate client_id (registered)
    |-- Validate redirect_uri (in registered list)
    |-- Filter scopes (remove unauthorized scopes)
    |-- Find McpAuthorizationFlowEntity for client+server
    |-- Store: code_challenge, code_challenge_method, state, redirect_uri, scope
    |-- Update status to AUTHORIZATION_REQUEST_STARTED
    |-- Generate flow_id
    v
Redirect to: /consent?flow={flow_id}
```

### Phase 3: User Consent

```
User Browser
    |
    | GET /consent?flow={flow_id}
    v
Consent UI
    |
    | Fetch flow details:
    | GET /auth/flow/{flow_id}
    v
AuthorizationController.getFlow()
    |
    v
AuthJourneysService.findJourneyByFlowId()
    |
    v
Response: {
    server_name: 'Taskeroo',
    client_name: 'My MCP Client',
    requested_scopes: ['read:tasks', 'write:tasks'],
    connections: [
        { name: 'Google Tasks', scopes: ['readonly', 'write'] }
    ]
}
    |
    v
User clicks Approve/Deny
    |
    | POST /auth/authorize/mcp/taskeroo/1.0
    | { flow_id, approved: true }
    v
AuthorizationService.processConsentDecision()
    |
    |-- Validate flow exists
    |-- Validate flow not already used
    |
    |-- If approved:
    |       Update status to USER_CONSENT_OK
    |       Call processNextDownstreamFlow()
    |
    |-- If denied:
    |       Update status to USER_CONSENT_REJECTED
    |       Redirect to client with error
```

### Phase 4: Downstream OAuth Flows (Sequential)

```
AuthorizationService.processNextDownstreamFlow()
    |
    |-- Get all ConnectionAuthorizationFlowEntity for journey
    |-- Filter to status='pending'
    |
    |-- If no pending connections:
    |       Call completeMcpAuthFlow() --> Go to Phase 5
    |
    |-- If pending connections exist:
    |       Get first pending connection
    |       Call initiateConnectionOAuth()
    v
AuthorizationService.initiateConnectionOAuth()
    |
    |-- Generate state (unique for this connection)
    |-- Get MCP scopes from mcp_authorization_flows.scope
    |-- Query mcp_scope_mappings to get downstream scopes:
    |       SELECT downstream_scope
    |       FROM mcp_scope_mappings
    |       WHERE scope_id IN ('read:tasks', 'write:tasks')
    |         AND connection_id = current_connection_id
    |
    |-- Build authorization URL:
    |       authorize_url +
    |       ?client_id={downstream_client_id}
    |       &redirect_uri={our_callback}
    |       &scope={mapped_downstream_scopes}
    |       &state={generated_state}
    |       &access_type=offline (Google-specific)
    |       &prompt=consent (Google-specific)
    |
    |-- Store state in ConnectionAuthorizationFlowEntity
    v
Redirect user to downstream provider (e.g., Google)
    |
    |-- User logs in to Google
    |-- User approves scopes
    v
Google redirects to:
GET /auth/callback
?code={downstream_auth_code}
&state={our_state}
    |
    v
AuthorizationController.callback()
    |
    v
AuthorizationService.handleDownstreamCallback()
    |
    |-- Find ConnectionAuthorizationFlowEntity by state
    |-- Store authorization_code
    |-- Call exchangeCodeForToken():
    |       POST to downstream token_url
    |       {
    |           grant_type: 'authorization_code',
    |           code: {downstream_auth_code},
    |           client_id: {downstream_client_id},
    |           client_secret: {downstream_client_secret},
    |           redirect_uri: {our_callback}
    |       }
    |
    |-- Store: access_token, refresh_token, token_expires_at
    |-- Update status to 'authorized'
    |-- Call processNextDownstreamFlow() again
    v
Repeat for next pending connection...
    |
    |-- If more pending connections: Redirect to next provider
    |-- If all complete: Call completeMcpAuthFlow()
```

### Phase 5: Complete MCP Authorization

```
AuthorizationService.completeMcpAuthFlow()
    |
    |-- Generate authorization_code (uuid)
    |-- Set authorization_code_expires_at (10 minutes from now)
    |-- Update status to AUTHORIZATION_CODE_ISSUED
    |-- Save McpAuthorizationFlowEntity
    v
Redirect to MCP client:
{redirect_uri}
?code={authorization_code}
&state={original_state}
```

### Phase 6: Token Exchange (MCP Client Gets JWT)

```
MCP Client
    |
    | POST /auth/token/mcp/taskeroo/1.0
    | Content-Type: application/x-www-form-urlencoded
    | {
    |   grant_type: 'authorization_code',
    |   code: {authorization_code},
    |   code_verifier: {original_code_verifier},
    |   redirect_uri: {same_as_before},
    |   client_id: {client_id}
    | }
    v
AuthorizationController.token()
    |
    v
TokenService.exchangeAuthorizationCode()
    |
    |-- Find McpAuthorizationFlowEntity by authorization_code
    |
    |-- Validate client_id matches
    |-- Validate authorization_code not expired
    |-- Validate authorization_code_used == false
    |-- Validate redirect_uri matches stored value
    |
    |-- PKCE Validation:
    |       If code_challenge_method == 'S256':
    |           computed_challenge = base64url(SHA256(code_verifier))
    |       If code_challenge_method == 'plain':
    |           computed_challenge = code_verifier
    |
    |       If computed_challenge != stored code_challenge:
    |           Reject with 'invalid_grant'
    |
    |-- Mark authorization_code_used = true
    |-- Call generateAccessToken()
    v
TokenService.generateAccessToken()
    |
    |-- Get active signing key from JwksService
    |-- Build JWT payload:
    |       {
    |         iss: 'https://auth-server.example.com',
    |         sub: 'user-id',
    |         aud: 'mcp-server-id',
    |         client_id: 'mcp-client-id',
    |         scope: 'read:tasks write:tasks',
    |         server_identifier: 'taskeroo',
    |         resource: 'https://api.example.com',
    |         version: '1.0',
    |         exp: now + 3600,
    |         iat: now,
    |         jti: uuid()
    |       }
    |
    |-- Sign with RSA private key (RS256)
    |-- Return signed JWT
    v
Response to MCP Client:
{
    access_token: 'eyJhbGciOiJSUzI1NiIs...',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'read:tasks write:tasks',
    refresh_token: 'refresh-token-uuid' (future enhancement)
}
```

## Security Mechanisms

### 1. PKCE (Proof Key for Code Exchange)

**Purpose**: Prevents authorization code interception attacks

**Implementation**:
- MCP client generates random `code_verifier` (128 characters)
- Client sends `code_challenge = base64url(SHA256(code_verifier))` in authorization request
- Authorization server stores `code_challenge` and `code_challenge_method` in database
- During token exchange, server hashes provided `code_verifier` and compares to stored challenge
- Token exchange fails if hashes don't match

**Code Location**: `token.service.ts:validatePkce()`

### 2. State Parameter (CSRF Protection)

**Purpose**: Prevents cross-site request forgery

**Implementation**:
- **MCP Flow**: Client generates state, server stores it, validates on callback
- **Downstream Flow**: Server generates unique state per connection, validates on callback
- Each `ConnectionAuthorizationFlowEntity` has its own state value
- State must match exactly or request is rejected

**Code Location**: `authorization.service.ts:initiateConnectionOAuth()`, `handleDownstreamCallback()`

### 3. Authorization Code Single-Use

**Purpose**: Prevents replay attacks

**Implementation**:
- `authorization_code_used` boolean flag in `mcp_authorization_flows`
- Set to `true` after first successful token exchange
- Subsequent attempts with same code are rejected

**Code Location**: `token.service.ts:exchangeAuthorizationCode()`

### 4. Authorization Code Expiration

**Purpose**: Limits time window for code interception

**Implementation**:
- `authorization_code_expires_at` set to 10 minutes after generation
- Token exchange validates current time < expiration time
- Expired codes are rejected

**Code Location**: `authorization.service.ts:completeMcpAuthFlow()`, `token.service.ts:exchangeAuthorizationCode()`

### 5. Redirect URI Validation

**Purpose**: Prevents authorization code leakage to unauthorized URIs

**Implementation**:
- Client registers allowed `redirect_uris` during registration
- Every authorization request validates `redirect_uri` is in registered list
- Token exchange validates `redirect_uri` matches what was stored during authorization

**Code Location**: `authorization.service.ts:processAuthorizationRequest()`, `token.service.ts:exchangeAuthorizationCode()`

### 6. Client Secret Hashing

**Purpose**: Protects client credentials in database

**Implementation**:
- Client secrets hashed with bcrypt before storage
- Only hashed value stored in `registered_clients.client_secret`
- Verification uses bcrypt.compare()

**Code Location**: `client-registration.service.ts:generateClientCredentials()`

### 7. Token Encryption at Rest

**Purpose**: Protects downstream access/refresh tokens

**Implementation**:
- `access_token` and `refresh_token` in `connection_authorization_flows` encrypted
- Encryption key managed separately (environment variable or secrets manager)
- Decrypted only when needed for downstream API calls

**Status**: Production configuration (development may use plaintext)

### 8. JWT Signature Verification

**Purpose**: Ensures JWT integrity and authenticity

**Implementation**:
- JWTs signed with RSA-SHA256 (RS256)
- Private key stored securely in `jwks_keys` table
- Public key exposed via JWKS endpoint for verification
- MCP servers fetch JWKS and verify signature before trusting JWT

**Code Location**: `token.service.ts:generateAccessToken()`, `jwks.controller.ts`, `jwks.service.ts`

### 9. Scope Filtering

**Purpose**: Ensures clients only receive authorized scopes

**Implementation**:
- Client registration defines allowed scopes
- Authorization request filters requested scopes against allowed list
- Only authorized scopes included in final JWT

**Code Location**: `authorization.service.ts:processAuthorizationRequest()`

## Key Architectural Patterns

### 1. Journey Pattern

**Concept**: One authorization journey encompasses entire multi-stage flow

**Structure**:
```
AuthJourneyEntity (1)
  ├── McpAuthorizationFlowEntity (1)
  └── ConnectionAuthorizationFlowEntity (N)
```

**Benefits**:
- Single source of truth for authorization state
- Easy to track progress across all stages
- Supports rollback and error recovery
- Enables audit trail

**Code Location**: `auth-journeys.service.ts`

### 2. Sequential Downstream Authorization

**Concept**: Process one downstream provider at a time, not in parallel

**Implementation**:
- `processNextDownstreamFlow()` gets first pending connection
- After successful downstream callback, calls `processNextDownstreamFlow()` again
- Repeats until all connections are `authorized` or one fails

**Rationale**:
- Simplifies user experience (one consent screen at a time)
- Easier error handling and recovery
- Prevents race conditions in database updates

**Code Location**: `authorization.service.ts:processNextDownstreamFlow()`

### 3. Scope Mapping via Database

**Concept**: Dynamic mapping of MCP scopes to provider-specific scopes

**Implementation**:
```sql
SELECT downstream_scope
FROM mcp_scope_mappings
WHERE scope_id IN ('read:tasks', 'write:tasks')
  AND server_id = 'taskeroo-server-id'
  AND connection_id = 'google-connection-id'
```

**Benefits**:
- No hardcoded scope mappings in code
- Different mappings per provider (Google, Asana, etc.)
- Easy to add new providers without code changes
- Supports complex many-to-many mappings

**Code Location**: `authorization.service.ts:initiateConnectionOAuth()`

### 4. Stateless JWTs

**Concept**: Access tokens contain all necessary claims for authorization

**Implementation**:
- JWT includes `client_id`, `scope`, `server_identifier`, `resource`, `version`
- MCP server can validate JWT independently via JWKS
- No need to call introspection endpoint for every request
- Introspection endpoint provided for detailed metadata (RFC 7662)

**Benefits**:
- Scales horizontally (no shared session state)
- Reduces latency (no database lookup per request)
- Standards-compliant (OAuth 2.0 JWT Bearer)

**Code Location**: `token.service.ts:generateAccessToken()`

### 5. Comprehensive Status Tracking

**Concept**: Every stage of authorization has explicit status value

**MCP Flow Statuses**:
- `CLIENT_REGISTERED` → `AUTHORIZATION_REQUEST_STARTED` → `USER_CONSENT_OK` → `AUTHORIZATION_CODE_ISSUED` → `TOKEN_ISSUED`

**Connection Flow Statuses**:
- `pending` → `authorized` or `failed`

**Benefits**:
- Easy to debug stuck flows
- Supports flow resumption after errors
- Clear audit trail
- Enables monitoring and alerting

**Code Location**: Entity definitions and status enums

### 6. Key Rotation with Grace Period

**Concept**: Rotate signing keys without invalidating existing JWTs

**Implementation**:
- Generate new key pair every 24 hours
- Keep old keys active for grace period (e.g., 48 hours)
- JWKS endpoint returns all active keys
- Verifiers try keys until one succeeds

**Benefits**:
- Existing JWTs remain valid during rotation
- Limits exposure window for compromised keys
- Standards-compliant (JWKS supports multiple keys)

**Code Location**: `jwks.service.ts:rotateKeys()`

## Future Enhancements

### 1. Token Swap / Token Exchange

**Goal**: MCP server presents JWT to get downstream tokens on-demand

**Use Case**:
- MCP server receives request requiring Google API access
- MCP server sends JWT to authorization server
- Authorization server validates JWT, returns Google access token
- MCP server uses Google token to fulfill request

**Benefits**:
- MCP server doesn't store downstream tokens
- Tokens refreshed automatically by authorization server
- Supports token revocation and re-authorization

**Implementation Plan**:
- New endpoint: `POST /auth/token/swap`
- Accept JWT in Authorization header
- Validate JWT signature and claims
- Look up `ConnectionAuthorizationFlowEntity` by journey
- Return `access_token` for requested connection
- Refresh token if expired

**Status**: Not yet implemented (mentioned in code comments)

### 2. Refresh Token Support

**Goal**: Issue refresh tokens to MCP clients for long-lived access

**Current State**:
- Token exchange returns `refresh_token` field
- Refresh tokens not yet stored in database
- Refresh flow not implemented

**Implementation Plan**:
- Add `refresh_token` and `refresh_token_expires_at` to `mcp_authorization_flows`
- Implement `POST /auth/token` with `grant_type=refresh_token`
- Validate refresh token, issue new access token
- Rotate refresh token on each use (best practice)

**Status**: Partial implementation

### 3. Token Revocation

**Goal**: Allow clients and users to revoke issued tokens

**Implementation Plan**:
- Add `POST /auth/revoke` endpoint (RFC 7009)
- Maintain revocation list (blacklist) or jti tracking table
- Check revocation status during introspection
- Consider short-lived JWTs to minimize revocation complexity

**Status**: Not yet implemented

### 4. Dynamic Client Registration Metadata

**Goal**: Support full OAuth 2.0 DCR spec with client metadata updates

**Current State**:
- Basic registration implemented
- Metadata updates not supported

**Implementation Plan**:
- Add `PUT /register/mcp/:serverIdentifier/:version/:client_id` for updates
- Add `DELETE /register/mcp/:serverIdentifier/:version/:client_id` for deletion
- Implement registration access tokens

**Status**: Partial implementation

## API Endpoints Summary

### Client Registration
- `POST /register/mcp/:serverIdentifier/:version` - Register new client

### Authorization Flow
- `GET /auth/authorize/mcp/:serverIdentifier/:version` - Start authorization
- `POST /auth/authorize/mcp/:serverIdentifier/:version` - Handle consent
- `GET /auth/flow/:flowId` - Get flow details for consent UI
- `GET /auth/callback` - Downstream OAuth callback

### Token Operations
- `POST /auth/token/mcp/:serverIdentifier/:version` - Exchange code for JWT
- `POST /auth/introspect/mcp/:serverIdentifier/:version` - Introspect JWT

### Key Management
- `GET /auth/.well-known/jwks.json` - Public key set (JWKS)

## File Structure Summary

```
apps/backend/src/
├── authorization-server/
│   ├── authorization.controller.ts       (Authorization endpoints)
│   ├── authorization.service.ts          (OAuth flow orchestration)
│   ├── token.service.ts                  (JWT issuance & validation)
│   ├── client-registration.controller.ts (DCR endpoints)
│   ├── client-registration.service.ts    (Client registration logic)
│   ├── jwks.controller.ts                (JWKS endpoint)
│   └── jwks.service.ts                   (Key management)
├── auth-journeys/
│   ├── auth-journeys.service.ts          (Journey state management)
│   └── entities/
│       ├── auth-journey.entity.ts
│       ├── mcp-authorization-flow.entity.ts
│       └── connection-authorization-flow.entity.ts
├── registered-clients/
│   └── registered-client.entity.ts
├── mcp-registry/
│   ├── mcp-server.entity.ts
│   ├── mcp-scope.entity.ts
│   ├── mcp-connection.entity.ts
│   └── mcp-scope-mapping.entity.ts
└── jwks-keys/
    └── jwks-key.entity.ts
```

## Monitoring and Observability

### Key Metrics to Track

1. **Authorization Flow Metrics**:
   - Authorization requests per minute
   - Consent approval/denial rates
   - Average time to complete authorization
   - Failed authorization reasons

2. **Token Metrics**:
   - Token exchanges per minute
   - PKCE validation failure rate
   - Token expiration and refresh rates
   - JWT signature verification failures

3. **Downstream Integration Metrics**:
   - Downstream authorization success/failure rates per provider
   - Token exchange failures per provider
   - Token refresh success rates
   - Average downstream authorization time

4. **Security Metrics**:
   - Invalid redirect_uri attempts
   - Authorization code replay attempts
   - Expired code usage attempts
   - Failed PKCE validations

### Logging Best Practices

**Sensitive Data Exclusions**:
- Never log `client_secret`, `access_token`, `refresh_token`, `code_verifier`
- Log only last 4 characters of `authorization_code` for debugging
- Use secure audit logging for security-relevant events

**Recommended Log Events**:
- Client registration (client_id, server_id)
- Authorization request (flow_id, client_id, scopes)
- Consent decision (flow_id, approved)
- Downstream authorization initiated (connection_id)
- Downstream authorization completed (connection_id, success/failure)
- Token exchange (client_id, success/failure)
- PKCE validation failures (client_id)
- Security violations (failed validations, replay attempts)

## Testing Strategy

### Unit Tests

**Controllers**:
- Request validation (missing parameters, invalid formats)
- Response formatting
- Error handling

**Services**:
- Authorization flow state transitions
- PKCE validation logic (S256 and plain)
- Scope mapping and filtering
- JWT generation and signing
- Token expiration logic

**Database Operations**:
- Entity relationships (journey → flows)
- Status transitions
- Unique constraints (client_id, kid)

### Integration Tests

**End-to-End Authorization Flow**:
1. Register client
2. Start authorization request
3. Approve consent
4. Complete downstream OAuth (mocked provider)
5. Complete MCP authorization
6. Exchange code for JWT
7. Verify JWT signature
8. Introspect token

**Security Tests**:
- PKCE validation with invalid code_verifier
- Authorization code replay attempts
- Expired code usage
- Invalid redirect_uri
- State parameter tampering

**Downstream Integration Tests**:
- Multiple downstream providers
- Scope mapping correctness
- Token storage and retrieval
- Error handling (provider downtime, invalid credentials)

### Performance Tests

**Load Tests**:
- Concurrent authorization requests
- Simultaneous token exchanges
- JWKS endpoint caching behavior

**Stress Tests**:
- Maximum journeys per user
- Maximum connections per journey
- Database connection pool limits

## Conclusion

The authorization server implements a robust OAuth 2.0 bridge between MCP clients and downstream providers. Key architectural strengths include:

1. **Security First**: PKCE, state parameters, code single-use, and token encryption
2. **Flexible Scope Mapping**: Database-driven mapping supports any provider
3. **Comprehensive State Tracking**: Every stage tracked for debugging and audit
4. **Standards Compliant**: OAuth 2.0, PKCE, RFC 7662 introspection, JWKS
5. **Scalable Design**: Stateless JWTs, key rotation, sequential downstream flows

Future enhancements like token swap and refresh token support will further strengthen the system's capabilities for production use.

**Status**: Core functionality complete and operational
**Next Steps**: Implement token swap, refresh tokens, and comprehensive monitoring
