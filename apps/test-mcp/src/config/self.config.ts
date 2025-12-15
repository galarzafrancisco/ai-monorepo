// Meta
export const SELF_NAME = 'test-mcp';
export const SELF_VERSION = '0.0.0';

// Auth
export const SELF_SCOPES = 'food:eat,neurofabric:read'

// Token Exchange
export const TOKEN_EXCHANGE_RESOURCE = process.env.TOKEN_EXCHANGE_RESOURCE || 'neurofabric';
export const TOKEN_EXCHANGE_SCOPE = process.env.TOKEN_EXCHANGE_SCOPE || 'https://www.googleapis.com/auth/devstorage.read_only';

// GCS
export const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'your-bucket-name';

// Runtime
export const SELF_PORT = process.env.PORT || 1111;
export const SELF_URL = `http://localhost:${SELF_PORT}`;