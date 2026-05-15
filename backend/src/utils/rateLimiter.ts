import { Request, RequestHandler } from 'express';
import { AppError } from '../types';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyFn?: (req: Request) => string;
}

export const createRateLimiter = (opts: RateLimitOptions): RequestHandler => {
  const buckets = new Map<string, Bucket>();

  return (req, _res, next) => {
    const key = opts.keyFn ? opts.keyFn(req) : req.ip || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > opts.max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      return next(
        new AppError(
          opts.message || `Too many requests. Try again in ${retryAfterSec}s.`,
          429,
        ),
      );
    }

    next();
  };
};
