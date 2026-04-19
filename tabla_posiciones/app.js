// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — Google Sheets publicado
// ═══════════════════════════════════════════════════════════
const PUB_ID = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';

const URL_EQUIPOS = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1862807827&single=true&output=csv`;
const URL_FIXTURE = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1171502194&single=true&output=csv`;

// ═══════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════
const G = {
  equipos:   {},   // { '2015': ['U CAJAMARCA', ...] }
  fixture:   [],   // todos los partidos del sheet
  standings: {},   // { cat: [{equipo,pj,g,e,p,gf,gc,dg,pts}] }
  activeCat: 'all',
};

const el = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════
function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════
// PARSE EQUIPOS
// Fila 1: "Equipos" | 2013 | 2014 | 2015 ...
// Fila 2+: Nombre equipo | 1/vacío por cada año
// ═══════════════════════════════════════════════════════════
function parseEquipos(rows) {
  if (!rows.length) return {};
  const hdr = rows[0];
  const cats = {};
  for (let c = 1; c < hdr.length; c++) {
    const yr = hdr[c].trim();
    if (yr && !isNaN(yr)) cats[yr] = [];
  }
  for (let r = 1; r < rows.length; r++) {
    const team = (rows[r][0] || '').trim().toUpperCase();
    if (!team) continue;
    for (let c = 1; c < hdr.length; c++) {
      const yr  = hdr[c].trim();
      const val = (rows[r][c] || '').trim();
      if (cats[yr] && (val === '1' || val.toLowerCase() === 'x' || val === '✓'))
        cats[yr].push(team);
    }
  }
  Object.keys(cats).forEach(k => { if (!cats[k].length) delete cats[k]; });
  return cats;
}

