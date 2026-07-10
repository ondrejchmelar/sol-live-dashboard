"use strict";
/* ============================================================
   English UI labels — single place to tweak wording.
   ============================================================ */
const LABELS={
  round:"Round", remaining:"remaining", liveMatches:"Live matches", standings:"Standings",
  running:"In progress", prealarm:"No more new boards", time:"Round ended",
  nextRound:"Next round", prealarmIn:"prealarm in", nextRoundAt:"next round ~",
  updated:"updated", finished:"Finished", inProgress:"In progress", bye:"Bye",
  pts:"Pts", bch:"Bch", net:"Net", page:"page", source:"source",
};

/* ============================================================
   Which embedded sample to show as the file:// fallback.
   Flip to "singles" to check long-list auto-paging.
   ============================================================ */
const SAMPLE="doubles";

/* ---------- Auto-scroll config ---------- */
const SCROLL_SPEED=28;       // px/sec vertical drift
const SCROLL_PAUSE_MS=2000;  // pause at top and bottom
const SCROLL_FRAME_MS=50;    // ~20fps cap; drift is slow so fewer frames look identical, ~1/3 less GPU

/* ============================================================
   Embedded sample datasets (mirror SoL / data.json shape).
   startedAtISO:null => clock is synthesized relative to "now"
   so the demo always shows a running clock crossing into
   prealarm shortly. The real scraper fills a concrete value.
   ============================================================ */
function doublesSample(){
  const M=(board,a,b,s1,s2,fin,phantom)=>({
    board, side1:a, side2:b, score1:s1, score2:s2,
    finished:fin, winner:fin?(s1>s2?1:(s2>s1?2:0)):0, phantom:!!phantom
  });
  const base={
    event:{name:"Jarní turnaj čtyřher 2026",type:"doubles",system:"Swiss",
           club:"SK Carrom Praha",location:"Praha",currentRound:5,totalRounds:8},
    clock:{startedAtISO:null,durationMin:50,prealarmMin:7,state:"running"},
    matches:[
      M(1,["Chmelař Tomáš","Bednář Matěj"],["Sviták Zdeněk","Vopálenská M."],24,12,true),
      M(2,["Sekhesh Ajay","Těšitel Jan"],["Novák Petr","Horák Lukáš"],23,9,true),
      M(3,["Rezek Pavel","Dvořák Jiří"],["Marek Ondřej","Kraus Filip"],18,16,false),
      M(4,["Beránek Karel","Šimek Tomáš"],["Pospíšil Jan","Urban David"],11,14,false),
      M(5,["Veselý Adam","Král Martin"],["Holub Roman","Fiala Petr"],25,7,true),
      M(6,["Procházka Jan","Růžička Aleš"],["—","—"],25,0,true,true),
    ],
    standings:[
      {rank:1,players:["Sekhesh Ajay","Těšitel Jan"],pts:13,bch:41,net:78},
      {rank:2,players:["Chmelař Tomáš","Bednář Matěj"],pts:11,bch:39,net:64},
      {rank:3,players:["Veselý Adam","Král Martin"],pts:10,bch:37,net:52},
      {rank:4,players:["Rezek Pavel","Dvořák Jiří"],pts:9,bch:35,net:33},
      {rank:5,players:["Procházka Jan","Růžička Aleš"],pts:8,bch:33,net:21},
      {rank:6,players:["Beránek Karel","Šimek Tomáš"],pts:7,bch:32,net:9},
      {rank:7,players:["Marek Ondřej","Kraus Filip"],pts:6,bch:30,net:-4},
      {rank:8,players:["Pospíšil Jan","Urban David"],pts:6,bch:29,net:-12},
      {rank:9,players:["Sviták Zdeněk","Vopálenská M."],pts:4,bch:27,net:-30},
      {rank:10,players:["Holub Roman","Fiala Petr"],pts:3,bch:25,net:-48},
      {rank:11,players:["Novák Petr","Horák Lukáš"],pts:2,bch:24,net:-61},
      {rank:12,players:["—","—"],pts:0,bch:0,net:-92},
    ],
    updatedISO:new Date().toISOString(),
  };
  // Pad with realistic filler so panels overflow and auto-scroll is visible
  // (real doubles events run ~50 pairs).
  const fp=["Horáček Petr/Kadlec Jan","Bláha Tomáš/Šťastný Ivo","Macháček Aleš/Vlček Jan",
    "Pešek Ota/Říha Dan","Soukup Jiří/Beneš Karel","Tichý Lukáš/Vávra Petr",
    "Malý Jan/Kovář Aleš","Bartoš Filip/Janda Roman","Vacek Petr/Liška Tomáš",
    "Pokorný Jan/Šebek Aleš","Hruška Ivo/Kalous Petr","Strnad Jan/Mareš Filip",
    "Diviš Ota/Toman Jan","Kohout Petr/Brož Aleš","Šimon Jan/Dušek Karel","Sýkora Petr/Eliáš Jan"];
  let bd=base.matches.length, rk=base.standings.length;
  for(let i=0;i+1<fp.length;i+=2){
    const s1=13+(i%12), s2=8+((i*5)%15), fin=(i%4!==0);
    base.matches.push({board:++bd,side1:fp[i].split("/"),side2:fp[i+1].split("/"),
      score1:s1,score2:s2,finished:fin,winner:fin?(s1>=s2?1:2):0,phantom:false});
  }
  fp.forEach((nm,i)=>base.standings.push({rank:++rk,players:nm.split("/"),
    pts:Math.max(0,6-Math.floor(i/3)),bch:23-i,net:-95-i*6}));
  return base;
}

