/**
 * Centralized API Client and Interceptor for PORTIDE.
 * Automatically attaches session headers (X-User-Email, X-User-Role, X-User-Id)
 * and intercepts 401/403 session expiration errors.
 */

export const API_BASE_URL = 'http://127.0.0.1:8000';

export interface StoredSession {
  id: string;
  name: string;
  email: string;
  role: string;
  organisation?: string;
  phone?: string;
  status?: string;
  employeeId?: string;
  department?: string;
}

export const getStoredSession = (): StoredSession | null => {
  const raw = localStorage.getItem('portide_user_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('portide_user_session');
    return null;
  }
};

export const setStoredSession = (session: StoredSession): void => {
  localStorage.setItem('portide_user_session', JSON.stringify(session));
};

export const clearStoredSession = (): void => {
  localStorage.removeItem('portide_user_session');
};

type SessionExpiredHandler = (message: string) => void;
let onSessionExpiredCallback: SessionExpiredHandler | null = null;

export const registerSessionExpiredHandler = (handler: SessionExpiredHandler) => {
  onSessionExpiredCallback = handler;
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const session = getStoredSession();
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Default Content-Type to application/json if body is stringified JSON and Content-Type is not set
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach session authorization headers for Django backend
  if (session) {
    if (session.email && !headers['X-User-Email']) {
      headers['X-User-Email'] = session.email;
    }
    if (session.role && !headers['X-User-Role']) {
      headers['X-User-Role'] = session.role;
    }
    if (session.id && !headers['X-User-Id']) {
      headers['X-User-Id'] = String(session.id);
    }
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Centralized Session Expiration Interception
    if (response.status === 401 && !endpoint.includes('/api/auth/login/')) {
      clearStoredSession();
      if (onSessionExpiredCallback) {
        onSessionExpiredCallback('Your session has expired. Please sign in again.');
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
};
