'use strict';
/* =========================================================
   google.js — Lectura de Google Calendar (solo lectura)
   Usa Google Identity Services para pedir permiso y la API REST
   de Calendar. No necesita servidor: todo ocurre en el navegador.
   El token dura ~1 hora; después basta con pulsar "Conectar".
   ========================================================= */

const GCal = {
  SCOPE: 'https://www.googleapis.com/auth/calendar.readonly',
  API: 'https://www.googleapis.com/calendar/v3/',
  token: null,
  exp: 0,
  cache: {},
  calendars: null,
  libPromise: null,

  init() {
    const t = Store.get('gtoken', null);
    if (t && t.exp > Date.now()) { this.token = t.token; this.exp = t.exp; }
    if (this.configured()) this.loadLib().catch(() => {});
  },

  configured() { return !!(App.settings.googleClientId || '').trim(); },
  connected() { return !!this.token && Date.now() < this.exp; },
  /** true si alguna vez se conectó (para mostrar "Reconectar") */
  wasConnected() { return Store.get('gconnected', false); },

  loadLib() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (this.libPromise) return this.libPromise;
    this.libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { this.libPromise = null; reject(new Error('No se pudo cargar Google (¿sin conexión?)')); };
      document.head.appendChild(s);
    });
    return this.libPromise;
  },

  /** Debe llamarse directamente desde un toque del usuario (si no, el navegador bloquea la ventana) */
  connect() {
    return new Promise((resolve, reject) => {
      if (!this.configured()) return reject(new Error('Primero añade tu Client ID en Ajustes'));
      if (!(window.google && google.accounts && google.accounts.oauth2)) {
        this.loadLib().catch(() => {});
        return reject(new Error('Cargando Google… vuelve a pulsar en un segundo'));
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: App.settings.googleClientId.trim(),
        scope: this.SCOPE,
        callback: (r) => {
          if (r.error) return reject(new Error(r.error_description || 'Google rechazó el permiso'));
          // Google deja desmarcar el permiso del calendario en la pantalla de consentimiento
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, this.SCOPE)) {
            return reject(new Error('No marcaste el permiso del calendario. Vuelve a pulsar Conectar y márcalo'));
          }
          this.token = r.access_token;
          this.exp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
          Store.set('gtoken', { token: this.token, exp: this.exp });
          Store.set('gconnected', true);
          this.cache = {};
          this.calendars = null;
          resolve();
        },
        error_callback: (e) => reject(new Error(e && e.type === 'popup_closed' ? 'Has cerrado la ventana de Google' : 'No se pudo abrir la ventana de Google')),
      });
      client.requestAccessToken({ prompt: this.wasConnected() ? '' : 'consent' });
    });
  },

  disconnect() {
    if (this.token && window.google && google.accounts) { try { google.accounts.oauth2.revoke(this.token, () => {}); } catch (e) {} }
    this.token = null; this.exp = 0; this.cache = {}; this.calendars = null;
    Store.remove('gtoken');
    Store.set('gconnected', false);
  },

  clearCache() { this.cache = {}; this.calendars = null; },

  async api(path) {
    const r = await fetch(this.API + path, { headers: { Authorization: 'Bearer ' + this.token } });
    if (r.status === 401) {
      this.token = null; Store.remove('gtoken');
      throw new Error('La sesión de Google ha caducado. Vuelve a conectar.');
    }
    if (!r.ok) {
      // Traducimos los errores más habituales a algo comprensible
      let reason = '', msg = '';
      try { const j = await r.json(); reason = (j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || j.error.status || ''; msg = j.error.message || ''; } catch (e) {}
      if (r.status === 403 && (/accessNotConfigured|SERVICE_DISABLED/i.test(reason) || /has not been used|is disabled/i.test(msg))) {
        throw new Error('La Google Calendar API no está habilitada en tu proyecto de Google Cloud');
      }
      if (r.status === 403 && /insufficient|PERMISSION_DENIED/i.test(reason + msg)) {
        this.token = null; Store.remove('gtoken');
        throw new Error('Falta el permiso para ver tus calendarios. Pulsa Conectar y marca la casilla del calendario');
      }
      throw new Error(`Error de Google Calendar (${r.status})${msg ? ': ' + msg : ''}`);
    }
    return r.json();
  },

  /** Calendarios que tienes visibles en Google Calendar */
  async getCalendars() {
    if (this.calendars) return this.calendars;
    const d = await this.api('users/me/calendarList?minAccessRole=reader');
    this.calendars = (d.items || [])
      .filter((c) => c.selected || c.primary)
      .map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, color: c.backgroundColor || '#4285F4' }));
    return this.calendars;
  },

  /** Eventos de un día concreto (k = 'YYYY-MM-DD') */
  async eventsFor(k) {
    if (this.cache[k]) return this.cache[k];
    const cals = await this.getCalendars();
    const q = new URLSearchParams({
      timeMin: D.parse(k).toISOString(),
      timeMax: D.parse(D.add(k, 1)).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    }).toString();
    const lists = await Promise.all(cals.map((c) =>
      this.api(`calendars/${encodeURIComponent(c.id)}/events?${q}`)
        .then((d) => (d.items || []).map((e) => this.mapEvent(e, c, k)))
        .catch((err) => { if (!this.token) throw err; return []; })));
    const evs = lists.flat().filter(Boolean);
    this.cache[k] = evs;
    return evs;
  },

  mapEvent(e, cal, k) {
    if (e.status === 'cancelled') return null;
    const allDay = !!(e.start && e.start.date);
    let start = 0, end = 1440;
    if (!allDay) {
      const s = new Date(e.start.dateTime), en = new Date(e.end.dateTime);
      start = D.key(s) < k ? 0 : s.getHours() * 60 + s.getMinutes();
      end = D.key(en) > k ? 1440 : en.getHours() * 60 + en.getMinutes();
    }
    return {
      type: 'event',
      id: e.id,
      title: e.summary || '(Sin título)',
      allDay, start, end,
      color: cal.color,
      calName: cal.name,
      location: e.location || '',
      description: (e.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '),
      link: e.htmlLink || '',
      sub: [e.location && '📍 ' + e.location].filter(Boolean).join(''),
    };
  },
};
