/**
 * Quick test to verify the generated taico client compiles correctly
 */

import { ApiClient } from './generated/taico/index.js';

// This test just verifies TypeScript compilation
// It doesn't actually make any HTTP requests

const client = new ApiClient({
  baseUrl: 'http://localhost:3000',
  getAccessToken: async () => 'test-token',
});

// Verify all resource properties are accessible
console.log('Testing taico client compilation...');
console.log('✓ client.app:', typeof client.app);
console.log('✓ client.agentExecutionTokens:', typeof client.agentExecutionTokens);
console.log('✓ client.authorizationServer:', typeof client.authorizationServer);
console.log('✓ client.chatProviders:', typeof client.chatProviders);
console.log('✓ client.metaProjects:', typeof client.metaProjects);
console.log('All resource properties accessible!');
