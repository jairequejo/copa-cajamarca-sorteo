/**
 * =====================================================================
 * COPA CAJAMARCA — Cronograma de Partidos
 * app.js
 *
 * Reglas de negocio:
 *  - Cat 2013 / 2014 → Fútbol 9 (F9), 45 min, solo campo grande "EL GOLAZO"
 *  - Cat 2015..2020  → Fútbol 7 (F7), 35 min, hasta 3 campos simultáneos
 *
 * Fuente de datos: Google Sheets (mismo que torneos) → pestaña FIXTURE
 * Solo se muestran partidos con resultado PENDIENTE / vacío (no jugados aún)
 * =====================================================================
 */
'use strict';

/* ── CONFIG ─────────────────────────────────────────────── */
const PUB_ID      = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';
const URL_FIXTURE = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1171502194&single=true&output=csv`;

const CATS_F9 = new Set(['2013', '2014']);   // Fútbol 9 — 45 min — campo grande
const DUR_F9  = 45;
const DUR_F7  = 35;

/* ── CANCHAS ─────────────────────────────────────────────── */
const F9_CANCHAS = [
  { id: 'f9_1', nombre: 'Campo Grande EL GOLAZO', tipo: 'F9' },
];
const F7_CANCHAS = [
  { id: 'f7_1', nombre: 'EL GOLAZO — Campo 1', tipo: 'F7' },
  { id: 'f7_2', nombre: 'EL GOLAZO — Campo 2', tipo: 'F7' },
  { id: 'f7_3', nombre: 'EL GOLAZO — Campo 3', tipo: 'F7' },
];
const ALL_CANCHAS = [...F9_CANCHAS, ...F7_CANCHAS];

/* ── ESTADO ──────────────────────────────────────────────── */
let pendientes   = [];    // todos los partidos pendientes del sheet
let filtroCat    = '';    // categoría activa en el filtro
let dragSrc      = null;  // { partido }

// Horario asignado por cancha: { canchaId: [{hora, partido}] }
const asignaciones = {};
ALL_CANCHAS.forEach(c => { asignaciones[c.id] = []; });

let _uid = 0;
const uid = () => `sl${++_uid}`;

/* ── TOAST ───────────────────────────────────────────────── */
function toast(msg, tipo = 'info', ms = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('hiding'); setTimeout(() => el.remove(), 300); }, ms);
}

/* ── PARSEAR CSV ─────────────────────────────────────────── */
function parseCsv(text) {
  const rows = [], lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

/* ── HELPERS DE HORA ─────────────────────────────────────── */
function parseMinutos(str) {
  if (!str) return null;
  const m = str.trim().match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + min;
}
function formatHora(totalMin) {
  const h24 = Math.floor(totalMin / 60) % 24, min = totalMin % 60;
  const ap = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 > 12 ? h24 - 12 : (h24 === 0 ? 12 : h24);
  return `${h12}:${String(min).padStart(2, '0')} ${ap}`;
}
function normalizarHora(str) {
  if (!str || !str.trim()) return str;
  const m = parseMinutos(str);
  return m !== null ? formatHora(m) : str;
}

function siguienteHora(canchaId) {
  const filas = asignaciones[canchaId];
  if (!filas.length) return '';
  const last = filas[filas.length - 1];
  const base = parseMinutos(last.hora);
  if (base === null) return '';
  const dur = esF9(last.partido) ? DUR_F9 : DUR_F7;
  return formatHora(base + dur);
}

function esF9(partido) {
  return CATS_F9.has(String(partido?.cat || '').trim());
}

/* ── IDs asignados ───────────────────────────────────────── */
function asignadosIds() {
  const s = new Set();
  ALL_CANCHAS.forEach(c => asignaciones[c.id].forEach(a => { if (a.partido) s.add(a.partido.pid); }));
  return s;
}

/* ── CARGA DE DATOS ──────────────────────────────────────── */
async function cargarPartidos() {
  const badge = document.getElementById('loadingBadge');
  try {
    const resp = await fetch(URL_FIXTURE);
    if (!resp.ok) throw new Error('Error de red');
    const text = await resp.text();
    const rows = parseCsv(text);
    if (!rows.length) throw new Error('Sin datos');

    const hdr = rows[0].map(h => h.trim().toUpperCase());
    const idx = {
      jornada:   hdr.findIndex(h => h.includes('JORNADA')),
      cat:       hdr.findIndex(h => h.includes('CATEG')),
      local:     hdr.findIndex(h => h === 'LOCAL'),
      visitante: hdr.findIndex(h => h.includes('VISITANTE')),
      resultado: hdr.findIndex(h => h.includes('RESULTADO')),
    };

    const todos = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row[0]) continue;
      const local     = (row[idx.local]     || '').trim();
      const visitante = (row[idx.visitante] || '').trim();
      const resultado = (row[idx.resultado] || '').trim().toUpperCase();
      const cat       = (row[idx.cat]       || '').trim();
      const jornada   = (row[idx.jornada]   || '').trim();
      if (!local || !visitante) continue;
      // Solo pendientes (no jugados)
      const jugado = resultado && resultado !== 'PENDIENTE' && resultado !== '-';
      if (jugado) continue;
      todos.push({
        pid: `${cat}-${jornada}-${local}-${visitante}`.replace(/\s+/g,'-'),
        cat, jornada, local, visitante,
        tipo: CATS_F9.has(cat) ? 'F9' : 'F7',
        dur:  CATS_F9.has(cat) ? DUR_F9 : DUR_F7,
      });
    }

    pendientes = todos;
    if (badge) badge.style.display = 'none';
    document.getElementById('btnExport').disabled = false;
    poblarFiltroCat();
    renderPendientes();
    renderGrid();
    actualizarStats();

  } catch (err) {
    console.error(err);
    if (badge) { badge.textContent = '❌ Error al cargar datos'; badge.style.borderColor = '#dc2626'; badge.style.color = '#dc2626'; }
    toast('❌ No se pudieron cargar los partidos del Sheet', 'error');
  }
}

function poblarFiltroCat() {
  const sel = document.getElementById('filtroCat');
  if (!sel) return;
  const cats = [...new Set(pendientes.map(p => p.cat))].sort((a,b) => Number(a)-Number(b));
  sel.innerHTML = '<option value="">Todas</option>' + cats.map(c => `<option value="${c}">CAT. ${c}</option>`).join('');
}

/* ── PANEL: PARTIDOS PENDIENTES ──────────────────────────── */
function renderPendientes() {
  const lista = document.getElementById('partidosList');
  const cont  = document.getElementById('contadorPartidos');
  if (!lista) return;

  const asig = asignadosIds();
  const catFiltro = document.getElementById('filtroCat')?.value || '';
  const sinAsignar = pendientes.filter(p => !asig.has(p.pid) && (!catFiltro || p.cat === catFiltro));

  if (cont) cont.textContent = sinAsignar.length;

  if (!sinAsignar.length) {
    lista.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p class="ok-text">¡Todos asignados!</p></div>`;
    return;
  }

  lista.innerHTML = sinAsignar.map(p => `
    <div class="partido-card" draggable="true" data-pid="${p.pid}" id="pcard-${p.pid}">
      <span class="badge badge-${p.tipo.toLowerCase()}">${p.tipo}</span>
      <div style="min-width:0;flex:1;">
        <p class="name">${p.local} vs ${p.visitante}</p>
        <p class="cat">Cat. ${p.cat} · J${p.jornada} · ${p.dur} min</p>
      </div>
    </div>`).join('');

  lista.querySelectorAll('.partido-card').forEach(el => {
    el.addEventListener('dragstart', e => {
      const pid = el.dataset.pid;
      dragSrc = pendientes.find(p => p.pid === pid);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('is-dragging'), 0);
    });
    el.addEventListener('dragend', () => el.classList.remove('is-dragging'));
  });
}

