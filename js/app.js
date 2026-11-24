'use strict';
/* =========================================================
   app.js — Núcleo de la app: utilidades, almacenamiento,
   fechas, iconos, componentes compartidos y navegación.
   ========================================================= */

/* ---------- Utilidades pequeñas ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const vibrate = (ms = 10) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/** Convierte un string HTML en un elemento del DOM */
function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Client ID de Google Cloud (no es secreto: solo funciona en los orígenes autorizados) */
const GOOGLE_CLIENT_ID = '356618214947-hkk28q1h2oaopigitsvhqjalt7ch0snp.apps.googleusercontent.com';

/** Paleta de colores para hábitos y asignaturas */
const COLORS = ['#6C63FF', '#FF6B6B', '#FF9F43', '#F7B731', '#20BF6B', '#0FB9B1', '#45AAF2', '#4B7BEC', '#A55EEA', '#FF6FB5'];

/* ---------- Almacenamiento (localStorage) ---------- */
const Store = {
  prefix: 'miDia.',
  get(key, fallback) {
    try {
      const v = localStorage.getItem(this.prefix + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) { localStorage.setItem(this.prefix + key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(this.prefix + key); },
  keys() { return Object.keys(localStorage).filter((k) => k.startsWith(this.prefix)).map((k) => k.slice(this.prefix.length)); },
};

/* ---------- Fechas ----------
   Trabajamos con "claves" de día tipo '2026-11-24' (hora local).
   Los días de la semana van de 0 = lunes a 6 = domingo.          */
const D = {
  DAYS_SHORT: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  DAYS: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  key(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  parse(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); },
  today() { return D.key(); },
  add(k, n) { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
  wd(k) { return (D.parse(k).getDay() + 6) % 7; },
  weekStart(k) { return D.add(k, -D.wd(k)); },
  diff(a, b) { return Math.round((D.parse(a) - D.parse(b)) / 86400000); },
  fmt(k, opts) { return D.parse(k).toLocaleDateString('es-ES', opts); },
  cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); },
  long(k) { return D.cap(D.fmt(k, { weekday: 'long', day: 'numeric', month: 'long' })); },
  short(k) { return D.fmt(k, { day: 'numeric', month: 'short' }); },
  relative(k) {
    const n = D.diff(k, D.today());
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    if (n === -1) return 'Ayer';
    return D.long(k);
  },
  toMin(hhmm) { const [hh, mm] = hhmm.split(':').map(Number); return hh * 60 + mm; },
  fromMin(min) { min = Math.max(0, Math.min(min, 1440)) % 1440; return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; },
  nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },
  duration(min) { const hh = Math.floor(min / 60), mm = min % 60; return [hh && `${hh} h`, mm && `${mm} min`].filter(Boolean).join(' '); },
};

/* ---------- Iconos SVG ---------- */
const svg = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const Icons = {
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="3"'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.5"'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevL: svg('<path d="M15 6l-6 6 6 6"/>'),
  chevR: svg('<path d="M9 6l6 6-6 6"/>'),
  gear: svg('<path d="M4 6h9M18 6h2M4 12h3M12 12h8M4 18h11M20 18h0"/><circle cx="15.5" cy="6" r="2.3"/><circle cx="9.5" cy="12" r="2.3"/><circle cx="17.5" cy="18" r="2.3"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  habits: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'),
  tasks: svg('<path d="M11 6h9M11 12h9M11 18h9"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5"/><circle cx="5" cy="18" r="1.4"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  refresh: svg('<path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>',
};

/* ---------- Toast (avisos breves abajo) ---------- */
const Toast = {
  timer: null,
  show(msg, { action, onAction, duration = Math.max(3200, String(msg).length * 70) } = {}) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
    if (action) $('button', el).onclick = () => { onAction && onAction(); this.hide(); };
    el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), duration);
  },
  hide() { $('#toast').classList.remove('show'); },
};

