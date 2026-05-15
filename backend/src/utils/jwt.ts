import { createHash, timingSafeEqual } from 'crypto';
import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

const ACCESS_SECRET: Secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface AccessTokenPayload {
  sub: string;
}

export interface RefreshTokenPayload {
  sub: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  const opts: SignOptions = { expiresIn: ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, ACCESS_SECRET, opts);
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  const opts: SignOptions = { expiresIn: REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, REFRESH_SECRET, opts);
};

export const verifyAccessToken = (token: string): AccessTokenPayload & JwtPayload => {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload & JwtPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload & JwtPayload => {
  return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload & JwtPayload;
};

export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const compareRefreshToken = (plain: string, hashed: string): boolean => {
  const candidate = Buffer.from(hashRefreshToken(plain), 'hex');
  const stored = Buffer.from(hashed, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
};
