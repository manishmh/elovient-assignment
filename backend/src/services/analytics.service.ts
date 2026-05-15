import { ActivityLog } from '../models/ActivityLog';

export const computeActivityStats = async () => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const [totalActions, mostCommon, actionsPerMinute, mostActive] = await Promise.all([
    ActivityLog.countDocuments(),

    ActivityLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, action: '$_id', count: 1 } },
    ]),

    ActivityLog.aggregate([
      { $match: { createdAt: { $gte: tenMinutesAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H:%M:00.000Z', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, minute: '$_id', count: 1 } },
    ]),

    ActivityLog.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, userId: '$_id', count: 1 } },
    ]),
  ]);

  return {
    totalActions,
    mostCommonAction: mostCommon[0] || null,
    actionsPerMinute,
    mostActiveUser: mostActive[0] || null,
  };
};