function filtrarPendientes() {
  renderPendientes();
}

/* ── GRID DE CANCHAS ─────────────────────────────────────── */
function renderGrid() {
  const container = document.getElementById('editGrid');
  if (!container) return;
  container.innerHTML = '';

  // Campo grande F9
  F9_CANCHAS.forEach(c => container.appendChild(buildCanchaBlock(c)));

  // Campos F7 en grid horizontal
  const f7Wrapper = buildF7Grid();
  container.appendChild(f7Wrapper);
}

function buildCanchaBlock(cancha) {
  const div = document.createElement('div');
  div.className = 'edit-section';

  const filas = asignaciones[cancha.id];
  const rowsHtml = filas.map((a, idx) => buildFilaRow(cancha, a, idx)).join('');

  div.innerHTML = `
    <div class="edit-section-head">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="badge badge-${cancha.tipo.toLowerCase()}">${cancha.tipo}</span>
        <span class="title" contenteditable="true" spellcheck="false"
          onblur="renombrarCancha('${cancha.id}', this)"
          title="✏️ Clic para renombrar">${cancha.nombre}</span>
      </div>
      <button class="btn btn-sm" onclick="agregarFilaVacia('${cancha.id}')">+ Hora</button>
    </div>
    <table class="edit-tbl">
      <thead><tr>
        <th style="width:90px">HORA</th>
        <th>LOCAL</th>
        <th style="width:28px">vs</th>
        <th>VISITANTE</th>
        <th style="width:60px">CAT.</th>
        <th style="width:60px">JORN.</th>
        <th style="width:32px"></th>
      </tr></thead>
      <tbody id="tbody-${cancha.id}">
        ${rowsHtml || `<tr><td colspan="7" class="empty-state" style="padding:20px;">
          Arrastra un partido ${cancha.tipo} aquí o usa "+ Hora"
        </td></tr>`}
      </tbody>
    </table>`;

  // Drop en tbody (zona libre)
  setTimeout(() => {
    const tbody = document.getElementById(`tbody-${cancha.id}`);
    if (!tbody) return;
    tbody.addEventListener('dragover', e => e.preventDefault());
    tbody.addEventListener('dragenter', e => {
      e.preventDefault();
      if (!dragSrc) return;
      if (!validarTipo(cancha, dragSrc)) { tbody.style.background = 'var(--red-bg)'; return; }
      tbody.style.background = 'var(--green-bg)';
    });
    tbody.addEventListener('dragleave', () => tbody.style.background = '');
    tbody.addEventListener('drop', e => {
      e.preventDefault(); tbody.style.background = '';
      if (!dragSrc) return;
      if (!validarTipo(cancha, dragSrc)) {
        toast(`❌ ${dragSrc.tipo} no puede ir en ${cancha.tipo}`, 'error'); return;
      }
      agregarPartidoACancha(cancha.id, dragSrc);
      dragSrc = null;
    });

    // Drop en filas vacías
    tbody.querySelectorAll('.drop-zone').forEach(zone => {
      zone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
      zone.addEventListener('dragenter', e => {
        e.preventDefault(); e.stopPropagation();
        if (!dragSrc) return;
        zone.classList.toggle('drag-over-valid', validarTipo(cancha, dragSrc));
        zone.classList.toggle('drag-over-invalid', !validarTipo(cancha, dragSrc));
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over-valid', 'drag-over-invalid'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        zone.classList.remove('drag-over-valid', 'drag-over-invalid');
        if (!dragSrc) return;
        const idx = parseInt(zone.dataset.idx);
        if (!validarTipo(cancha, dragSrc)) { toast(`❌ ${dragSrc.tipo} no puede ir aquí`, 'error'); return; }
        asignaciones[cancha.id][idx].partido = dragSrc;
        dragSrc = null;
        renderGrid(); renderPendientes(); actualizarStats();
      });
    });
  }, 0);

  return div;
}

