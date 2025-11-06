import { OpenAPI, WikirooService } from 'shared';

// Use relative URL in production, absolute URL in development
if (import.meta.env.PROD) {
  OpenAPI.BASE = '';
} else {
  const PORT = import.meta.env.VITE_BACKEND_PORT || 3000;
  OpenAPI.BASE = `http://localhost:${PORT}`;
}

export { WikirooService };
