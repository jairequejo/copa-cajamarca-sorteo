// ============================================
// CONSTANTES GLOBALES
// ============================================
const EQUIPOS = {
  "2013": ["U CAJAMARCA","AAC RETOÑITOS","JR STARS","FC RIVER","ANCEL FC","DEPORTIVO ANCEL","COCO OLIVA","ALAN VILLATI"],
  "2014": ["U CAJAMARCA","AAC RETOÑITOS","JR STARS","COCO OLIVA"],
  "2015": ["U CAJAMARCA","AAC RETOÑITOS","JR STARS","COCO OLIVA"],
  "2016": ["U CAJAMARCA","AAC RETOÑITOS","JR STARS","EFB BARCELONA","COCO OLIVA","ALAN VILLATI"],
  "2017": ["U CAJAMARCA","AAC RETOÑITOS","JR STARS","SAINTHORE","PERFECT SOCCER","JOTITAS","COCO OLIVA","ALAN VILLATI"],
  "2018": ["U CAJAMARCA","AAC RETOÑITOS","JR STARS","ANCEL FC","OLYMPIC FC"],
  "2019": ["U CAJAMARCA","AAC RETOÑITOS","JR STARS","OLYMPIC FC","ANCEL FC"],
  "2020": ["U CAJAMARCA","AAC RETOÑITOS","JJ LOS LEONES"]
};

const COLORS = [
  ["#1a3a6b","#2a5aab"],["#b8860b","#f5c800"],["#1a6b3a","#00c060"],
  ["#6b1a1a","#c03030"],["#1a4a6b","#00a0e0"],["#6b1a6b","#c050c0"],
  ["#3a6b1a","#80c020"],["#6b4a1a","#e08020"],["#1a6b6b","#00c0c0"],["#4a1a6b","#9040d0"],
];

// ============================================
// CLASE: AudioEngine
// Motor de sonido usando Web Audio API (sin archivos externos)
// ============================================
class AudioEngine {
  constructor() {
    this._ctx = null;
  }

  get ctx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  }

  /** Desbloquea el contexto de audio (requerido por los navegadores en el primer gesto) */
  unlock() {
    return this.ctx;
  }

  /** Tick metálico al cruzar un segmento de la ruleta */
  playTick(pitch = 440, vol = 0.18) {
    const ac = this.ctx;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = 'triangle';
    o.frequency.setValueAtTime(pitch, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(pitch * 1.5, ac.currentTime + 0.02);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
    o.start(ac.currentTime);
    o.stop(ac.currentTime + 0.08);
  }

  /** Efecto whoosh al comenzar a girar */
  playWhoosh() {
    const ac = this.ctx;
    const buf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    src.buffer = buf;
    f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5;
    src.connect(f); f.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.6, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    src.start();
  }

  /** Fanfare ascendente al revelar al ganador */
  playWinner() {
    const ac = this.ctx;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = ac.currentTime + i * 0.13;
      // Nota principal (square)
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'square';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.28);
      // Armónico (sine)
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.connect(g2); g2.connect(ac.destination);
      o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 1.5, t);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.1, t + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o2.start(t); o2.stop(t + 0.22);
    });
  }

  /** Jingle de victoria cuando el sorteo está completo */
  playComplete() {
    const ac = this.ctx;
    const melody = [
      [523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36],
      [987.77, 0.5], [1046.5, 0.6], [1174.66, 0.72], [1318.51, 0.84]
    ];
    melody.forEach(([freq, delay]) => {
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    });
    // Golpe de batería
    const buf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.05));
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buf; src.connect(g); g.connect(ac.destination);
    g.gain.value = 0.5; src.start();
  }
}

// ============================================
// CLASE: ParticleSystem
// Sistema de confeti y partículas sobre canvas fijo
// ============================================
class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animId = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /** Lanza `count` partículas desde (x, y) */
  spawn(x, y, count = 80) {
    const colors = ['#f5c800','#00d068','#7ec8ff','#e03030','#ff8c00','#fff','#c050c0'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 8,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 12,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        shape: Math.random() < 0.5 ? 'rect' : 'circle'
      });
    }
    if (!this.animId) this._animate();
  }

  _animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.3; // gravedad
      p.vx *= 0.99;
      p.rot += p.rotV;
      p.life -= p.decay;
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle = p.color;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rot * Math.PI / 180);
      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });
    this.particles = this.particles.filter(p => p.life > 0);
    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this._animate());
    } else {
      this.animId = null;
    }
  }

  /** Explota confeti desde el centro de un elemento DOM */
  burstFromElement(elementId, count = 120) {
    const rect = document.getElementById(elementId).getBoundingClientRect();
    this.spawn(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
  }

  /** Explota confeti en múltiples puntos de la pantalla */
  burstFullScreen() {
    const { width: w, height: h } = this.canvas;
    this.spawn(w * 0.25, h * 0.3, 60);
    setTimeout(() => this.spawn(w * 0.75, h * 0.3, 60), 200);
    setTimeout(() => this.spawn(w * 0.5,  h * 0.2, 80), 400);
    setTimeout(() => this.spawn(w * 0.1,  h * 0.5, 50), 600);
    setTimeout(() => this.spawn(w * 0.9,  h * 0.5, 50), 800);
  }
}

