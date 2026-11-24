'use strict';
/* =========================================================
   tasks.js — Tareas pendientes de cada día
   Cada tarea: { id, title, note, date:'YYYY-MM-DD', prio:'high'|'med'|'low',
                 done, doneAt, created }
   ========================================================= */

const Tasks = {
  title: 'Tareas',
  sel: D.today(),
  list: Store.get('tasks', []),
  newPrio: 'med',
  pop: null,

  PRIO: {
    high: { label: 'Alta', color: '#FF5A5F' },
    med: { label: 'Media', color: '#FF9F43' },
    low: { label: 'Baja', color: '#45AAF2' },
  },
  PRIO_ORDER: ['low', 'med', 'high'],

  save() { Store.set('tasks', this.list); },
  find(id) { return this.list.find((t) => t.id === id); },
  forDay(k) { return this.list.filter((t) => t.date === k); },
  overdue() {
    const today = D.today();
    return this.list.filter((t) => !t.done && t.date < today).sort((a, b) => a.date.localeCompare(b.date));
  },
  sort(arr) {
    const o = { high: 0, med: 1, low: 2 };
    return arr.sort((a, b) => (o[a.prio] - o[b.prio]) || (a.created - b.created));
  },

  add(data) {
    this.list.push(Object.assign({ id: uid(), title: '', note: '', date: this.sel, prio: 'med', done: false, doneAt: null, created: Date.now() }, data));
    this.save();
  },

  toggle(id, rowEl) {
    const t = this.find(id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    this.save();
    if (t.done) vibrate(12);
    // Primero animamos en su sitio y luego reordenamos la lista
    if (rowEl) {
      rowEl.classList.toggle('done', t.done);
      rowEl.classList.add('pop');
      setTimeout(() => App.refresh(), 420);
    } else App.refresh();
  },

  remove(id) {
    const i = this.list.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [t] = this.list.splice(i, 1);
    this.save();
    App.refresh();
    Toast.show('Tarea eliminada', {
      action: 'Deshacer',
      onAction: () => { this.list.splice(i, 0, t); this.save(); App.refresh(); },
    });
  },

  moveTo(ids, date) {
    ids.forEach((id) => { const t = this.find(id); if (t) t.date = date; });
    this.save();
  },

  /* ---------- Pintado ---------- */
  render(view) {
    const k = this.sel;
    const today = D.today();
    const tasks = this.forDay(k);
    const pending = this.sort(tasks.filter((t) => !t.done));
    const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

    view.append(DateStrip(k, (nk) => { this.sel = nk; App.refresh(); }, {
      mark: (dk) => {
        const ts = this.forDay(dk);
        if (!ts.length) return '';
        return ts.every((t) => t.done) ? 'full' : 'some';
      },
    }));

    // Atrasadas (solo al mirar el día de hoy)
    const overdue = k === today ? this.overdue() : [];
    if (overdue.length) {
      const card = h(`<div class="card overdue-card">
          <div class="oc-head">
            <b>⏰ ${plural(overdue.length, 'tarea atrasada', 'tareas atrasadas')}</b>
            <button class="btn sm btn-soft" data-move>Pasar a hoy</button>
          </div>
          <div class="task-list">${overdue.map((t) => this.rowHTML(t, true)).join('')}</div>
        </div>`);
      $('[data-move]', card).onclick = () => {
        this.moveTo(overdue.map((t) => t.id), today);
        App.refresh();
        Toast.show(`${plural(overdue.length, 'tarea movida', 'tareas movidas')} a hoy`);
      };
      this.wireList($('.task-list', card));
      view.append(card);
    }

    // Progreso del día
    if (tasks.length) {
      const pct = Math.round((done.length / tasks.length) * 100);
      view.append(h(`<div class="card progress-card">
          <div class="pc-row"><b>${D.relative(k)}</b><span>${done.length} de ${tasks.length} hechas</span></div>
          <div class="bar ${pct === 100 ? 'full' : ''}"><i style="width:${pct}%"></i></div>
        </div>`));
    }

    // Añadir rápido
    const p = this.PRIO[this.newPrio];
    const qa = h(`<form class="card quick-add" autocomplete="off">
        <button type="button" class="prio-toggle" style="--p:${p.color}" title="Prioridad: ${p.label}" aria-label="Cambiar prioridad">${Icons.flag}</button>
        <input name="t" placeholder="Añadir tarea ${k === today ? 'para hoy' : 'para el ' + D.short(k)}…" maxlength="120" enterkeyhint="done">
        <button class="add-btn" aria-label="Añadir">${Icons.plus}</button>
      </form>`);
    $('.prio-toggle', qa).onclick = (e) => {
      const i = this.PRIO_ORDER.indexOf(this.newPrio);
      this.newPrio = this.PRIO_ORDER[(i + 1) % 3];
      const np = this.PRIO[this.newPrio];
      e.currentTarget.style.setProperty('--p', np.color);
      Toast.show(`Prioridad: ${np.label}`, { duration: 1200 });
    };
    qa.onsubmit = (e) => {
      e.preventDefault();
      const title = qa.t.value.trim();
      if (!title) { qa.t.focus(); return; }
      this.add({ title, prio: this.newPrio, date: k });
      App.refresh();
      const input = $('.quick-add input');
      if (input) input.focus();
    };
    view.append(qa);

    if (!tasks.length) {
      view.append(emptyState(k < today ? '📭' : '🌤️',
        k < today ? 'No hubo tareas este día' : 'Nada pendiente',
        k < today ? 'Este día no tenías nada apuntado.' : 'Escribe arriba lo que tengas que hacer y táchalo cuando lo termines.'));
      return;
    }

    if (pending.length) {
      const list = h(`<div class="task-list">${pending.map((t) => this.rowHTML(t)).join('')}</div>`);
      this.wireList(list);
      view.append(list);
    } else {
      view.append(h(`<div class="card" style="text-align:center"><b>🎉 ¡Todo hecho!</b><p class="muted" style="font-size:14px;margin-top:4px">Has terminado todas las tareas del día.</p></div>`));
    }

    if (done.length) {
      view.append(h(`<div class="section-title">Completadas · ${done.length}</div>`));
      const list = h(`<div class="task-list">${done.map((t) => this.rowHTML(t)).join('')}</div>`);
      this.wireList(list);
      view.append(list);
    }
    this.pop = null;
  },

  rowHTML(t, showDate = false) {
    const p = this.PRIO[t.prio] || this.PRIO.med;
    return `<div class="task-wrap" data-id="${t.id}">
        <div class="task-del-bg">${Icons.trash}</div>
        <div class="task-row ${t.done ? 'done' : ''}" style="--p:${p.color}">
          <button class="task-check" data-check aria-label="${t.done ? 'Desmarcar' : 'Completar'}">${Icons.check}</button>
          <div class="task-body" data-edit>
            <span class="task-title">${esc(t.title)}</span>
            ${t.note ? `<span class="task-note">${esc(t.note)}</span>` : ''}
            ${showDate ? `<span class="task-date">${esc(D.relative(t.date))}</span>` : ''}
          </div>
          ${t.prio === 'high' ? `<span class="prio-tag">${p.label}</span>` : ''}
        </div>
      </div>`;
  },

  /** Clics + deslizar a la izquierda para borrar */
  wireList(list) {
    list.addEventListener('click', (e) => {
      const wrap = e.target.closest('.task-wrap');
      if (!wrap) return;
      if (e.target.closest('[data-check]')) this.toggle(wrap.dataset.id, $('.task-row', wrap));
      else if (e.target.closest('[data-edit]')) this.form(this.find(wrap.dataset.id));
    });

    let row = null, sx = 0, sy = 0, dx = 0, dir = null;
    list.addEventListener('touchstart', (e) => {
      row = e.target.closest('.task-row');
      if (!row) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; dir = null;
    }, { passive: true });
    list.addEventListener('touchmove', (e) => {
      if (!row) return;
      const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
      if (!dir) {
        if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
        dir = Math.abs(x) > Math.abs(y) ? 'h' : 'v';
      }
      if (dir !== 'h') return;
      dx = Math.min(0, x);
      row.classList.add('swiping');
      row.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    list.addEventListener('touchend', () => {
      if (!row) return;
      const r = row; row = null;
      r.classList.remove('swiping');
      r.style.transform = '';
      if (dir === 'h' && dx < -90) {
        r.classList.add('leaving');
        const id = r.closest('.task-wrap').dataset.id;
        setTimeout(() => this.remove(id), 230);
      }
    });
  },

  /* ---------- Formulario (nueva / editar) ---------- */
  form(t) {
    const isNew = !t;
    const data = t ? { ...t } : { title: '', note: '', prio: this.newPrio, date: this.sel };
    const prioBtns = ['high', 'med', 'low'].map((p) =>
      `<button type="button" data-p="${p}" class="${data.prio === p ? 'sel' : ''}">${this.PRIO[p].label}</button>`).join('');

    Sheet.open({
      title: isNew ? 'Nueva tarea' : 'Editar tarea',
      body: `
        <label class="field"><span>Tarea</span><input id="tf-title" maxlength="120" placeholder="Ej: Entregar práctica de Estadística" value="${esc(data.title)}"></label>
        <label class="field"><span>Nota (opcional)</span><textarea id="tf-note" maxlength="500" placeholder="Detalles, enlaces, aula…">${esc(data.note)}</textarea></label>
        <div class="field"><span>Prioridad</span><div class="segmented" id="tf-prio">${prioBtns}</div></div>
        <label class="field"><span>Día</span><input type="date" id="tf-date" value="${data.date}"></label>
        <button class="btn btn-primary block" id="tf-save">${isNew ? 'Añadir tarea' : 'Guardar cambios'}</button>
        ${isNew ? '' : `<div class="btn-row">
            <button class="btn" id="tf-tomorrow">Mover a mañana</button>
            <button class="btn btn-ghost-danger" id="tf-del">${Icons.trash} Eliminar</button>
          </div>`}`,
      onMount: (b) => {
        const title = $('#tf-title', b);
        if (isNew) setTimeout(() => title.focus(), 300);
        $$('#tf-prio button', b).forEach((btn) => (btn.onclick = () => {
          $$('#tf-prio button', b).forEach((x) => x.classList.remove('sel'));
          btn.classList.add('sel');
          data.prio = btn.dataset.p;
        }));
        $('#tf-save', b).onclick = () => {
          const v = title.value.trim();
          if (!v) { title.focus(); Toast.show('Escribe un nombre para la tarea'); return; }
          const fields = { title: v, note: $('#tf-note', b).value.trim(), prio: data.prio, date: $('#tf-date', b).value || this.sel };
          if (isNew) this.add(fields);
          else { Object.assign(this.find(t.id), fields); this.save(); }
          Sheet.close();
          App.refresh();
        };
        if (!isNew) {
          $('#tf-tomorrow', b).onclick = () => {
            const base = t.date < D.today() ? D.today() : t.date;
            this.moveTo([t.id], D.add(base, 1));
            Sheet.close(); App.refresh();
            Toast.show('Movida a ' + D.relative(D.add(base, 1)).toLowerCase());
          };
          $('#tf-del', b).onclick = () => { Sheet.close(); this.remove(t.id); };
        }
      },
    });
  },

  fab() { Tasks.form(null); },
};

App.register('tasks', Tasks);
