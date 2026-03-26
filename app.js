// ============================================
// DATA
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

let state = {};
Object.keys(EQUIPOS).forEach(c => { state[c] = { drawn:[], remaining:[...EQUIPOS[c]], spinning:false }; });

let currentCat = "2013";
let currentMatches = [];

const COLORS = [
  ["#1a3a6b","#2a5aab"],["#b8860b","#f5c800"],["#1a6b3a","#00c060"],
  ["#6b1a1a","#c03030"],["#1a4a6b","#00a0e0"],["#6b1a6b","#c050c0"],
  ["#3a6b1a","#80c020"],["#6b4a1a","#e08020"],["#1a6b6b","#00c0c0"],["#4a1a6b","#9040d0"],
];

// ============================================
// AUDIO ENGINE (Web Audio API — sin archivos externos)
// ============================================
let audioCtx = null;
function getAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}

function playTick(pitch=440, vol=0.18){
  const ac=getAudio();
  const o=ac.createOscillator();
  const g=ac.createGain();
  o.connect(g); g.connect(ac.destination);
  o.type='triangle';
  o.frequency.setValueAtTime(pitch,ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(pitch*1.5,ac.currentTime+0.02);
  g.gain.setValueAtTime(vol,ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.07);
  o.start(ac.currentTime);
  o.stop(ac.currentTime+0.08);
}

function playWhoosh(){
  const ac=getAudio();
  const buf=ac.createBuffer(1,ac.sampleRate*0.4,ac.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
  const src=ac.createBufferSource();
  const g=ac.createGain();
  const f=ac.createBiquadFilter();
  src.buffer=buf;
  f.type='bandpass'; f.frequency.value=800; f.Q.value=0.5;
  src.connect(f); f.connect(g); g.connect(ac.destination);
  g.gain.setValueAtTime(0.6,ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
  src.start();
}

function playWinner(){
  const ac=getAudio();
  const notes=[523.25,659.25,783.99,1046.5];
  notes.forEach((freq,i)=>{
    const t=ac.currentTime+i*0.13;
    const o=ac.createOscillator();
    const g=ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type='square';
    o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.22,t+0.04);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    o.start(t); o.stop(t+0.28);
    const o2=ac.createOscillator();
    const g2=ac.createGain();
    o2.connect(g2); g2.connect(ac.destination);
    o2.type='sine'; o2.frequency.setValueAtTime(freq*1.5,t);
    g2.gain.setValueAtTime(0,t);
    g2.gain.linearRampToValueAtTime(0.1,t+0.04);
    g2.gain.exponentialRampToValueAtTime(0.001,t+0.2);
    o2.start(t); o2.stop(t+0.22);
  });
}

function playComplete(){
  const ac=getAudio();
  const melody=[
    [523.25,0],[659.25,0.12],[783.99,0.24],[1046.5,0.36],
    [987.77,0.5],[1046.5,0.6],[1174.66,0.72],[1318.51,0.84]
  ];
  melody.forEach(([freq,delay])=>{
    const t=ac.currentTime+delay;
    const o=ac.createOscillator();
    const g=ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type='sine';
    o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.28,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
    o.start(t); o.stop(t+0.32);
  });
  const buf=ac.createBuffer(1,ac.sampleRate*0.3,ac.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(ac.sampleRate*0.05));
  const src=ac.createBufferSource();
  const g=ac.createGain();
  src.buffer=buf; src.connect(g); g.connect(ac.destination);
  g.gain.value=0.5; src.start();
}

// ============================================
// PARTICLES
// ============================================
const pCanvas=document.getElementById('particleCanvas');
const pCtx=pCanvas.getContext('2d');
let particles=[];
let pAnimId=null;

function resizePC(){
  pCanvas.width=window.innerWidth;
  pCanvas.height=window.innerHeight;
}
resizePC();
window.addEventListener('resize',resizePC);

function spawnConfetti(x,y,count=80){
  const colors=['#f5c800','#00d068','#7ec8ff','#e03030','#ff8c00','#fff','#c050c0'];
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2;
    const speed=4+Math.random()*8;
    particles.push({
      x,y,
      vx:Math.cos(angle)*speed,
      vy:Math.sin(angle)*speed-6,
      color:colors[Math.floor(Math.random()*colors.length)],
      size:4+Math.random()*8,
      rot:Math.random()*360,
      rotV:(Math.random()-0.5)*12,
      life:1,
      decay:0.012+Math.random()*0.018,
      shape:Math.random()<0.5?'rect':'circle'
    });
  }
  if(!pAnimId) animParticles();
}

function animParticles(){
  pCtx.clearRect(0,0,pCanvas.width,pCanvas.height);
  particles.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy;
    p.vy+=0.3;
    p.vx*=0.99;
    p.rot+=p.rotV;
    p.life-=p.decay;
    pCtx.save();
    pCtx.globalAlpha=Math.max(0,p.life);
    pCtx.fillStyle=p.color;
    pCtx.translate(p.x,p.y);
    pCtx.rotate(p.rot*Math.PI/180);
    if(p.shape==='rect'){
      pCtx.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);
    } else {
      pCtx.beginPath();
      pCtx.arc(0,0,p.size/2,0,Math.PI*2);
      pCtx.fill();
    }
    pCtx.restore();
  });
  particles=particles.filter(p=>p.life>0);
  if(particles.length>0){
    pAnimId=requestAnimationFrame(animParticles);
  } else {
    pAnimId=null;
  }
}