function buildF7Grid() {
  const wrap = document.createElement('div');
  wrap.className = 'edit-section';

  const headers = F7_CANCHAS.map(c => `
    <th style="min-width:220px;">
      <span class="title" contenteditable="true" spellcheck="false"
        onblur="renombrarCancha('${c.id}', this)"
        title="✏️ Clic para renombrar">${c.nombre}</span>
      <span class="badge badge-f7" style="margin-left:6px;">F7</span>
    </th>`).join('');

  // filas: el número de rows es el máximo de asignaciones entre los 3 campos
  const maxRows = Math.max(...F7_CANCHAS.map(c => asignaciones[c.id].length), 0);

  let rowsHtml = '';
  for (let i = 0; i < maxRows; i++) {
    // la hora la toma del primer campo que tenga fila i, o vacía
    const horaRef = F7_CANCHAS.map(c => asignaciones[c.id][i]?.hora).find(h => h) || '';
    const celdas = F7_CANCHAS.map(c => {
      const fila = asignaciones[c.id][i];
      if (!fila) return `<td></td>`;
      if (fila.partido) {
        return `<td>
          <div class="cell-card" draggable="true" data-cid="${c.id}" data-idx="${i}">
            <button class="rmv" onclick="quitarPartidoF7('${c.id}',${i})">×</button>
            <p class="match-text">${fila.partido.local} <span class="match-vs">vs</span> ${fila.partido.visitante}</p>
            <div class="match-meta">
              <span class="match-cat">Cat.${fila.partido.cat}</span>
              <span style="font-size:10px;color:var(--gray-500)">J${fila.partido.jornada}</span>
            </div>
          </div>
        </td>`;
      }
      return `<td>
        <div class="drop-zone" data-cid="${c.id}" data-idx="${i}"
          style="min-height:56px;display:flex;align-items:center;justify-content:center;
                 border:2px dashed var(--gray-200);border-radius:8px;font-size:22px;font-weight:100;">
          +
        </div>
      </td>`;
    }).join('');

    rowsHtml += `<tr data-row="${i}">
      <td>
        <input class="hora-inp" type="text" value="${horaRef}" placeholder="- : --"
          onblur="actualizarHoraFila(${i}, this.value)"
          title="Hora compartida para esta fila" />
      </td>
      ${celdas}
      <td style="text-align:center;">
        <button class="btn-danger" onclick="quitarFilaF7(${i})">×</button>
      </td>
    </tr>`;
  }

  wrap.innerHTML = `
    <div class="edit-section-head">
      <div style="font-size:13px;font-weight:700;color:var(--navy);">
        Canchas Fútbol 7
        <span style="color:var(--gray-500);font-size:11px;font-weight:400;margin-left:6px;">Cada fila = misma hora · máx 3 simultáneos</span>
      </div>
      <button class="btn btn-sm" onclick="agregarFilaF7()">+ Hora compartida</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="edit-tbl">
        <thead><tr>
          <th style="width:90px;">HORA</th>
          ${headers}
          <th style="width:32px;"></th>
        </tr></thead>
        <tbody id="f7-tbody">
          ${rowsHtml || `<tr><td colspan="${F7_CANCHAS.length + 2}" class="empty-state" style="padding:20px;">
            Usa "+ Hora compartida" para agregar turnos · Arrastra partidos F7 a las celdas
          </td></tr>`}
        </tbody>
      </table>
    </div>`;

  // Adjuntar drop listeners a las celdas vacías y cell-cards
  setTimeout(() => {
    // Drop zones en las celdas vacías
    wrap.querySelectorAll('.drop-zone').forEach(zone => {
      const canchaId = zone.dataset.cid;
      const rowIdx   = parseInt(zone.dataset.idx);
      const cancha   = F7_CANCHAS.find(c => c.id === canchaId);
      zone.addEventListener('dragover', e => e.preventDefault());
      zone.addEventListener('dragenter', e => {
        e.preventDefault();
        if (!dragSrc) return;
        zone.classList.toggle('drag-over-valid',   validarTipo(cancha, dragSrc));
        zone.classList.toggle('drag-over-invalid', !validarTipo(cancha, dragSrc));
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over-valid', 'drag-over-invalid'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over-valid', 'drag-over-invalid');
        if (!dragSrc) return;
        if (!validarTipo(cancha, dragSrc)) { toast('❌ Solo partidos F7 en campos pequeños', 'error'); return; }
        asignaciones[canchaId][rowIdx].partido = dragSrc;
        // Sincronizar hora de fila
        const horaFila = document.querySelector(`[data-row="${rowIdx}"] .hora-inp`)?.value || '';
        asignaciones[canchaId][rowIdx].hora = horaFila;
        dragSrc = null;
        renderGrid(); renderPendientes(); actualizarStats();
      });
    });
    // Drag desde cell-cards F7
    wrap.querySelectorAll('.cell-card').forEach(el => {
      const cid = el.dataset.cid, idx = parseInt(el.dataset.idx);
      el.addEventListener('dragstart', e => {
        const fila = asignaciones[cid][idx];
        if (!fila?.partido) return;
        dragSrc = fila.partido;
        e.dataTransfer.effectAllowed = 'move';
        // Quitar de origen
        asignaciones[cid][idx].partido = null;
        setTimeout(() => { renderGrid(); renderPendientes(); actualizarStats(); }, 0);
      });
    });
    // Drop en todo el bloque F7 (fallback)
    const f7tbody = document.getElementById('f7-tbody');
    if (f7tbody) {
      f7tbody.addEventListener('dragover', e => e.preventDefault());
      f7tbody.addEventListener('dragenter', e => {
        e.preventDefault();
        if (dragSrc && !esF9(dragSrc)) f7tbody.style.background = 'var(--green-bg)';
        else if (dragSrc) f7tbody.style.background = 'var(--red-bg)';
      });
      f7tbody.addEventListener('dragleave', () => f7tbody.style.background = '');
      f7tbody.addEventListener('drop', e => {
        e.preventDefault(); f7tbody.style.background = '';
        if (!dragSrc) return;
        if (esF9(dragSrc)) { toast('❌ Los partidos F9 van en el Campo Grande', 'error'); return; }
        // Buscar primera celda libre
        let placed = false;
        for (const c of F7_CANCHAS) {
          const fila = asignaciones[c.id].find(f => !f.partido);
          if (fila) { fila.partido = dragSrc; placed = true; break; }
        }
        if (!placed) { toast('⚠️ Agrega una "Hora compartida" primero', 'error'); return; }
        dragSrc = null;
        renderGrid(); renderPendientes(); actualizarStats();
      });
    }
  }, 0);

  return wrap;
}