// ============================================
// CLASE: Wheel
// Dibuja y anima la ruleta sobre un canvas
// ============================================
class Wheel {
  constructor(canvasId, colors) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.colors = colors;
    this.angle = 0;
  }

  /**
   * Dibuja la ruleta con los ítems activos.
   * @param {number[]} items  - nombres de equipos restantes
   * @param {number}   blur   - desenfoque en px para efecto de movimiento
   */
  draw(items, blur = 0) {
    const { ctx } = this;
    ctx.clearRect(0, 0, 240, 240);
    if (blur > 0.3) {
      ctx.filter = `blur(${blur.toFixed(1)}px)`;
    }
    if (!items.length) {
      ctx.fillStyle = 'rgba(245,200,0,0.08)';
      ctx.beginPath(); ctx.arc(120, 120, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5c800'; ctx.font = 'bold 15px Barlow Condensed';
      ctx.textAlign = 'center';
      ctx.fillText('SORTEO', 120, 115); ctx.fillText('COMPLETO', 120, 135);
      return;
    }
    const n = items.length, arc = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const s = this.angle + i * arc, e = s + arc;
      const [c1, c2] = this.colors[i % this.colors.length];
      const grd = ctx.createRadialGradient(120, 120, 0, 120, 120, 120);
      grd.addColorStop(0, c1); grd.addColorStop(1, c2);
      ctx.beginPath(); ctx.moveTo(120, 120); ctx.arc(120, 120, 118, s, e); ctx.closePath();
      ctx.fillStyle = grd; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.translate(120, 120); ctx.rotate(s + arc / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      const fontSize = n <= 4 ? 17 : n <= 6 ? 15 : n <= 8 ? 13 : 11;
      ctx.font = `bold ${fontSize}px Barlow Condensed`;
      ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
      const maxChars = n <= 4 ? 18 : n <= 6 ? 15 : 12;
      const lbl = items[i].length > maxChars ? items[i].slice(0, maxChars - 1) + '…' : items[i];
      ctx.fillText(lbl, 112, 5);
      ctx.restore();
    }
    ctx.filter = 'none';
  }

  /**
   * Anima el giro de la ruleta.
   * @param {object}   options
   * @param {number}   options.n          - número de segmentos
   * @param {string[]} options.items      - ítems actuales (para redibujar cada frame)
   * @param {Function} options.onTick     - callback(segment, progress) al cruzar segmento
   * @param {Function} options.onComplete - callback(total, a0, n, arc) al terminar
   */
  spin({ n, items, onTick, onComplete }) {
    const arc   = (Math.PI * 2) / n;
    const total = (Math.PI * 2) * 9 + Math.random() * (Math.PI * 2); // más rotaciones
    const t0 = performance.now(), dur = 4200, a0 = this.angle;
    let lastSeg = -1;

    // easeOutQuart: arranca muy rápido, frena de forma suave y natural
    const ease  = t => 1 - Math.pow(1 - t, 4);
    // velocidad normalizada en t: derivada de easeOutQuart = 4*(1-t)^3
    const speed = t => 4 * Math.pow(1 - t, 3);

    const anim = now => {
      const p  = Math.min((now - t0) / dur, 1);
      this.angle = a0 + total * ease(p);

      // Blur proporcional a la velocidad angular (máx ~3 px al inicio)
      const blurPx = speed(p) * 0.9;
      this.draw(items, blurPx);

      const seg = Math.floor(((this.angle % (Math.PI * 2)) / (Math.PI * 2)) * n);
      if (seg !== lastSeg) { lastSeg = seg; onTick(seg, p); }

      if (p < 1) {
        requestAnimationFrame(anim);
      } else {
        this.draw(items, 0); // frame final sin blur
        onComplete(total, a0, n, arc);
      }
    };
    requestAnimationFrame(anim);
  }
}

