/* ══════════════════════════════════════════
   Copa Cajamarca — Generador de Banners HORARIOS
   app.js
═══════════════════════════════════════════ */

/* ── PARSER ── */
function parseRaw(raw){
  raw=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
  if(raw.includes('\t')){
    return raw.split('\n').filter(l=>l.trim()).map(line=>{
      const c=line.split('\t').map(s=>s.trim());
      return{hora:c[0]||'',teamA:c[1]||'',teamB:c[3]||c[2]||'',cat:c[4]||'',fecha:c[5]||''};
    });
  }
  const timeRe=/(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm))/gi;
  const segs=raw.split(timeRe).filter(Boolean);const rows=[];
  for(let i=0;i<segs.length-1;i+=2){
    const hora=segs[i].trim(),rest=segs[i+1]||'';
    const vp=rest.split(/\bvs\.?\b/i);if(vp.length<2)continue;
    const teamA=vp[0].trim(),afterVS=vp[1].trim();
    const ym=afterVS.match(/(\d{4})/);const year=ym?ym[1]:'';
    const fm=afterVS.match(/(playoff|semifinal|final|\bfecha\s*\d+)/i);const fechaTipo=fm?fm[1].toUpperCase():'';
    const teamB=afterVS.replace(/\d{4}/,'').replace(/(playoff|semifinal|final|\bfecha\s*\d+)/gi,'').trim();
    rows.push({hora,teamA,teamB,cat:year,fecha:fechaTipo});
  }
  return rows;
}

/* ── ROUND RECT ── */
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

/* ── SOCCER BALL (fallback cuando el logo no carga) ── */
function drawSoccerBall(ctx,cx,cy,r,alpha){
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle='#f8f8f5';ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=r*0.03;ctx.stroke();
  const pentR=r*0.28;
  const pts=[[0,-0.62],[0.59,-0.19],[0.36,0.50],[-0.36,0.50],[-0.59,-0.19],[0,0]];
  pts.forEach(([px,py])=>{
    const bx=cx+px*r,by=cy+py*r,dist=Math.sqrt(px*px+py*py),pr=pentR*(1-dist*0.18);
    ctx.beginPath();
    for(let a=0;a<5;a++){
      const ang=-Math.PI/2+a*(Math.PI*2/5);
      const vx=bx+pr*Math.cos(ang),vy=by+pr*Math.sin(ang);
      a===0?ctx.moveTo(vx,vy):ctx.lineTo(vx,vy);
    }
    ctx.closePath();
    ctx.fillStyle='#111111';ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=r*0.02;ctx.stroke();
  });
  const shine=ctx.createRadialGradient(cx-r*0.28,cy-r*0.28,r*0.05,cx,cy,r);
  shine.addColorStop(0,'rgba(255,255,255,0.45)');
  shine.addColorStop(0.4,'rgba(255,255,255,0.08)');
  shine.addColorStop(1,'rgba(0,0,0,0.25)');
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle=shine;ctx.fill();
  ctx.restore();
}

/* ── LOGO IMAGE ── */
const _logoImg = new Image();
_logoImg.src = '../logo.svg';   /* carga directa — preview siempre muestra el logo */

/* ── LOGO CIRCLE ── */
function drawLogoCircle(ctx,cx,cy,r,alpha){
  ctx.save();
  ctx.globalAlpha=alpha;

  const lbg=ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,r*0.05,cx,cy,r);
  lbg.addColorStop(0,'#1c3da6');lbg.addColorStop(1,'#040e30');
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle=lbg;ctx.fill();

  const ringG=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
  ringG.addColorStop(0,'#6a3c00');ringG.addColorStop(0.5,'#ffd15c');ringG.addColorStop(1,'#6a3c00');
  ctx.strokeStyle=ringG;ctx.lineWidth=r*0.07;ctx.stroke();

  if(_logoImg.complete && _logoImg.naturalWidth>0){
    ctx.save();
    ctx.beginPath();ctx.arc(cx,cy,r*0.88,0,Math.PI*2);ctx.clip();
    const s=r*1.76;
    ctx.drawImage(_logoImg,cx-s/2,cy-s/2,s,s);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();ctx.arc(cx,cy,r*0.82,0,Math.PI*2);ctx.clip();
    drawSoccerBall(ctx,cx,cy,r*0.7,1);
    ctx.restore();
  }

  ctx.beginPath();ctx.arc(cx,cy,r*0.88,0,Math.PI*2);
  ctx.strokeStyle='rgba(245,168,0,0.2)';ctx.lineWidth=r*0.02;ctx.stroke();
  ctx.restore();
}

/* ══════════════════════════════════════════
   PALETA SORTEO
   fondo  #0b1a3a  panel  #122047  panel2 #192d60
   am     #f5c800  am2    #e0a800
   azul   #1a3a6b  azul2  #0d2147  azul3  #1e4fa0
   blanco #f5f7ff  gris   #b8c4d8
═══════════════════════════════════════════ */
const C = {
  fondo:'#0b1a3a', panel:'#122047', panel2:'#192d60',
  am:'#f5c800',  am2:'#e0a800',
  rojo:'#e03030', blanco:'#f5f7ff', gris:'#b8c4d8',
  azul:'#1a3a6b', azul2:'#0d2147', azul3:'#1e4fa0',
};

