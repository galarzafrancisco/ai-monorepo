import { OpenAPI, WikirooService } from 'shared';

// Use relative URL in production, absolute URL in development
OpenAPI.BASE = import.meta.env.PROD ? '' : 'http://localhost:3000';

export { WikirooService };
