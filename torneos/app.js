// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════
const PUB_ID = '2PACX-1vTOWEsF51iU6PUh4zJ2GGhMJGJGICjYwIpoIAUiWSR6Rbl6P2WsN--YBVsVhwVtuZQdEs1ijtBngaHJ';

const URL_EQUIPOS = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1862807827&single=true&output=csv`;
const URL_FIXTURE = `https://docs.google.com/spreadsheets/d/e/${PUB_ID}/pub?gid=1171502194&single=true&output=csv`;

// ═══════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════
const G = {
  equipos:   {},
  loaded:    [],   // todos los partidos del sheet FIXTURE
  result:    {},   // { cat: [{ jornada, local, visitante, status, score, resultado }] }
  byes:      {},   // { cat: { jornada: teamName } } - quién descansa cada fecha
  standings: {},   // { cat: [{ equipo, pj, g, e, p, gf, gc, dg, pts }] }
  activeCat: 'all',
  view:      'all',    // 'all' | 'missing'
  mode:      'fixture' // 'fixture' | 'standings'
};

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
      } else if (c === ',' && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

const el = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════
// PARSEAR PESTAÑA EQUIPOS
// ═══════════════════════════════════════════════════════════
function parseEquipos(rows) {
  if (!rows.length) return {};
  const header = rows[0];
  const cats = {};
  for (let c = 1; c < header.length; c++) {
    const yr = header[c].trim();
    if (yr && !isNaN(yr)) cats[yr] = [];
  }
  for (let r = 1; r < rows.length; r++) {
    const team = (rows[r][0] || '').trim().toUpperCase();
    if (!team) continue;
    for (let c = 1; c < header.length; c++) {
      const yr  = header[c].trim();
      const val = (rows[r][c] || '').trim();
      if (cats[yr] && (val === '1' || val.toLowerCase() === 'x' || val === '✓')) {
        cats[yr].push(team);
      }
    }
  }
  Object.keys(cats).forEach(k => { if (!cats[k].length) delete cats[k]; });
  return cats;
}

// ═══════════════════════════════════════════════════════════
// ROUND-ROBIN  (mismo algoritmo que sorteo/app.js)
// ═══════════════════════════════════════════════════════════
function buildRoundRobin(teams) {
  const list = [...teams];
  if (list.length % 2 !== 0) list.push('LIBRE');
  const tot = list.length, rounds = tot - 1;
  let half = [...list];
  const matches = [];
  for (let r = 0; r < rounds; r++) {
    const top = half.slice(0, tot / 2);
    const bot = half.slice(tot / 2).reverse();
    for (let i = 0; i < tot / 2; i++) {
      if (top[i] !== 'LIBRE' && bot[i] !== 'LIBRE') {
        matches.push({ jornada: r + 1, local: top[i], visitante: bot[i] });
      }
    }
    const fixed = half[0], rest = half.slice(1);
    rest.unshift(rest.pop());
    half = [fixed, ...rest];
  }
  return matches;
}

// ═══════════════════════════════════════════════════════════
// PARSEAR PESTAÑA FIXTURE
// Columnas: Jornada·Categoria·Local·Score·Visitante·Goles Local·Goles Visitante·Resultado
// ═══════════════════════════════════════════════════════════
function parseFixture(rows) {
  if (!rows.length) return [];
  const hdr = rows[0].map(h => h.trim().toUpperCase());

  const col   = key => hdr.findIndex(h => h.includes(key));
  const exact = key => hdr.findIndex(h => h === key);
  const IDX = {
    jornada:   col('JORNADA'),
    cat:       col('CATEG'),
    local:     exact('LOCAL'),
    visitante: col('VISITANTE'),
    score:     exact('SCORE'),
    golesL:    hdr.findIndex(h => h.includes('GOLES') && h.includes('LOCAL')),
    golesV:    hdr.findIndex(h => h.includes('GOLES') && h.includes('VISITANTE')),
    resultado: col('RESULTADO'),
  };

  const result = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;
    const local     = (row[IDX.local]     || '').trim().toUpperCase();
    const visitante = (row[IDX.visitante] || '').trim().toUpperCase();
    if (!local || !visitante) continue;
    result.push({
      jornada:   (row[IDX.jornada]   || '').trim(),
      cat:       (row[IDX.cat]       || '').trim(),
      local, visitante,
      score:     (row[IDX.score]     || '').trim(),
      golesL:    parseInt(row[IDX.golesL] || '', 10),
      golesV:    parseInt(row[IDX.golesV] || '', 10),
      resultado: (row[IDX.resultado] || '').trim(),
    });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// CLAVE DE PARTIDO
// ═══════════════════════════════════════════════════════════
function matchKey(cat, local, visitante) {
  return `${cat}|${local.trim().toUpperCase()}|${visitante.trim().toUpperCase()}`;
}

// ═══════════════════════════════════════════════════════════
// COMPARAR FIXTURE (sheet = fuente de jornadas, RR = validación)
// ═══════════════════════════════════════════════════════════
function buildComparison() {
  G.result = {};
  G.byes   = {};

  let totExpected = 0, totLoaded = 0, totMissing = 0,
      totPlayed = 0, totPending = 0, totInvalid = 0;

  Object.keys(G.equipos).sort().forEach(cat => {
    const catTeamsList = G.equipos[cat] || [];
    const catTeams     = new Set(catTeamsList);
    G.result[cat] = [];
    G.byes[cat]   = {};

    // Construir set de claves esperadas por round-robin (para validar)
    const rrExpected = buildRoundRobin(catTeamsList);
    const rrKeySet   = new Set(rrExpected.map(m => {
      const [t1, t2] = [m.local, m.visitante].sort();
      return `${cat}|${t1}|${t2}`;
    }));

    const seenKeys   = new Set(); // detección de duplicados
    const consumedRR = new Set(); // claves RR cubiertas por el sheet

    // ── PASO 1: partidos del sheet → fuente de jornadas ──
    G.loaded.filter(m => m.cat === cat).forEach(m => {
      const [t1, t2] = [m.local, m.visitante].sort();
      const key      = `${cat}|${t1}|${t2}`;

      const localOk  = catTeams.has(m.local);
      const visitOk  = catTeams.has(m.visitante);
      const isSelf   = m.local === m.visitante;
      const isDup    = seenKeys.has(key);
      const notInRR  = !isDup && localOk && visitOk && !isSelf && !rrKeySet.has(key);
      const isInvalid = !localOk || !visitOk || isSelf || isDup || notInRR;

      seenKeys.add(key);

      if (isInvalid) {
        totInvalid++;
        const reason = isDup    ? 'Partido duplicado'
                     : isSelf   ? 'Equipo juega contra sí mismo'
                     : !localOk ? `"${m.local}" no está en EQUIPOS`
                     : !visitOk ? `"${m.visitante}" no está en EQUIPOS`
                     :            'No corresponde al fixture del sorteo';
        G.result[cat].push({
          jornada: null, local: m.local, visitante: m.visitante,
          status: 'invalid', score: m.score || '', resultado: m.resultado || '', reason,
        });
        return;
      }

      consumedRR.add(key);
      const played = m.resultado &&
        m.resultado.toUpperCase() !== 'PENDIENTE' &&
        m.resultado !== '-' && m.resultado !== '';

      totExpected++; totLoaded++;
      played ? totPlayed++ : totPending++;
      G.result[cat].push({
        jornada:   m.jornada,   // ← jornada REAL del sheet
        local:     m.local,
        visitante: m.visitante,
        status:    played ? 'ok' : 'pending',
        score:     m.score || '',
        resultado: m.resultado || '',
      });
    });

    // ── PASO 2: faltantes → backtracking para distribución perfecta ──
    // 1) Generar TODAS las combinaciones C(N,2) y encontrar las faltantes
    const allExpectedKeys = new Set();
    for (let i = 0; i < catTeamsList.length; i++)
      for (let j = i + 1; j < catTeamsList.length; j++) {
        const [t1, t2] = [catTeamsList[i], catTeamsList[j]].sort();
        allExpectedKeys.add(`${cat}|${t1}|${t2}`);
      }

    // consumedRR ya tiene las claves del sheet (sorted)
    const missingPairs = [];
    allExpectedKeys.forEach(key => {
      if (!consumedRR.has(key)) {
        const parts = key.split('|');
        missingPairs.push({ local: parts[1], visitante: parts[2] });
      }
    });

    // Ordenar por restricción: equipos más frecuentes primero → mejor backtracking
    const _freq = {};
    missingPairs.forEach(m => {
      _freq[m.local]     = (_freq[m.local]     || 0) + 1;
      _freq[m.visitante] = (_freq[m.visitante] || 0) + 1;
    });
    missingPairs.sort((a, b) =>
      (_freq[b.local] + _freq[b.visitante]) - (_freq[a.local] + _freq[a.visitante])
    );

    // 2) Construir schedule actual desde los partidos del sheet
    const teamSchedule = {};
    const jMatchCount  = {};
    const sched = t => {
      if (!teamSchedule[t]) teamSchedule[t] = new Set();
      return teamSchedule[t];
    };

    G.result[cat]
      .filter(m => m.status !== 'invalid')
      .forEach(m => {
        const j = String(m.jornada);
        sched(m.local).add(j);
        sched(m.visitante).add(j);
        jMatchCount[j] = (jMatchCount[j] || 0) + 1;
      });

    const maxMatchesPerJ = Math.floor(catTeamsList.length / 2);
    const totalJornadas  = catTeamsList.length % 2 === 0
      ? catTeamsList.length - 1
      : catTeamsList.length;

    // 3) Backtracking: asignar cada partido faltante a una jornada válida
    //    Garantiza: máx floor(N/2) por jornada, ningún equipo repetido
    const assignments = new Array(missingPairs.length).fill(null);

    function btCanPlace(idx, jKey) {
      const m = missingPairs[idx];
      if ((jMatchCount[jKey] || 0) >= maxMatchesPerJ) return false;
      if (sched(m.local).has(jKey))     return false;
      if (sched(m.visitante).has(jKey)) return false;
      return true;
    }
    function btPlace(idx, jKey) {
      const m = missingPairs[idx];
      sched(m.local).add(jKey); sched(m.visitante).add(jKey);
      jMatchCount[jKey] = (jMatchCount[jKey] || 0) + 1;
      assignments[idx] = jKey;
    }
    function btUnplace(idx, jKey) {
      const m = missingPairs[idx];
      sched(m.local).delete(jKey); sched(m.visitante).delete(jKey);
      jMatchCount[jKey]--;
      assignments[idx] = null;
    }
    function btSolve(idx) {
      if (idx === missingPairs.length) return true;
      // Intentar primero dentro del rango ideal (totalJornadas)
      for (let j = 1; j <= totalJornadas; j++) {
        const jKey = String(j);
        if (btCanPlace(idx, jKey)) {
          btPlace(idx, jKey);
          if (btSolve(idx + 1)) return true;
          btUnplace(idx, jKey);
        }
      }
      // Fallback: jornadas extra si el schedule del sheet no permite un fit perfecto
      for (let j = totalJornadas + 1; j <= totalJornadas + 10; j++) {
        const jKey = String(j);
        if (btCanPlace(idx, jKey)) {
          btPlace(idx, jKey);
          if (btSolve(idx + 1)) return true;
          btUnplace(idx, jKey);
        }
      }
      return false;
    }

    btSolve(0);

    // 4) Agregar los faltantes con su jornada asignada
    missingPairs.forEach((m, i) => {
      totExpected++; totMissing++;
      G.result[cat].push({
        jornada: assignments[i] || '?',
        local:   m.local, visitante: m.visitante,
        status:  'missing', score: '', resultado: '',
      });
    });

    // ── PASO 3: calcular quién descansa por jornada ──
    // Solo aplica si hay número impar de equipos (siempre hay un equipo LIBRE)
    // Con n par todos juegan, nadie descansa
    const nTeams = catTeamsList.length;
    const matchesPerJ = Math.floor(nTeams / 2); // partidos esperados por jornada

    // Agrupar los partidos válidos por jornada para calcular quién juega
    const jornParticipants = {};
    G.result[cat].filter(m => m.jornada !== null && m.status !== 'invalid').forEach(m => {
      if (!jornParticipants[m.jornada]) jornParticipants[m.jornada] = new Set();
      jornParticipants[m.jornada].add(m.local);
      jornParticipants[m.jornada].add(m.visitante);
    });

    Object.keys(jornParticipants).forEach(j => {
      const played   = jornParticipants[j];
      const resting  = catTeamsList.filter(t => !played.has(t));
      // Mostrar LIBRE solo si exactamente 1 equipo no jugó y la jornada parece completa
      if (resting.length === 1 && played.size === matchesPerJ * 2) {
        G.byes[cat][j] = resting[0];
      }
    });
  });

  el('sumCats').textContent     = Object.keys(G.equipos).length;
  el('sumExpected').textContent = totExpected;
  el('sumLoaded').textContent   = totLoaded;
  el('sumMissing').textContent  = totMissing;
  el('sumPlayed').textContent   = totPlayed;
  el('sumPending').textContent  = totPending;
}

// ═══════════════════════════════════════════════════════════
// CALCULAR TABLA DE POSICIONES
// ═══════════════════════════════════════════════════════════
function buildStandings() {
  G.standings = {};

  Object.keys(G.equipos).sort().forEach(cat => {
    const teamMap = {};

    // Inicializar todos los equipos de la categoría
    G.equipos[cat].forEach(t => {
      teamMap[t] = { equipo: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
    });

    // Procesar partidos jugados de esta categoría
    G.loaded
      .filter(m => m.cat === cat)
      .forEach(m => {
        const played = m.resultado &&
          m.resultado.toUpperCase() !== 'PENDIENTE' &&
          m.resultado !== '-' && m.resultado !== '';
        if (!played) return;

        const gl = isNaN(m.golesL) ? null : m.golesL;
        const gv = isNaN(m.golesV) ? null : m.golesV;
        if (gl === null || gv === null) return;

        const loc = m.local.toUpperCase().trim();
        const vis = m.visitante.toUpperCase().trim();

        // Asegurar que el equipo esté en el mapa aunque no esté en EQUIPOS
        if (!teamMap[loc]) teamMap[loc] = { equipo: loc, pj:0,g:0,e:0,p:0,gf:0,gc:0,dg:0,pts:0 };
        if (!teamMap[vis]) teamMap[vis] = { equipo: vis, pj:0,g:0,e:0,p:0,gf:0,gc:0,dg:0,pts:0 };

        const tL = teamMap[loc];
        const tV = teamMap[vis];

        tL.pj++; tV.pj++;
        tL.gf += gl; tL.gc += gv;
        tV.gf += gv; tV.gc += gl;

        if (gl > gv) {
          tL.g++; tL.pts += 3; tV.p++;
        } else if (gl < gv) {
          tV.g++; tV.pts += 3; tL.p++;
        } else {
          tL.e++; tL.pts++; tV.e++; tV.pts++;
        }

        tL.dg = tL.gf - tL.gc;
        tV.dg = tV.gf - tV.gc;
      });

    // Ordenar: Pts → DG → GF → nombre
    G.standings[cat] = Object.values(teamMap).sort((a, b) =>
      b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.equipo.localeCompare(b.equipo)
    );
  });
}

// ═══════════════════════════════════════════════════════════
// RENDER — estructura principal
// ═══════════════════════════════════════════════════════════
function renderAll() {
  el('summaryGrid').classList.remove('hidden');
  el('filterBar').classList.remove('hidden');

  const pillsEl = el('catPills');
  pillsEl.innerHTML = '';

  const makeBtn = (text, cat) => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill' + (G.activeCat === cat ? ' active' : '');
    btn.textContent = text;
    btn.dataset.cat = cat;
    btn.onclick = () => setActiveCat(cat);
    pillsEl.appendChild(btn);
  };

  makeBtn('Todas', 'all');
  Object.keys(G.equipos).sort().forEach(cat => makeBtn(`CAT. ${cat}`, cat));

  renderContent();
}

// ── FIXTURE ──────────────────────────────────────────────
function renderMatchRows(list) {
  let html = '';
  list.forEach(m => {
    let scoreHtml;
    if (m.status === 'ok')           scoreHtml = `<div class="score-box">${m.score || m.resultado}</div>`;
    else if (m.status === 'pending') scoreHtml = `<div class="score-box pending">VS</div>`;
    else if (m.status === 'invalid') scoreHtml = `<div class="score-box invalid">—</div>`;
    else                             scoreHtml = `<div class="score-box missing">FALTA</div>`;

    const dim = (m.status === 'missing' || m.status === 'invalid') ? ' dim' : '';

    const badgeMap = {
      ok:      `<span class="badge ok">✓ Jugado</span>`,
      pending: `<span class="badge pending">⏳ Pendiente</span>`,
      missing: `<span class="badge missing">✗ Sin cargar</span>`,
      invalid: `<span class="badge invalid" title="${m.reason || ''}">⚠ Inválido</span>`,
    };

    const reasonHtml = m.status === 'invalid' && m.reason
      ? `<div class="invalid-reason">${m.reason}</div>`
      : '';

    html += `
      <div class="match-row status-${m.status}">
        <div class="match-local"><div class="team-name${dim}">${m.local}</div></div>
        <div class="match-center">${scoreHtml}</div>
        <div class="match-visitor">
          <div class="team-name${dim}">${m.visitante}</div>
          ${reasonHtml}
        </div>
        <div class="match-badge-col">${badgeMap[m.status]}</div>
      </div>`;
  });
  return html;
}

function renderFixtureSection(cat) {
  const matches = G.result[cat];
  if (!matches) return '';

  // Separar inválidos del resto
  const valid    = matches.filter(m => m.status !== 'invalid');
  const invalids = matches.filter(m => m.status === 'invalid');

  const okCount      = valid.filter(m => m.status === 'ok').length;
  const pendingCount = valid.filter(m => m.status === 'pending').length;
  const missingCount = valid.filter(m => m.status === 'missing').length;
  const invalidCount = invalids.length;
  const totalEquipos = (G.equipos[cat] || []).length;
  const inSheet      = valid.filter(m => m.status !== 'missing').length;

  let html = `
    <div class="cat-section">
      <div class="cat-card">
        <div class="cat-head">
          <div class="cat-head-left">
            <div class="cat-badge">CAT. ${cat}</div>
            <div class="cat-pill-count">⚽ ${totalEquipos} equipos · ${inSheet} en sheet</div>
          </div>
          <div class="cat-mini-stats">
            <div class="mini-stat ms-green"><div class="mini-dot g"></div>${okCount} jugados</div>
            <div class="mini-stat ms-amber"><div class="mini-dot a"></div>${pendingCount} pendientes</div>
            <div class="mini-stat ms-red"><div class="mini-dot r"></div>${missingCount} sin cargar</div>
            ${invalidCount ? `<div class="mini-stat ms-orange"><div class="mini-dot o"></div>${invalidCount} inválido${invalidCount > 1 ? 's' : ''}</div>` : ''}
          </div>
        </div>`;

  if (!valid.length && !invalids.length) {
    html += `<div class="all-ok"><span class="ok-icon">📋</span>Sin datos para esta categoría.</div>`;
  } else {

    // ── Vista unificada: TODOS los partidos (sheet + missing) por jornada ──
    const toShow = G.view === 'missing'
      ? valid.filter(m => m.status === 'missing')
      : valid;

    const byJ = {};
    toShow.forEach(m => {
      const jKey = String(m.jornada);
      if (!byJ[jKey]) byJ[jKey] = [];
      byJ[jKey].push(m);
    });

    Object.keys(byJ)
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
      .forEach(j => {
        const items      = byJ[j];
        const missingN   = items.filter(m => m.status === 'missing').length;
        const chip       = missingN
          ? `<span class="jornada-count jornada-count-red">${missingN} sin cargar</span>`
          : '';

        // Calcular quién descansa en esta jornada
        const playing = new Set(items.flatMap(m => [m.local, m.visitante]));
        // También contar equipos de partidos no mostrados (por filtro)
        const allInJ  = valid.filter(m => String(m.jornada) === j);
        const allPlaying = new Set(allInJ.flatMap(m => [m.local, m.visitante]));
        const resting = (G.equipos[cat] || []).filter(t => !allPlaying.has(t));
        const bye = resting.length === 1 ? resting[0] : null;

        // Si TODOS son missing en esta jornada, fondo azul
        const allMissing = items.every(m => m.status === 'missing');
        const headStyle  = allMissing ? ' style="background:#f8faff;border-color:#e0e7ff"' : '';
        const numStyle   = allMissing ? ' style="color:#4f46e5"' : '';

        // Detectar jornadas incompletas o extras
        const expectedPerJ = Math.floor(totalEquipos / 2);
        const totalJ = totalEquipos % 2 === 0 ? totalEquipos - 1 : totalEquipos;
        const isExtra = Number(j) > totalJ;
        const isIncomplete = items.length < expectedPerJ && allMissing;
        const warnChip = (isExtra || isIncomplete)
          ? `<span class="jornada-count" style="color:#b45309;background:#fef3c7;border-color:#fde68a" title="El fixture del sheet genera conflictos de horario que requieren jornadas adicionales">⚠ Jornada extra</span>`
          : '';

        html += `
          <div class="jornada-head"${headStyle}>
            <span class="jornada-num"${numStyle}>Jornada ${j}</span>
            <span class="jornada-count">${items.length} partido${items.length > 1 ? 's' : ''}</span>
            ${chip}
            ${warnChip}
            ${bye ? `<span class="jornada-bye">💤 Descansa: <strong>${bye}</strong></span>` : ''}
          </div>`;
        html += renderMatchRows(items);
      });

    // ── Inválidos al final ──
    if (invalids.length && G.view !== 'missing') {
      html += `
        <div class="jornada-head jornada-missing">
          <span class="jornada-num">⚠ Partidos Inválidos</span>
          <span class="jornada-count jornada-count-red">${invalids.length} no corresponden al sorteo</span>
        </div>`;
      html += renderMatchRows(invalids);
    }
  }

  return html + `</div></div>`;
}

// ── TABLA DE POSICIONES ───────────────────────────────────
function renderStandingsSection(cat) {
  const rows = G.standings[cat];
  if (!rows || !rows.length) return '';

  const totalJugados = rows.reduce((s, r) => Math.max(s, r.pj), 0);

  let html = `
    <div class="cat-section">
      <div class="cat-card">
        <div class="cat-head">
          <div class="cat-head-left">
            <div class="cat-badge">CAT. ${cat}</div>
            <div class="cat-pill-count">🏆 ${rows.length} equipos</div>
          </div>
          <div class="cat-mini-stats">
            <div class="mini-stat ms-green"><div class="mini-dot g"></div>${rows[0]?.pts ?? 0} pts líder</div>
          </div>
        </div>
        <div class="standings-table">
          <div class="st-header">
            <div class="st-col-pos">#</div>
            <div class="st-col-team">Equipo</div>
            <div class="st-col-num tt" title="Partidos Jugados">PJ</div>
            <div class="st-col-num tt" title="Ganados">G</div>
            <div class="st-col-num tt" title="Empatados">E</div>
            <div class="st-col-num tt" title="Perdidos">P</div>
            <div class="st-col-num tt" title="Goles a Favor">GF</div>
            <div class="st-col-num tt" title="Goles en Contra">GC</div>
            <div class="st-col-num tt" title="Diferencia de Goles">DG</div>
            <div class="st-col-pts">PTS</div>
          </div>`;

  rows.forEach((r, i) => {
    const posClass = i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : '';
    const dgStr = r.dg > 0 ? `+${r.dg}` : `${r.dg}`;
    const ptsBar = totalJugados > 0
      ? Math.round((r.pts / (totalJugados * 3)) * 100)
      : 0;

    html += `
      <div class="st-row ${i % 2 === 0 ? '' : 'st-row-alt'}">
        <div class="st-col-pos">
          <span class="pos-badge ${posClass}">${i + 1}</span>
        </div>
        <div class="st-col-team">
          <div class="team-name-st">${r.equipo}</div>
          <div class="pts-bar-wrap">
            <div class="pts-bar" style="width:${ptsBar}%"></div>
          </div>
        </div>
        <div class="st-col-num">${r.pj}</div>
        <div class="st-col-num st-g">${r.g}</div>
        <div class="st-col-num st-e">${r.e}</div>
        <div class="st-col-num st-p">${r.p}</div>
        <div class="st-col-num">${r.gf}</div>
        <div class="st-col-num">${r.gc}</div>
        <div class="st-col-num ${r.dg > 0 ? 'dg-pos' : r.dg < 0 ? 'dg-neg' : ''}">${dgStr}</div>
        <div class="st-col-pts"><strong>${r.pts}</strong></div>
      </div>`;
  });

  html += `</div></div></div>`;
  return html;
}

// ── RENDER CONTENIDO PRINCIPAL ────────────────────────────
function renderContent() {
  const cats = G.activeCat === 'all'
    ? Object.keys(G.equipos).sort()
    : [G.activeCat];

  let html = '';

  cats.forEach(cat => {
    if (G.mode === 'fixture') {
      html += renderFixtureSection(cat);
    } else {
      html += renderStandingsSection(cat);
    }
  });

  el('mainContent').innerHTML = html || `
    <div style="text-align:center;padding:40px;color:var(--gray-500);background:var(--white);
                border-radius:var(--radius);border:1px solid var(--gray-200);">
      Sin datos para mostrar.
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// CONTROLES
// ═══════════════════════════════════════════════════════════
function setActiveCat(cat) {
  G.activeCat = cat;
  document.querySelectorAll('.cat-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.cat === cat)
  );
  renderContent();
}

function setView(view) {
  G.view = view;
  el('btnAll').classList.toggle('active', view === 'all');
  el('btnMissing').classList.toggle('active', view === 'missing');
  renderContent();
}

function setMode(mode) {
  G.mode = mode;
  el('tabFixture').classList.toggle('tab-active', mode === 'fixture');
  el('tabStandings').classList.toggle('tab-active', mode === 'standings');
  // Mostrar/ocultar filtros de vista solo en modo fixture
  el('viewRow').style.display = mode === 'fixture' ? 'flex' : 'none';
  renderContent();
}

// ═══════════════════════════════════════════════════════════
// CARGA PRINCIPAL
// ═══════════════════════════════════════════════════════════
async function loadAll() {
  el('errorBox').classList.add('hidden');
  el('summaryGrid').classList.add('hidden');
  el('filterBar').classList.add('hidden');
  el('mainContent').innerHTML = '';
  el('lastUpdated').classList.add('hidden');

  el('loaderWrap').style.display = 'flex';
  el('loaderText').textContent = 'Conectando con Google Sheets…';

  try {
    el('loaderText').textContent = 'Cargando equipos por categoría…';
    const resEq = await fetch(URL_EQUIPOS);
    if (!resEq.ok) throw new Error(`No se pudo leer EQUIPOS (HTTP ${resEq.status}).`);
    G.equipos = parseEquipos(parseCsv(await resEq.text()));
    if (!Object.keys(G.equipos).length) {
      throw new Error('La pestaña EQUIPOS no tiene datos válidos.');
    }

    el('loaderText').textContent = 'Cargando fixture y resultados…';
    const resFix = await fetch(URL_FIXTURE);
    if (!resFix.ok) throw new Error(`No se pudo leer FIXTURE (HTTP ${resFix.status}).`);
    G.loaded = parseFixture(parseCsv(await resFix.text()));

    buildComparison();
    buildStandings();
    renderAll();

    const now = new Date();
    el('lastUpdated').textContent =
      `Última actualización: ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    el('lastUpdated').classList.remove('hidden');

  } catch (err) {
    el('errorTitle').textContent = 'Error al conectar con Google Sheets';
    el('errorMsg').textContent   = err.message;
    el('errorBox').classList.remove('hidden');
  } finally {
    el('loaderWrap').style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', loadAll);
