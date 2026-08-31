import { FalhaEvent, DashboardStats, LogEntry, SystemConfig } from '../types';

const TOKEN_KEY = 'industrial_alert_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuthToken();
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || 'Erro na requisição com o servidor');
  }

  return data as T;
}

export const api = {
  // Auth
  login: (accessCode: string) =>
    request<{ success: boolean; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ accessCode }),
    }),

  verifyAuth: () => request<{ authenticated: boolean }>('/api/auth/verify'),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }).finally(() => {
      clearAuthToken();
    }),

  // Dashboard & Fila de Falhas
  getStats: () => request<DashboardStats>('/api/stats'),
  getFalhas: (limit = 100) => request<FalhaEvent[]>(`/api/falhas?limit=${limit}`),
  simulateFalha: (data: { equipamento_id: string; setor?: string; user: string }) =>
    request<{ success: boolean; event: FalhaEvent }>('/api/falhas/simular', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  retryFalha: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/falhas/${id}/retry`, {
      method: 'POST',
    }),

  // Logs & Config
  getLogs: () => request<LogEntry[]>('/api/logs'),
  getConfig: () => request<SystemConfig>('/api/config'),
  runCleanup: () => request<{ success: boolean; count: number; message: string }>('/api/cleaner/run', { method: 'POST' }),
  resetThrottle: (equipamento_id: string) =>
    request<{ success: boolean }>('/api/throttling/reset', {
      method: 'POST',
      body: JSON.stringify({ equipamento_id }),
    }),

  // WhatsApp
  getWhatsAppStatus: () => request<{ status: string; qrCode: string | null }>('/whatsapp/status'),
  connectWhatsApp: () => request<{ success: boolean; message: string }>('/whatsapp/connect', { method: 'POST' }),
  disconnectWhatsApp: () => request<{ success: boolean; message: string }>('/whatsapp/disconnect', { method: 'POST' }),
  sendTestMessage: (phone: string) =>
    request<{ success: boolean; messageId?: string }>('/whatsapp/send-test', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
};