/* ---------- Hoja inferior (bottom sheet) para formularios ---------- */
const Sheet = {
  open({ title, body, onMount }) {
    const root = $('#sheet-root');
    root.innerHTML = `
      <div class="sheet-backdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <h2>${esc(title)}</h2>
          <button class="icon-btn sm" data-close aria-label="Cerrar">${Icons.x}</button>
        </div>
        <div class="sheet-body">${body}</div>
      </div>`;
    root.classList.add('open');
    document.body.classList.add('no-scroll');
    $('.sheet-backdrop', root).onclick = () => this.close();
    $('[data-close]', root).onclick = () => this.close();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('visible')));
    if (onMount) onMount($('.sheet-body', root));
  },
  close() {
    const root = $('#sheet-root');
    root.classList.remove('visible');
    document.body.classList.remove('no-scroll');
    setTimeout(() => {
      if (!root.classList.contains('visible')) { root.classList.remove('open'); root.innerHTML = ''; }
    }, 280);
  },
  isOpen() { return $('#sheet-root').classList.contains('open'); },
};

/** Diálogo de confirmación. Devuelve una promesa con true/false */
function confirmSheet(title, text, okText = 'Eliminar') {
  return new Promise((resolve) => {
    Sheet.open({
      title,
      body: `<p class="muted">${esc(text)}</p>
        <div class="btn-row">
          <button class="btn" data-no>Cancelar</button>
          <button class="btn btn-danger" data-yes>${esc(okText)}</button>
        </div>`,
      onMount: (b) => {
        $('[data-no]', b).onclick = () => { Sheet.close(); resolve(false); };
        $('[data-yes]', b).onclick = () => { Sheet.close(); resolve(true); };
      },
    });
  });
}

/* ---------- Selector de color reutilizable ---------- */
function colorPickerHTML(selected) {
  return `<div class="color-row">${COLORS.map((c) =>
    `<button type="button" class="color-opt ${c.toLowerCase() === String(selected).toLowerCase() ? 'sel' : ''}" style="--c:${c}" data-c="${c}" aria-label="Color ${c}"></button>`).join('')}</div>`;
}
function wireColorPicker(root, onPick) {
  $$('.color-opt', root).forEach((b) => (b.onclick = () => {
    $$('.color-opt', root).forEach((x) => x.classList.remove('sel'));
    b.classList.add('sel');
    onPick(b.dataset.c);
  }));
}

/* ---------- Tira de fechas (semana) ----------
   mark(k) puede devolver 'full' | 'some' | '' para pintar un puntito. */
function DateStrip(selected, onChange, { mark } = {}) {
  const el = h('<div class="date-strip card"></div>');
  let ws = D.weekStart(selected);

  const draw = () => {
    const today = D.today();
    const month = D.cap(D.fmt(D.add(ws, 3), { month: 'long', year: 'numeric' }));
    const showToday = selected !== today || ws !== D.weekStart(today);
    let days = '';
    for (let i = 0; i < 7; i++) {
      const k = D.add(ws, i);
      const m = mark ? mark(k) : '';
      days += `<button class="day-pill ${k === selected ? 'active' : ''} ${k === today ? 'today' : ''}" data-k="${k}">
          <span class="dp-wd">${D.DAYS_SHORT[i]}</span>
          <span class="dp-num">${D.parse(k).getDate()}</span>
          <span class="dp-dot ${m || ''}"></span>
        </button>`;
    }
    el.innerHTML = `
      <div class="ds-head">
        <span class="ds-month">${month}</span>
        <div class="ds-actions">
          ${showToday ? '<button class="pill-btn" data-today>Hoy</button>' : ''}
          <button class="icon-btn sm" data-prev aria-label="Semana anterior">${Icons.chevL}</button>
          <button class="icon-btn sm" data-next aria-label="Semana siguiente">${Icons.chevR}</button>
        </div>
      </div>
      <div class="ds-days">${days}</div>`;
  };

  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-prev')) { ws = D.add(ws, -7); draw(); }
    else if (t.hasAttribute('data-next')) { ws = D.add(ws, 7); draw(); }
    else if (t.hasAttribute('data-today')) onChange(D.today());
    else if (t.dataset.k) onChange(t.dataset.k);
  });

  // Deslizar a izquierda/derecha para cambiar de semana
  let sx = null;
  el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) { ws = D.add(ws, dx < 0 ? 7 : -7); draw(); }
    sx = null;
  });

  draw();
  return el;
}

