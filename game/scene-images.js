// =====================================================================
// MMA FIRST-PERSON (POV) SCENE — the opponent faces the camera
// Calm by design (2026-07 rework): both fighters just idle while the
// multiplier climbs — no exchanges, no alerts. At the crash your right
// glove throws the single finishing punch: KO -> the round is won.
// =====================================================================

// ── Easing + helpers ──
function _easeOutCubic(x){return 1-Math.pow(1-x,3)}
function _lerp(a,b,t){return a+(b-a)*t}

// ── Static images (gloves + background fallback) ──
var IMG={};
var _isMobile=window.innerWidth<600;
var _assetDir=_isMobile?'assets/mobile/':'assets/';
var _imgList=[
  {key:'bg',src:_assetDir+'bg.webp'},          // fallback until the animated loop decodes
  {key:'fistL',src:_assetDir+'hand-Left.webp'},
  {key:'fistR',src:_assetDir+'hand-Right.webp'}
];
var _imgsLoaded=0;

// ── POV frame sets (video-derived, same pipeline as the side view) ──
var POV={
  anims:{},          // {oppidle:[Image,...], oppko:[...], bg:[...]}
  cur:'oppidle',
  frame:0,timer:0,
  bgFrame:0,bgTimer:0,
  _started:false
};
// Draw config per opponent set — measured like the side view's SETCFG:
// s = crop height / standing body height, ax/ay = the fighter's standing
// anchor inside the crop (fractions). Values from sprite_meta of the
// front-facing green-screen clips.
var POVCFG={
  oppidle:{s:1.062,ax:0.499,ay:0.980},
  oppko:  {s:1.061,ax:0.793,ay:0.987}   // wide crop: he falls to the frame's left
};
var POVFPS={idle:6,idleRamp:5,ko:16,bg:10};
var POVSETS=[
  {name:'oppidle',path:'assets/anim3/front/idle/',prefix:'idle_',count:32},
  {name:'oppko',  path:'assets/anim3/front/ko/',  prefix:'ko_',  count:32},
  {name:'bg',     path:'assets/anim3/front/bg/',  prefix:'bg_',  count:16}
];

function _povLoadSet(s){
  POV.anims[s.name]=[];
  for(var i=0;i<s.count;i++){
    var img=new Image();
    (function(img,src){
      img.onerror=function(){if(!img._retried){img._retried=true;setTimeout(function(){img.src=src+'?r=1'},1500)}};
      img.src=src;
    })(img,s.path+s.prefix+('0'+i).slice(-2)+'.webp');
    POV.anims[s.name].push(img);
  }
}

function _loadImages(){
  if(IMG._started)return;
  IMG._started=true;
  _imgList.forEach(function(item){
    var img=new Image();
    img.onload=function(){_imgsLoaded++;if(_imgsLoaded>=_imgList.length)IMG._ready=true};
    img.onerror=function(){_imgsLoaded++;console.warn('Failed to load:',item.src)};
    img.src=item.src;
    IMG[item.key]=img;
  });
  POVSETS.forEach(_povLoadSet);
}
// Load only if this scene is the active view; toggleGameView() lazy-loads it otherwise.
// Same key + default as GAME_VIEW in app.js (which loads after this file).
if((localStorage.getItem('mma_view')||'side')!=='side')_loadImages();

// ── State ──
function initFighterState(){
  G.opp={breathCycle:0};
  G.myFists={punchArm:1,punchPhase:'idle',punchTimer:0,punchWindup:0};
  G.tension=0;G.koTimer=0;G.bellRing=0;G.arenaShake=0;G.crowdRoar=0;G.crowdRoarSmooth=0;
  POV.cur='oppidle';POV.frame=0;POV.timer=0;
  POV._koInit=false;POV._koHit=false;
}
function getTension(m){if(m<=1)return 0;if(m<=1.5)return(m-1)/0.5*0.25;if(m<=3)return 0.25+(m-1.5)/1.5*0.25;if(m<=7)return 0.5+(m-3)/4*0.25;return Math.min(1,0.75+(m-7)/13*0.25)}
function initCrowd(){}

