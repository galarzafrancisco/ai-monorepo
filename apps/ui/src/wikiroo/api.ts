import { OpenAPI, WikirooService } from 'shared';

// Use relative URL in production, absolute URL in development
OpenAPI.BASE = import.meta.env.PROD ? "/api/v1" : "http://localhost:3000/api/v1";

export { WikirooService };
