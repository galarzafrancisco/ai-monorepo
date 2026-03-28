// Re-export generated client for ergonomics
export * from './client/index.js';

// Re-export handwritten instance client layer.
// Keep this outside src/client because src/client is regenerated.
export * from './instance/create-taico-client.js';

// Re-export generated types for ergonomics
export * from '../contracts/types.js';

// Instance-safe client factory
export * from './createTaicoClient.js';