function buildFilaRow(cancha, fila, idx) {
  if (fila.partido) {
    const p = fila.partido;
    return `
      <tr class="f-row" draggable="true" data-cid="${cancha.id}" data-idx="${idx}">
        <td>
          <input class="hora-inp" type="text" value="${fila.hora}" placeholder="- : --"
            onblur="this.value=normalizarHora(this.value); actualizarHoraF9('${cancha.id}',${idx},this.value)" />
        </td>
        <td style="font-weight:700;color:var(--gray-900);text-align:center;">${p.local}</td>
        <td style="color:var(--gray-500);font-size:11px;text-align:center;font-style:italic;">vs</td>
        <td style="font-weight:700;color:var(--gray-900);text-align:center;">${p.visitante}</td>
        <td style="text-align:center;font-weight:600;color:var(--navy);">${p.cat}</td>
        <td style="text-align:center;color:var(--gray-500);font-size:12px;">J${p.jornada}</td>
        <td style="text-align:center;">
          <button class="btn-danger" onclick="quitarPartidoF9('${cancha.id}',${idx})">×</button>
        </td>
      </tr>`;
  }
  // Fila vacía
  return `
    <tr>
      <td>
        <input class="hora-inp" type="text" value="${fila.hora}" placeholder="- : --"
          onblur="this.value=normalizarHora(this.value); actualizarHoraF9('${cancha.id}',${idx},this.value)" />
      </td>
      <td colspan="5">
        <div class="drop-zone" data-idx="${idx}"
          style="display:flex;align-items:center;justify-content:center;min-height:34px;
                 border:2px dashed var(--gray-200);border-radius:6px;">
          <span style="color:var(--gray-300);font-size:12px;">↓ Arrastra aquí un partido ${cancha.tipo}</span>
        </div>
      </td>
      <td style="text-align:center;">
        <button class="btn-danger" onclick="quitarFilaVaciaF9('${cancha.id}',${idx})">×</button>
      </td>
    </tr>`;
}