// ============================================
// CLASE: SorteoApp
// Orquesta el sorteo: categorías, posiciones, fixture y UI
// ============================================
class SorteoApp {
  constructor(audio, particles) {
    this.audio = audio;
    this.particles = particles;
    this.wheel = new Wheel('wCanvas', COLORS);

    // Estado del sorteo por categoría
    this.state = {};
    Object.keys(EQUIPOS).forEach(cat => {
      this.state[cat] = { drawn: [], remaining: [...EQUIPOS[cat]], spinning: false };
    });

    this.currentCat = '2013';
    this.currentMatches = [];
    this.currentByes = {};
  }

  // ---------------------------
  // UI HELPERS
  // ---------------------------

  _el(id) { return document.getElementById(id); }

  updateCatLabel() {
    const el = this._el('catLabel');
    if (el) el.textContent = `— CAT. ${this.currentCat}`;
  }

  // ---------------------------
  // CATEGORÍAS
  // ---------------------------

  selectCat(cat) {
    this.currentCat = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    const s = this.state[cat];
    this._el('spinBtn').disabled = !s.remaining.length;
    this._el('completeBanner').style.display = s.remaining.length ? 'none' : 'block';
    this._el('resultBox').innerHTML = `<div class="res-label">Selecciona y gira</div>`;
    this.wheel.angle = 0;
    this.updateCatLabel();
    this.renderPos();
    this.wheel.draw(s.remaining);
    if (!s.remaining.length) {
      this.buildFixture();
    } else {
      this._el('fixtureContent').innerHTML = '<div class="no-fixture">Completa el sorteo para ver el fixture.</div>';
      this._el('fixtureControls').style.display = 'none';
    }
  }

  resetDraw() {
    this.state[this.currentCat] = { drawn: [], remaining: [...EQUIPOS[this.currentCat]], spinning: false };
    this._el('completeBanner').style.display = 'none';
    this._el('spinBtn').disabled = false;
    this._el('resultBox').innerHTML = `<div class="res-label">Sorteo reiniciado</div>`;
    this._el('fixtureContent').innerHTML = '<div class="no-fixture">Completa el sorteo para ver el fixture.</div>';
    this._el('fixtureControls').style.display = 'none';
    this._el('sfSection').style.display = 'none';
    this.currentMatches = [];
    this.wheel.angle = 0;
    this.renderPos();
    this.wheel.draw(this.state[this.currentCat].remaining);
  }

  // ---------------------------
  // RULETA
  // ---------------------------

  spinWheel() {
    const s = this.state[this.currentCat];
    if (s.spinning || !s.remaining.length) return;

    this.audio.unlock();
    this.audio.playWhoosh();
    s.spinning = true;

    const btn = this._el('spinBtn');
    btn.disabled = true;
    btn.textContent = '⏳ GIRANDO...';
    this.wheel.canvas.classList.add('spinning');

    this.wheel.spin({
      n: s.remaining.length,
      items: s.remaining,
      onTick: (seg, p) => {
        // Solo gestiona el sonido — el draw lo hace Wheel.spin() cada frame
        const pitchFactor = p < 0.5 ? 0.7 + p * 1.6 : 1.5 - p * 0.9;
        this.audio.playTick(300 + pitchFactor * 350, 0.12 + p * 0.06);
      },
      onComplete: (total, a0, n, arc) => {
        this.wheel.canvas.classList.remove('spinning');
        btn.textContent = '🎯 GIRAR RULETA';
        this._finalize(total, a0, n, arc);
      }
    });
  }

  _finalize(total, a0, n, arc) {
    const s = this.state[this.currentCat];
    const finalAngle = (a0 + total) % (Math.PI * 2);
    const ptr = (Math.PI * 1.5 - finalAngle + Math.PI * 100) % (Math.PI * 2);
    const idx = Math.floor(ptr / arc) % n;
    const winner = s.remaining[idx];

    s.drawn.push(winner);
    s.remaining.splice(idx, 1);
    s.spinning = false;
    const pos = s.drawn.length;

    this.audio.playWinner();
    this.particles.burstFromElement('wCanvas', 120);

    this._el('resultBox').innerHTML = `
      <div class="res-label">🎉 Posición ${pos}</div>
      <div class="res-pos pop">${pos}°</div>
      <div class="res-team">${winner}</div>`;

    this.wheel.draw(s.remaining);
    this.renderPos();

    // Flash de la tarjeta ganadora
    setTimeout(() => {
      const cards = document.querySelectorAll('.pos-card.filled');
      if (cards.length) {
        const last = cards[cards.length - 1];
        last.classList.add('winner-flash');
        setTimeout(() => last.classList.remove('winner-flash'), 900);
      }
    }, 300);

    this._el('spinBtn').disabled = !s.remaining.length;

    if (!s.remaining.length) {
      setTimeout(() => {
        this.audio.playComplete();
        this.particles.burstFullScreen();
        this._el('completeBanner').style.display = 'block';
        this._el('completeBanner').classList.add('shake');
      }, 600);
      this.buildFixture();
    }
  }

