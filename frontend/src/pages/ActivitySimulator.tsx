import { FormEvent, useState } from 'react';
import { api } from '../services/api';

const ACTIONS = ['login', 'logout', 'click', 'view'];

interface LogEntry {
  t: string;
  endpoint: 'activity' | 'replay-check';
  action: string;
  status: 'ok' | 'error';
  message?: string;
  body?: any;
}

export default function ActivitySimulator() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  function record(entry: LogEntry) {
    setEntries((prev) => [entry, ...prev.slice(0, 19)]);
  }

  async function logAction(action: string) {
    if (!action.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<{
        success: boolean;
        serverTime: string;
        actionsInLast10Sec: number;
      }>('/api/activity', { method: 'POST', body: { action } });
      setRateLimited(false);
      record({
        t: new Date().toLocaleTimeString(),
        endpoint: 'activity',
        action,
        status: 'ok',
        body: res,
      });
    } catch (err: any) {
      const message = err.message || 'Error';
      if (/rate limit/i.test(message)) {
        setRateLimited(true);
        window.setTimeout(() => setRateLimited(false), 10_000);
      }
      record({
        t: new Date().toLocaleTimeString(),
        endpoint: 'activity',
        action,
        status: 'error',
        message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function replayCheck(action: string) {
    if (!action.trim() || busy) return;
    setBusy(true);
    const clientTime = new Date().toISOString();
    try {
      const res = await api<{ allowed: boolean; serverTime: string }>(
        '/api/activity/replay-check',
        { method: 'POST', body: { action, clientTime } },
      );
      const driftMs =
        new Date(res.serverTime).getTime() - new Date(clientTime).getTime();
      record({
        t: new Date().toLocaleTimeString(),
        endpoint: 'replay-check',
        action,
        status: 'ok',
        body: { ...res, clientTime, driftMs },
      });
    } catch (err: any) {
      record({
        t: new Date().toLocaleTimeString(),
        endpoint: 'replay-check',
        action,
        status: 'error',
        message: err.message || 'Error',
        body: { clientTime },
      });
    } finally {
      setBusy(false);
    }
  }

  function handleCustom(e: FormEvent) {
    e.preventDefault();
    if (custom.trim()) logAction(custom.trim());
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Activity Simulator</h1>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase text-gray-600">
          Log Action — POST /api/activity
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => logAction(a)}
              disabled={busy || rateLimited}
              className="border border-gray-400 px-3 py-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {a}
            </button>
          ))}
          <form onSubmit={handleCustom} className="flex gap-1">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="custom action..."
              className="border border-gray-400 px-2 py-1"
            />
            <button
              disabled={busy || rateLimited || !custom.trim()}
              className="border border-gray-400 px-3 py-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              send
            </button>
          </form>
        </div>
        {rateLimited && (
          <div className="text-sm text-red-700 border border-red-300 bg-red-50 px-2 py-1">
            Rate limit hit (5 actions / 10s). Buttons disabled until the window clears.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase text-gray-600">
          Replay Check — POST /api/activity/replay-check
        </h2>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a}
              onClick={() => replayCheck(a)}
              disabled={busy}
              className="border border-gray-400 px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
            >
              {a}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-600">
          Server rejects with 409 if clientTime differs from serverTime by &gt; 30s,
          or if the same action was already logged within 3 seconds.
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase text-gray-600">Recent calls</h2>
        {entries.length === 0 ? (
          <div className="text-sm text-gray-600">No requests sent yet.</div>
        ) : (
          <div className="border border-gray-300">
            {entries.map((e, i) => (
              <div
                key={i}
                className={`border-b border-gray-200 last:border-b-0 px-3 py-2 text-sm ${
                  e.status === 'error' ? 'bg-red-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">
                    <span className="text-gray-500">[{e.t}]</span> {e.endpoint} → {e.action}
                  </span>
                  <span
                    className={e.status === 'error' ? 'text-red-700' : 'text-green-700'}
                  >
                    {e.status}
                  </span>
                </div>
                {e.message && <div className="text-red-700 mt-1">{e.message}</div>}
                {e.body && (
                  <pre className="text-xs text-gray-700 mt-1 whitespace-pre-wrap break-all">
                    {JSON.stringify(e.body, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
