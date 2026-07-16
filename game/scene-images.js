// =====================================================================
// MMA FRONT SCENE — the pro fighter faces the camera, knees-up shot
// The whole story is his (2026-07): he idles while the multiplier
// climbs, throws the single finishing punch toward the camera at the
// crash, then celebrates. No player gloves, no visible opponent.
// =====================================================================

// ── Helpers ──
function _easeOutCubic(x){return 1-Math.pow(1-x,3)}
function _lerp(a,b,t){return a+(b-a)*t}

// ── Static images (background fallback) ──
var IMG={};
var _isMobile=window.innerWidth<600;
var _assetDir=_isMobile?'assets/mobile/':'assets/';
var _imgList=[
  {key:'bg',src:_assetDir+'bg.webp'},  // fallback until the animated loop decodes
  {key:'fistL',src:_assetDir+'hand-Left.webp'},
  {key:'fistR',src:_assetDir+'hand-Right.webp'}
];
var _imgsLoaded=0;

// ── Frame sets (video-derived, same pipeline as the side view) ──
var POV={
  anims:{},          // {idle:[Image,...], punch:[...], victory:[...], bg:[...]}
  cur:'idle',
  frame:0,timer:0,
  bgFrame:0,bgTimer:0
};
// Draw config per set — measured from the green-screen clips (figure centered
// at x=960, knee-up body pinned to the canvas bottom y=1080 of 1920x1080).
// s = crop height / frame-0 body height; ax = body center inside the crop;
// ay = the body's bottom edge inside the crop. Filled by extraction metrics.
var POVCFG={
  idle:   {s:1.028,ax:0.502,ay:1.0},
  punch:  {s:1.070,ax:0.654,ay:1.0},  // wide crop: the glove reaches toward the camera
  victory:{s:1.022,ax:0.538,ay:1.0}
};
var POVFPS={idle:6,idleRamp:5,punch:20,victory:12,bg:10};
var POVSETS=[
  {name:'idle',   path:'assets/anim3/hero/idle/',   prefix:'idle_',   count:24},
  {name:'punch',  path:'assets/anim3/hero/punch/',  prefix:'punch_',  count:32},
  {name:'victory',path:'assets/anim3/hero/victory/',prefix:'victory_',count:32},
  {name:'bg',     path:'assets/anim3/front/bg/',    prefix:'bg_',     count:16}
];
// The punch clip is a combo: three full extensions toward the camera, with
// pull-backs between. Each one gets its own impact (measured fill peaks).
var PUNCH_HITS=[10,19,25];

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
// The first-person scene is the only view — load immediately.
_loadImages();

// ── State ──
function initFighterState(){
  G.opp={breathCycle:0}; // kept: app.js pokes G.opp/G.myFists existence
  G.myFists={};
  G.tension=0;G.koTimer=0;G.bellRing=0;G.arenaShake=0;G.crowdRoar=0;G.crowdRoarSmooth=0;
  POV.cur='idle';POV.frame=0;POV.timer=0;
  POV._hitIdx=0;POV._flashT=0;POV._vic=false;
}
function getTension(m){if(m<=1)return 0;if(m<=1.5)return(m-1)/0.5*0.25;if(m<=3)return 0.25+(m-1.5)/1.5*0.25;if(m<=7)return 0.5+(m-3)/4*0.25;return Math.min(1,0.75+(m-7)/13*0.25)}
function initCrowd(){}

function _povSet(name){
  if(POV.cur!==name){POV.cur=name;POV.frame=0;POV.timer=0}
}

// A set is animatable only when EVERY frame has decoded — cycling through a
// half-loaded set makes the character/arena flicker on first load.
function _povReady(name){
  var a=POV.anims[name];
  if(!a||!a.length)return false;
  if(POV._ready&&POV._ready[name])return true;
  for(var i=0;i<a.length;i++){if(!(a[i].complete&&a[i].naturalWidth>0))return false}
  (POV._ready||(POV._ready={}))[name]=true;
  return true;
}

