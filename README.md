# 📱 Mi Día

Web app para el día a día: **hábitos**, **tareas** y **agenda de la uni + Google Calendar**.
En el móvil se instala como una app (PWA) y funciona sin conexión.

## Qué hace

| Apartado | Funciones |
|---|---|
| ✅ **Hábitos** | Diarios, días concretos o X veces por semana · anillo de progreso · rachas 🔥 · estadísticas y mapa de calor (toca un hábito) · marcar días pasados |
| 📝 **Tareas** | Lista por día · tachar al completar · prioridad (toca la banderita) · atrasadas → "Pasar a hoy" · desliza a la izquierda para borrar (con deshacer) · toca una tarea para editarla |
| 📅 **Agenda** | Horario de la uni que se repite cada semana · vista *Día* (línea de tiempo con clases + eventos de Google, línea roja de "ahora", huecos libres) · vista *Horario semanal* en rejilla |
| ⚙️ **Ajustes** | Tema claro/oscuro/auto · color principal · Google Calendar · exportar/importar copia de seguridad |

## Probarla en el ordenador

Hace falta un servidor local (Google no funciona abriendo el `index.html` con doble clic). En esta carpeta:

```powershell
python -m http.server 5500
```

Abre <http://localhost:5500>. Para verla como en el móvil: F12 → icono de móvil (Ctrl+Shift+M).

## Publicarla para usarla en el móvil (gratis)

**Opción rápida — Netlify Drop:** entra en <https://app.netlify.com/drop> y arrastra esta carpeta. Te da una URL `https://xxxx.netlify.app`.

**Opción GitHub Pages:** sube la carpeta a un repositorio de GitHub → *Settings → Pages* → rama `main`. URL: `https://tu-usuario.github.io/tu-repo/`.

Luego en el móvil abre la URL y:
- **iPhone (Safari):** Compartir → *Añadir a pantalla de inicio*.
- **Android (Chrome):** menú ⋮ → *Instalar aplicación*.

> ⚠️ Los datos se guardan en cada navegador por separado. Lo que marques en el móvil no aparece en el ordenador (usa Exportar/Importar en Ajustes). La sincronización será el siguiente paso.

## Conectar Google Calendar

La guía paso a paso está dentro de la app: **Ajustes → ¿Cómo consigo el Client ID?** Resumen:

1. <https://console.cloud.google.com/> → crea un proyecto.
2. *APIs y servicios → Biblioteca* → habilita **Google Calendar API**.
3. *Pantalla de consentimiento de OAuth*: tipo Externo, y añade tu Gmail como **usuario de prueba**.
4. *Credenciales → Crear → ID de cliente de OAuth → Aplicación web*.
5. En **Orígenes de JavaScript autorizados** añade `http://localhost:5500` y, cuando la publiques, también tu URL pública (sin barra final, p. ej. `https://xxxx.netlify.app`).
6. Pega el Client ID en Ajustes → **Conectar**.

El permiso es **solo de lectura**. Por seguridad dura 1 hora; después toca *Reconectar*.

## Estructura del código

```
index.html        estructura y barra de pestañas
styles.css        todo el diseño (colores en :root al principio)
js/app.js         núcleo: almacenamiento, fechas, iconos, hoja inferior, navegación
js/habits.js      hábitos
js/tasks.js       tareas
js/agenda.js      horario + vista día/semana
js/google.js      conexión con Google Calendar
js/settings.js    ajustes y copias de seguridad
sw.js, manifest.json, icons/   lo necesario para que sea instalable
```

### Ideas para personalizar (pídeselas a Claude)
- Cambiar colores o emojis → `COLORS` en `js/app.js`, `EMOJIS` en `js/habits.js`.
- Una pestaña **"Hoy"** con resumen de todo.
- Notificaciones/recordatorios de hábitos.
- Subtareas o categorías en las tareas (Uni, Personal…).
- Sincronizar entre dispositivos (Firebase / Supabase).

> Con internet, la app siempre carga la última versión. Si alguna vez ves una versión antigua, sube el número de `CACHE` en `sw.js` (`mi-dia-v2`…).
