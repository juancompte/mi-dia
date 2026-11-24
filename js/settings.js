'use strict';
/* =========================================================
   settings.js — Ajustes: tema, color, Google y copias de seguridad
   ========================================================= */

const Settings = {
  title: 'Ajustes',
  DATA_KEYS: ['habits', 'habitLog', 'tasks', 'classes', 'settings', 'agendaMode'],

  render(view) {
    const s = App.settings;
    const gOn = GCal.connected();
    view.append(h(`<div>
      <div class="section-title">Apariencia</div>
      <div class="card list-card" style="margin-top:10px">
        <div class="setting-row" style="cursor:default"><span>Tema</span>
          <div class="segmented" id="st-theme">
            ${[['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button data-v="${v}" class="${s.theme === v ? 'sel' : ''}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row col"><span>Color principal</span>${colorPickerHTML(s.accent)}</div>
      </div>

      <div class="section-title" style="margin-top:22px">Google Calendar</div>
      <div class="card" style="margin-top:10px">
        <div class="g-status"><span class="dot ${gOn ? 'on' : ''}"></span>
          ${gOn ? 'Conectado' : GCal.configured() ? 'No conectado' : 'Sin configurar'}</div>
        <label class="field"><span>Client ID de Google</span>
          <input id="st-cid" placeholder="123456-abc.apps.googleusercontent.com" value="${esc(s.googleClientId)}" autocomplete="off" spellcheck="false"></label>
        <div class="btn-row" style="margin-top:0">
          <button class="btn" id="st-cid-save">Guardar ID</button>
          ${gOn ? '<button class="btn btn-ghost-danger" id="st-gdis">Desconectar</button>'
                : `<button class="btn btn-primary" id="st-gcon" ${GCal.configured() ? '' : 'disabled style="opacity:.5"'}>Conectar</button>`}
        </div>
        <button class="link-btn" id="st-guide" style="margin-top:10px">¿Cómo consigo el Client ID? →</button>
      </div>

      <div class="section-title" style="margin-top:22px">Tus datos</div>
      <div class="card list-card" style="margin-top:10px">
        <button class="setting-row" id="st-export"><span>📤 Exportar copia de seguridad</span>${Icons.chevR}</button>
        <label class="setting-row"><span>📥 Importar copia</span>${Icons.chevR}<input type="file" accept="application/json,.json" id="st-import" hidden></label>
        <button class="setting-row danger" id="st-reset"><span>🗑️ Borrar todos los datos</span></button>
      </div>

      <p class="about">Mi Día · v1.0<br>Tus datos se guardan solo en este dispositivo.<br>Exporta una copia de vez en cuando 😉</p>
    </div>`));

    // Tema
    $$('#st-theme button', view).forEach((b) => (b.onclick = () => {
      s.theme = b.dataset.v; App.saveSettings(); App.refresh();
    }));
    // Color principal
    wireColorPicker(view, (c) => { s.accent = c; App.saveSettings(); });

    // Google
    $('#st-cid-save', view).onclick = () => {
      const v = $('#st-cid', view).value.trim();
      if (v && !/\.apps\.googleusercontent\.com$/.test(v)) { Toast.show('Ese ID no parece válido (debe acabar en .apps.googleusercontent.com)'); return; }
      if (v !== s.googleClientId) GCal.disconnect();
      s.googleClientId = v; App.saveSettings();
      if (v) GCal.loadLib().catch(() => {});
      Toast.show(v ? 'Client ID guardado. Ahora pulsa Conectar' : 'Client ID borrado');
      App.refresh();
    };
    const con = $('#st-gcon', view);
    if (con) con.onclick = () => GCal.connect()
      .then(() => { Toast.show('Google Calendar conectado ✅'); App.refresh(); })
      .catch((e) => Toast.show(e.message));
    const dis = $('#st-gdis', view);
    if (dis) dis.onclick = () => { GCal.disconnect(); Toast.show('Google desconectado'); App.refresh(); };
    $('#st-guide', view).onclick = () => this.guide();

    // Datos
    $('#st-export', view).onclick = () => this.exportData();
    $('#st-import', view).onchange = (e) => this.importData(e.target.files[0]);
    $('#st-reset', view).onclick = async () => {
      if (await confirmSheet('¿Borrar todo?', 'Se eliminarán hábitos, tareas, horario y ajustes de este dispositivo. No se puede deshacer.', 'Borrar todo')) {
        GCal.disconnect();
        Store.keys().forEach((k) => Store.remove(k));
        location.reload();
      }
    };
  },

  guide() {
    const origin = location.origin;
    Sheet.open({
      title: 'Conectar Google Calendar',
      body: `
        <p class="muted" style="margin-bottom:16px;font-size:14.5px">Solo se hace una vez (unos 10 minutos). La app pedirá permiso <b>solo de lectura</b> a tu calendario.</p>
        <ol class="steps">
          <li><span>Entra en <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> con tu cuenta de Google y crea un <b>proyecto nuevo</b> (p. ej. "Mi Día").</span></li>
          <li><span>Ve a <b>APIs y servicios → Biblioteca</b>, busca <b>Google Calendar API</b> y pulsa <b>Habilitar</b>.</span></li>
          <li><span>Ve a <b>Pantalla de consentimiento de OAuth</b> (o "Google Auth Platform"): tipo <b>Externo</b>, pon un nombre y tu correo. En <b>Público → Usuarios de prueba</b> añade tu propio Gmail.</span></li>
          <li><span>Ve a <b>Credenciales → Crear credenciales → ID de cliente de OAuth</b> y elige <b>Aplicación web</b>.</span></li>
          <li><span>En <b>Orígenes de JavaScript autorizados</b> añade esta dirección (toca para copiar):<br><code class="copy" data-copy="${esc(origin)}">${esc(origin)}</code><br>Cuando publiques la app, añade también su URL pública.</span></li>
          <li><span>Copia el <b>ID de cliente</b> (acaba en <i>.apps.googleusercontent.com</i>), pégalo en Ajustes y pulsa <b>Conectar</b>.</span></li>
        </ol>
        <div class="note">💡 Google mostrará el aviso <i>"Google no ha verificado esta aplicación"</i>. Es normal porque la app es tuya: pulsa <b>Continuar</b>.<br>🔒 Por seguridad el acceso dura 1 hora; después solo tienes que tocar <b>Reconectar</b>.</div>`,
      onMount: (b) => {
        $$('[data-copy]', b).forEach((c) => (c.onclick = () => {
          navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy).then(() => Toast.show('Copiado ✅'));
        }));
      },
    });
  },

  exportData() {
    const data = {};
    this.DATA_KEYS.forEach((k) => { const v = Store.get(k, undefined); if (v !== undefined) data[k] = v; });
    const blob = new Blob([JSON.stringify({ app: 'mi-dia', version: 1, exported: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mi-dia-copia-${D.today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    Toast.show('Copia descargada 📦');
  },

  importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const json = JSON.parse(reader.result);
        if (json.app !== 'mi-dia' || !json.data) throw new Error();
        if (!(await confirmSheet('¿Importar copia?', `Se sustituirán los datos actuales por los de la copia del ${new Date(json.exported).toLocaleDateString('es-ES')}.`, 'Importar'))) return;
        Object.entries(json.data).forEach(([k, v]) => { if (this.DATA_KEYS.includes(k)) Store.set(k, v); });
        location.reload();
      } catch (e) {
        Toast.show('Ese archivo no es una copia válida de Mi Día');
      }
    };
    reader.readAsText(file);
  },
};

App.register('settings', Settings);
