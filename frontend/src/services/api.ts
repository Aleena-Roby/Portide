/**
 * Centralized API Client and Interceptor for PORTIDE.
 * Automatically attaches session headers (X-User-Email, X-User-Role, X-User-Id)
 * and intercepts 401/403 session expiration errors.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

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
  mustChangePassword?: boolean;
}

/**
 * Dual-Tier Tab-Isolated Session Storage:
 * 1. Checks tab-isolated sessionStorage FIRST so each browser tab maintains its own active
 *    role/account without cross-tab collisions when refreshed.
 * 2. Falls back to localStorage if this is a newly opened tab or window, ensuring users
 *    never get logged out unexpectedly when opening new tabs.
 */
export const getStoredSession = (): StoredSession | null => {
  // 1. Check tab-isolated sessionStorage first
  try {
    const raw = sessionStorage.getItem('portide_user_session');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    try {
      sessionStorage.removeItem('portide_user_session');
    } catch {}
  }

  // 2. Persistent fallback: localStorage (for newly opened tabs or page restorations)
  try {
    const fallback = localStorage.getItem('portide_user_session');
    if (fallback) {
      const parsed = JSON.parse(fallback);
      // Populate this tab's sessionStorage so subsequent refreshes strictly use this tab's state
      try {
        sessionStorage.setItem('portide_user_session', fallback);
      } catch {}
      return parsed;
    }
  } catch {
    try {
      localStorage.removeItem('portide_user_session');
    } catch {}
  }

  return null;
};

export const setStoredSession = (session: StoredSession): void => {
  const jsonStr = JSON.stringify(session);
  try {
    // Store in tab's isolated sessionStorage
    sessionStorage.setItem('portide_user_session', jsonStr);
  } catch (err) {
    console.error('Failed to write to sessionStorage:', err);
  }

  try {
    // Also store in localStorage as persistent fallback
    localStorage.setItem('portide_user_session', jsonStr);
  } catch (err) {
    console.error('Failed to write to localStorage:', err);
  }
};

export const clearStoredSession = (): void => {
  try {
    sessionStorage.removeItem('portide_user_session');
  } catch {}
  try {
    localStorage.removeItem('portide_user_session');
  } catch {}
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

/**
 * Container Delivery Tracking API Client Methods
 */
export const deliveryApi = {
  getContainers: async (params?: { status?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') {
      searchParams.append('status', params.status);
    }
    if (params?.search && params.search.trim()) {
      searchParams.append('search', params.search.trim());
    }
    const query = searchParams.toString();
    const endpoint = `/api/delivery/containers/${query ? `?${query}` : ''}`;
    const res = await apiFetch(endpoint);
    try {
      const data = await res.json();
      if (!res.ok) {
        return {
          status: 'error',
          message: data?.detail || data?.message || `HTTP error ${res.status}`,
          results: [],
        };
      }
      return data;
    } catch {
      return {
        status: 'error',
        message: `Server returned HTTP ${res.status}`,
        results: [],
      };
    }
  },

  getContainerDetail: async (containerId: number) => {
    const res = await apiFetch(`/api/delivery/containers/${containerId}/`);
    try {
      const data = await res.json();
      if (!res.ok) {
        return {
          status: 'error',
          message: data?.detail || data?.message || `HTTP error ${res.status}`,
        };
      }
      return data;
    } catch {
      return {
        status: 'error',
        message: `Server returned HTTP ${res.status}`,
      };
    }
  },

  confirmDeparture: async (containerId: number, data?: { location?: string; remarks?: string }) => {
    const res = await apiFetch(`/api/delivery/containers/${containerId}/confirm-departure/`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
    return res.json();
  },

  updateStatus: async (containerId: number, data: { status: 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED'; location?: string; destination?: string; expected_delivery_date?: string | null; remarks?: string }) => {
    const res = await apiFetch(`/api/delivery/containers/${containerId}/update-status/`, {
      method: 'POST',
      body: JSON.stringify({
        target_status: data.status,
        location: data.location,
        destination: data.destination,
        expected_delivery_date: data.expected_delivery_date,
        remarks: data.remarks,
      }),
    });
    return res.json();
  },

  confirmDelivery: async (containerId: number, data: { delivered_location?: string; delivery_location?: string; delivered_to?: string; recipient_name?: string; remarks?: string }) => {
    const loc = data.delivery_location || data.delivered_location || '';
    const rec = data.recipient_name || data.delivered_to || '';
    const res = await apiFetch(`/api/delivery/containers/${containerId}/confirm-delivery/`, {
      method: 'POST',
      body: JSON.stringify({
        delivery_location: loc,
        delivered_location: loc,
        recipient_name: rec,
        delivered_to: rec,
        remarks: data.remarks,
      }),
    });
    return res.json();
  },

  reportException: async (containerId: number, data: { exception_type: string; remarks: string; location?: string }) => {
    const res = await apiFetch(`/api/delivery/containers/${containerId}/report-exception/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  trackPublicContainer: async (containerNumber: string) => {
    const clean = encodeURIComponent(containerNumber.trim());
    const res = await fetch(`${API_BASE_URL}/api/containers/track/?number=${clean}`);
    return res.json();
  },
};
