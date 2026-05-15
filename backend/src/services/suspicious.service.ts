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
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, userId: '$_id', email: '$user.email', count: 1 } },
    ]),

    ActivityLog.aggregate([
      { $match: { createdAt: { $gte: fiveMinutesAgo } } },
      { $group: { _id: '$userId', ips: { $addToSet: '$ip' } } },
      { $project: { _id: 1, count: { $size: '$ips' } } },
      { $match: { count: { $gt: 2 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, userId: '$_id', email: '$user.email', count: 1 } },
    ]),
  ]);

  const suspicious = new Map<
    string,
    { userId: string; email: string | null; reason: string; count: number }
  >();

  for (const u of highFrequency) {
    const userId = String(u.userId);
    suspicious.set(userId, {
      userId,
      email: u.email ?? null,
      reason: 'High frequency',
      count: u.count,
    });
  }

  for (const u of multipleIps) {
    const userId = String(u.userId);
    const existing = suspicious.get(userId);
    if (existing) {
      existing.reason = 'High frequency / Multiple IPs';
      if (!existing.email && u.email) existing.email = u.email;
    } else {
      suspicious.set(userId, {
        userId,
        email: u.email ?? null,
        reason: 'Multiple IPs',
        count: u.count,
      });
    }
  }

  return Array.from(suspicious.values());
};
