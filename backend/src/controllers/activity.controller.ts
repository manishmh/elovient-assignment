import { Request, Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { computeActivityStats } from '../services/analytics.service';
import { checkReplay } from '../services/replay.service';
import { findSuspiciousUsers } from '../services/suspicious.service';
import { AppError } from '../types';
import { asyncHandler } from '../utils/asyncHandler';

const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_MAX = 5;

export const logAction = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { action, meta } = req.body as { action?: unknown; meta?: Record<string, unknown> };

  if (typeof action !== 'string' || action.trim() === '') {
    throw new AppError('action is required and must be a non-empty string', 400);
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await ActivityLog.countDocuments({
    userId: req.user.id,
    createdAt: { $gte: since },
  });

  if (recentCount >= RATE_LIMIT_MAX) {
    throw new AppError(
      `Rate limit exceeded: more than ${RATE_LIMIT_MAX} actions in the last 10 seconds`,
      429,
    );
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || undefined;

  await ActivityLog.create({
    userId: req.user.id,
    action: action.trim(),
    ip,
    userAgent,
    meta,
  });

  res.status(201).json({
    success: true,
    serverTime: new Date().toISOString(),
    actionsInLast10Sec: recentCount + 1,
  });
});

export const replayCheck = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { action, clientTime } = req.body as { action?: unknown; clientTime?: unknown };

  if (typeof action !== 'string' || action.trim() === '') {
    throw new AppError('action is required and must be a non-empty string', 400);
  }
  if (typeof clientTime !== 'string' || clientTime.trim() === '') {
    throw new AppError('clientTime is required and must be an ISO date string', 400);
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || undefined;

  const { serverTime } = await checkReplay({
    userId: req.user.id,
    action: action.trim(),
    clientTime,
    ip,
    userAgent,
  });

  res.status(200).json({
    allowed: true,
    serverTime,
  });
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const stats = await computeActivityStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
});

export const getSuspicious = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const suspicious = await findSuspiciousUsers();

  res.status(200).json(suspicious);
});
