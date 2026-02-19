const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiClient {
  private token: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  // C2 fix: Tokens stored in-memory only — no localStorage.
  // Authentication relies on httpOnly cookies set by the backend.
  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  /**
   * Attempt to refresh the access token using the httpOnly refresh_token cookie.
   * Deduplicates concurrent refresh calls so only one is in-flight at a time.
   */
  private tryRefresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.accessToken) {
            this.setToken(data.accessToken);
          }
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Retry a fetch call once after a short delay for transient network errors
   * (e.g., deployment rollover causing "Failed to fetch").
   */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err) {
      // Network error (Failed to fetch) — retry once after 1s
      await new Promise((r) => setTimeout(r, 1000));
      return fetch(url, init);
    }
  }

  private async request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    // Send Bearer token as fallback; httpOnly cookies are sent automatically
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await this.fetchWithRetry(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include', // Send cookies with every request
    });

    if (!res.ok) {
      // On 401: try automatic token refresh before giving up.
      // Skip refresh for auth endpoints (login/refresh/logout) and retries.
      if (res.status === 401 && !isRetry && !path.startsWith('/auth/')) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          return this.request<T>(path, options, true);
        }
      }

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

  async getText(path: string): Promise<string> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await this.fetchWithRetry(`${API_URL}${path}`, {
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      if (res.status === 401) {
        const refreshed = await this.tryRefresh();
        if (refreshed) return this.getText(path);
        this.setToken(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      const error = await res.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    return res.text();
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

    const res = await this.fetchWithRetry(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) {
      // On 401 for upload: try refresh then retry
      if (res.status === 401) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          const retryHeaders: Record<string, string> = {};
          const newToken = this.getToken();
          if (newToken) retryHeaders['Authorization'] = `Bearer ${newToken}`;
          const retryRes = await this.fetchWithRetry(`${API_URL}${path}`, {
            method: 'POST',
            headers: retryHeaders,
            body: formData,
            credentials: 'include',
          });
          if (retryRes.ok) return retryRes.json();
        }
        this.setToken(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      const error = await res
        .json()
        .catch(() => ({ message: res.status === 401 ? 'Unauthorized' : 'Upload failed' }));
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    return res.json();
  }
}

export const api = new ApiClient();