// Advance + fetch the current hero frame. Idle/victory loop; punch plays once, holds.
function _povFrame(dt){
  var anim=POV.anims[POV.cur];
  if(!anim||!anim.length)return null;
  var fps=(POV.cur==='idle')?POVFPS.idle+(G.tension||0)*POVFPS.idleRamp
         :(POV.cur==='victory')?POVFPS.victory:POVFPS.punch;
  POV.timer+=dt;
  var d=1/fps;
  while(POV.timer>=d){POV.timer-=d;POV.frame++}
  var idx;
  if(POV.cur==='punch'){if(POV.frame>=anim.length)POV.frame=anim.length-1;idx=POV.frame}
  else idx=POV.frame=POV.frame%anim.length;
  var img=anim[idx];
  // Hold the last good frame if this one hasn't decoded (mid-set switch on a
  // slow connection) — a held pose beats a vanishing fighter.
  if(img&&img.complete&&img.naturalWidth>0){POV._lastImg=img;return img}
  return POV._lastImg||null;
}

// ── Update ──
function updateFighters(){
  var dt=G.dt||0.016;
  if(!G.opp)return;

  if(G.phase==='BETTING'){
    G.koTimer=0;POV._hitIdx=0;POV._flashT=0;POV._vic=false;
    _povSet('idle');
  }
  else if(G.phase==='EXPLODE'){
    G.bellRing=Math.max(0,(G.bellRing||0)-dt);
    if(G.phaseTimer>1.2&&G.bellRing<=0)G.bellRing=0.5;
  }
  // FREEFALL: nothing — he just breathes; tension lives in the idle rate,
  // the vignette and the crowd.
  else if(G.phase==='CRASH'){
    G.koTimer+=dt;
    if(POV.cur==='idle'){_povSet('punch');POV._hitIdx=0}
    // Impacts: one per extension of the combo, fired the moment playback
    // reaches each measured contact frame (the final one is the KO blow)
    if(POV.cur==='punch'){
      while(POV._hitIdx<PUNCH_HITS.length&&POV.frame>=PUNCH_HITS[POV._hitIdx]){
        POV._hitIdx++;
        var last=POV._hitIdx>=PUNCH_HITS.length;
        POV._flashT=0.16;
        G.arenaShake=last?12:7;
        G.crowdRoar=last?1:Math.min(1,(G.crowdRoar||0)+0.4);
        if(typeof spawnParticles==='function')spawnParticles(cv.width*0.5,cv.height*0.4,'gold',last?8:4);
        if(typeof SND!=='undefined'){SND.play('punch',last?0.9:0.6);if(last)SND.play('cheer',0.5)}
      }
    }
    // Punch played out -> celebration until the next round resets him
    var pAnim=POV.anims.punch;
    if(!POV._vic&&POV.cur==='punch'&&pAnim&&POV.frame>=pAnim.length-1){
      POV._vic=true;
      _povSet('victory');
    }
  }
  POV._flashT=Math.max(0,(POV._flashT||0)-dt);

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
  var time=G.time||0;
  var dt=G.dt||0.016;

  // ═══ L1: ARENA BACKGROUND — animated crowd loop, static still as fallback ═══
  var bgImg=null;
  if(_povReady('bg')){
    var bgAnim=POV.anims.bg;
    POV.bgTimer+=dt;
    // Crowd stirs a little faster as the roar builds
    var bgD=1/(POVFPS.bg*(1+(G.crowdRoarSmooth||0)*0.6));
    while(POV.bgTimer>=bgD){POV.bgTimer-=bgD;POV.bgFrame=(POV.bgFrame+1)%bgAnim.length}
    bgImg=bgAnim[POV.bgFrame];
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

  // ═══ L2: THE FIGHTER — knees-up, faces the camera ═══
  // Wait for the FULL idle set before he first appears: one clean reveal
  // instead of a fighter flickering while frames stream in.
  var heroImg=_povReady('idle')?_povFrame(dt):null;
  // The branded loading screen lifts as soon as he can be drawn
  // (index.html also force-hides it after 6s as a safety net).
  if(heroImg&&!POV._loadHidden){
    POV._loadHidden=true;
    try{var ls=document.getElementById('loadingScreen');if(ls)ls.classList.add('hidden')}catch(e){}
  }
  if(heroImg){
    var pc=POVCFG[POV.cur]||{s:1,ax:0.5,ay:1};
    var isMob=W<600;
    // Knee-up body height relative to the canvas; bottom pinned near the panel
    var bodyH=Math.round(H*(isMob?0.78:0.92));
    var drawH=Math.round(bodyH*pc.s);
    var drawW=Math.round(drawH*(heroImg.naturalWidth/heroImg.naturalHeight));
    var bottomY=Math.round(H*(isMob?0.93:1.0));
    cx.drawImage(heroImg,Math.round(W*0.5-pc.ax*drawW),bottomY-Math.round(pc.ay*drawH),drawW,drawH);
  }

  // ═══ L2b: MY GLOVES — always present, calm idle bob ═══
  var fistW2=W<600?W*0.828:W<900?W*0.4:W*0.358;
  var fistH2=fistW2*0.56;
  var idleBobL=Math.sin(time*2)*(W<600?3:5);
  var idleBobR=Math.sin(time*2+1)*(W<600?3:5);
  var fistBottomOffset=W<600?124:W<900?124:30;
  if(IMG.fistL&&IMG.fistL.complete&&IMG.fistL.naturalWidth>0){
    cx.drawImage(IMG.fistL,W*0.5-fistW2*0.8,H-fistH2-fistBottomOffset+idleBobL,fistW2,fistH2);
  }
  if(IMG.fistR&&IMG.fistR.complete&&IMG.fistR.naturalWidth>0){
    cx.drawImage(IMG.fistR,W*0.5-fistW2*0.2,H-fistH2-fistBottomOffset+idleBobR,fistW2,fistH2);
  }

  // ═══ L3: IMPACT FLASH — one burst per landed hit ═══
  if((POV._flashT||0)>0){
    var impX=W*0.5,impY=H*0.42;
    cx.save();cx.globalAlpha=0.5;
    var ig=cx.createRadialGradient(impX,impY,0,impX,impY,W*0.09);
    ig.addColorStop(0,'rgba(255,255,255,0.9)');ig.addColorStop(0.3,'rgba(255,240,150,0.4)');ig.addColorStop(1,'transparent');
    cx.fillStyle=ig;cx.beginPath();cx.arc(impX,impY,W*0.09,0,Math.PI*2);cx.fill();
    cx.strokeStyle='rgba(255,230,100,0.5)';cx.lineWidth=2;
    for(var sl=0;sl<8;sl++){var sa=sl/8*Math.PI*2+time*15;cx.beginPath();cx.moveTo(impX+Math.cos(sa)*W*0.03,impY+Math.sin(sa)*W*0.03);cx.lineTo(impX+Math.cos(sa)*W*0.075,impY+Math.sin(sa)*W*0.075);cx.stroke()}
    cx.restore();
  }

  // ═══ L4: PARTICLES ═══
  G.particles=(G.particles||[]).filter(function(p){
    p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;
    p.vy+=dt*7;p.life-=dt*1.2;
    if(p.life<=0)return false;
    var a=p.life*p.life;
    cx.beginPath();cx.arc(p.x,p.y,p.r*(0.5+p.life*0.5),0,Math.PI*2);
    cx.fillStyle='hsla('+(p.hue||20)+','+(p.sat||100)+'%,'+(p.lit||55)+'%,'+a+')';
    cx.fill();return true;
  });

  // ═══ L5: KO TEXT ═══
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

  // ═══ L6: BELL FLASH ═══
  if((G.bellRing||0)>0){cx.globalAlpha=G.bellRing*0.15;cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.globalAlpha=1}

  // ═══ L7: VIGNETTE ═══
  var vS=0.2+t*0.3;
  var vG=cx.createRadialGradient(W/2,H*0.4,H*0.2,W/2,H/2,H*0.85);
  vG.addColorStop(0,'transparent');vG.addColorStop(0.5,'rgba(0,0,0,'+vS*0.15+')');vG.addColorStop(1,'rgba(0,0,0,'+vS+')');
  cx.fillStyle=vG;cx.fillRect(0,0,W,H);

  cx.restore();
  }catch(e){console.error('MMA Render error:',e);try{cx.restore()}catch(e2){}}
}