function singlesSample(){
  // 40 players, 20 boards — long enough to exercise auto-paging.
  const first=["Tomáš","Jan","Petr","Pavel","Jiří","Martin","Lukáš","Ondřej","David","Filip",
    "Roman","Adam","Karel","Aleš","Marek","Zdeněk","Michal","Daniel","Václav","Štěpán"];
  const last=["Novák","Svoboda","Dvořák","Černý","Procházka","Kučera","Veselý","Horák","Němec","Marek",
    "Pospíšil","Pokorný","Hájek","Král","Beneš","Fiala","Sedláček","Doležal","Zeman","Kolář"];
  const players=[];
  for(let i=0;i<40;i++) players.push(last[i%20]+" "+first[(i*7)%20]);
  const matches=[];
  for(let b=1;b<=20;b++){
    const a=players[(b-1)*2], c=players[(b-1)*2+1];
    const fin=b<=14;                       // ~70% finished mid-round
    const s1=fin?(b%3===0?25:18+(b%8)):12+(b%9);
    const s2=fin?(b%3===0?(10+b%6):25):9+(b%7);
    matches.push({board:b,side1:[a],side2:[c],score1:s1,score2:s2,
      finished:fin,winner:fin?(s1>s2?1:2):0,phantom:false});
  }
  const standings=players.map((p,i)=>({rank:i+1,players:[p],
    pts:Math.max(0,28-i),bch:120-i*3,net:200-i*11})).slice(0,40);
  return {
    event:{name:"Mistrovství ČR jednotlivců 2026",type:"singles",system:"Swiss",
           club:"Český svaz carrom",location:"Praha",currentRound:8,totalRounds:13},
    clock:{startedAtISO:null,durationMin:50,prealarmMin:7,state:"running"},
    matches, standings, updatedISO:new Date().toISOString(),
  };
}

const SAMPLES={doubles:doublesSample,singles:singlesSample};

/* ============================================================
   Clock resolution: if startedAtISO is null, synthesize a
   start so remaining sits just above prealarm → the demo
   visibly crosses into the prealarm state ~30s after load.
   ============================================================ */
function resolveClock(c){
  const out=Object.assign({},c);
  if(!out.startedAtISO){
    const remainSec=out.prealarmMin*60+30;             // 30s before prealarm
    const startedMs=Date.now()-(out.durationMin*60-remainSec)*1000;
    out.startedAtISO=new Date(startedMs).toISOString();
  }
  return out;
}