function burstConfettiFromWheel(){
  const rect=document.getElementById('wCanvas').getBoundingClientRect();
  const cx=rect.left+rect.width/2;
  const cy=rect.top+rect.height/2;
  spawnConfetti(cx,cy,120);
}

function burstConfettiFullScreen(){
  const w=pCanvas.width, h=pCanvas.height;
  spawnConfetti(w*0.25,h*0.3,60);
  setTimeout(()=>spawnConfetti(w*0.75,h*0.3,60),200);
  setTimeout(()=>spawnConfetti(w*0.5,h*0.2,80),400);
  setTimeout(()=>spawnConfetti(w*0.1,h*0.5,50),600);
  setTimeout(()=>spawnConfetti(w*0.9,h*0.5,50),800);
}

// ============================================
// WHEEL
// ============================================
const canvas = document.getElementById('wCanvas');
const ctx = canvas.getContext('2d');
let angle = 0;

function drawWheel(a) {
  const items = state[currentCat].remaining;
  ctx.clearRect(0,0,240,240);
  if (!items.length) {
    ctx.fillStyle='rgba(245,200,0,0.08)';
    ctx.beginPath();ctx.arc(120,120,120,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f5c800';ctx.font='bold 15px Barlow Condensed';
    ctx.textAlign='center';ctx.fillText('SORTEO',120,115);ctx.fillText('COMPLETO',120,135);
    return;
  }
  const n=items.length, arc=(Math.PI*2)/n;
  for(let i=0;i<n;i++){
    const s=a+i*arc, e=s+arc;
    const [c1,c2]=COLORS[i%COLORS.length];
    const grd=ctx.createRadialGradient(120,120,0,120,120,120);
    grd.addColorStop(0,c1);grd.addColorStop(1,c2);
    ctx.beginPath();ctx.moveTo(120,120);ctx.arc(120,120,118,s,e);ctx.closePath();
    ctx.fillStyle=grd;ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.save();ctx.translate(120,120);ctx.rotate(s+arc/2);
    ctx.textAlign='right';ctx.fillStyle='#fff';
    const fontSize = n <= 4 ? 17 : n <= 6 ? 15 : n <= 8 ? 13 : 11;
    ctx.font=`bold ${fontSize}px Barlow Condensed`;
    ctx.shadowColor='rgba(0,0,0,0.95)';ctx.shadowBlur=6;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
    const maxChars = n <= 4 ? 18 : n <= 6 ? 15 : 12;
    const lbl = items[i].length > maxChars ? items[i].slice(0, maxChars-1)+'…' : items[i];
    ctx.fillText(lbl, 112, 5);
    ctx.restore();
  }
}

let lastTickAngle=0;
let tickInterval=null;

function spinWheel(){
  const s=state[currentCat];
  if(s.spinning||!s.remaining.length)return;
  getAudio();
  playWhoosh();
  s.spinning=true;
  document.getElementById('spinBtn').disabled=true;
  document.getElementById('spinBtn').textContent='⏳ GIRANDO...';
  canvas.classList.add('spinning');
  const n=s.remaining.length, arc=(Math.PI*2)/n;
  const total=(Math.PI*2)*7+Math.random()*(Math.PI*2);
  const t0=performance.now(), dur=3800, a0=angle;
  let lastTickSegment=-1;

  function ease(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function anim(now){
    const p=Math.min((now-t0)/dur,1);
    const easedP=ease(p);
    angle=a0+total*easedP;
    drawWheel(angle);
    const segment=Math.floor(((angle%(Math.PI*2))/(Math.PI*2))*n);
    if(segment!==lastTickSegment){
      lastTickSegment=segment;
      const pitchFactor = p < 0.5 ? 0.7+p*1.6 : 1.5-p*0.9;
      playTick(300+pitchFactor*350, 0.12+p*0.06);
    }
    if(p<1){requestAnimationFrame(anim);}
    else{
      canvas.classList.remove('spinning');
      document.getElementById('spinBtn').textContent='🎯 GIRAR RULETA';
      finalize(total,a0,n,arc);
    }
  }
  requestAnimationFrame(anim);
}

function finalize(total,a0,n,arc){
  const s=state[currentCat];
  const final=(a0+total)%(Math.PI*2);
  const ptr=(Math.PI*1.5-final+Math.PI*100)%(Math.PI*2);
  const idx=Math.floor(ptr/arc)%n;
  const winner=s.remaining[idx];
  s.drawn.push(winner);
  s.remaining.splice(idx,1);
  s.spinning=false;
  const pos=s.drawn.length;

  playWinner();
  burstConfettiFromWheel();

  document.getElementById('resultBox').innerHTML=`
    <div class="res-label">🎉 Posición ${pos}</div>
    <div class="res-pos pop">${pos}°</div>
    <div class="res-team">${winner}</div>`;

  drawWheel(angle);
  renderPos();

  setTimeout(()=>{
    const cards=document.querySelectorAll('.pos-card.filled');
    if(cards.length){
      const last=cards[cards.length-1];
      last.classList.add('winner-flash');
      setTimeout(()=>last.classList.remove('winner-flash'),900);
    }
  },300);

  document.getElementById('spinBtn').disabled=!s.remaining.length;
  if(!s.remaining.length){
    setTimeout(()=>{
      playComplete();
      burstConfettiFullScreen();
      document.getElementById('completeBanner').style.display='block';
      document.getElementById('completeBanner').classList.add('shake');
    },600);
    buildFixture();
  }
}

// ============================================
// CATEGORIES
// ============================================
function updateCatLabel(){
  const el=document.getElementById('catLabel');
  if(el) el.textContent=`— CAT. ${currentCat}`;
}

function selectCat(cat){
  currentCat=cat;
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  const s=state[cat];
  document.getElementById('spinBtn').disabled=!s.remaining.length;
  document.getElementById('completeBanner').style.display=s.remaining.length?'none':'block';
  document.getElementById('resultBox').innerHTML=`<div class="res-label">Selecciona y gira</div>`;
  angle=0;
  updateCatLabel();
  renderPos();
  drawWheel(0);
  if(!s.remaining.length) buildFixture();
  else{
    document.getElementById('fixtureContent').innerHTML='<div class="no-fixture">Completa el sorteo para ver el fixture.</div>';
    document.getElementById('fixtureControls').style.display='none';
  }
}

function resetDraw(){
  state[currentCat]={drawn:[],remaining:[...EQUIPOS[currentCat]],spinning:false};
  document.getElementById('completeBanner').style.display='none';
  document.getElementById('spinBtn').disabled=false;
  document.getElementById('resultBox').innerHTML=`<div class="res-label">Sorteo reiniciado</div>`;
  document.getElementById('fixtureContent').innerHTML='<div class="no-fixture">Completa el sorteo para ver el fixture.</div>';
  document.getElementById('fixtureControls').style.display='none';
  document.getElementById('sfSection').style.display='none';
  currentMatches=[];
  angle=0;
  renderPos();
  drawWheel(0);
}

// ============================================
// POSICIONES
// ============================================
function renderPos(){
  const s=state[currentCat];
  const total=EQUIPOS[currentCat].length;
  const grid=document.getElementById('posGrid');
  grid.innerHTML='';
  for(let i=0;i<total;i++){
    const team=s.drawn[i];
    const div=document.createElement('div');
    div.className='pos-card'+(team?' filled':'');
    div.innerHTML=`
      <div class="pos-num ${team?'filled':''}">${i+1}°</div>
      <div>
        ${team
          ?`<div class="pos-name">${team}</div>`
          :`<div class="pos-empty-hint">— pendiente —</div>`}
      </div>
      ${team?`<span class="pos-badge-lbl">POS. ${i+1}</span>`:''}`;
    grid.appendChild(div);
  }
  renderSemifinal();
}

// ============================================
// SEMIFINALES / FINAL
// ============================================
function renderSemifinal(){
  const s=state[currentCat];
  const total=EQUIPOS[currentCat].length;
  const sfSec=document.getElementById('sfSection');
  const sfBox=document.getElementById('sfBox');
  const sfTitle=document.getElementById('sfTitle');

  if(s.remaining.length>0||total>4){sfSec.style.display='none';return;}

  sfSec.style.display='block';
  const d=s.drawn;

  if(total===2){
    sfTitle.textContent='FINAL DIRECTA';
    sfBox.innerHTML=`
      <div class="final-tag">🏆 FINAL</div>
      <div class="sf-match">
        <span class="sf-pos c1">1°</span>
        <span class="sf-team">${d[0]||'—'}</span>
        <span class="sf-vs">VS</span>
        <span class="sf-team">${d[1]||'—'}</span>
        <span class="sf-pos c2">2°</span>
      </div>`;
    return;
  }

  if(total===3){
    sfTitle.textContent='SEMIFINALES';
    sfBox.innerHTML=`
      <div class="sf-match">
        <span class="sf-pos c1">1°</span>
        <span class="sf-team">${d[0]||'—'}</span>
        <span class="sf-vs">VS</span>
        <span class="sf-team">${d[2]||'—'}</span>
        <span class="sf-pos c3">3°</span>
      </div>
      <div class="sf-match">
        <span class="sf-pos c2">2°</span>
        <span class="sf-team">${d[1]||'—'}</span>
        <span class="sf-vs">VS</span>
        <span class="sf-team descanso-tag">DESCANSA</span>
        <span class="sf-note">Pasa directo a Final</span>
      </div>`;
    return;
  }

  if(total===4){
    sfTitle.textContent='SEMIFINALES';
    sfBox.innerHTML=`
      <div class="sf-match">
        <span class="sf-pos c1">1°</span>
        <span class="sf-team">${d[0]||'—'}</span>
        <span class="sf-vs">VS</span>
        <span class="sf-team">${d[3]||'—'}</span>
        <span class="sf-pos c4">4°</span>
      </div>
      <div class="sf-match">
        <span class="sf-pos c2">2°</span>
        <span class="sf-team">${d[1]||'—'}</span>
        <span class="sf-vs">VS</span>
        <span class="sf-team">${d[2]||'—'}</span>
        <span class="sf-pos c3">3°</span>
      </div>`;
    return;
  }

  sfSec.style.display='none';
}

// ============================================
// FIXTURE — round-robin
// ============================================
let currentByes = {};

function buildFixture(){
  const teams=[...state[currentCat].drawn];
  const matches=[];
  const byes={};
  const list=[...teams];
  if(list.length%2!==0) list.push('LIBRE');
  const tot=list.length, rounds=tot-1;
  let half=[...list];
  for(let r=0;r<rounds;r++){
    const top=half.slice(0,tot/2);
    const bot=half.slice(tot/2).reverse();
    for(let i=0;i<tot/2;i++){
      if(top[i]==='LIBRE'){ byes[r+1]=bot[i]; }
      else if(bot[i]==='LIBRE'){ byes[r+1]=top[i]; }
      else{
        matches.push({
          jornada:r+1,
          local:top[i],
          visitante:bot[i],
          localPos:teams.indexOf(top[i])+1,
          visitantePos:teams.indexOf(bot[i])+1
        });
      }
    }
    const fixed=half[0],rest=half.slice(1);
    rest.unshift(rest.pop());
    half=[fixed,...rest];
  }
  currentMatches=matches;
  currentByes=byes;

  const sel=document.getElementById('filterJornada');
  sel.innerHTML='<option value="">Todas las jornadas</option>';
  const jornadas=[...new Set(matches.map(m=>m.jornada))].sort((a,b)=>a-b);
  jornadas.forEach(j=>{
    const o=document.createElement('option');
    o.value=j;o.textContent=`Jornada ${j}`;
    sel.appendChild(o);
  });

  const totalByes=Object.keys(byes).length;
  const byeNote = totalByes>0 ? ` · ${totalByes} descanso${totalByes>1?'s':''}` : '';
  document.getElementById('fixturePanelHdr').textContent=`📅 FIXTURE — CAT ${currentCat} (${jornadas.length} jornadas · ${matches.length} partidos${byeNote})`;
  document.getElementById('fixtureControls').style.display='flex';
  renderFixture();
}

function renderFixture(){
  const filterJ=document.getElementById('filterJornada').value;
  const search=document.getElementById('searchEquipo').value.toLowerCase().trim();
  let filtered=currentMatches;
  if(filterJ) filtered=filtered.filter(m=>String(m.jornada)===filterJ);
  if(search) filtered=filtered.filter(m=>m.local.toLowerCase().includes(search)||m.visitante.toLowerCase().includes(search));

  if(!filtered.length){
    document.getElementById('fixtureContent').innerHTML='<div class="no-fixture">Sin partidos con ese filtro.</div>';
    return;
  }

  const byJ={};
  filtered.forEach(m=>{
    if(!byJ[m.jornada])byJ[m.jornada]=[];
    byJ[m.jornada].push(m);
  });

  let html='';
  Object.keys(byJ).sort((a,b)=>a-b).forEach(j=>{
    const byeTeam=currentByes[j];
    const byeTeamPos = byeTeam ? state[currentCat].drawn.indexOf(byeTeam)+1 : null;
    html+=`<div class="jornada-block"><div class="jornada-label">JORNADA ${j} <span style="color:var(--gris);font-size:0.8rem;letter-spacing:1px;">(${byJ[j].length} partido${byJ[j].length>1?'s':''})</span></div>`;
    byJ[j].forEach(m=>{
      html+=`<div class="match-row">
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
    if(byeTeam){
      html+=`<div class="bye-row">
        <span class="bye-icon">📢</span>
        <span><strong>${byeTeam}</strong>${byeTeamPos>0?` <span style="font-size:0.72rem;opacity:.7">(Pos. ${byeTeamPos})</span>`:''} &mdash; Descansa esta jornada</span>
        <span class="bye-label">Libre</span>
      </div>`;
    }
    html+='</div>';
  });
  document.getElementById('fixtureContent').innerHTML=html;
}

// ============================================
// INIT
// ============================================
function init(){
  const g=document.getElementById('catGrid');
  Object.keys(EQUIPOS).forEach(cat=>{
    const b=document.createElement('button');
    b.className='cat-btn'+(cat===currentCat?' active':'');
    b.dataset.cat=cat; b.textContent=cat;
    b.onclick=()=>selectCat(cat);
    g.appendChild(b);
  });
  updateCatLabel();
  renderPos();
  drawWheel(0);
}
init();