/* ── MAIN DRAW ── */
function _doGenerateBanner(){
  const raw     = document.getElementById('rawData').value;
  const fecha   = document.getElementById('fecha').value;
  const sede    = document.getElementById('sede').value;
  const etiq    = document.getElementById('etiqueta').value;
  const subetiq = document.getElementById('subetiq').value;
  const temp    = document.getElementById('temporada').value;
  const tit1    = 'COPA CAJAMARCA';
  const tit2    = 'CAMPEONATO DE MENORES';
  const rows    = parseRaw(raw);

  document.getElementById('parse-error').textContent='';
  if(!rows.length){
    document.getElementById('parse-error').textContent='⚠ No se pudo leer ningún partido.';
    return;
  }

  const W=1080, H=1080;
  const cv=document.getElementById('banner-canvas');
  cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');

  const HEADER  = 168;
  const DATEBAR = 92;
  const THEAD   = 44;
  const FOOTER  = 54;
  const TABLE_H = H - HEADER - DATEBAR - THEAD - FOOTER;
  const ROW_H   = TABLE_H / rows.length;

  /* 1. BG */
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,C.azul2);bg.addColorStop(1,C.fondo);
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  /* 2. HEADER */
  const hg=ctx.createLinearGradient(0,0,0,HEADER);
  hg.addColorStop(0,C.azul2);hg.addColorStop(1,C.azul);
  ctx.fillStyle=hg;ctx.fillRect(0,0,W,HEADER);
  ctx.fillStyle=C.am;ctx.fillRect(0,0,W,8);          /* raya top */
  ctx.fillStyle=C.am;ctx.fillRect(0,HEADER-3,W,3);   /* separador */

  /* LOGO */
  drawLogoCircle(ctx,82,HEADER/2+4,54,1.0);

  /* TÍTULO — centrado verticalmente junto al logo */
  ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.shadowColor='rgba(245,200,0,0.6)';ctx.shadowBlur=18;
  ctx.fillStyle=C.blanco;
  ctx.font='900 76px "Barlow Condensed",sans-serif';
  ctx.fillText(tit1,152,HEADER/2-20);
  ctx.shadowBlur=0;
  ctx.fillStyle=C.gris;
  ctx.font='700 38px "Barlow Condensed",sans-serif';
  ctx.fillText(tit2,152,HEADER/2+28);

  /* ETIQUETA DERECHA */
  ctx.textAlign='right';
  ctx.font='italic 700 18px "Barlow Condensed",sans-serif';
  ctx.fillStyle=C.gris;
  ctx.fillText(subetiq,W-38,HEADER/2-4);
  ctx.shadowColor='rgba(245,200,0,0.8)';ctx.shadowBlur=20;
  ctx.font='900 52px "Bebas Neue",sans-serif';
  ctx.fillStyle=C.am;
  ctx.fillText(etiq,W-38,HEADER/2+42);
  ctx.shadowBlur=0;

  /* 3. DATE BAR */
  const dy=HEADER;
  const dateG=ctx.createLinearGradient(0,dy,W,dy+DATEBAR);
  dateG.addColorStop(0,C.am2);dateG.addColorStop(0.5,C.am);dateG.addColorStop(1,C.am2);
  ctx.fillStyle=dateG;ctx.fillRect(0,dy,W,DATEBAR);
  ctx.fillStyle='rgba(255,255,255,0.22)';ctx.fillRect(0,dy,W,3);
  ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(0,dy+DATEBAR-3,W,3);
  ctx.fillStyle=C.fondo;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor='rgba(255,255,255,0.3)';ctx.shadowBlur=6;
  ctx.font='bold 36px "Barlow Condensed",sans-serif';
  ctx.fillText(fecha,W/2,dy+30);
  ctx.shadowBlur=0;
  ctx.font='700 26px "Barlow Condensed",sans-serif';
  ctx.fillStyle='rgba(11,26,58,0.85)';
  ctx.fillText(sede,W/2,dy+70);

  /* 4. TABLE HEADER */
  const thy=HEADER+DATEBAR;
  ctx.fillStyle=C.panel2;ctx.fillRect(0,thy,W,THEAD);
  ctx.fillStyle=C.am;ctx.fillRect(0,thy+THEAD-3,W,3);
  const COLS=[
    {label:'HORA',   x:18,  w:130, al:'left'},
    {label:'PARTIDO',x:154, w:680, al:'center'},
    {label:'CAT.',   x:848, w:100, al:'center'},
    {label:'FECHA',  x:960, w:108, al:'center'},
  ];
  ctx.fillStyle=C.am;ctx.font='700 17px "Barlow Condensed",sans-serif';ctx.textBaseline='middle';
  COLS.forEach(c=>{
    ctx.textAlign=c.al;
    ctx.fillText(c.label, c.al==='center'?c.x+c.w/2:c.x, thy+THEAD/2);
  });
  [154,848,960].forEach(x=>{
    ctx.fillStyle='rgba(245,200,0,0.25)';ctx.fillRect(x,thy+6,1,THEAD-12);
  });

  /* 5. ROWS */
  rows.forEach((r,i)=>{
    const ry=thy+THEAD+i*ROW_H;
    ctx.fillStyle=i%2===0?C.panel:C.panel2;
    ctx.fillRect(0,ry,W,ROW_H);
    ctx.fillStyle='rgba(245,200,0,0.08)';ctx.fillRect(0,ry+ROW_H-1,W,1);

    const midY=ry+ROW_H/2;
    const fs=Math.max(14,Math.min(28,ROW_H*0.48));
    ctx.textBaseline='middle';

    /* HORA */
    ctx.textAlign='left';ctx.fillStyle=C.am;
    ctx.font=`700 ${fs}px "Barlow Condensed",sans-serif`;
    ctx.fillText(r.hora,18,midY);

    /* VS PILL */
    const vsX=COLS[1].x+COLS[1].w/2;
    const pillW=72, pillH=Math.min(36,ROW_H*0.62);

    ctx.textAlign='right';ctx.fillStyle=C.blanco;
    ctx.font=`700 ${fs}px "Barlow Condensed",sans-serif`;
    ctx.shadowColor='rgba(0,0,0,0.4)';ctx.shadowBlur=4;
    ctx.fillText(r.teamA.toUpperCase(),vsX-pillW/2-10,midY);
    ctx.shadowBlur=0;

    rr(ctx,vsX-pillW/2,midY-pillH/2,pillW,pillH,10);
    ctx.fillStyle=C.azul3;ctx.fill();
    ctx.strokeStyle='rgba(245,200,0,0.5)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle=C.am;
    ctx.font=`900 ${Math.max(fs*1.1,16)}px "Bebas Neue",sans-serif`;
    ctx.textAlign='center';ctx.fillText('VS',vsX,midY);

    ctx.textAlign='left';ctx.fillStyle=C.blanco;
    ctx.font=`700 ${fs}px "Barlow Condensed",sans-serif`;
    ctx.shadowColor='rgba(0,0,0,0.4)';ctx.shadowBlur=4;
    ctx.fillText(r.teamB.toUpperCase(),vsX+pillW/2+10,midY);
    ctx.shadowBlur=0;

    /* CAT BADGE */
    const catX=COLS[2].x+COLS[2].w/2;
    const cph=Math.min(28,ROW_H*0.52);
    rr(ctx,catX-34,midY-cph/2,68,cph,14);
    ctx.fillStyle='rgba(245,200,0,0.15)';ctx.fill();
    ctx.strokeStyle='rgba(245,200,0,0.5)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle=C.am;ctx.textAlign='center';
    ctx.font=`700 ${fs}px "Barlow Condensed",sans-serif`;
    ctx.fillText(r.cat,catX,midY);

    /* FECHA BADGE */
    if(r.fecha){
      const bx=COLS[3].x+COLS[3].w/2;
      const bw=Math.min(r.fecha.length*10+22,116);
      const bh=Math.min(32,ROW_H*0.58);
      rr(ctx,bx-bw/2,midY-bh/2,bw,bh,7);
      ctx.fillStyle=C.azul3;ctx.fill();
      ctx.strokeStyle='rgba(245,200,0,0.45)';ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle=C.blanco;
      ctx.font=`700 ${fs*0.82}px "Barlow Condensed",sans-serif`;
      ctx.textAlign='center';ctx.fillText(r.fecha,bx,midY);
    }
  });

  /* 6. FOOTER */
  const fy=H-FOOTER;
  ctx.fillStyle=C.azul2;ctx.fillRect(0,fy,W,FOOTER);
  ctx.fillStyle=C.am;ctx.fillRect(0,fy,W,3);
  ctx.fillStyle=C.blanco;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='700 15px "Barlow Condensed",sans-serif';
  ctx.fillText(temp,W/2,fy+FOOTER/2+2);

  document.getElementById('preview-area').style.display='block';
  document.getElementById('preview-area').scrollIntoView({behavior:'smooth'});
}

/* ── PUBLIC API ── */
function generateBanner(){
  /* Dibuja inmediatamente — drawLogoCircle usa fallback si el logo no está listo */
  _doGenerateBanner();
}

/* Si el logo llega después (servidor local), redibuja automáticamente */
_logoImg.onload = ()=> {
  if(document.getElementById('preview-area').style.display !== 'none'){
    _doGenerateBanner();
  }
};

function downloadBanner(){
  const cv=document.getElementById('banner-canvas');
  try{
    const dataURL=cv.toDataURL('image/png');
    const a=document.createElement('a');
    a.download='copa_cajamarca_1080x1080.png';
    a.href=dataURL;
    a.click();
  } catch(e){
    alert('No se pudo exportar: el navegador bloqueó el acceso al canvas.\nIntenta abrir la página desde un servidor local (ej: extensión Live Server en VS Code).');
  }
}

window.addEventListener('load',()=>generateBanner());
