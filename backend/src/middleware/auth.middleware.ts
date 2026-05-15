import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../types';

const extractAccessToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const fromHeader = header.slice('Bearer '.length).trim();
    if (fromHeader) return fromHeader;
  }
  const fromCookie = req.cookies?.accessToken;
  if (typeof fromCookie === 'string' && fromCookie.length > 0) {
    return fromCookie;
  }
  return null;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractAccessToken(req);
  if (!token) {
    return next(new AppError('Missing access token', 401));
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload.sub) {
      return next(new AppError('Invalid token payload', 401));
    }
    req.user = { id: payload.sub };
    return next();
  } catch {
    return next(new AppError('Invalid or expired access token', 401));
  }
};