  // ---------------------------
  // POSICIONES
  // ---------------------------

  renderPos() {
    const s = this.state[this.currentCat];
    const total = EQUIPOS[this.currentCat].length;
    const grid = this._el('posGrid');
    grid.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const team = s.drawn[i];
      const div = document.createElement('div');
      div.className = 'pos-card' + (team ? ' filled' : '');
      div.innerHTML = `
        <div class="pos-num ${team ? 'filled' : ''}">${i + 1}°</div>
        <div>
          ${team
            ? `<div class="pos-name">${team}</div>`
            : `<div class="pos-empty-hint">— pendiente —</div>`}
        </div>
        ${team ? `<span class="pos-badge-lbl">POS. ${i + 1}</span>` : ''}`;
      grid.appendChild(div);
    }
    this.renderSemifinal();
  }

  // ---------------------------
  // SEMIFINALES / FINAL
  // ---------------------------

  renderSemifinal() {
    const s = this.state[this.currentCat];
    const total = EQUIPOS[this.currentCat].length;
    const sfSec = this._el('sfSection');
    const sfBox = this._el('sfBox');
    const sfTitle = this._el('sfTitle');

    if (s.remaining.length > 0 || total > 4) { sfSec.style.display = 'none'; return; }

    sfSec.style.display = 'block';
    const d = s.drawn;

    if (total === 2) {
      sfTitle.textContent = 'FINAL DIRECTA';
      sfBox.innerHTML = `
        <div class="final-tag">🏆 FINAL</div>
        <div class="sf-match">
          <span class="sf-pos c1">1°</span>
          <span class="sf-team">${d[0] || '—'}</span>
          <span class="sf-vs">VS</span>
          <span class="sf-team">${d[1] || '—'}</span>
          <span class="sf-pos c2">2°</span>
        </div>`;
      return;
    }

    if (total === 3) {
      sfTitle.textContent = 'SEMIFINALES';
      sfBox.innerHTML = `
        <div class="sf-match">
          <span class="sf-pos c1">1°</span><span class="sf-team">${d[0] || '—'}</span>
          <span class="sf-vs">VS</span>
          <span class="sf-team">${d[2] || '—'}</span><span class="sf-pos c3">3°</span>
        </div>
        <div class="sf-match">
          <span class="sf-pos c2">2°</span><span class="sf-team">${d[1] || '—'}</span>
          <span class="sf-vs">VS</span>
          <span class="sf-team descanso-tag">DESCANSA</span>
          <span class="sf-note">Pasa directo a Final</span>
        </div>`;
      return;
    }

    if (total === 4) {
      sfTitle.textContent = 'SEMIFINALES';
      sfBox.innerHTML = `
        <div class="sf-match">
          <span class="sf-pos c1">1°</span><span class="sf-team">${d[0] || '—'}</span>
          <span class="sf-vs">VS</span>
          <span class="sf-team">${d[3] || '—'}</span><span class="sf-pos c4">4°</span>
        </div>
        <div class="sf-match">
          <span class="sf-pos c2">2°</span><span class="sf-team">${d[1] || '—'}</span>
          <span class="sf-vs">VS</span>
          <span class="sf-team">${d[2] || '—'}</span><span class="sf-pos c3">3°</span>
        </div>`;
      return;
    }

    sfSec.style.display = 'none';
  }

  // ---------------------------
  // FIXTURE — round-robin
  // ---------------------------

  buildFixture() {
    const teams = [...this.state[this.currentCat].drawn];
    const matches = [];
    const byes = {};
    const list = [...teams];
    if (list.length % 2 !== 0) list.push('LIBRE');
    const tot = list.length, rounds = tot - 1;
    let half = [...list];

    for (let r = 0; r < rounds; r++) {
      const top = half.slice(0, tot / 2);
      const bot = half.slice(tot / 2).reverse();
      for (let i = 0; i < tot / 2; i++) {
        if (top[i] === 'LIBRE')      { byes[r + 1] = bot[i]; }
        else if (bot[i] === 'LIBRE') { byes[r + 1] = top[i]; }
        else {
          matches.push({
            jornada: r + 1,
            local: top[i],       visitante: bot[i],
            localPos: teams.indexOf(top[i]) + 1,
            visitantePos: teams.indexOf(bot[i]) + 1
          });
        }
      }
      const fixed = half[0], rest = half.slice(1);
      rest.unshift(rest.pop());
      half = [fixed, ...rest];
    }

    this.currentMatches = matches;
    this.currentByes = byes;

    const sel = this._el('filterJornada');
    sel.innerHTML = '<option value="">Todas las jornadas</option>';
    const jornadas = [...new Set(matches.map(m => m.jornada))].sort((a, b) => a - b);
    jornadas.forEach(j => {
      const o = document.createElement('option');
      o.value = j; o.textContent = `Jornada ${j}`;
      sel.appendChild(o);
    });

    const totalByes = Object.keys(byes).length;
    const byeNote = totalByes > 0 ? ` · ${totalByes} descanso${totalByes > 1 ? 's' : ''}` : '';
    this._el('fixturePanelHdr').textContent =
      `📅 FIXTURE — CAT ${this.currentCat} (${jornadas.length} jornadas · ${matches.length} partidos${byeNote})`;
    this._el('fixtureControls').style.display = 'flex';
    this.renderFixture();
  }

  renderFixture() {
    const filterJ = this._el('filterJornada').value;
    const search = this._el('searchEquipo').value.toLowerCase().trim();
    let filtered = this.currentMatches;
    if (filterJ) filtered = filtered.filter(m => String(m.jornada) === filterJ);
    if (search) filtered = filtered.filter(m =>
      m.local.toLowerCase().includes(search) || m.visitante.toLowerCase().includes(search));

    if (!filtered.length) {
      this._el('fixtureContent').innerHTML = '<div class="no-fixture">Sin partidos con ese filtro.</div>';
      return;
    }

    const byJ = {};
    filtered.forEach(m => {
      if (!byJ[m.jornada]) byJ[m.jornada] = [];
      byJ[m.jornada].push(m);
    });

    let html = '';
    Object.keys(byJ).sort((a, b) => a - b).forEach(j => {
      const byeTeam = this.currentByes[j];
      const byePos = byeTeam ? this.state[this.currentCat].drawn.indexOf(byeTeam) + 1 : null;
      html += `<div class="jornada-block">
        <div class="jornada-label">JORNADA ${j}
          <span style="color:var(--gris);font-size:0.8rem;letter-spacing:1px;">(${byJ[j].length} partido${byJ[j].length > 1 ? 's' : ''})</span>
        </div>`;
      byJ[j].forEach(m => {
        html += `<div class="match-row">
          <div class="match-local">
            <span>${m.local}</span>
            <span class="match-pos">Pos. ${m.localPos}</span>
          </div>
          <div class="match-vs">VS</div>
          <div class="match-visitor">
            <span>${m.visitante}</span>
            <span class="match-pos">Pos. ${m.visitantePos}</span>
          </div>
        </div>`;
      });
      if (byeTeam) {
        html += `<div class="bye-row">
          <span class="bye-icon">📢</span>
          <span><strong>${byeTeam}</strong>${byePos > 0 ? ` <span style="font-size:0.72rem;opacity:.7">(Pos. ${byePos})</span>` : ''} &mdash; Descansa esta jornada</span>
          <span class="bye-label">Libre</span>
        </div>`;
      }
      html += '</div>';
    });
    this._el('fixtureContent').innerHTML = html;
  }

  // ---------------------------
  // INIT
  // ---------------------------

  init() {
    const grid = this._el('catGrid');
    Object.keys(EQUIPOS).forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (cat === this.currentCat ? ' active' : '');
      btn.dataset.cat = cat;
      btn.textContent = cat;
      btn.onclick = () => this.selectCat(cat);
      grid.appendChild(btn);
    });
    this.updateCatLabel();
    this.renderPos();
    this.wheel.draw(this.state[this.currentCat].remaining);
  }
}

// ============================================
// BOOTSTRAP — instancias globales
// ============================================
const audio     = new AudioEngine();
const particles = new ParticleSystem('particleCanvas');
const app       = new SorteoApp(audio, particles);
app.init();

// Wrappers globales para los onclick del HTML
function spinWheel()    { app.spinWheel(); }
function resetDraw()    { app.resetDraw(); }
function renderFixture(){ app.renderFixture(); }