function _povSetOpp(name){
  if(POV.cur!==name){POV.cur=name;POV.frame=0;POV.timer=0}
}

// Advance + fetch the current opponent frame. Idle loops; ko plays once, holds.
function _povOppFrame(dt){
  var anim=POV.anims[POV.cur];
  if(!anim||!anim.length)return null;
  var fps=(POV.cur==='oppidle')?POVFPS.idle+(G.tension||0)*POVFPS.idleRamp:POVFPS.ko;
  POV.timer+=dt;
  var d=1/fps;
  while(POV.timer>=d){POV.timer-=d;POV.frame++}
  var idx;
  if(POV.cur==='oppidle')idx=POV.frame=POV.frame%anim.length;
  else{if(POV.frame>=anim.length)POV.frame=anim.length-1;idx=POV.frame}
  var img=anim[idx];
  return (img&&img.complete&&img.naturalWidth>0)?img:null;
}

// ── Update ──
function updateFighters(){
  var dt=G.dt||0.016,fists=G.myFists;
  if(!G.opp||!fists)return;

  G.opp.breathCycle+=dt*2.8;

  // My punch phases (drives the glove offsets in render)
  if(fists.punchPhase!=='idle'){
    fists.punchTimer-=dt;
    if(fists.punchPhase==='windup'){fists.punchWindup=Math.min(1,fists.punchWindup+dt*14);if(fists.punchTimer<=0){fists.punchPhase='extend';fists.punchTimer=0.08}}
    else if(fists.punchPhase==='extend'){fists.punchWindup=0;if(fists.punchTimer<=0){fists.punchPhase='hold';fists.punchTimer=0.05}}
    else if(fists.punchPhase==='hold'){if(fists.punchTimer<=0){fists.punchPhase='retract';fists.punchTimer=0.2}}
    else if(fists.punchPhase==='retract'){if(fists.punchTimer<=0){fists.punchPhase='idle';fists.punchTimer=0}}
  }

  if(G.phase==='BETTING'){
    fists.punchPhase='idle';
    G.koTimer=0;POV._koInit=false;POV._koHit=false;
    _povSetOpp('oppidle');
  }
  else if(G.phase==='EXPLODE'){
    G.bellRing=Math.max(0,(G.bellRing||0)-dt);
    if(G.phaseTimer>1.2&&G.bellRing<=0)G.bellRing=0.5;
  }
  // FREEFALL: nothing to do — both fighters just breathe. The tension lives in
  // the idle rate, the vignette and the crowd, not in activity.
  else if(G.phase==='CRASH'){
    G.koTimer+=dt;
    if(!POV._koInit){
      POV._koInit=true;
      // The one punch — right glove
      fists.punchArm=1;
      fists.punchPhase='windup';fists.punchTimer=0.07;fists.punchWindup=0;
    }
    // Impact lands as the glove reaches extension
    if(!POV._koHit&&G.koTimer>=0.14){
      POV._koHit=true;
      _povSetOpp('oppko');
      G.arenaShake=12;G.crowdRoar=1;
      if(typeof spawnParticles==='function')spawnParticles(cv.width*0.5,cv.height*0.35,'gold',8);
      if(typeof SND!=='undefined'){SND.play('punch',0.9);SND.play('cheer',0.5)}
    }
  }

  G.arenaShake=Math.max(0,(G.arenaShake||0)*(1-dt*8));
  G.crowdRoar=Math.max(0,(G.crowdRoar||0)-dt*0.4);
  G.crowdRoarSmooth=_lerp(G.crowdRoarSmooth||0,G.crowdRoar,dt*5);
  if(G.arenaShake>0.3)G.camera.shake=Math.max(G.camera.shake,G.arenaShake*0.6);
}

