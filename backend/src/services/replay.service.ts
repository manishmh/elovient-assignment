import { ActivityLog } from '../models/ActivityLog';
import { AppError } from '../types';

const MAX_CLOCK_SKEW_MS = 30 * 1000;
const DUPLICATE_WINDOW_MS = 3 * 1000;

export interface ReplayCheckInput {
  userId: string;
  action: string;
  clientTime: string;
  ip: string;
  userAgent?: string;
}

export interface ReplayCheckResult {
  serverTime: string;
}

export const checkReplay = async (input: ReplayCheckInput): Promise<ReplayCheckResult> => {
  const { userId, action, clientTime, ip, userAgent } = input;

  const clientDate = new Date(clientTime);
  if (Number.isNaN(clientDate.getTime())) {
    throw new AppError('clientTime must be a valid ISO date string', 400);
  }

  const serverDate = new Date();
  const skewMs = Math.abs(serverDate.getTime() - clientDate.getTime());
  if (skewMs > MAX_CLOCK_SKEW_MS) {
    throw new AppError(
      `Clock skew exceeds 30 seconds (actual: ${Math.round(skewMs / 1000)}s)`,
      409,
    );
  }

  const since = new Date(serverDate.getTime() - DUPLICATE_WINDOW_MS);
  const duplicate = await ActivityLog.findOne({
    userId,
    action,
    createdAt: { $gte: since },
  }).select('_id');

  if (duplicate) {
    throw new AppError(
      `Duplicate action: "${action}" was already logged within the last 3 seconds`,
      409,
    );
  }

  await ActivityLog.create({
    userId,
    action,
    ip,
    userAgent,
    meta: { source: 'replay-check', clientTime },
  });

  return { serverTime: serverDate.toISOString() };
};
