import { getStore, connectLambda } from '@netlify/blobs';

const STORE_NAME = 'turnero-repuestos-db';
const STATE_KEY = 'state';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

const slugify = (text = '') => text
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || `casa-${Date.now()}`;

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const decode = (token) => JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));

const initialState = () => ({
  version: 1,
  createdAt: now(),
  stores: [],
  users: [
    {
      id: 'user_super',
      username: 'super',
      password: 'super123',
      name: 'Super Usuario',
      role: 'super_admin',
      storeSlug: null,
      active: true,
      puesto: null,
    },
  ],
  tickets: [],
});

async function loadState() {
  const store = getStore(STORE_NAME);
  const current = await store.get(STATE_KEY, { type: 'json' });
  if (current) return current;
  const seed = initialState();
  await store.setJSON(STATE_KEY, seed);
  return seed;
}

async function saveState(state) {
  const store = getStore(STORE_NAME);
  state.updatedAt = now();
  await store.setJSON(STATE_KEY, state);
}

function publicBaseUrl(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host || 'localhost:8888';
  return `${proto}://${host}`;
}

function currentUser(event, state) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = decode(token);
    const user = state.users.find(u => u.id === payload.id && u.active);
    if (!user) return null;
    return user;
  } catch {
    return null;
  }
}

function requireUser(event, state) {
  const user = currentUser(event, state);
  if (!user) throw Object.assign(new Error('No autorizado'), { statusCode: 401 });
  return user;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    throw Object.assign(new Error('Permiso insuficiente'), { statusCode: 403 });
  }
}

function getBody(event) {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { return {}; }
}

function storeForUser(state, slug, user) {
  const store = state.stores.find(s => s.slug === slug && s.active !== false);
  if (!store) throw Object.assign(new Error('Casa no encontrada'), { statusCode: 404 });
  if (user.role !== 'super_admin' && user.storeSlug !== slug) {
    throw Object.assign(new Error('No pertenece a esta casa'), { statusCode: 403 });
  }
  return store;
}

function visibleTicket(t) {
  return {
    id: t.id,
    storeSlug: t.storeSlug,
    code: t.code,
    number: t.number,
    name: t.name,
    type: t.type,
    status: t.status,
    puesto: t.puesto,
    vendorName: t.vendorName,
    createdAt: t.createdAt,
    calledAt: t.calledAt,
    finishedAt: t.finishedAt,
  };
}

