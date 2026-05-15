import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface SuspiciousUser {
  userId: string;
  email: string | null;
  reason: string;
  count: number;
}

export default function Suspicious() {
  const [users, setUsers] = useState<SuspiciousUser[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  async function fetchUsers() {
    try {
      const data = await api<SuspiciousUser[]>('/api/activity/suspicious');
      setUsers(data);
      setError('');
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Error fetching suspicious users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    const id = window.setInterval(fetchUsers, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Suspicious users</h1>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>Auto-refresh 5s · last: {lastUpdate || '—'}</span>
          <button
            onClick={fetchUsers}
            className="border border-gray-400 px-2 py-1 hover:bg-gray-100"
          >
            refresh
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Flagged when &gt; 20 actions in 1 minute OR &gt; 2 distinct IPs in 5 minutes.
      </div>

      {error && (
        <div className="text-sm text-red-700 border border-red-300 bg-red-50 px-2 py-1">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-gray-600 border border-gray-300 p-3">
          No suspicious users at the moment.
        </div>
      ) : (
        <div className="border border-gray-300">
          <div className="grid grid-cols-12 px-3 py-2 text-xs uppercase text-gray-600 border-b border-gray-200">
            <div className="col-span-6">User</div>
            <div className="col-span-4">Reason</div>
            <div className="col-span-2 text-right">Count</div>
          </div>
          {users.map((u) => (
            <div
              key={u.userId + u.reason}
              className="grid grid-cols-12 px-3 py-2 text-sm border-b border-gray-200 last:border-b-0"
            >
              <div className="col-span-6 break-all">
                <div>{u.email || '(no email)'}</div>
                <div className="font-mono text-xs text-gray-500">{u.userId}</div>
              </div>
              <div className="col-span-4">{u.reason}</div>
              <div className="col-span-2 text-right">{u.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
