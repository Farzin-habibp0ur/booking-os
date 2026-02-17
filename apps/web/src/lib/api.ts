const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiClient {
  private token: string | null = null;

  // C2 fix: Tokens stored in-memory only — no localStorage.
  // Authentication relies on httpOnly cookies set by the backend.
  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    // Send Bearer token as fallback; httpOnly cookies are sent automatically
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include', // Send cookies with every request
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: res.status === 401 ? 'Invalid credentials' : 'Request failed' }));
      if (res.status === 401) {
        this.setToken(null);
        // Don't redirect if already on login page (let the page show the error)
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      // M15 fix: Sanitize error messages — strip internal details (stack traces, SQL, file paths)
      const rawMsg: string = error.message || `HTTP ${res.status}`;
      const safeMsg = rawMsg.length > 200 ? rawMsg.slice(0, 200) : rawMsg;
      throw new Error(safeMsg.replace(/\bat\s+\S+\.\S+\s*\(.*?\)/g, '').trim());
    }

    return res.json();
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  del<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: res.status === 401 ? 'Unauthorized' : 'Upload failed' }));
      if (res.status === 401) {
        this.setToken(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    return res.json();
  }
}

export const api = new ApiClient();
