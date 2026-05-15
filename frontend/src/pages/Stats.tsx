import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Stats {
  totalActions: number;
  mostCommonAction: { action: string; count: number } | null;
  actionsPerMinute: { minute: string; count: number }[];
  mostActiveUser: { userId: string; email: string | null; count: number } | null;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');

  async function fetchStats() {
    try {
      const res = await api<{ data: Stats }>('/api/activity/stats');
      setStats(res.data);
      setError('');
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Error fetching stats');
    }
  }

  useEffect(() => {
    fetchStats();
    const id = window.setInterval(fetchStats, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stats</h1>
        <div className="text-xs text-gray-600">
          Auto-refresh every 5s · last: {lastUpdate || '—'}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 border border-red-300 bg-red-50 px-2 py-1">
          {error}
        </div>
      )}

      {!stats ? (
        <div className="text-sm text-gray-600">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-gray-300 p-4">
              <div className="text-xs uppercase text-gray-600">Total actions</div>
              <div className="text-2xl mt-1">{stats.totalActions}</div>
            </div>
            <div className="border border-gray-300 p-4">
              <div className="text-xs uppercase text-gray-600">Most common action</div>
              {stats.mostCommonAction ? (
                <div className="mt-1 text-sm">
                  <span className="font-mono">{stats.mostCommonAction.action}</span>
                  <span className="text-gray-600"> · {stats.mostCommonAction.count}</span>
                </div>
              ) : (
                <div className="text-gray-500 mt-1">—</div>
              )}
            </div>
            <div className="border border-gray-300 p-4">
              <div className="text-xs uppercase text-gray-600">Most active user</div>
              {stats.mostActiveUser ? (
                <div className="mt-1 text-sm space-y-0.5">
                  <div className="break-all">{stats.mostActiveUser.email || '(no email)'}</div>
                  <div className="font-mono text-xs text-gray-500 break-all">
                    {stats.mostActiveUser.userId}
                  </div>
                  <div className="text-gray-600">{stats.mostActiveUser.count} actions</div>
                </div>
              ) : (
                <div className="text-gray-500 mt-1">—</div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-xs font-semibold uppercase text-gray-600">
              Actions per minute (last 10 min)
            </h2>
            {stats.actionsPerMinute.length === 0 ? (
              <div className="text-sm text-gray-500">
                No activity in the last 10 minutes.
              </div>
            ) : (
              <div className="border border-gray-300">
                {stats.actionsPerMinute.map((b) => (
                  <div
                    key={b.minute}
                    className="flex justify-between border-b border-gray-200 last:border-b-0 px-3 py-1 text-sm font-mono"
                  >
                    <span>{b.minute}</span>
                    <span>{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