/* ── VALIDACIONES ────────────────────────────────────────── */
function validarTipo(cancha, partido) {
  if (cancha.tipo === 'F9') return esF9(partido);
  return !esF9(partido);
}

/* ── OPERACIONES ─────────────────────────────────────────── */
function agregarPartidoACancha(canchaId, partido) {
  const libre = asignaciones[canchaId].findIndex(f => !f.partido);
  if (libre >= 0) {
    asignaciones[canchaId][libre].partido = partido;
  } else {
    asignaciones[canchaId].push({ id: uid(), hora: siguienteHora(canchaId), partido });
  }
  renderGrid(); renderPendientes(); actualizarStats();
}

function agregarFilaVacia(canchaId) {
  asignaciones[canchaId].push({ id: uid(), hora: siguienteHora(canchaId), partido: null });
  renderGrid(); renderPendientes(); actualizarStats();
}

function quitarPartidoF9(canchaId, idx) {
  asignaciones[canchaId].splice(idx, 1);
  renderGrid(); renderPendientes(); actualizarStats();
}
function quitarFilaVaciaF9(canchaId, idx) {
  asignaciones[canchaId].splice(idx, 1);
  renderGrid(); renderPendientes(); actualizarStats();
}
function actualizarHoraF9(canchaId, idx, valor) {
  if (asignaciones[canchaId]?.[idx]) asignaciones[canchaId][idx].hora = valor;
}

