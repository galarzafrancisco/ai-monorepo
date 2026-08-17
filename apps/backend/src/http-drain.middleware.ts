import { NextFunction, Request, Response } from 'express';
import { ServerLifecycleService } from './server-lifecycle.service';

export function createHttpDrainMiddleware(lifecycle: ServerLifecycleService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isHealthRequest(req)) {
      return next();
    }

    if (lifecycle.isShuttingDown()) {
      return res.status(503).json({
        statusCode: 503,
        message: 'Server is shutting down',
        error: 'Service Unavailable',
      });
    }

    const release = lifecycle.trackRequest();
    res.once('finish', release);
    res.once('close', release);
    return next();
  };
}

export function isHealthRequest(req: Request): boolean {
  return req.path === '/health/live' || req.path === '/health/ready';
}