/** Estado vacío bonito */
function emptyState(emoji, title, text, btnText, onClick) {
  const el = h(`<div class="empty">
      <div class="empty-emoji">${emoji}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${btnText ? `<button class="btn btn-primary">${esc(btnText)}</button>` : ''}
    </div>`);
  if (btnText) $('button', el).onclick = onClick;
  return el;
}

/* =========================================================
   App: navegación entre pestañas, tema y arranque
   ========================================================= */
const App = {
  tab: 'habits',
  modules: {},
  settings: Object.assign({ theme: 'auto', accent: '#6C63FF' }, Store.get('settings', {}), {
    googleClientId: Store.get('settings', {}).googleClientId || GOOGLE_CLIENT_ID,
  }),
  lastDay: D.today(),

  register(name, mod) { this.modules[name] = mod; },

  saveSettings() { Store.set('settings', this.settings); this.applyTheme(); },

  applyTheme() {
    const s = this.settings;
    const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--accent', s.accent);
    $('meta[name=theme-color]').content = dark ? '#0E0F15' : '#F4F5FA';
  },

  greeting() {
    const hr = new Date().getHours();
    if (hr < 6) return 'Buenas noches';
    if (hr < 13) return 'Buenos días';
    if (hr < 21) return 'Buenas tardes';
    return 'Buenas noches';
  },

  go(tab) {
    if (!this.modules[tab]) tab = 'habits';
    this.prevTab = this.tab === 'settings' ? this.prevTab : this.tab;
    this.tab = tab;
    if (tab !== 'settings') Store.set('tab', tab);
    this.render(true);
    window.scrollTo({ top: 0 });
  },

  /** Vuelve a pintar la pestaña actual (animate = animación de entrada) */
  render(animate = false) {
    const mod = this.modules[this.tab];
    $('#title').textContent = mod.title;
    $('#subtitle').textContent = `${this.greeting()} · ${D.long(D.today())}`;
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    $('#settings-btn').classList.toggle('active', this.tab === 'settings');

    const fab = $('#fab');
    fab.hidden = !mod.fab;
    fab.onclick = mod.fab ? () => mod.fab() : null;

    const view = $('#view');
    view.innerHTML = '';
    if (animate) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
    mod.render(view);
  },

  refresh() { this.render(false); },

  init() {
    // Iconos de la interfaz
    $$('[data-icon]').forEach((el) => (el.innerHTML = Icons[el.dataset.icon]));
    $('#settings-btn').innerHTML = Icons.gear;
    $('#fab').innerHTML = Icons.plus;

    this.applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());

    $$('.tab').forEach((b) => (b.onclick = () => this.go(b.dataset.tab)));
    $('#settings-btn').onclick = () => this.go(this.tab === 'settings' ? (this.prevTab || 'habits') : 'settings');
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && Sheet.isOpen()) Sheet.close(); });

    // Si la app se queda abierta y cambia el día, volvemos a "hoy"
    const checkNewDay = () => {
      if (D.today() !== this.lastDay) {
        this.lastDay = D.today();
        Object.values(this.modules).forEach((m) => { if ('sel' in m) m.sel = this.lastDay; });
      }
      this.refresh();
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
    setInterval(() => { if (!document.hidden && !Sheet.isOpen()) checkNewDay(); }, 60000);

    if (typeof GCal !== 'undefined') GCal.init();

    this.tab = Store.get('tab', 'habits');
    this.go(this.tab);

    // Service worker: permite instalarla y usarla sin conexión
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },
};