function agregarFilaF7() {
  // Agrega una fila vacía (sin partido) en los 3 campos F7
  const hora = (() => {
    const last = F7_CANCHAS.map(c => asignaciones[c.id]).flat().slice(-1)[0];
    const base = parseMinutos(last?.hora);
    return base !== null ? formatHora(base + DUR_F7) : '';
  })();
  F7_CANCHAS.forEach(c => asignaciones[c.id].push({ id: uid(), hora, partido: null }));
  renderGrid(); renderPendientes(); actualizarStats();
}

function quitarFilaF7(rowIdx) {
  F7_CANCHAS.forEach(c => { if (asignaciones[c.id][rowIdx] !== undefined) asignaciones[c.id].splice(rowIdx, 1); });
  renderGrid(); renderPendientes(); actualizarStats();
}

function quitarPartidoF7(canchaId, rowIdx) {
  if (asignaciones[canchaId][rowIdx]) asignaciones[canchaId][rowIdx].partido = null;
  renderGrid(); renderPendientes(); actualizarStats();
}

function actualizarHoraFila(rowIdx, valor) {
  // Actualiza la hora de todos los campos F7 en esa fila
  F7_CANCHAS.forEach(c => {
    if (asignaciones[c.id][rowIdx] !== undefined) asignaciones[c.id][rowIdx].hora = normalizarHora(valor);
  });
}

function renombrarCancha(canchaId, el) {
  const nombre = el.textContent.trim();
  if (!nombre) return;
  const cancha = ALL_CANCHAS.find(c => c.id === canchaId);
  if (cancha) cancha.nombre = nombre;
}

/* ── STATS ───────────────────────────────────────────────── */
function actualizarStats() {
  const asig = asignadosIds().size;
  const pend = pendientes.length - asig;
  const ea = document.getElementById('statAsig'), ep = document.getElementById('statPend');
  if (ea) ea.textContent = asig;
  if (ep) ep.textContent = Math.max(0, pend);
}

/* ── FECHA ───────────────────────────────────────────────── */
function actualizarFechaDisplay() {
  const inp = document.getElementById('inputFecha');
  if (!inp || !inp.value) return;
  const [y, m, d] = inp.value.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const str = f.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const p = str.split(' ');
  p[0] = p[0].charAt(0).toUpperCase() + p[0].slice(1);
  window._fechaFlyer = p.join(' ');
}