function pad(n){return String(n).padStart(2,"0")}
function mmss(sec){sec=Math.max(0,Math.round(sec));return pad(Math.floor(sec/60))+":"+pad(sec%60)}
function hhmm(d){return pad(d.getHours())+":"+pad(d.getMinutes())}
function round5(d){const ms=5*60*1000;return new Date(Math.round(d.getTime()/ms)*ms);}
function esc(s){return String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
// SoL renders "Surname Firstname" — show the surname (first token) in bold caps.
function fmtName(full){
  const s=String(full||"").trim();
  if(!s) return "";
  const i=s.indexOf(" ");
  if(i<0) return '<b class="sn">'+esc(s)+'</b>';
  return '<b class="sn">'+esc(s.slice(0,i))+'</b> '+esc(s.slice(i+1));
}
// A side's players on one line, slash-separated (surname bold caps per player).
function names(side){
  return '<span class="names">'+(side||[]).map(fmtName).join('<span class="vs">/</span>')+'</span>';
}

/* ============================================================
   State + render
   ============================================================ */
let DATA=null;
let clockTimer=null;

function start(data){
  DATA=data;
  renderStatic();
  renderMatches(); renderStandings();
  layoutPanels();

  // Live clock only when we actually have timing data; otherwise hide the bar.
  if(clockTimer){clearInterval(clockTimer);clockTimer=null;}
  const bar=document.getElementById("timerbar");
  if(DATA.clock){
    bar.style.display="";
    // Sample data has no mode/start → synthesize a running clock; real data carries both.
    if(!DATA.clock.mode){ DATA.clock=resolveClock(DATA.clock); DATA.clock.mode="running"; }
    tick(); clockTimer=setInterval(tick,1000);
  }else{
    // No live clock yet (e.g. id not learned until the first countdown starts).
    // Hide the timer silently — never surface a diagnostic on the public display.
    bar.style.display="none";
  }
}

/* Auto-scroll a panel body: drift the .scroller down at SCROLL_SPEED, pause 2s at the
   bottom, drift back up, pause 2s at the top, repeat. Rows move via a GPU-composited
   transform (no per-frame scroll repaint); the panel header stays fixed outside .scroller.
   Time-based, so it's independent of frame rate, and it re-queries .scroller every tick so
   innerHTML re-renders don't disturb the loop. */
function attachAutoScroll(el){
  if(!el) return;
  let pos=0, dir=1, pauseUntil=0, last=null, inner=null, written=null;
  function frame(ts){
    requestAnimationFrame(frame);
    const cur=el.querySelector(".scroller");
    if(!cur){ last=null; return; }                 // nothing rendered yet
    if(cur!==inner){ inner=cur; written=null; }     // re-rendered: reapply transform
    const clip=inner.parentNode;
    if(last==null){ last=ts; return; }
    const dt=ts-last;
    if(dt<SCROLL_FRAME_MS) return;  // throttle below the display refresh rate
    last=ts;
    const max=inner.offsetHeight-clip.clientHeight;
    if(max<=1){ if(written!==0){ inner.style.transform="translateY(0)"; written=0; } pos=0; dir=1; pauseUntil=0; return; }
    if(pos>max) pos=max;            // content shrank since last frame
    if(ts<pauseUntil) return;       // holding at an end
    pos += dir*SCROLL_SPEED*(dt/1000);
    if(pos>=max){ pos=max; dir=-1; pauseUntil=ts+SCROLL_PAUSE_MS; }
    else if(pos<=0){ pos=0; dir=1; pauseUntil=ts+SCROLL_PAUSE_MS; }
    const next=Math.round(pos);
    if(next!==written){ inner.style.transform="translateY("+(-next)+"px)"; written=next; }  // skip redundant frames
  }
  requestAnimationFrame(frame);
}

// Tournament status line for the TOP bar: round number + phase.
function topStatus(d){
  const r=d.event.currentRound, tot=d.event.totalRounds;
  const rnd = r==null ? "" : (tot!=null ? "Round "+r+" / "+tot : "Round "+r);
  switch(d.state){
    case "final":    return "Final results";
    case "running":  return rnd+" · in progress";
    case "prealarm": return rnd+" · prealarm";
    case "over":     return rnd+" · round ended";
    case "ready":    return rnd+" · prepared";
    case "prepare":  return r!=null ? "Preparing round "+r : "Preparing next round";
    case "pre":      return "Before first round";
    default:         return rnd || "In progress";
  }
}

function renderStatic(){
  const e=DATA.event;
  document.getElementById("eventName").textContent=e.name;
  const typeLbl=e.type==="doubles"?"Doubles":"Singles";
  document.getElementById("eventSub").textContent=
    topStatus(DATA)+" · "+typeLbl+(e.location?" · "+e.location:"");
  document.getElementById("matchesTitle").textContent=LABELS.liveMatches;
  document.title=e.name+" — Corridor Dashboard";
}

// A new match column every 15 boards, capped at 3: <15 → 1, 15–29 → 2, 30+ → 3.
function matchColumns(n){ return n>=30 ? 3 : n>=15 ? 2 : 1; }

// Standings are always visible (1 column); the matches panel appears whenever
// there are matches, spanning as many columns as matchColumns() allows.
function layoutPanels(){
  const list=DATA.matches||[];
  const hasMatches=list.length>0;
  const cols=matchColumns(list.length);
  const m=document.getElementById("matchesPanel");
  const s=document.getElementById("standingsPanel");
  const main=document.querySelector("main");
  s.style.display="";                              // standings: always shown
  m.style.display=hasMatches?"":"none";
  main.style.gridTemplateColumns=hasMatches?(cols+"fr 1fr"):"1fr"; // matches | standings
}

function renderMatches(){
  const list=DATA.matches||[];
  const body=document.getElementById("matchesBody");
  const teamLabel=DATA.event.type==="doubles"?"Team":"Player";
  const headCell='<div class="match head">'+
      '<div class="board">Board</div>'+
      '<div class="sides"><div class="side"><span class="names">'+teamLabel+'</span>'+
        '<span class="sc">Score</span></div></div>'+
      '<div class="badges"></div>'+
    '</div>';
  const cols=matchColumns(list.length);
  const rows=Math.ceil(list.length/cols)||1;
  // Column-major fill: boards run top-to-bottom in column 1, then column 2, …
  const colHtml=[];
  for(let c=0;c<cols;c++){
    const slice=list.slice(c*rows,(c+1)*rows);
    colHtml.push('<div class="mcol">'+slice.map(renderMatchRow).join("")+'</div>');
  }
  const gt='grid-template-columns:repeat('+cols+',1fr)';
  body.innerHTML='<div class="mhead" style="'+gt+'">'+headCell.repeat(cols)+'</div>'+
    '<div class="sclip"><div class="scroller">'+
      '<div class="mgrid" style="'+gt+'">'+colHtml.join("")+'</div>'+
    '</div></div>';
  const remaining=list.filter(m=>!m.finished && !m.phantom).length;
  document.getElementById("matchesPg").textContent=remaining+" "+LABELS.remaining;
}

function renderMatchRow(m){
  const s1win=m.finished&&m.winner===1, s2win=m.finished&&m.winner===2;
  // The round only starts "in progress" once its clock is running — while it's
  // merely prepared (or before the first round) boards are scheduled, not live.
  const started=DATA.state!=="ready" && DATA.state!=="prepare" && DATA.state!=="pre";
  // Icon-only status so every row's badge is the same width → scores stay aligned.
  let badge;
  if(m.phantom) badge='<span class="badge bye" title="'+LABELS.bye+'">—</span>';
  else if(m.finished) badge='<span class="badge fin" title="'+LABELS.finished+'">✓</span>';
  else if(started) badge='<span class="badge live" title="'+LABELS.inProgress+'"><span class="statedot"></span></span>';
  else badge='<span class="badge sched">&nbsp;</span>';
  return ''+
    '<div class="match">'+
      '<div class="board">B'+m.board+'</div>'+
      '<div class="sides">'+
        '<div class="side'+(s1win?' win':'')+'">'+names(m.side1)+'<span class="sc">'+m.score1+'</span></div>'+
        '<div class="side'+(s2win?' win':'')+'">'+names(m.side2)+'<span class="sc">'+m.score2+'</span></div>'+
      '</div>'+
      '<div class="badges">'+badge+'</div>'+
    '</div>';
}

function renderStandings(){
  const list=DATA.standings||[];
  const rows=list.map(r=>{
    const chip=r.rank<=3?("rankchip r"+r.rank):"rankchip";
    return '<tr>'+
      '<td class="r"><span class="'+chip+'">'+r.rank+'</span></td>'+
      '<td class="name">'+names(r.players)+'</td>'+
      '<td class="pts">'+r.pts+'</td>'+
      '<td class="num">'+r.bch+'</td>'+
      '<td class="num">'+r.net+'</td>'+
    '</tr>';
  }).join("");
  const cg='<colgroup><col class="cg-r"><col class="cg-name"><col class="cg-pts"><col class="cg-num"><col class="cg-num"></colgroup>';
  document.getElementById("standingsBody").innerHTML=
    '<table class="rank rank-head">'+cg+'<thead><tr>'+
      '<th class="r">#</th><th class="name">'+(DATA.event.type==="doubles"?"Team":"Player")+'</th>'+
      '<th>'+LABELS.pts+'</th><th>'+LABELS.bch+'</th><th>'+LABELS.net+'</th>'+
    '</tr></thead></table>'+
    '<div class="sclip"><div class="scroller">'+
      '<table class="rank rank-body">'+cg+'<tbody>'+rows+'</tbody></table>'+
    '</div></div>';
  document.getElementById("standingsPg").textContent=
    list.length+(DATA.event.type==="doubles"?" teams":" players");
}

/* ---------- Live clock tick ---------- */
const BREAK_MIN=10;   // assumed break between rounds for the "next round ~" estimate
function tick(){
  const c=DATA.clock;
  const bar=document.getElementById("timerbar");
  const tEl=document.getElementById("clockTime");
  const sEl=document.getElementById("clockState");
  const aux=document.getElementById("clockAux");
  bar.classList.remove("state-running","state-prealarm","state-time","state-next","state-ended");

  // Round prepared but clock not started, or a between-rounds pre-countdown:
  // show the full duration with a waiting label, no live counting.
  if(c.mode==="ready" || c.mode==="prepare"){
    bar.classList.add("state-next");
    tEl.textContent=mmss((c.durationMin||0)*60);
    sEl.textContent=c.mode==="prepare"?LABELS.nextRound:"Round prepared";
    aux.innerHTML="";
    return;
  }

  // Round time is up (or ended without a live start) — red until the next draw.
  if(c.mode==="over"){
    bar.classList.add("state-ended");
    tEl.textContent="00:00";
    sEl.textContent=LABELS.time; // "Round ended"
    aux.innerHTML="";
    return;
  }

  const started=new Date(c.startedAtISO).getTime();
  const durSec=c.durationMin*60, preSec=c.prealarmMin*60;
  const remaining=durSec-(Date.now()-started)/1000;
  aux.innerHTML='<span class="nrlabel">'+LABELS.nextRound+'</span><b>~'+
    hhmm(round5(new Date(started+(durSec+BREAK_MIN*60)*1000)))+'</b>';

  if(remaining>preSec){
    bar.classList.add("state-running");
    tEl.textContent=mmss(remaining);
    sEl.textContent=LABELS.running;
  }else if(remaining>0){
    bar.classList.add("state-prealarm");
    tEl.textContent=mmss(remaining);
    sEl.innerHTML='<span class="statedot"></span>'+LABELS.prealarm;
  }else{
    bar.classList.add("state-ended");
    tEl.textContent="00:00";
    sEl.textContent=LABELS.time; // "Round ended" — stays red until a new round is drawn
  }
}

// Bottom bar = DASHBOARD status only (data freshness + connection warnings).
function refreshFooter(){
  const el=document.getElementById("updated");
  if(!DATA.updatedISO){ el.textContent=""; return; }
  el.textContent=LABELS.updated+" "+hhmm(new Date(DATA.updatedISO));
}

/* ============================================================
   Data load seam — the plugin feeds the corridor shape directly
   from chrome.storage.local (written by the background poller).
   No demo fallback: with no live data we show an empty board and
   surface the connection state (e.g. Anubis needs re-solving).
   ============================================================ */
function applyStatus(status){
  const note=document.getElementById("dashstatus");
  if(!note) return;
  if(status && status.state==="anubis") note.textContent="⚠ "+(status.message||"Anubis — reconnecting…");
  else if(status && status.state==="error") note.textContent="⚠ "+(status.message||"error");
  else note.textContent="";
}

// Empty board when there's no live data (first run, or a lapsed Anubis challenge).
function showEmpty(status){
  DATA={event:{name:"",type:"singles",currentRound:null,totalRounds:null,location:"",club:"",system:""},
        clock:null,matches:[],standings:[],state:"idle",updatedISO:null};
  renderMatches(); renderStandings(); layoutPanels();
  document.getElementById("timerbar").style.display="none";
  const anubis=status && status.state==="anubis";
  document.getElementById("eventName").textContent=anubis?"Reconnecting to SoL…":"Waiting for SoL…";
  document.getElementById("eventSub").textContent=anubis
    ? (status.message || "Re-solving the Anubis challenge…")
    : (status && status.state==="error" ? String(status.message||"") : "");
  document.title="SoL Live Dashboard";
}

function boot(){
  chrome.storage.local.get(["data","status"],({data,status})=>{
    const anubis=status && status.state==="anubis";
    if(!anubis && data && data.event && Array.isArray(data.standings)) start(data);
    else showEmpty(status);
    refreshFooter();
    applyStatus(status);
  });
}

// Re-render whenever the poller writes new data/status.
chrome.storage.onChanged.addListener((ch,area)=>{
  if(area==="local" && (ch.data||ch.status)) boot();
});
boot();

// Persistent auto-scrollers on each panel body (run for the life of the page).
attachAutoScroll(document.getElementById("matchesBody"));
attachAutoScroll(document.getElementById("standingsBody"));
