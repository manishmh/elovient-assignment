const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const tokens = {
  get: () => localStorage.getItem('accessToken'),
  getRefresh: () => localStorage.getItem('refreshToken'),
  set: (access: string, refresh: string) => {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  },
  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

async function tryRefresh(): Promise<string | null> {
  const refreshToken = tokens.getRefresh();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    tokens.clear();
    return null;
  }
  const body = await res.json();
  const access = body?.data?.accessToken;
  const newRefresh = body?.data?.refreshToken;
  if (!access || !newRefresh) {
    tokens.clear();
    return null;
  }
  tokens.set(access, newRefresh);
  return access;
}

type ApiInit = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T = any>(path: string, init: ApiInit = {}): Promise<T> {
  const send = (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      body:
        init.body !== undefined && typeof init.body !== 'string'
          ? JSON.stringify(init.body)
          : (init.body as BodyInit | undefined),
    });
  };

  let res = await send(tokens.get());

  if (res.status === 401 && tokens.getRefresh()) {
    const fresh = await tryRefresh();
    if (fresh) res = await send(fresh);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok) {
    const err = new Error((data && data.message) || `Request failed (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }

  return data as T;
}