/* ── MODAL EXPORT ────────────────────────────────────────── */
window.Cron = {
  recargar() { location.reload(); },
  filtrarPendientes() {
    filtroCat = document.getElementById('filtroCat')?.value || '';
    filtrarPendientes();
  },
  abrirModalExport() {
    actualizarFechaDisplay();
    const modal = document.getElementById('modalExport');
    if (!modal) return;
    document.getElementById('checkF9').innerHTML = F9_CANCHAS.map(c => `
      <label class="modal-check-item">
        <input type="checkbox" value="${c.id}" class="chk-f9" checked />
        <span class="name">${c.nombre}</span>
        <span class="badge badge-f9">F9</span>
      </label>`).join('');
    document.getElementById('checkF7').innerHTML = F7_CANCHAS.map(c => `
      <label class="modal-check-item">
        <input type="checkbox" value="${c.id}" class="chk-f7" checked />
        <span class="name">${c.nombre}</span>
        <span class="badge badge-f7">F7</span>
      </label>`).join('');
    const fd = document.getElementById('modalFechaStr');
    if (fd) fd.textContent = window._fechaFlyer || 'Fecha no configurada';
    modal.classList.add('open');
  },
  cerrarModalExport() {
    document.getElementById('modalExport')?.classList.remove('open');
  },
  async generarFlyer() {
    const btn = document.getElementById('btnGenerar');
    btn.textContent = '⏳ Generando...'; btn.disabled = true;
    const selF9 = [...document.querySelectorAll('.chk-f9:checked')].map(c => c.value);
    const selF7 = [...document.querySelectorAll('.chk-f7:checked')].map(c => c.value);
    if (!selF9.length && !selF7.length) {
      toast('⚠️ Selecciona al menos una cancha', 'error');
      btn.textContent = '📸 Generar PNG para Facebook'; btn.disabled = false; return;
    }

    const fechaTexto = window._fechaFlyer || 'Horario de Partidos';
    let flyerHtml = `
      <div class="flyer-header">
        <div class="flyer-logo-block">
          <div class="flyer-logo-circle">
            <svg viewBox="0 0 52 52" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
              <g fill="#f5a623"><path d="M18 10h16l-3 10c0 4-10 4-10 0z"/><path d="M18 12q-6 2-4 7q1 3 5 3l-1-10z"/>
              <path d="M34 12q6 2 4 7q-1 3-5 3l1-10z"/><rect x="22" y="20" width="8" height="6" rx="1"/>
              <rect x="18" y="26" width="16" height="3" rx="1.5"/></g>
              <text x="10" y="11" font-size="7" fill="#f5a623">★</text><text x="23" y="9" font-size="7" fill="#f5a623">★</text>
              <text x="36" y="11" font-size="7" fill="#f5a623">★</text>
              <text x="26" y="40" font-size="6.5" font-family="Arial" font-weight="900" fill="white" text-anchor="middle">CAJAMARCA</text>
              <text x="26" y="49" font-size="5.5" font-family="Arial" font-weight="700" fill="#f5a623" text-anchor="middle">2026</text>
            </svg>
          </div>
          <div>
            <p style="font-weight:900;font-size:13px;color:white;line-height:1.1">COPA CAJAMARCA</p>
            <p style="font-weight:700;font-size:10px;color:rgba(255,255,255,.7);text-transform:uppercase">Campeonato de Menores</p>
          </div>
        </div>
        <div class="flyer-fecha-badge">${fechaTexto}</div>
        <div class="flyer-right"><p class="flyer-prog-title">CRONOGRAMA</p><p class="flyer-prog-sub">Fútbol 7 / 9</p></div>
      </div>
      <div class="flyer-body">`;

    // F9
    F9_CANCHAS.filter(c => selF9.includes(c.id)).forEach(cancha => {
      const filas = asignaciones[cancha.id].filter(f => f.partido);
      flyerHtml += `<div>
        <div class="flyer-cancha-title">
          <span class="flyer-cancha-badge">${cancha.nombre}</span>
          <span style="background:rgba(245,166,35,.15);color:#92400e;border:1px solid rgba(245,166,35,.4);font-size:10px;padding:2px 8px;border-radius:50px;font-weight:700;margin-left:6px">F9 · 45 min</span>
        </div>
        <table class="flyer-tbl"><thead><tr>
          <th style="width:80px">HORA</th><th>LOCAL</th><th style="width:28px">vs</th>
          <th>VISITANTE</th><th style="width:60px">CAT.</th><th style="width:60px">JORN.</th>
        </tr></thead><tbody>
        ${filas.length ? filas.map(f => `<tr>
          <td class="t-hora">${f.hora||'—'}</td>
          <td class="t-partido" style="text-align:right">${f.partido.local}</td>
          <td style="color:#8898c0;font-style:italic;font-size:11px">vs</td>
          <td class="t-partido">${f.partido.visitante}</td>
          <td class="t-cat">${f.partido.cat}</td>
          <td class="t-tipo">J${f.partido.jornada}</td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:#8898c0;padding:10px;font-style:italic">Sin partidos asignados</td></tr>'}
        </tbody></table></div>`;
    });

    // F7 (una tabla por campo)
    F7_CANCHAS.filter(c => selF7.includes(c.id)).forEach(cancha => {
      const filas = asignaciones[cancha.id].filter(f => f.partido);
      flyerHtml += `<div>
        <div class="flyer-cancha-title">
          <span class="flyer-cancha-badge">${cancha.nombre}</span>
          <span style="background:rgba(22,163,74,.12);color:#166534;border:1px solid rgba(22,163,74,.3);font-size:10px;padding:2px 8px;border-radius:50px;font-weight:700;margin-left:6px">F7 · 35 min</span>
        </div>
        <table class="flyer-tbl"><thead><tr>
          <th style="width:80px">HORA</th><th>LOCAL</th><th style="width:28px">vs</th>
          <th>VISITANTE</th><th style="width:60px">CAT.</th><th style="width:60px">JORN.</th>
        </tr></thead><tbody>
        ${filas.length ? filas.map(f => `<tr>
          <td class="t-hora">${f.hora||'—'}</td>
          <td class="t-partido" style="text-align:right">${f.partido.local}</td>
          <td style="color:#8898c0;font-style:italic;font-size:11px">vs</td>
          <td class="t-partido">${f.partido.visitante}</td>
          <td class="t-cat">${f.partido.cat}</td>
          <td class="t-tipo">J${f.partido.jornada}</td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:#8898c0;padding:10px;font-style:italic">Sin partidos</td></tr>'}
        </tbody></table></div>`;
    });

    flyerHtml += '</div>';

    const fc = document.getElementById('flyerContainer');
    fc.innerHTML = flyerHtml;
    await new Promise(r => setTimeout(r, 120));

    try {
      const raw = await html2canvas(fc, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false, width: 1080, height: fc.scrollHeight });
      const FB_W = 2160, FB_H = raw.height <= FB_W ? FB_W : Math.min(raw.height, 2700);
      const fbCanvas = document.createElement('canvas'); fbCanvas.width = FB_W; fbCanvas.height = FB_H;
      const ctx = fbCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, FB_W, FB_H);
      const scale = Math.min(FB_W / raw.width, FB_H / raw.height);
      const dw = Math.round(raw.width * scale), dh = Math.round(raw.height * scale);
      ctx.drawImage(raw, Math.round((FB_W - dw) / 2), 0, dw, dh);
      const link = document.createElement('a');
      link.download = `CronogramaCopa-${new Date().toLocaleDateString('es-PE').replace(/\//g,'-')}.png`;
      link.href = fbCanvas.toDataURL('image/png', 1.0); link.click();
      toast('📸 PNG generado — listo para publicar!', 'success', 4000);
      this.cerrarModalExport();
    } catch (err) {
      console.error(err); toast('❌ Error al generar la imagen', 'error');
    } finally {
      fc.innerHTML = '';
      btn.textContent = '📸 Generar PNG para Facebook'; btn.disabled = false;
    }
  },
};

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('inputFecha');
  if (inp) {
    inp.value = new Date().toISOString().split('T')[0];
    inp.addEventListener('change', actualizarFechaDisplay);
    actualizarFechaDisplay();
  }
  cargarPartidos();
});
