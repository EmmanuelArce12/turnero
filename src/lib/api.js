const API = '/.netlify/functions/api';

export function getToken() { return localStorage.getItem('turnero_token') || ''; }
export function setToken(token) { localStorage.setItem('turnero_token', token); }
export function clearToken() { localStorage.removeItem('turnero_token'); }

export async function api(action, options = {}) {
  const { method = 'GET', body, query = {}, auth = true } = options;
  const qs = new URLSearchParams({ action, ...query }).toString();
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}?${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}

export function ticketLabel(type) { return type === 'mecanico' ? 'Mecánico' : type === 'retiro' ? 'Retiro' : 'Particular'; }
export function statusLabel(status) {
  return { pendiente: 'Pendiente', llamado: 'Llamado', atendido: 'Atendido', saltado: 'Saltado' }[status] || status;
}
