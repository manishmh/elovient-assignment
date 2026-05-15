import { Request, Response } from 'express';
import { User } from '../models/User';
import { AppError } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import {
  compareRefreshToken,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { comparePassword, hashPassword } from '../utils/password';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new AppError('Invalid email format', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const hashed = await hashPassword(password);
  const user = await User.create({ email: normalizedEmail, password: hashed });
  const userId = user._id.toString();

  const accessToken = signAccessToken({ sub: userId });
  const refreshToken = signRefreshToken({ sub: userId });
  await User.findByIdAndUpdate(userId, { refreshToken: hashRefreshToken(refreshToken) });

  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    success: true,
    message: 'Registered successfully',
    data: {
      user: { id: userId, email: user.email, createdAt: user.createdAt },
      accessToken,
      refreshToken,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const ok = await comparePassword(password, user.password);
  if (!ok) {
    throw new AppError('Invalid credentials', 401);
  }

  const userId = user._id.toString();
  const accessToken = signAccessToken({ sub: userId });
  const refreshToken = signRefreshToken({ sub: userId });
  await User.findByIdAndUpdate(userId, { refreshToken: hashRefreshToken(refreshToken) });

  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: 'Logged in',
    data: {
      user: { id: userId, email: user.email },
      accessToken,
      refreshToken,
    },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const fromCookie = req.cookies?.[REFRESH_COOKIE];
  const incoming: string | undefined = fromBody || fromCookie;

  if (!incoming) {
    throw new AppError('Refresh token is required', 400);
  }

  let payload;
  try {
    payload = verifyRefreshToken(incoming);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  if (!payload.sub) {
    throw new AppError('Invalid refresh token payload', 401);
  }

  const user = await User.findById(payload.sub).select('+refreshToken');
  if (!user || !user.refreshToken) {
    throw new AppError('Refresh token has been revoked', 401);
  }

  if (!compareRefreshToken(incoming, user.refreshToken)) {
    throw new AppError('Refresh token has been revoked', 401);
  }

  const userId = user._id.toString();
  const accessToken = signAccessToken({ sub: userId });
  const newRefreshToken = signRefreshToken({ sub: userId });
  await User.findByIdAndUpdate(userId, { refreshToken: hashRefreshToken(newRefreshToken) });

  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: 'Token refreshed',
    data: { accessToken, refreshToken: newRefreshToken },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  await User.findByIdAndUpdate(req.user.id, { refreshToken: null });

  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
  });
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out',
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    message: 'Current user',
    data: {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
    },
  });
});