// ══════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════
function render(){
  try{
  if(!cv||!cx)return;
  var W=cv.width,H=cv.height;if(!W||!H)return;
  if(!G.opp){try{initFighterState()}catch(e){}}
  cx.clearRect(0,0,W,H);cx.save();

  // Camera shake + zoom
  var cam=G.camera||{};
  if((cam.shake||0)>0.1)cx.translate((Math.random()-0.5)*cam.shake,(Math.random()-0.5)*cam.shake);
  var z=cam.zoom||1;
  if(z!==1){var zx=cam.zoomX||W*0.5,zy=cam.zoomY||H*0.45;cx.translate(zx,zy);cx.scale(z,z);cx.translate(-zx,-zy)}

  var t=G.tension=getTension(G.mult||1);
  var fists=G.myFists||{};
  var time=G.time||0;
  var dt=G.dt||0.016;

  // ═══ L1: ARENA BACKGROUND — animated crowd loop, static still as fallback ═══
  var bgAnim=POV.anims.bg;
  var bgImg=null;
  if(bgAnim&&bgAnim.length){
    POV.bgTimer+=dt;
    // Crowd stirs a little faster as the roar builds
    var bgD=1/(POVFPS.bg*(1+(G.crowdRoarSmooth||0)*0.6));
    while(POV.bgTimer>=bgD){POV.bgTimer-=bgD;POV.bgFrame=(POV.bgFrame+1)%bgAnim.length}
    var cand=bgAnim[POV.bgFrame];
    if(cand&&cand.complete&&cand.naturalWidth>0)bgImg=cand;
  }
  if(!bgImg&&IMG.bg&&IMG.bg.complete&&IMG.bg.naturalWidth)bgImg=IMG.bg;
  if(bgImg){
    var bgA=bgImg.naturalWidth/bgImg.naturalHeight,scA=W/H;
    var dW,dH;
    if(scA>bgA){dW=W;dH=W/bgA}else{dH=H;dW=H*bgA}
    cx.drawImage(bgImg,(W-dW)/2,(H-dH)/2,dW,dH);
  }else{
    cx.fillStyle='#060414';cx.fillRect(0,0,W,H);
  }

  // ═══ L2: OPPONENT — frame animation, faces the camera ═══
  var oppImg=_povOppFrame(dt);
  if(oppImg){
    var pc=POVCFG[POV.cur]||{s:1,ax:0.5,ay:1};
    var isMob=W<600;
    // He stands close: body height ~86% of the canvas, feet just above the panel
    var bodyH=Math.round(H*(isMob?0.72:0.86));
    var drawH=Math.round(bodyH*pc.s);
    var drawW=Math.round(drawH*(oppImg.naturalWidth/oppImg.naturalHeight));
    var floorY=Math.round(H*(isMob?0.9:0.99));
    cx.drawImage(oppImg,Math.round(W*0.5-pc.ax*drawW),floorY-Math.round(pc.ay*drawH),drawW,drawH);
  }

  // ═══ L3: MY GLOVES ═══
  var fistW2=W<600?W*0.828:W<900?W*0.4:W*0.358;
  var fistH2=fistW2*0.56;
  var idleBobL=Math.sin(time*2)*(W<600?3:5);
  var idleBobR=Math.sin(time*2+1)*(W<600?3:5);
  var fistBottomOffset=W<600?124:W<900?124:30;
  var lBaseX=W*0.5-fistW2*0.8;
  var lBaseY=H-fistH2-fistBottomOffset+idleBobL;
  var rBaseX=W*0.5-fistW2*0.2;
  var rBaseY=H-fistH2-fistBottomOffset+idleBobR;

  // The single KO punch — right glove lunges toward his chin
  var lOffX=0,lOffY=0,rOffX=0,rOffY=0;
  if(fists.punchPhase==='windup'){
    var wb=fists.punchWindup||0;
    if(fists.punchArm===-1){lOffY=15*wb;lOffX=-10*wb}else{rOffY=15*wb;rOffX=10*wb}
  }else if(fists.punchPhase==='extend'||fists.punchPhase==='hold'){
    if(fists.punchArm===-1){lOffY=-H*0.2;lOffX=W*0.12}else{rOffY=-H*0.2;rOffX=-W*0.12}
  }else if(fists.punchPhase==='retract'){
    var rp=Math.max(0,(fists.punchTimer||0)/0.2);
    if(fists.punchArm===-1){lOffY=-H*0.2*rp;lOffX=W*0.12*rp}else{rOffY=-H*0.2*rp;rOffX=-W*0.12*rp}
  }

  if(IMG.fistL&&IMG.fistL.complete&&IMG.fistL.naturalWidth>0){
    cx.drawImage(IMG.fistL,lBaseX+lOffX,lBaseY+lOffY,fistW2,fistH2);
  }
  if(IMG.fistR&&IMG.fistR.complete&&IMG.fistR.naturalWidth>0){
    cx.drawImage(IMG.fistR,rBaseX+rOffX,rBaseY+rOffY,fistW2,fistH2);
  }

  // ═══ L4: IMPACT FLASH — the moment the punch lands ═══
  if(fists.punchPhase==='hold'||(fists.punchPhase==='extend'&&(fists.punchTimer||0)<0.03)){
    var impX=W*0.5,impY=H*0.35;
    cx.save();cx.globalAlpha=0.5;
    var ig=cx.createRadialGradient(impX,impY,0,impX,impY,W*0.07);
    ig.addColorStop(0,'rgba(255,255,255,0.9)');ig.addColorStop(0.3,'rgba(255,240,150,0.4)');ig.addColorStop(1,'transparent');
    cx.fillStyle=ig;cx.beginPath();cx.arc(impX,impY,W*0.07,0,Math.PI*2);cx.fill();
    cx.strokeStyle='rgba(255,230,100,0.5)';cx.lineWidth=2;
    for(var sl=0;sl<8;sl++){var sa=sl/8*Math.PI*2+time*15;cx.beginPath();cx.moveTo(impX+Math.cos(sa)*W*0.025,impY+Math.sin(sa)*W*0.025);cx.lineTo(impX+Math.cos(sa)*W*0.06,impY+Math.sin(sa)*W*0.06);cx.stroke()}
    cx.restore();
  }

  // ═══ L5: PARTICLES ═══
  G.particles=(G.particles||[]).filter(function(p){
    p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;
    p.vy+=dt*7;p.life-=dt*1.2;
    if(p.life<=0)return false;
    var a=p.life*p.life;
    cx.beginPath();cx.arc(p.x,p.y,p.r*(0.5+p.life*0.5),0,Math.PI*2);
    cx.fillStyle='hsla('+(p.hue||20)+','+(p.sat||100)+'%,'+(p.lit||55)+'%,'+a+')';
    cx.fill();return true;
  });

  // ═══ L6: KO TEXT ═══
  if(G.phase==='CRASH'){
    var koT=G.koTimer||0;
    if(koT>0.5){
      var tp=Math.min(1,(koT-0.5)/0.4),ts=0.5+tp*0.5;
      cx.save();cx.translate(W/2,H*0.4);cx.scale(ts,ts);cx.globalAlpha=tp;
      cx.shadowColor='#ff2222';cx.shadowBlur=30;
      cx.font='bold 80px sans-serif';cx.textAlign='center';cx.textBaseline='middle';
      cx.fillStyle='#ff2222';cx.fillText('K.O.',0,0);
      cx.strokeStyle='rgba(255,255,255,0.3)';cx.lineWidth=2;cx.strokeText('K.O.',0,0);
      cx.shadowBlur=0;
      if(koT>1.2){
        cx.globalAlpha=Math.min(1,(koT-1.2)/0.5);
        cx.font='bold 28px sans-serif';cx.fillStyle='rgba(255,255,255,0.8)';
        cx.fillText((G.mult||1).toFixed(2)+'x',0,50);
      }
      cx.restore();
    }
  }

  // ═══ L7: BELL FLASH ═══
  if((G.bellRing||0)>0){cx.globalAlpha=G.bellRing*0.15;cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.globalAlpha=1}

  // ═══ L8: VIGNETTE ═══
  var vS=0.2+t*0.3;
  var vG=cx.createRadialGradient(W/2,H*0.4,H*0.2,W/2,H/2,H*0.85);
  vG.addColorStop(0,'transparent');vG.addColorStop(0.5,'rgba(0,0,0,'+vS*0.15+')');vG.addColorStop(1,'rgba(0,0,0,'+vS+')');
  cx.fillStyle=vG;cx.fillRect(0,0,W,H);

  cx.restore();
  }catch(e){console.error('MMA Render error:',e);try{cx.restore()}catch(e2){}}
}
