import { ActivityLog } from '../models/ActivityLog';

export const findSuspiciousUsers = async () => {
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60 * 1000);
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

  const [highFrequency, multipleIps] = await Promise.all([
    ActivityLog.aggregate([
      { $match: { createdAt: { $gte: oneMinuteAgo } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 20 } } },
      { $project: { _id: 0, userId: '$_id', count: 1 } },
    ]),

    ActivityLog.aggregate([
      { $match: { createdAt: { $gte: fiveMinutesAgo } } },
      { $group: { _id: '$userId', ips: { $addToSet: '$ip' } } },
      { $project: { _id: 0, userId: '$_id', count: { $size: '$ips' } } },
      { $match: { count: { $gt: 2 } } },
    ]),
  ]);

  const suspicious = new Map<string, { userId: string; reason: string; count: number }>();

  for (const u of highFrequency) {
    const userId = String(u.userId);
    suspicious.set(userId, { userId, reason: 'High frequency', count: u.count });
  }

  for (const u of multipleIps) {
    const userId = String(u.userId);
    const existing = suspicious.get(userId);
    if (existing) {
      existing.reason = 'High frequency / Multiple IPs';
    } else {
      suspicious.set(userId, { userId, reason: 'Multiple IPs', count: u.count });
    }
  }

  return Array.from(suspicious.values());
};
