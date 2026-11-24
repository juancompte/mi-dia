'use strict';
/* =========================================================
   habits.js — Seguimiento de hábitos
   Hábito: { id, name, emoji, color, freq:'daily'|'days'|'weekly',
             days:[0..6] (0 = lunes), target (veces/semana), created:'YYYY-MM-DD' }
   Registro: log[habitId]['YYYY-MM-DD'] = true
   ========================================================= */

const Habits = {
  title: 'Hábitos',
  sel: D.today(),
  list: Store.get('habits', []),
  log: Store.get('habitLog', {}),
  pop: null,

  EMOJIS: ['💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '📵', '🌅', '🧠', '💻', '🚶', '🏊', '🚴', '🍎', '☕', '💰', '🎯', '🌿', '🙏'],
  SUGGESTIONS: [
    { name: 'Beber 2 L de agua', emoji: '💧', color: '#45AAF2', freq: 'daily' },
    { name: 'Estudiar 1 hora', emoji: '📚', color: '#6C63FF', freq: 'days', days: [0, 1, 2, 3, 4] },
    { name: 'Ir al gimnasio', emoji: '💪', color: '#FF6B6B', freq: 'weekly', target: 3 },
    { name: 'Leer 20 minutos', emoji: '📖', color: '#20BF6B', freq: 'daily' },
  ],

  save() { Store.set('habits', this.list); Store.set('habitLog', this.log); },
  find(id) { return this.list.find((x) => x.id === id); },

  /* ---------- Lógica ---------- */
  isDue(h, k) {
    if (k < h.created) return false;
    if (h.freq === 'days') return h.days.includes(D.wd(k));
    return true; // diario y semanal se muestran todos los días
  },
  isDone(h, k) { return !!(this.log[h.id] && this.log[h.id][k]); },
  weekCount(h, k) {
    const ws = D.weekStart(k);
    let n = 0;
    for (let i = 0; i < 7; i++) if (this.isDone(h, D.add(ws, i))) n++;
    return n;
  },
  /** ¿Cuenta como "cumplido" para el anillo de ese día? */
  completeOn(h, k) {
    return h.freq === 'weekly' ? (this.isDone(h, k) || this.weekCount(h, k) >= h.target) : this.isDone(h, k);
  },

  toggle(h, k) {
    if (k > D.today()) { Toast.show('No puedes marcar días futuros 😉'); return false; }
    const l = this.log[h.id] || (this.log[h.id] = {});
    if (l[k]) delete l[k];
    else {
      l[k] = true;
      this.pop = h.id;
      vibrate(12);
      if (k < h.created) h.created = k;
    }
    this.save();
    return true;
  },

  /** Racha actual: días (o semanas) seguidos cumplidos */
  streak(h) {
    const today = D.today();
    if (h.freq === 'weekly') {
      let ws = D.weekStart(today), n = 0;
      if (this.weekCount(h, ws) >= h.target) n++;
      ws = D.add(ws, -7);
      const first = D.weekStart(h.created);
      while (ws >= first && this.weekCount(h, ws) >= h.target) { n++; ws = D.add(ws, -7); }
      return n;
    }
    let k = this.isDone(h, today) ? today : D.add(today, -1);
    let n = 0;
    while (k >= h.created) {
      if (this.isDue(h, k)) { if (this.isDone(h, k)) n++; else break; }
      k = D.add(k, -1);
    }
    return n;
  },

  bestStreak(h) {
    const today = D.today();
    let best = 0, cur = 0;
    if (h.freq === 'weekly') {
      for (let ws = D.weekStart(h.created); ws <= today; ws = D.add(ws, 7)) {
        if (this.weekCount(h, ws) >= h.target) best = Math.max(best, ++cur);
        else if (ws !== D.weekStart(today)) cur = 0;
      }
    } else {
      for (let k = h.created; k <= today; k = D.add(k, 1)) {
        if (!this.isDue(h, k)) continue;
        if (this.isDone(h, k)) best = Math.max(best, ++cur);
        else if (k !== today) cur = 0;
      }
    }
    return best;
  },

  /** % de cumplimiento en los últimos 30 días */
  rate(h) {
    const today = D.today();
    if (h.freq === 'weekly') {
      let weeks = 0, ok = 0;
      for (let i = 0; i < 4; i++) {
        const ws = D.add(D.weekStart(today), -7 * i);
        if (D.add(ws, 6) < h.created) break;
        weeks++;
        if (this.weekCount(h, ws) >= h.target) ok++;
      }
      return weeks ? Math.round((ok / weeks) * 100) : 0;
    }
    let due = 0, done = 0;
    for (let i = 0; i < 30; i++) {
      const k = D.add(today, -i);
      if (k < h.created) break;
      if (this.isDue(h, k)) { due++; if (this.isDone(h, k)) done++; }
    }
    return due ? Math.round((done / due) * 100) : 0;
  },

  total(h) { return Object.keys(this.log[h.id] || {}).length; },

  freqLabel(h) {
    if (h.freq === 'weekly') return `${h.target} ${h.target === 1 ? 'vez' : 'veces'} por semana`;
    if (h.freq === 'days') {
      if (h.days.length === 7) return 'Cada día';
      const s = [...h.days].sort().join();
      if (s === '0,1,2,3,4') return 'Entre semana';
      if (s === '5,6') return 'Fines de semana';
      return [...h.days].sort().map((i) => D.DAYS_SHORT[i]).join(' · ');
    }
    return 'Cada día';
  },

  /* ---------- Pintado ---------- */
  render(view) {
    const k = this.sel;
    view.append(DateStrip(k, (nk) => { this.sel = nk; App.refresh(); }, { mark: (dk) => this.markDay(dk) }));

    if (!this.list.length) { this.renderEmpty(view); return; }

    const due = this.list.filter((h) => this.isDue(h, k));
    const rest = this.list.filter((h) => !this.isDue(h, k) && k >= h.created);
    const done = due.filter((h) => this.completeOn(h, k)).length;
    const pct = due.length ? Math.round((done / due.length) * 100) : 0;

    // Resumen con anillo de progreso
    const C = 2 * Math.PI * 36;
    const isToday = k === D.today();
    let msg;
    if (!due.length) msg = 'Día libre de hábitos 🌴';
    else if (pct === 100) msg = isToday ? '¡Día perfecto! 🎉' : 'Día completado ✅';
    else if (!isToday && k < D.today()) msg = 'Resumen del día';
    else if (pct === 0) msg = '¡A por el día! 💪';
    else if (pct < 50) msg = 'Buen comienzo 🙌';
    else msg = 'Ya casi lo tienes 🔥';

    view.append(h(`<div class="card summary">
        <div class="ring ${pct === 100 ? 'full' : ''}">
          <svg viewBox="0 0 84 84"><circle class="track" cx="42" cy="42" r="36"/>
            <circle class="prog" cx="42" cy="42" r="36" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/></svg>
          <div class="ring-label">${pct}%</div>
        </div>
        <div class="summary-text">
          <h3>${msg}</h3>
          <p>${due.length ? `${done} de ${plural(due.length, 'hábito', 'hábitos')} · ${D.relative(k).toLowerCase()}` : 'Hoy no toca ninguno'}</p>
        </div>
      </div>`));

    const list = h('<div class="habit-list"></div>');
    due.forEach((hb) => list.append(this.card(hb, k)));
    view.append(list);

    if (rest.length) {
      view.append(h(`<p class="rest-note">Hoy descansan: ${rest.map((r) => `${r.emoji} ${esc(r.name)}`).join(', ')}</p>`));
    }
    this.pop = null;
  },

  markDay(k) {
    if (k > D.today()) return '';
    const due = this.list.filter((h) => this.isDue(h, k));
    if (!due.length) return '';
    const n = due.filter((h) => this.completeOn(h, k)).length;
    return n === due.length ? 'full' : n > 0 ? 'some' : '';
  },

  card(hb, k) {
    const done = this.isDone(hb, k);
    const st = this.streak(hb);
    let meta = '';
    if (hb.freq === 'weekly') {
      const c = this.weekCount(hb, k);
      const dots = Array.from({ length: Math.min(hb.target, 7) }, (_, i) => `<i class="${i < c ? 'on' : ''}"></i>`).join('');
      meta = `<span class="week-dots">${dots}</span> ${c}/${hb.target} esta semana`;
      if (st) meta += ` · <span class="streak">🔥 ${plural(st, 'sem', 'sem')}</span>`;
    } else {
      meta = st ? `<span class="streak">🔥 ${plural(st, 'día', 'días')}</span> · ${this.freqLabel(hb)}` : this.freqLabel(hb);
    }
    const el = h(`<div class="habit-card ${done ? 'done' : ''} ${this.pop === hb.id ? 'pop' : ''}" style="--c:${hb.color}">
        <button class="habit-main" data-open>
          <span class="habit-emoji">${esc(hb.emoji)}</span>
          <span class="habit-info">
            <span class="habit-name">${esc(hb.name)}</span>
            <span class="habit-meta">${meta}</span>
          </span>
        </button>
        <button class="check-btn" aria-label="${done ? 'Desmarcar' : 'Marcar como hecho'}">${Icons.check}</button>
      </div>`);
    $('.check-btn', el).onclick = () => { if (this.toggle(hb, k)) App.refresh(); };
    $('[data-open]', el).onclick = () => this.detail(hb);
    return el;
  },

  renderEmpty(view) {
    view.append(emptyState('🌱', 'Empieza tu primer hábito', 'Los pequeños hábitos diarios son los que más cambian tu día a día.', 'Crear hábito', () => this.form(null)));
    view.append(h('<div class="section-title">Ideas para empezar</div>'));
    const list = h('<div class="habit-list"></div>');
    this.SUGGESTIONS.forEach((s) => {
      const el = h(`<div class="habit-card" style="--c:${s.color}">
          <button class="habit-main"><span class="habit-emoji">${s.emoji}</span>
            <span class="habit-info"><span class="habit-name">${esc(s.name)}</span>
            <span class="habit-meta">${this.freqLabel({ days: [], target: 3, ...s })}</span></span></button>
          <button class="check-btn" style="color:var(--c)" aria-label="Añadir">${Icons.plus}</button>
        </div>`);
      el.onclick = () => {
        this.list.push({ id: uid(), days: [0, 1, 2, 3, 4, 5, 6], target: 3, created: D.today(), ...s });
        this.save(); App.refresh();
        Toast.show(`Añadido: ${s.name}`);
      };
      list.append(el);
    });
    view.append(list);
  },

  /* ---------- Detalle: estadísticas + mapa de calor ---------- */
  detail(hb) {
    const WEEKS = 15;
    const draw = (b) => {
      const today = D.today();
      const start = D.add(D.weekStart(today), -(WEEKS - 1) * 7);
      let cells = '';
      for (let i = 0; i < WEEKS * 7; i++) {
        const k = D.add(start, i);
        const cls = k > today ? 'fut' : this.isDone(hb, k) ? 'on' : (!this.isDue(hb, k) && hb.freq === 'days') ? 'off' : '';
        cells += `<button class="hm-cell ${cls} ${k === today ? 'today' : ''}" data-k="${k}" title="${D.long(k)}"></button>`;
      }
      const unit = hb.freq === 'weekly' ? 'sem.' : 'días';
      b.innerHTML = `
        <div class="hd-top" style="--c:${hb.color}">
          <span class="habit-emoji">${esc(hb.emoji)}</span>
          <div><h3>${esc(hb.name)}</h3><p>${this.freqLabel(hb)}</p></div>
        </div>
        <div class="stats">
          <div class="stat"><b>🔥 ${this.streak(hb)}</b><span>Racha (${unit})</span></div>
          <div class="stat"><b>${this.bestStreak(hb)}</b><span>Mejor racha</span></div>
          <div class="stat"><b>${this.rate(hb)}%</b><span>Último mes</span></div>
        </div>
        <div class="heatmap-wrap" style="--c:${hb.color}">
          <div class="heatmap-head"><span>Últimas ${WEEKS} semanas</span><span>${plural(this.total(hb), 'vez', 'veces')} en total</span></div>
          <div class="heatmap">${cells}</div>
        </div>
        <p class="hint">Toca un día para marcarlo o desmarcarlo</p>
        <div class="btn-row">
          <button class="btn" data-edit>${Icons.edit} Editar</button>
          <button class="btn btn-ghost-danger" data-del>${Icons.trash} Eliminar</button>
        </div>`;
      $('.heatmap', b).onclick = (e) => {
        const c = e.target.closest('.hm-cell');
        if (!c) return;
        if (this.toggle(hb, c.dataset.k)) { draw(b); App.refresh(); }
      };
      $('[data-edit]', b).onclick = () => this.form(hb);
      $('[data-del]', b).onclick = async () => {
        if (await confirmSheet('¿Eliminar hábito?', `Se borrará "${hb.name}" y todo su historial.`)) {
          this.list = this.list.filter((x) => x.id !== hb.id);
          delete this.log[hb.id];
          this.save(); App.refresh();
          Toast.show('Hábito eliminado');
        }
      };
    };
    Sheet.open({ title: 'Detalle', body: '', onMount: draw });
  },

  /* ---------- Formulario (nuevo / editar) ---------- */
  form(hb) {
    const isNew = !hb;
    const d = hb ? { ...hb, days: [...hb.days] } : { name: '', emoji: '💧', color: COLORS[0], freq: 'daily', days: [0, 1, 2, 3, 4], target: 3 };
    const emojis = this.EMOJIS.includes(d.emoji) ? this.EMOJIS : [d.emoji, ...this.EMOJIS.slice(0, -1)];

    Sheet.open({
      title: isNew ? 'Nuevo hábito' : 'Editar hábito',
      body: `
        <label class="field"><span>Nombre</span><input id="hf-name" maxlength="40" placeholder="Ej: Beber 2 L de agua" value="${esc(d.name)}"></label>
        <div class="field"><span>Icono</span>
          <div class="emoji-grid">${emojis.map((e) => `<button type="button" class="emoji-opt ${e === d.emoji ? 'sel' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
          <input id="hf-emoji" class="input" maxlength="8" placeholder="…o escribe/pega cualquier emoji" style="margin-top:4px">
        </div>
        <div class="field"><span>Color</span>${colorPickerHTML(d.color)}</div>
        <div class="field"><span>Frecuencia</span>
          <div class="segmented" id="hf-freq">
            <button type="button" data-f="daily">Diario</button>
            <button type="button" data-f="days">Días concretos</button>
            <button type="button" data-f="weekly">Semanal</button>
          </div>
        </div>
        <div class="field" id="hf-days-wrap"><span>¿Qué días?</span>
          <div class="chips">${D.DAYS_SHORT.map((s, i) => `<button type="button" class="chip ${d.days.includes(i) ? 'sel' : ''}" data-d="${i}">${s}</button>`).join('')}</div>
        </div>
        <div class="field" id="hf-target-wrap"><span>¿Cuántas veces por semana?</span>
          <div class="stepper"><button type="button" data-dec>−</button><b id="hf-target">${d.target}</b><button type="button" data-inc>+</button></div>
        </div>
        <button class="btn btn-primary block" id="hf-save">${isNew ? 'Crear hábito' : 'Guardar cambios'}</button>`,
      onMount: (b) => {
        const name = $('#hf-name', b);
        if (isNew) setTimeout(() => name.focus(), 300);

        $$('.emoji-opt', b).forEach((e) => (e.onclick = () => {
          $$('.emoji-opt', b).forEach((x) => x.classList.remove('sel'));
          e.classList.add('sel'); d.emoji = e.dataset.e; $('#hf-emoji', b).value = '';
        }));
        $('#hf-emoji', b).oninput = (e) => {
          const v = e.target.value.trim();
          if (v) { d.emoji = [...v].slice(0, 2).join(''); $$('.emoji-opt', b).forEach((x) => x.classList.remove('sel')); }
        };
        wireColorPicker(b, (c) => (d.color = c));

        const syncFreq = () => {
          $$('#hf-freq button', b).forEach((x) => x.classList.toggle('sel', x.dataset.f === d.freq));
          $('#hf-days-wrap', b).hidden = d.freq !== 'days';
          $('#hf-target-wrap', b).hidden = d.freq !== 'weekly';
        };
        $$('#hf-freq button', b).forEach((x) => (x.onclick = () => { d.freq = x.dataset.f; syncFreq(); }));
        syncFreq();

        $$('.chip', b).forEach((c) => (c.onclick = () => {
          const i = Number(c.dataset.d);
          d.days = d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i];
          c.classList.toggle('sel');
        }));
        const tgt = $('#hf-target', b);
        $('[data-dec]', b).onclick = () => { d.target = Math.max(1, d.target - 1); tgt.textContent = d.target; };
        $('[data-inc]', b).onclick = () => { d.target = Math.min(7, d.target + 1); tgt.textContent = d.target; };

        $('#hf-save', b).onclick = () => {
          d.name = name.value.trim();
          if (!d.name) { name.focus(); Toast.show('Ponle un nombre al hábito'); return; }
          if (d.freq === 'days' && !d.days.length) { Toast.show('Elige al menos un día'); return; }
          if (isNew) this.list.push({ ...d, id: uid(), created: D.today() });
          else Object.assign(this.find(hb.id), d);
          this.save();
          Sheet.close();
          App.refresh();
          Toast.show(isNew ? 'Hábito creado ✨' : 'Cambios guardados');
        };
      },
    });
  },

  fab() { Habits.form(null); },
};

App.register('habits', Habits);