// ═══════════════════════════════════════════════════════════
// PARSE FIXTURE
// Jornada·Categoria·Local·Score·Visitante·Goles Local·Goles Visitante·Resultado
// ═══════════════════════════════════════════════════════════
function parseFixture(rows) {
  if (!rows.length) return [];
  const hdr = rows[0].map(h => h.trim().toUpperCase());

  const col   = key => hdr.findIndex(h => h.includes(key));
  const exact = key => hdr.findIndex(h => h === key);

  const IDX = {
    cat:       col('CATEG'),
    local:     exact('LOCAL'),
    visitante: col('VISITANTE'),
    score:     exact('SCORE'),
    golesL:    hdr.findIndex(h => h.includes('GOLES') && h.includes('LOCAL')),
    golesV:    hdr.findIndex(h => h.includes('GOLES') && h.includes('VISITANTE')),
    resultado: col('RESULTADO'),
  };

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;
    const local     = (row[IDX.local]     || '').trim().toUpperCase();
    const visitante = (row[IDX.visitante] || '').trim().toUpperCase();
    if (!local || !visitante) continue;
    out.push({
      cat:       (row[IDX.cat]  || '').trim(),
      local, visitante,
      score:     (row[IDX.score]     || '').trim(),
      golesL:    parseInt(row[IDX.golesL] || '', 10),
      golesV:    parseInt(row[IDX.golesV] || '', 10),
      resultado: (row[IDX.resultado] || '').trim(),
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// CALCULAR TABLA DE POSICIONES
// ═══════════════════════════════════════════════════════════
function buildStandings() {
  G.standings = {};

  Object.keys(G.equipos).sort().forEach(cat => {
    // Inicializar con todos los equipos del sheet EQUIPOS
    const map = {};
    G.equipos[cat].forEach(t => {
      map[t] = { equipo: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
    });

    // Procesar partidos jugados de esta categoría
    G.fixture
      .filter(m => m.cat === cat)
      .forEach(m => {
        const jugado = m.resultado &&
          m.resultado.toUpperCase() !== 'PENDIENTE' &&
          m.resultado !== '-' && m.resultado !== '';
        if (!jugado) return;

        const gl = isNaN(m.golesL) ? null : m.golesL;
        const gv = isNaN(m.golesV) ? null : m.golesV;
        if (gl === null || gv === null) return;

        const loc = m.local.toUpperCase().trim();
        const vis = m.visitante.toUpperCase().trim();

        // Si un equipo aparece en el fixture pero no en EQUIPOS, lo agregamos igual
        if (!map[loc]) map[loc] = { equipo: loc, pj:0,g:0,e:0,p:0,gf:0,gc:0,dg:0,pts:0 };
        if (!map[vis]) map[vis] = { equipo: vis, pj:0,g:0,e:0,p:0,gf:0,gc:0,dg:0,pts:0 };

        const tL = map[loc], tV = map[vis];
        tL.pj++; tV.pj++;
        tL.gf += gl; tL.gc += gv;
        tV.gf += gv; tV.gc += gl;

        if (gl > gv)      { tL.g++; tL.pts += 3; tV.p++; }
        else if (gl < gv) { tV.g++; tV.pts += 3; tL.p++; }
        else              { tL.e++; tL.pts++;     tV.e++; tV.pts++; }

        tL.dg = tL.gf - tL.gc;
        tV.dg = tV.gf - tV.gc;
      });

    // Ordenar: Pts ↓ → DG ↓ → GF ↓ → nombre ↑
    G.standings[cat] = Object.values(map).sort(
      (a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.equipo.localeCompare(b.equipo)
    );
  });
}

// ═══════════════════════════════════════════════════════════
// CALCULAR RESUMEN GENERAL
// ═══════════════════════════════════════════════════════════
function calcSummary() {
  let totalCats = 0, totalEquipos = 0, totalJugados = 0, totalPendientes = 0;
  Object.keys(G.equipos).forEach(cat => {
    totalCats++;
    totalEquipos += G.equipos[cat].length;
  });
  G.fixture.forEach(m => {
    const jugado = m.resultado &&
      m.resultado.toUpperCase() !== 'PENDIENTE' &&
      m.resultado !== '-' && m.resultado !== '';
    jugado ? totalJugados++ : totalPendientes++;
  });
  return { totalCats, totalEquipos, totalJugados, totalPendientes };
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderAll() {
  const { totalCats, totalEquipos, totalJugados, totalPendientes } = calcSummary();

  // Summary row
  el('summaryRow').innerHTML = `
    <div class="sum-card c-blue">
      <div class="sum-label">Categorías</div>
      <div class="sum-value blue">${totalCats}</div>
      <div class="sum-sub">en el torneo</div>
    </div>
    <div class="sum-card c-gold">
      <div class="sum-label">Equipos</div>
      <div class="sum-value gold">${totalEquipos}</div>
      <div class="sum-sub">participantes</div>
    </div>
    <div class="sum-card c-green">
      <div class="sum-label">Partidos jugados</div>
      <div class="sum-value green">${totalJugados}</div>
      <div class="sum-sub">con resultado</div>
    </div>
    <div class="sum-card c-red">
      <div class="sum-label">Pendientes</div>
      <div class="sum-value red">${totalPendientes}</div>
      <div class="sum-sub">sin resultado</div>
    </div>`;
  el('summaryRow').classList.remove('hidden');

  // Tabs de categoría
  const tabsEl = el('catTabs');
  tabsEl.innerHTML = '';
  const makeTab = (text, cat) => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (G.activeCat === cat ? ' active' : '');
    btn.textContent = text;
    btn.dataset.cat = cat;
    btn.onclick = () => setActiveCat(cat);
    tabsEl.appendChild(btn);
  };
  makeTab('Todas las categorías', 'all');
  Object.keys(G.equipos).sort().forEach(cat => makeTab(`CAT. ${cat}`, cat));
  tabsEl.classList.remove('hidden');

  renderContent();
}

function renderContent() {
  const cats = G.activeCat === 'all'
    ? Object.keys(G.equipos).sort()
    : [G.activeCat];

  let html = '';

  cats.forEach(cat => {
    const rows = G.standings[cat];
    if (!rows) return;

    const jugados   = rows.reduce((s, r) => s + r.pj, 0) / 2; // cada partido suma 2 PJ
    const equipos   = rows.length;
    const liderPts  = rows[0]?.pts ?? 0;
    const maxPts    = rows.reduce((s, r) => s + r.pj, 0) > 0
      ? Math.max(...rows.map(r => r.pj)) * 3
      : 1;

    html += `
      <div class="standings-block">
        <div class="st-card">

          <!-- Cabecera de categoría -->
          <div class="st-card-head">
            <div class="st-head-left">
              <div class="st-cat-label">CAT. ${cat}</div>
              <div class="st-meta">
                <div class="st-chip">⚽ ${equipos} equipos</div>
                <div class="st-chip">🏆 Líder: ${liderPts} pts</div>
              </div>
            </div>
          </div>

          <!-- Tabla -->
          <table class="st-table">
            <thead>
              <tr>
                <th class="th-pos" style="width:40px">#</th>
                <th class="th-team">Equipo</th>
                <th title="Partidos Jugados">PJ</th>
                <th title="Ganados">G</th>
                <th title="Empatados">E</th>
                <th title="Perdidos">P</th>
                <th class="col-gf" title="Goles a Favor">GF</th>
                <th class="col-gc" title="Goles en Contra">GC</th>
                <th title="Diferencia de Goles">DG</th>
                <th class="th-pts" style="width:52px">PTS</th>
              </tr>
            </thead>
            <tbody>`;

    rows.forEach((r, i) => {
      const posClass = i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : '';
      const dgStr    = r.dg > 0 ? `+${r.dg}` : `${r.dg}`;
      const pctPts   = maxPts > 0 ? Math.round((r.pts / maxPts) * 100) : 0;
      const altClass = i % 2 === 1 ? 'row-alt' : '';
      const dgClass  = r.dg > 0 ? 'dg-pos' : r.dg < 0 ? 'dg-neg' : '';

      html += `
        <tr class="${altClass}">
          <td class="td-pos">
            <span class="pos-badge ${posClass}">${i + 1}</span>
          </td>
          <td class="td-team">
            <div class="team-info">
              <div class="team-name-st">${r.equipo}</div>
              <div class="pts-bar-wrap">
                <div class="pts-bar" style="width:${pctPts}%"></div>
              </div>
            </div>
          </td>
          <td>${r.pj}</td>
          <td class="td-g">${r.g}</td>
          <td class="td-e">${r.e}</td>
          <td class="td-p">${r.p}</td>
          <td class="col-gf">${r.gf}</td>
          <td class="col-gc">${r.gc}</td>
          <td class="${dgClass}">${dgStr}</td>
          <td class="td-pts">${r.pts}</td>
        </tr>`;
    });

    html += `
            </tbody>
          </table>

          <!-- Leyenda de columnas -->
          <div class="legend">
            <span class="legend-item"><span class="legend-dot" style="background:var(--primary)"></span>PJ = Partidos Jugados</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--green)"></span>G = Ganados (3 pts)</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--amber)"></span>E = Empatados (1 pt)</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--red)"></span>P = Perdidos (0 pts)</span>
            <span class="legend-item">DG = Diferencia de goles</span>
          </div>

        </div>
      </div>`;
  });

  el('mainContent').innerHTML = html || `
    <div style="text-align:center;padding:40px;background:var(--white);
                border:1px solid var(--gray-200);border-radius:var(--radius);color:var(--gray-500);">
      Sin datos de posiciones disponibles.
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// CONTROLES
// ═══════════════════════════════════════════════════════════
function setActiveCat(cat) {
  G.activeCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.cat === cat)
  );
  renderContent();
}

// ═══════════════════════════════════════════════════════════
// CARGA PRINCIPAL
// ═══════════════════════════════════════════════════════════
async function loadAll() {
  el('errorBox').classList.add('hidden');
  el('summaryRow').classList.add('hidden');
  el('catTabs').classList.add('hidden');
  el('mainContent').innerHTML = '';
  el('lastUpdated').classList.add('hidden');

  el('loaderWrap').style.display = 'flex';
  el('loaderText').textContent = 'Conectando con Google Sheets…';

  try {
    // 1. EQUIPOS
    el('loaderText').textContent = 'Leyendo equipos por categoría…';
    const resEq = await fetch(URL_EQUIPOS);
    if (!resEq.ok) throw new Error(`No se pudo leer EQUIPOS (HTTP ${resEq.status}).`);
    G.equipos = parseEquipos(parseCsv(await resEq.text()));
    if (!Object.keys(G.equipos).length)
      throw new Error('La pestaña EQUIPOS no tiene datos válidos. Verifica que el sheet esté publicado.');

    // 2. FIXTURE
    el('loaderText').textContent = 'Leyendo resultados del fixture…';
    const resFix = await fetch(URL_FIXTURE);
    if (!resFix.ok) throw new Error(`No se pudo leer FIXTURE (HTTP ${resFix.status}).`);
    G.fixture = parseFixture(parseCsv(await resFix.text()));

    // 3. CALCULAR Y RENDERIZAR
    buildStandings();
    renderAll();

    const now = new Date();
    el('lastUpdated').textContent =
      `Actualizado: ${now.toLocaleDateString('es-PE', { day:'2-digit', month:'short' })} · ${now.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' })}`;
    el('lastUpdated').classList.remove('hidden');

  } catch (err) {
    el('errorTitle').textContent = 'Error al cargar los datos';
    el('errorMsg').textContent   = err.message;
    el('errorBox').classList.remove('hidden');
  } finally {
    el('loaderWrap').style.display = 'none';
  }
}

// Auto-carga al abrir la página
document.addEventListener('DOMContentLoaded', loadAll);