export async function handler(event) {
  connectLambda(event);
  const action = event.queryStringParameters?.action || '';
  const method = event.httpMethod;

  try {
    const state = await loadState();
    const body = getBody(event);

    if (action === 'login' && method === 'POST') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const user = state.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password && u.active);
      if (!user) return json(401, { error: 'Usuario o contraseña incorrectos' });
      const token = encode({ id: user.id, username: user.username, role: user.role, iat: Date.now() });
      return json(200, { token, user: { ...user, password: undefined } });
    }

    if (action === 'public-store' && method === 'GET') {
      const slug = event.queryStringParameters?.slug;
      const store = state.stores.find(s => s.slug === slug && s.active !== false);
      if (!store) return json(404, { error: 'Casa no encontrada' });
      return json(200, { store: { slug: store.slug, name: store.name, puestos: store.puestos, theme: store.theme } });
    }

    if (action === 'public-tickets' && method === 'GET') {
      const slug = event.queryStringParameters?.slug;
      const store = state.stores.find(s => s.slug === slug && s.active !== false);
      if (!store) return json(404, { error: 'Casa no encontrada' });
      const tickets = state.tickets.filter(t => t.storeSlug === slug && t.date === today());
      const called = tickets.filter(t => t.status === 'llamado').sort((a, b) => (b.calledAt || '').localeCompare(a.calledAt || '')).slice(0, 8);
      const pending = tickets.filter(t => t.status === 'pendiente').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 15);
      return json(200, { store: { slug: store.slug, name: store.name, theme: store.theme }, called: called.map(visibleTicket), pending: pending.map(visibleTicket), lastCalled: called[0] ? visibleTicket(called[0]) : null });
    }

    if (action === 'take-ticket' && method === 'POST') {
      const slug = String(body.slug || '').trim();
      const type = body.type === 'mecanico' ? 'mecanico' : 'particular';
      const name = String(body.name || '').trim().slice(0, 50);
      if (!name) return json(400, { error: 'Ingresá un nombre' });
      const store = state.stores.find(s => s.slug === slug && s.active !== false);
      if (!store) return json(404, { error: 'Casa no encontrada' });
      if (store.lastResetDate !== today()) {
        store.lastResetDate = today();
        store.counterParticular = 0;
        store.counterMecanico = 0;
      }
      const field = type === 'mecanico' ? 'counterMecanico' : 'counterParticular';
      store[field] = Number(store[field] || 0) + 1;
      const number = store[field];
      const code = `${type === 'mecanico' ? 'M' : 'P'}-${String(number).padStart(3, '0')}`;
      const ticket = { id: id('ticket'), storeSlug: slug, date: today(), code, number, name, type, status: 'pendiente', puesto: null, vendorId: null, vendorName: null, createdAt: now(), calledAt: null, finishedAt: null };
      state.tickets.push(ticket);
      await saveState(state);
      return json(200, { ticket: visibleTicket(ticket) });
    }

    const user = requireUser(event, state);

    if (action === 'me' && method === 'GET') {
      return json(200, { user: { ...user, password: undefined } });
    }

    if (action === 'stores' && method === 'GET') {
      requireRole(user, ['super_admin']);
      const base = publicBaseUrl(event);
      return json(200, { stores: state.stores.map(s => ({ ...s, qrUrl: `${base}/turno/${s.slug}` })) });
    }

    if (action === 'create-store' && method === 'POST') {
      requireRole(user, ['super_admin']);
      const name = String(body.name || '').trim();
      if (!name) return json(400, { error: 'Falta el nombre de la casa' });
      let slug = slugify(body.slug || name);
      let n = 2;
      const original = slug;
      while (state.stores.some(s => s.slug === slug)) slug = `${original}-${n++}`;
      const puestos = String(body.puestos || 'A,B,C').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
      const adminUsername = String(body.adminUsername || `${slug}_admin`).trim().toLowerCase();
      const adminPassword = String(body.adminPassword || Math.random().toString(36).slice(2, 10)).trim();
      if (state.users.some(u => u.username.toLowerCase() === adminUsername.toLowerCase())) return json(400, { error: 'Ese usuario admin ya existe' });
      const store = { id: id('store'), name, slug, address: String(body.address || '').trim(), active: true, puestos, counterParticular: 0, counterMecanico: 0, lastResetDate: today(), theme: { accent: body.accent || '#111827' }, createdAt: now() };
      state.stores.push(store);
      state.users.push({ id: id('user'), username: adminUsername, password: adminPassword, name: `Administrador ${name}`, role: 'admin_casa', storeSlug: slug, active: true, puesto: puestos[0] || 'A', createdAt: now() });
      await saveState(state);
      const base = publicBaseUrl(event);
      return json(200, { store: { ...store, qrUrl: `${base}/turno/${slug}`, tvUrl: `${base}/tv/${slug}`, panelUrl: `${base}/admin/${slug}` }, admin: { username: adminUsername, password: adminPassword } });
    }

    if (action === 'store-detail' && method === 'GET') {
      const slug = event.queryStringParameters?.slug || user.storeSlug;
      const store = storeForUser(state, slug, user);
      const users = state.users.filter(u => u.storeSlug === slug && u.active !== false).map(u => ({ ...u, password: undefined }));
      const base = publicBaseUrl(event);
      return json(200, { store: { ...store, qrUrl: `${base}/turno/${slug}`, tvUrl: `${base}/tv/${slug}`, panelUrl: `${base}/panel/${slug}` }, users });
    }

    if (action === 'create-vendor' && method === 'POST') {
      const slug = body.slug || user.storeSlug;
      const store = storeForUser(state, slug, user);
      requireRole(user, ['super_admin', 'admin_casa']);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const name = String(body.name || username).trim();
      const puesto = String(body.puesto || store.puestos[0] || 'A').trim().toUpperCase();
      if (!username || !password) return json(400, { error: 'Falta usuario o contraseña' });
      if (state.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return json(400, { error: 'Ese usuario ya existe' });
      const newUser = { id: id('user'), username, password, name, role: 'vendedor', storeSlug: slug, active: true, puesto, createdAt: now() };
      state.users.push(newUser);
      await saveState(state);
      return json(200, { user: { ...newUser, password: undefined } });
    }


    if (action === 'update-user-password' && method === 'POST') {
      const slug = body.slug || user.storeSlug;
      storeForUser(state, slug, user);
      requireRole(user, ['super_admin', 'admin_casa']);
      const target = state.users.find(u => u.id === body.userId && u.storeSlug === slug && u.active !== false);
      if (!target) return json(404, { error: 'Usuario no encontrado' });
      if (target.role !== 'vendedor') return json(403, { error: 'Solo se puede cambiar la clave de vendedores desde este panel' });
      const password = String(body.password || '').trim();
      if (password.length < 3) return json(400, { error: 'La contraseña debe tener al menos 3 caracteres' });
      target.password = password;
      target.updatedAt = now();
      await saveState(state);
      return json(200, { ok: true, user: { ...target, password: undefined } });
    }

    if (action === 'tickets' && method === 'GET') {
      const slug = event.queryStringParameters?.slug || user.storeSlug;
      storeForUser(state, slug, user);
      const tickets = state.tickets.filter(t => t.storeSlug === slug && t.date === today()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return json(200, { tickets: tickets.map(visibleTicket) });
    }

    if (action === 'call-next' && method === 'POST') {
      const slug = body.slug || user.storeSlug;
      const store = storeForUser(state, slug, user);
      requireRole(user, ['super_admin', 'admin_casa', 'vendedor']);
      const puesto = String(body.puesto || user.puesto || store.puestos[0] || 'A').trim().toUpperCase();
      const ticket = state.tickets.filter(t => t.storeSlug === slug && t.date === today() && t.status === 'pendiente').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!ticket) return json(404, { error: 'No hay turnos pendientes' });
      ticket.status = 'llamado';
      ticket.puesto = puesto;
      ticket.vendorId = user.id;
      ticket.vendorName = user.name;
      ticket.calledAt = now();
      await saveState(state);
      return json(200, { ticket: visibleTicket(ticket) });
    }

    if (action === 'recall' && method === 'POST') {
      const slug = body.slug || user.storeSlug;
      storeForUser(state, slug, user);
      requireRole(user, ['super_admin', 'admin_casa', 'vendedor']);
      const ticket = state.tickets.find(t => t.id === body.ticketId && t.storeSlug === slug);
      if (!ticket) return json(404, { error: 'Turno no encontrado' });
      ticket.status = 'llamado';
      ticket.calledAt = now();
      if (body.puesto) ticket.puesto = String(body.puesto).toUpperCase();
      await saveState(state);
      return json(200, { ticket: visibleTicket(ticket) });
    }

    if (action === 'finish-ticket' && method === 'POST') {
      const slug = body.slug || user.storeSlug;
      storeForUser(state, slug, user);
      requireRole(user, ['super_admin', 'admin_casa', 'vendedor']);
      const ticket = state.tickets.find(t => t.id === body.ticketId && t.storeSlug === slug);
      if (!ticket) return json(404, { error: 'Turno no encontrado' });
      ticket.status = 'atendido';
      ticket.finishedAt = now();
      await saveState(state);
      return json(200, { ticket: visibleTicket(ticket) });
    }

    if (action === 'skip-ticket' && method === 'POST') {
      const slug = body.slug || user.storeSlug;
      storeForUser(state, slug, user);
      requireRole(user, ['super_admin', 'admin_casa', 'vendedor']);
      const ticket = state.tickets.find(t => t.id === body.ticketId && t.storeSlug === slug);
      if (!ticket) return json(404, { error: 'Turno no encontrado' });
      ticket.status = 'saltado';
      ticket.finishedAt = now();
      await saveState(state);
      return json(200, { ticket: visibleTicket(ticket) });
    }

    if (action === 'reset-day' && method === 'POST') {
      const slug = body.slug || user.storeSlug;
      const store = storeForUser(state, slug, user);
      requireRole(user, ['super_admin', 'admin_casa']);
      store.counterParticular = 0;
      store.counterMecanico = 0;
      store.lastResetDate = today();
      state.tickets = state.tickets.filter(t => !(t.storeSlug === slug && t.date === today()));
      await saveState(state);
      return json(200, { ok: true });
    }

    return json(404, { error: 'Acción no encontrada' });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Error interno' });
  }
}
