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
 * Tab-Isolated Session Storage:
 * Uses browser sessionStorage so that different tabs can maintain independent user sessions
 * (e.g. Tab 1 as Port Administrator, Tab 2 as Port Operations Officer) without cross-tab
 * account overriding on page refresh.
 */
export const getStoredSession = (): StoredSession | null => {
  // 1. Check tab-isolated sessionStorage
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

  // 2. Fallback / Migration: If an existing session exists in legacy localStorage,
  // migrate it into this tab's sessionStorage and delete from localStorage so other tabs won't collide.
  try {
    const legacy = localStorage.getItem('portide_user_session');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      sessionStorage.setItem('portide_user_session', legacy);
      localStorage.removeItem('portide_user_session');
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
  try {
    // Store strictly in this tab's sessionStorage to isolate each browser tab
    sessionStorage.setItem('portide_user_session', JSON.stringify(session));
    // Clean up any lingering localStorage to prevent any other tab from reading it
    localStorage.removeItem('portide_user_session');
  } catch (err) {
    console.error('Failed to store session in sessionStorage:', err);
  }
};

export const clearStoredSession = (): void => {
  try {
    sessionStorage.removeItem('portide_user_session');
    localStorage.removeItem('portide_user_session');
  } catch (err) {
    console.error('Failed to clear stored session:', err);
  }
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
