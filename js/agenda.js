'use strict';
/* =========================================================
   agenda.js — Horario de la uni + eventos de Google Calendar
   Clase: { id, name, room, teacher, day (0 = lunes), start:'HH:MM', end:'HH:MM', color }
   ========================================================= */

const Agenda = {
  title: 'Agenda',
  sel: D.today(),
  mode: Store.get('agendaMode', 'day'),
  classes: Store.get('classes', []),
  items: [],

  save() { Store.set('classes', this.classes); },
  find(id) { return this.classes.find((c) => c.id === id); },

  classItems(k) {
    const wd = D.wd(k);
    return this.classes.filter((c) => c.day === wd).map((c) => ({
      type: 'class', id: c.id, title: c.name, color: c.color,
      start: D.toMin(c.start), end: D.toMin(c.end),
      sub: [c.room && '📍 ' + c.room, c.teacher && '👤 ' + c.teacher].filter(Boolean).join('   '),
    }));
  },

  /* ---------- Pintado ---------- */
  render(view) {
    const sw = h(`<div class="segmented view-switch">
        <button data-m="day" class="${this.mode === 'day' ? 'sel' : ''}">Día</button>
        <button data-m="week" class="${this.mode === 'week' ? 'sel' : ''}">Horario semanal</button>
      </div>`);
    $$('button', sw).forEach((b) => (b.onclick = () => {
      this.mode = b.dataset.m; Store.set('agendaMode', this.mode); App.refresh();
    }));
    view.append(sw);

    if (this.mode === 'week') { this.renderWeek(view); return; }

    const k = this.sel;
    view.append(DateStrip(k, (nk) => { this.sel = nk; App.refresh(); }, {
      mark: (dk) => (this.classes.some((c) => c.day === D.wd(dk)) || (GCal.cache[dk] && GCal.cache[dk].length) ? 'some' : ''),
    }));

    const gbox = h('<div></div>');
    const allday = h('<div class="allday" hidden></div>');
    const tl = h('<div class="timeline"></div>');
    view.append(gbox, allday, tl);

    const classes = this.classItems(k);
    const willLoad = GCal.configured() && GCal.connected();
    this.drawTimeline(tl, classes, k, willLoad && !GCal.cache[k]);
    this.renderGoogle(gbox, allday, tl, classes, k);
  },

  renderGoogle(gbox, allday, tl, classes, k) {
    if (!GCal.configured()) {
      if (App.settings.hideGcalPrompt) return;
      const c = h(`<div class="card gcal-card">
          <span class="g-logo">${Icons.google}</span>
          <div class="g-text"><b>Conecta Google Calendar</b><span>Verás tus eventos junto a tus clases</span></div>
          <button class="btn sm btn-soft" data-go>Configurar</button>
        </div>`);
      $('[data-go]', c).onclick = () => App.go('settings');
      gbox.append(c);
      return;
    }
    if (!GCal.connected()) {
      const c = h(`<div class="card gcal-card">
          <span class="g-logo">${Icons.google}</span>
          <div class="g-text"><b>${GCal.wasConnected() ? 'Sesión de Google caducada' : 'Google Calendar'}</b><span>Toca para ver los eventos del día</span></div>
          <button class="btn sm btn-primary" data-con>${GCal.wasConnected() ? 'Reconectar' : 'Conectar'}</button>
        </div>`);
      $('[data-con]', c).onclick = () => GCal.connect()
        .then(() => { Toast.show('Google Calendar conectado ✅'); App.refresh(); })
        .catch((e) => Toast.show(e.message));
      gbox.append(c);
      return;
    }

    const status = h(`<div class="gcal-status loading">
        <span><span class="dot"></span>Google Calendar</span>
        <button data-r>${Icons.refresh} Actualizar</button>
      </div>`);
    $('[data-r]', status).onclick = () => { GCal.clearCache(); App.refresh(); };
    gbox.append(status);

    GCal.eventsFor(k).then((evs) => {
      if (!tl.isConnected) return;
      status.classList.remove('loading');
      const ad = evs.filter((e) => e.allDay);
      allday.hidden = !ad.length;
      allday.innerHTML = ad.map((e, i) => `<button class="allday-chip" style="--c:${e.color}" data-i="${i}">${esc(e.title)}</button>`).join('');
      $$('.allday-chip', allday).forEach((b) => (b.onclick = () => this.eventDetail(ad[b.dataset.i])));
      this.drawTimeline(tl, [...classes, ...evs.filter((e) => !e.allDay)], k, false);
    }).catch((err) => {
      status.classList.remove('loading');
      Toast.show(err.message);
      if (!GCal.connected()) App.refresh();
      else this.drawTimeline(tl, classes, k, false);
    });
  },

  drawTimeline(tl, items, k, loading) {
    items = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
    this.items = items;
    tl.innerHTML = '';

    if (!items.length) {
      if (loading) { tl.append(h('<p class="hint">Cargando eventos…</p>')); return; }
      tl.append(this.classes.length
        ? emptyState('🎉', 'Día libre', 'No tienes clases ni eventos este día.')
        : emptyState('🎓', 'Añade tu horario', 'Crea tus clases una vez y se repetirán todas las semanas.', 'Añadir clase', () => this.form(null)));
      return;
    }

    const isToday = k === D.today();
    const now = D.nowMin();
    let nowPlaced = !isToday;
    let prevEnd = null;
    let html = '';
    const nowLine = `<div class="now-line"><span>${D.fromMin(now)}</span></div>`;

    items.forEach((it, i) => {
      if (prevEnd !== null && it.start - prevEnd >= 30) {
        html += `<div class="tl-gap">☕ Hueco libre · ${D.duration(it.start - prevEnd)}</div>`;
      }
      if (!nowPlaced && now < it.start) { html += nowLine; nowPlaced = true; }
      const live = isToday && now >= it.start && now < it.end;
      const past = isToday && now >= it.end;
      if (live) nowPlaced = true;
      html += `<div class="tl-item ${live ? 'live' : ''} ${past ? 'past' : ''}" data-i="${i}" style="--c:${it.color}">
          <div class="tl-time"><b>${D.fromMin(it.start)}</b><span>${D.fromMin(it.end)}</span></div>
          <div class="tl-card">
            <div class="tl-title">${esc(it.title)} ${live ? '<span class="badge-live">Ahora</span>' : ''}</div>
            ${it.sub ? `<div class="tl-sub">${esc(it.sub)}</div>` : ''}
            <div class="tl-tag">${it.type === 'event' ? `${Icons.calendar} ${esc(it.calName)}` : `🎓 Clase`}</div>
          </div>
        </div>`;
      prevEnd = Math.max(prevEnd ?? 0, it.end);
    });
    if (!nowPlaced) html += nowLine;
    tl.innerHTML = html;

    tl.onclick = (e) => {
      const el = e.target.closest('.tl-item');
      if (!el) return;
      const it = this.items[el.dataset.i];
      if (it.type === 'class') this.form(this.find(it.id));
      else this.eventDetail(it);
    };
  },

  /* ---------- Vista semanal (rejilla) ---------- */
  renderWeek(view) {
    const cls = this.classes;
    if (!cls.length) {
      view.append(emptyState('🗓️', 'Tu horario está vacío', 'Añade tus asignaturas con su día, hora y aula. Se repetirán cada semana.', 'Añadir clase', () => this.form(null)));
      return;
    }
    const days = [0, 1, 2, 3, 4];
    if (cls.some((c) => c.day === 5)) days.push(5);
    if (cls.some((c) => c.day === 6)) days.push(6);

    let min = Math.min(...cls.map((c) => D.toMin(c.start)));
    let max = Math.max(...cls.map((c) => D.toMin(c.end)));
    min = Math.floor(min / 60) * 60;
    max = Math.ceil(max / 60) * 60;
    if (max - min < 240) max = min + 240;

    const HOUR = 58;
    const px = (m) => ((m - min) / 60) * HOUR;
    const todayWd = D.wd(D.today());
    const now = D.nowMin();

    let hours = '';
    for (let t = min; t <= max; t += 60) hours += `<span style="top:${px(t)}px">${t / 60}h</span>`;

    const cols = days.map((d) => {
      const blocks = cls.filter((c) => c.day === d).map((c) => {
        const s = D.toMin(c.start), e = D.toMin(c.end);
        return `<button class="wk-block" data-id="${c.id}" style="--c:${c.color};top:${px(s)}px;height:${Math.max(px(e) - px(s) - 2, 20)}px">
            <b>${esc(c.name)}</b><span>${c.start}${c.room ? ' · ' + esc(c.room) : ''}</span>
          </button>`;
      }).join('');
      const nowBar = d === todayWd && now >= min && now <= max ? `<div class="wk-now" style="top:${px(now)}px"></div>` : '';
      return `<div class="wk-col" style="height:${px(max)}px">${blocks}${nowBar}</div>`;
    }).join('');

    const grid = h(`<div class="card week" style="--cols:${days.length};--hour:${HOUR}px">
        <div class="wk-head"><span></span>${days.map((d) => `<span class="${d === todayWd ? 'today' : ''}">${D.DAYS_SHORT[d]}</span>`).join('')}</div>
        <div class="wk-body"><div class="wk-hours">${hours}</div>${cols}</div>
      </div>`);
    grid.onclick = (e) => {
      const b = e.target.closest('.wk-block');
      if (b) this.form(this.find(b.dataset.id));
    };
    view.append(grid);
    view.append(h(`<p class="hint">Toca una clase para editarla · ${plural(cls.length, 'clase', 'clases')} a la semana</p>`));
  },

  /* ---------- Detalle de evento de Google ---------- */
  eventDetail(ev) {
    const when = ev.allDay ? 'Todo el día' : `${D.fromMin(ev.start)} – ${D.fromMin(ev.end)}`;
    Sheet.open({
      title: ev.title,
      body: `<div class="event-detail">
          <div class="ed-row"><span>🕒</span><span>${when}</span></div>
          <div class="ed-row"><span style="color:${ev.color}">●</span><span>${esc(ev.calName)}</span></div>
          ${ev.location ? `<div class="ed-row"><span>📍</span><span>${esc(ev.location)}</span></div>` : ''}
          ${ev.description ? `<div class="ed-row"><span>📝</span><div class="ed-desc">${esc(ev.description.trim())}</div></div>` : ''}
          ${ev.link ? `<a class="btn btn-soft block" style="margin-top:16px;text-decoration:none" href="${esc(ev.link)}" target="_blank" rel="noopener">${Icons.external} Abrir en Google Calendar</a>` : ''}
        </div>`,
    });
  },

  /* ---------- Formulario de clase ---------- */
  form(c) {
    const isNew = !c;
    const d = c ? { ...c } : { name: '', room: '', teacher: '', day: D.wd(this.sel), start: '09:00', end: '10:30', color: COLORS[this.classes.length % COLORS.length] };
    let days = [d.day];
    const names = [...new Set(this.classes.map((x) => x.name))];

    Sheet.open({
      title: isNew ? 'Nueva clase' : 'Editar clase',
      body: `
        <label class="field"><span>Asignatura</span><input id="cf-name" list="cf-names" maxlength="60" placeholder="Ej: Termodinámica" value="${esc(d.name)}"></label>
        <datalist id="cf-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="field-row">
          <label class="field"><span>Aula</span><input id="cf-room" maxlength="30" placeholder="Ej: A-2.04" value="${esc(d.room)}"></label>
          <label class="field"><span>Profesor/a</span><input id="cf-teacher" maxlength="40" placeholder="Opcional" value="${esc(d.teacher)}"></label>
        </div>
        <div class="field"><span>${isNew ? 'Días (puedes elegir varios)' : 'Día'}</span>
          <div class="chips">${D.DAYS_SHORT.map((s, i) => `<button type="button" class="chip ${days.includes(i) ? 'sel' : ''}" data-d="${i}">${s}</button>`).join('')}</div>
        </div>
        <div class="field-row">
          <label class="field"><span>Empieza</span><input type="time" id="cf-start" value="${d.start}"></label>
          <label class="field"><span>Termina</span><input type="time" id="cf-end" value="${d.end}"></label>
        </div>
        <div class="field"><span>Color</span>${colorPickerHTML(d.color)}</div>
        <button class="btn btn-primary block" id="cf-save">${isNew ? 'Añadir al horario' : 'Guardar cambios'}</button>
        ${isNew ? '' : `<div class="btn-row">
          <button class="btn" id="cf-dup">Duplicar</button>
          <button class="btn btn-ghost-danger" id="cf-del">${Icons.trash} Eliminar</button></div>`}`,
      onMount: (b) => {
        const name = $('#cf-name', b);
        if (isNew) setTimeout(() => name.focus(), 300);

        // Si escribes una asignatura que ya existe, reutiliza su color, aula y profe
        name.onchange = () => {
          const prev = this.classes.find((x) => x.name.toLowerCase() === name.value.trim().toLowerCase());
          if (!prev) return;
          d.color = prev.color;
          $$('.color-opt', b).forEach((x) => x.classList.toggle('sel', x.dataset.c === prev.color));
          if (!$('#cf-room', b).value) $('#cf-room', b).value = prev.room;
          if (!$('#cf-teacher', b).value) $('#cf-teacher', b).value = prev.teacher;
        };

        $$('.chip', b).forEach((ch) => (ch.onclick = () => {
          const i = Number(ch.dataset.d);
          if (isNew) {
            days = days.includes(i) ? days.filter((x) => x !== i) : [...days, i];
          } else {
            days = [i];
            $$('.chip', b).forEach((x) => x.classList.remove('sel'));
          }
          ch.classList.toggle('sel', days.includes(i));
        }));
        wireColorPicker(b, (col) => (d.color = col));

        const read = () => {
          const v = {
            name: name.value.trim(), room: $('#cf-room', b).value.trim(), teacher: $('#cf-teacher', b).value.trim(),
            start: $('#cf-start', b).value, end: $('#cf-end', b).value, color: d.color,
          };
          if (!v.name) { name.focus(); Toast.show('Escribe el nombre de la asignatura'); return null; }
          if (!days.length) { Toast.show('Elige al menos un día'); return null; }
          if (!v.start || !v.end || D.toMin(v.end) <= D.toMin(v.start)) { Toast.show('La hora de fin debe ser posterior al inicio'); return null; }
          return v;
        };

        $('#cf-save', b).onclick = () => {
          const v = read();
          if (!v) return;
          if (isNew) days.forEach((day) => this.classes.push({ id: uid(), ...v, day }));
          else Object.assign(this.find(c.id), v, { day: days[0] });
          this.save(); Sheet.close(); App.refresh();
          Toast.show(isNew && days.length > 1 ? `${days.length} clases añadidas` : 'Horario actualizado');
        };
        if (!isNew) {
          $('#cf-dup', b).onclick = () => {
            const copy = { ...this.find(c.id), id: uid() };
            this.classes.push(copy); this.save(); Sheet.close(); App.refresh();
            setTimeout(() => this.form(copy), 300);
            Toast.show('Copia creada: cambia el día u hora');
          };
          $('#cf-del', b).onclick = async () => {
            if (await confirmSheet('¿Eliminar clase?', `Se quitará "${c.name}" del ${D.DAYS[c.day].toLowerCase()}.`)) {
              this.classes = this.classes.filter((x) => x.id !== c.id);
              this.save(); App.refresh();
              Toast.show('Clase eliminada');
            }
          };
        }
      },
    });
  },

  fab() { Agenda.form(null); },
};

App.register('agenda', Agenda);
