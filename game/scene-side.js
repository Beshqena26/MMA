// =====================================================================
// MMA SIDE VIEW — Two fighters visible from the side
// Pro (left, you) vs Amateur (right, opponent)
// =====================================================================

var _sideMobile=window.innerWidth<600;

// Layout constants for the fighter sprite sets (tight portrait crops, 1024px tall,
// character fills the frame and faces LEFT in the source art).
var SKINCFG={
  baseH:0.62, baseHMob:0.55,        // fighter height as fraction of canvas
  centerOff:0.36, centerOffMob:0.31 // fighter center distance from screen center, ×baseH
};

// Per-animation draw config, measured from the source green-screen videos where
// every clip had the fighter standing at the same spot (x=960, feet y=990 of
// 1920x1080). s = drawn-height multiplier (crop height / standing body height);
// ax/ay = where that standing spot sits inside the crop, as fractions. Anchoring
// by ax/ay instead of crop-center keeps the body registered when the animation
// switches — wide crops (stagger, kick reach, the KO slide) would otherwise
// teleport the fighter sideways.
var SETCFG={
  pro:{
    idle:      {s:1.082,ax:0.504,ay:0.997},
    rightpunch:{s:1.078,ax:0.646,ay:0.985},
    kick:      {s:1.165,ax:0.733,ay:0.971},
    gettinghit:{s:1.059,ax:0.709,ay:0.987},
    victory:   {s:1.294,ax:0.500,ay:0.984}
  },
  am:{
    idle:      {s:1.101,ax:0.511,ay:0.978},
    rightpunch:{s:1.072,ax:0.632,ay:1.005},
    kick:      {s:1.147,ax:0.720,ay:0.970},
    gettinghit:{s:1.081,ax:0.735,ay:0.988},
    ko:        {s:1.191,ax:0.565,ay:0.903}
  }
};
var SETCFG_DEF={s:1,ax:0.5,ay:1};

// Contact frame per strike — the source frame where the hit fully extends; the
// defender's reaction fires when playback reaches it. (Measured: widest reach
// toward the opponent in each generated set.)
var STRIKE={
  pro:{rightpunch:9,kick:14},
  am:{rightpunch:13,kick:11}
};

var SIDE={
  ready:false,img:{},_loaded:0,
  _list:[
    {key:'bg',src:_sideMobile?'assets/side/BG-sm.webp':'assets/side/BG.webp'}
  ],
  // Fight state for side view
  pro:{pose:'idle',poseTimer:0,punchArm:0},
  am:{pose:'idle',poseTimer:0}
};

// ── Face-off tuning ──
// The fighters are pre-rendered flat PNGs — there is no rig, so motion is controlled by
// WHICH frames play and HOW FAST, not by amplitude. Tension rides on rate, not size.
// The 2026-07 sets are 22-32 frames (video-derived), so playback fps roughly
// doubled vs the old 16-frame sets while wall-clock speed stays the same slow
// pace — twice the in-betweens is where the smoothness comes from.
var FACEOFF={
  idleFPS:6, idleFPSRamp:5,   // idle playback: 6fps calm (~real-time breath) -> 11fps tense
  punchFPS:20,                // crash punch — full extension is STRIKE.pro.rightpunch
  hitFPS:20,                  // reaction to the crash punch
  strikeFPS:16,               // mid-fight exchange strikes — deliberate, readable
  exHitFPS:16,                // reaction playback during exchanges
  koFPS:16,                   // the on-screen fall to the mat (~2s)
  contactAt:9/20,             // s from CRASH start to impact (= extension frame at punchFPS)
  koDelay:0.35,               // s after impact: reaction -> the fall starts
  vicDelay:1.25,              // s after impact: punch fully played out -> pro celebrates
  exGapMin:3.0, exGapMax:6.0, // s between exchanges; shrinks somewhat with tension
  impactShake:8,              // px, decays via app.js camera.shake *= 0.94
  pushIn:0.06,                // max zoom-in at full tension
  amPhase:5, amRate:0.93      // amateur desync so the two don't breathe in lockstep
};

// ── Pro frame-by-frame animation system ──
var PRO_ANIM={
  loaded:false,_loadCount:0,_totalFrames:0,
  anims:{},  // {idle:[Image,...], rightpunch:[...], gettinghit:[...]}
  current:'idle',
  frame:0,
  frameTimer:0
};

function _loadSet(target,s){
  target[s.name]=[];
  for(var i=s.start;i<=s.end;i++){
    PRO_ANIM._totalFrames++;
    var img=new Image();
    (function(img,src){
      img.onload=function(){
        PRO_ANIM._loadCount++;
        if(PRO_ANIM._loadCount>=PRO_ANIM._totalFrames)PRO_ANIM.loaded=true;
      };
      // One dropped frame would strand the loading state forever (fighters never
      // appear if an idle frame is missing) — retry once with a cache-buster.
      img.onerror=function(){
        if(!img._retried){
          img._retried=true;
          setTimeout(function(){img.src=src+'?r=1'},1500);
        }else{
          PRO_ANIM._loadCount++;
        }
      };
      img.src=src;
    })(img,s.path+s.prefix+('00000'+i).slice(-(s.pad||5))+(s.ext||'.webp'));
    target[s.name].push(img);
  }
}

function _loadProFrames(){
  if(PRO_ANIM._started)return;
  PRO_ANIM._started=true;
  // Video-derived comic sprite sets (Seedance green-screen -> chroma key, 2026-07),
  // 22-32 frames per move, all facing LEFT, union-bbox crops per set so frames
  // register within a set. Pro in assets/anim3/f1/, amateur in assets/anim3/f2/.
  var sets=[
    // Full breathing cycle, loop-cut where the clip best matches its start.
    {name:'idle',       path:'assets/anim3/f1/idle/',    prefix:'idle_',    start:0, end:30, pad:2, ext:'.webp'},
    {name:'rightpunch', path:'assets/anim3/f1/punch/',   prefix:'punch_',   start:0, end:31, pad:2, ext:'.webp'},
    {name:'kick',       path:'assets/anim3/f1/kick/',    prefix:'kick_',    start:0, end:31, pad:2, ext:'.webp'},
    {name:'gettinghit', path:'assets/anim3/f1/hit/',     prefix:'hit_',     start:0, end:31, pad:2, ext:'.webp'},
    // Post-KO celebration loop.
    {name:'victory',    path:'assets/anim3/f1/victory/', prefix:'victory_', start:0, end:21, pad:2, ext:'.webp'}
  ];
  sets.forEach(function(s){_loadSet(PRO_ANIM.anims,s)});
  var amSets=[
    {name:'idle',       path:'assets/anim3/f2/idle/',    prefix:'idle_',    start:0, end:21, pad:2, ext:'.webp'},
    {name:'rightpunch', path:'assets/anim3/f2/punch/',   prefix:'punch_',   start:0, end:31, pad:2, ext:'.webp'},
    {name:'kick',       path:'assets/anim3/f2/kick/',    prefix:'kick_',    start:0, end:31, pad:2, ext:'.webp'},
    {name:'gettinghit', path:'assets/anim3/f2/hit/',     prefix:'hit_',     start:0, end:31, pad:2, ext:'.webp'},
    // Full KO fall: guard -> crumple -> flat on his back. Plays once, holds last frame.
    {name:'ko',         path:'assets/anim3/f2/ko/',      prefix:'ko_',      start:0, end:31, pad:2, ext:'.webp'}
  ];
  amSets.forEach(function(s){_loadSet(AM_ANIM.anims,s)});
}

// The amateur has his own character set since 2026-07 (before that: pro's frames tinted)
function _amAnims(){return AM_ANIM.anims}

// Set pro animation — switch instantly
function _setProAnim(name){
  if(PRO_ANIM.current!==name){
    PRO_ANIM.current=name;
    PRO_ANIM.frame=0;
    PRO_ANIM.frameTimer=0;
  }
}

// FPS per animation — idle rate is the tension dial: faster breathing, same amplitude.
// Strikes and reactions run slower during exchanges than in the crash finish.
function _animFPS(name){
  if(name==='idle')return FACEOFF.idleFPS+(G.tension||0)*FACEOFF.idleFPSRamp;
  if(name==='rightpunch'||name==='kick')return (G.phase==='CRASH')?FACEOFF.punchFPS:FACEOFF.strikeFPS;
  if(name==='gettinghit')return (G.phase==='CRASH')?FACEOFF.hitFPS:FACEOFF.exHitFPS;
  if(name==='ko')return FACEOFF.koFPS;
  if(name==='victory')return 12;   // 22-frame celebration loop (~1.8s), relaxed
  return FACEOFF.hitFPS;
}

// Get current pro frame image
function _getProFrame(dt){
  var anim=PRO_ANIM.anims[PRO_ANIM.current];
  if(!anim||anim.length===0)return null;

  var fps=_animFPS(PRO_ANIM.current);
  PRO_ANIM.frameTimer+=dt;
  var frameDur=1/fps;
  while(PRO_ANIM.frameTimer>=frameDur){
    PRO_ANIM.frameTimer-=frameDur;
    PRO_ANIM.frame++;
  }

  // Idle and victory are designed cycles — loop them; others play once, hold last frame
  var idx;
  if(PRO_ANIM.current==='idle'||PRO_ANIM.current==='victory'){
    idx=PRO_ANIM.frame=PRO_ANIM.frame%anim.length;
  }else{
    if(PRO_ANIM.frame>=anim.length)PRO_ANIM.frame=anim.length-1;
    idx=PRO_ANIM.frame;
  }

  var img=anim[idx];
  return (img&&img.complete&&img.naturalWidth>0)?img:null;
}

// ── Amateur frame animation — his own character set, drawn unflipped ──
var AM_ANIM={
  anims:{},  // {idle:[Image,...], gettinghit:[...], ko:[...]}
  current:'idle',
  frame:FACEOFF.amPhase,  // offset from the pro on the very first round too — _setAmAnim
                          // won't fire at load, since both already start on 'idle'
  frameTimer:0
};

function _setAmAnim(name){
  if(AM_ANIM.current!==name){
    AM_ANIM.current=name;
    // Offset the idle so the amateur isn't breathing in lockstep with the pro
    AM_ANIM.frame=(name==='idle')?FACEOFF.amPhase:0;
    AM_ANIM.frameTimer=0;
  }
}

function _getAmFrame(dt){
  var anim=_amAnims()[AM_ANIM.current];
  if(!anim||anim.length===0)return null;

  // Idle runs slightly off the pro's rate so the two drift apart instead of
  // twinning; strikes/reactions keep exact speed so contact timing stays true.
  var fps=_animFPS(AM_ANIM.current)*(AM_ANIM.current==='idle'?FACEOFF.amRate:1);
  AM_ANIM.frameTimer+=dt;
  var frameDur=1/fps;
  while(AM_ANIM.frameTimer>=frameDur){
    AM_ANIM.frameTimer-=frameDur;
    AM_ANIM.frame++;
  }

  var idx;
  if(AM_ANIM.current==='idle'){
    idx=AM_ANIM.frame=AM_ANIM.frame%anim.length;
  }else{
    if(AM_ANIM.frame>=anim.length)AM_ANIM.frame=anim.length-1;
    idx=AM_ANIM.frame;
  }

  var img=anim[idx];
  return (img&&img.complete&&img.naturalWidth>0)?img:null;
}

function _loadSideImages(){
  if(SIDE._started)return;
  SIDE._started=true;
  SIDE._list.forEach(function(item){
    var img=new Image();
    img.onload=function(){SIDE._loaded++;if(SIDE._loaded>=SIDE._list.length)SIDE.ready=true};
    img.onerror=function(){SIDE._loaded++};
    img.src=item.src;
    SIDE.img[item.key]=img;
  });
}
// Load only if this scene is the active view; toggleGameView() lazy-loads it otherwise.
// Same key + default as GAME_VIEW in app.js (which loads after this file).
if((localStorage.getItem('mma_view')||'side')==='side'){_loadProFrames();_loadSideImages();}

// ── Side View Update ──
function updateSideView(){
  var dt=G.dt||0.016,t=G.tension||0;
  var pro=SIDE.pro,am=SIDE.am;

  // Timer-based pose system
  if(!pro._poseTime)pro._poseTime=0;
  pro._poseTime+=dt;
  if(!am._poseTime)am._poseTime=0;
  am._poseTime+=dt;

  if(G.phase==='BETTING'){
    pro.pose='idle';pro._poseTime=0;
    am.pose='idle';am._poseTime=0;
    SIDE._crashInit=false;   // arm the next crash sequence
    if(SIDE._ex)SIDE._ex.a=null;
  }
  else if(G.phase==='FREEFALL'){
    // Mid-fight exchanges: the two trade light strikes while the multiplier climbs.
    // Pacing quickens a little with tension but stays deliberate — the stakes still
    // live in the breathing and the push-in; the strikes are punctuation.
    var ex=SIDE._ex||(SIDE._ex={cool:1.6,a:null});
    if(ex.a){
      var a=ex.a;a.t+=dt;
      if(!a.landed&&a.t>=a.contactT){
        a.landed=true;
        if(a.atk==='pro'){am.pose='hit';am._poseTime=0}
        else{pro.pose='hit';pro._poseTime=0}
        if(G.camera)G.camera.shake=3;
        if(typeof SND!=='undefined')SND.play('punch',0.35);
      }
      if(a.t>=a.dur){
        pro.pose='idle';am.pose='idle';
        ex.a=null;
        ex.cool=(FACEOFF.exGapMin+Math.random()*(FACEOFF.exGapMax-FACEOFF.exGapMin))*(1-0.4*t);
      }
    }else{
      ex.cool-=dt;
      if(ex.cool<=0){
        var atk=Math.random()<0.62?'pro':'am';       // you land a few more than you take
        var mv=Math.random()<0.6?'punchR':'kick';
        var cf=STRIKE[atk][mv==='punchR'?'rightpunch':'kick'];
        ex.a={atk:atk,t:0,contactT:cf/FACEOFF.strikeFPS,dur:16/FACEOFF.strikeFPS+0.7,landed:false};
        if(atk==='pro'){pro.pose=mv;pro._poseTime=0}
        else{am.pose=mv;am._poseTime=0}
      }
    }
  }
  else if(G.phase==='CRASH'){
    // The finish plays out fully on screen: crash punch -> reaction -> the fall to
    // the mat -> the pro celebrates over the body until the next round resets.
    var ct=G.phaseTimer||0;
    if(!SIDE._crashInit){
      SIDE._crashInit=true;SIDE._impact=false;SIDE._koSet=false;SIDE._vicSet=false;
      if(SIDE._ex)SIDE._ex.a=null;
      pro.pose='punchR';pro._poseTime=0;
      PRO_ANIM.frame=0;PRO_ANIM.frameTimer=0;  // even if an exchange punch was mid-play
      am.pose='idle';am._poseTime=0;
    }
    if(!SIDE._impact&&ct>=FACEOFF.contactAt){
      SIDE._impact=true;
      am.pose='hit';am._poseTime=0;
      AM_ANIM.frame=0;AM_ANIM.frameTimer=0;
      if(G.camera)G.camera.shake=FACEOFF.impactShake;
      G.crowdRoar=1;
      if(typeof SND!=='undefined'){SND.play('punch',0.9);SND.play('cheer',0.4)}
    }
    if(!SIDE._koSet&&ct>=FACEOFF.contactAt+FACEOFF.koDelay){
      SIDE._koSet=true;
      am.pose='ko';am._poseTime=0;
      if(typeof SND!=='undefined')SND.play('punch',0.6);
    }
    if(!SIDE._vicSet&&ct>=FACEOFF.contactAt+FACEOFF.vicDelay){
      SIDE._vicSet=true;
      pro.pose='victory';pro._poseTime=0;
    }
  }

  // ── Sync pro pose → frame animation ──
  if(pro.pose==='idle')_setProAnim('idle');
  else if(pro.pose==='punchR')_setProAnim('rightpunch');
  else if(pro.pose==='kick')_setProAnim('kick');
  else if(pro.pose==='hit')_setProAnim('gettinghit');
  else if(pro.pose==='victory')_setProAnim('victory');

  // ── Sync amateur pose → frame animation ──
  if(am.pose==='idle')_setAmAnim('idle');
  else if(am.pose==='punchR')_setAmAnim('rightpunch');
  else if(am.pose==='kick')_setAmAnim('kick');
  else if(am.pose==='hit')_setAmAnim('gettinghit');
  else if(am.pose==='ko')_setAmAnim('ko');

  // KO -> standing crossfade: when the next round snaps him back to idle, fade the
  // body off the mat instead of an instant pop (render draws the overlay).
  if(SIDE._lastAmPose==='ko'&&am.pose!=='ko')SIDE._koFade=0.35;
  SIDE._lastAmPose=am.pose;
}

// ── Side View Render ──
function renderSideView(){
  try{
  if(!cv||!cx)return;
  var W=cv.width,H=cv.height;if(!W||!H)return;
  cx.clearRect(0,0,W,H);

  var t=G.tension=getTension(G.mult||1);
  var S=SIDE.img;
  var dt=G.dt||0.016;

  cx.save();

  // Layout is computed up front: the camera transform has to wrap the background too
  var pro=SIDE.pro,am=SIDE.am;
  var isMob=W<600;

  // Base height for fighters — fixed height + center anchors so position never jumps
  var baseH=Math.round(H*(isMob?SKINCFG.baseHMob:SKINCFG.baseH));
  var centerOff=Math.round(baseH*(isMob?SKINCFG.centerOffMob:SKINCFG.centerOff));
  var proCX=W*0.5-centerOff;  // pro (you) stands left of center
  var amCX=W*0.5+centerOff;   // amateur right of center
  var floorY=H*0.82;

  // ═══ CAMERA (wraps background + fighters; HUD below stays fixed) ═══
  // Local to the side view on purpose — app.js's per-phase zoomTarget is tuned for the POV scene.
  cx.save();
  var cam=G.camera||{};
  if((cam.shake||0)>0.1)cx.translate((Math.random()-0.5)*cam.shake,(Math.random()-0.5)*cam.shake);
  // Slow push-in: tension tightens the frame without the fighters moving at all
  var zoom=(G.phase==='FREEFALL'||G.phase==='CRASH')?(1+t*FACEOFF.pushIn):1;
  if(zoom!==1){
    // Origin biased toward the Pro so the push-in converges past the player
    var zx=W*0.5-baseH*0.2,zy=floorY-baseH*0.45;
    cx.translate(zx,zy);cx.scale(zoom,zoom);cx.translate(-zx,-zy);
  }

  // ═══ L1: BACKGROUND ═══
  if(S.bg&&S.bg.complete&&S.bg.naturalWidth){
    var bgA=S.bg.naturalWidth/S.bg.naturalHeight,scA=W/H;
    var dW,dH;
    if(scA>bgA){dW=W;dH=W/bgA}else{dH=H;dW=H*bgA}
    cx.drawImage(S.bg,(W-dW)/2,(H-dH)/2,dW,dH);
  }else{
    cx.fillStyle='#060414';cx.fillRect(0,0,W,H);
  }

  // ═══ L2: FIGHTERS ═══

  // First visit on a slow connection. The idle frames load first, so the moment they
  // decode the fighters stand there and the remaining frames stream invisibly — the
  // indicator is only needed while the arena is truly empty, and it stands where the
  // fighters will (they can't cover it: they aren't drawable yet).
  function _setReady(a){
    if(!a||!a.length)return false;
    for(var i=0;i<a.length;i++){if(!(a[i].complete&&a[i].naturalWidth>0))return false}
    return true;
  }
  var _idleReady=_setReady(PRO_ANIM.anims.idle)&&_setReady(AM_ANIM.anims.idle);
  if(!_idleReady&&PRO_ANIM._totalFrames>0){
    var lp=Math.min(1,PRO_ANIM._loadCount/PRO_ANIM._totalFrames);
    var lw=Math.min(220,W*0.4),lx=W*0.5-lw/2,ly=floorY-baseH*0.45;
    cx.save();
    cx.font='600 11px "JetBrains Mono",monospace';cx.textAlign='center';cx.textBaseline='bottom';
    cx.fillStyle='rgba(255,255,255,0.55)';
    cx.fillText('LOADING FIGHTERS — '+Math.round(lp*100)+'%',W*0.5,ly-9);
    cx.fillStyle='rgba(255,255,255,0.12)';cx.fillRect(lx,ly,lw,3);
    cx.fillStyle='#4caf50';cx.fillRect(lx,ly,Math.round(lw*lp),3);
    cx.restore();
  }

  // The source art faces LEFT: the pro (left side) is mirrored to face his opponent,
  // the amateur draws as-is. Each frame keeps its own aspect at its set's scaled
  // height, positioned by SETCFG's measured body anchor so differing crop sizes
  // (punch reach, stagger, the KO fall) never shift the standing body.

  // ── Pro (left, you) — frame animation, flipped to face right ──
  // Fighters wait for the FULL idle sets before appearing: drawing per-frame while
  // they stream makes them flicker as the loop hits undecoded indices, and they'd
  // stand on top of the loading line. One clean reveal instead.
  var proFrame=_idleReady?_getProFrame(dt):null;

  if(proFrame){
    var pc=SETCFG.pro[PRO_ANIM.current]||SETCFG_DEF;
    var pH=Math.round(baseH*pc.s);
    var drawW=Math.round(pH*(proFrame.naturalWidth/proFrame.naturalHeight));
    cx.save();
    // Mirrored draw: under scale(-1,1) the anchor column (ax from the crop's left)
    // lands on proCX when the image is drawn at local x = -ax*width.
    cx.translate(proCX,floorY-Math.round(pc.ay*pH));
    cx.scale(-1,1);
    cx.drawImage(proFrame,-Math.round(pc.ax*drawW),0,drawW,pH);
    cx.restore();
  }

  // ── Amateur (right, opponent) — his own set, unflipped (faces left) ──
  var amFrame=_idleReady?_getAmFrame(dt):null;

  if(amFrame){
    var ac=SETCFG.am[AM_ANIM.current]||SETCFG_DEF;
    var aH=Math.round(baseH*ac.s);
    var aDrawW=Math.round(aH*(amFrame.naturalWidth/amFrame.naturalHeight));
    var aX=amCX-Math.round(ac.ax*aDrawW);
    // The lying body is wide — pull it back in if it would hang past the right edge
    if(AM_ANIM.current==='ko')aX=Math.min(aX,W-aDrawW-4);
    cx.drawImage(amFrame,aX,floorY-Math.round(ac.ay*aH),aDrawW,aH);
  }

  // KO body fading off the mat while the standing idle takes over (see updateSideView)
  if(SIDE._koFade>0){
    SIDE._koFade-=dt;
    var koAnim=_amAnims().ko;
    var koImg=koAnim&&koAnim.length?koAnim[koAnim.length-1]:null;
    if(koImg&&koImg.complete&&koImg.naturalWidth>0){
      var kc=SETCFG.am.ko;
      var koH=Math.round(baseH*kc.s);
      var kW=Math.round(koH*(koImg.naturalWidth/koImg.naturalHeight));
      var kX=Math.min(amCX-Math.round(kc.ax*kW),W-kW-4);  // same edge clamp as the ko pose
      cx.save();
      cx.globalAlpha=Math.max(0,SIDE._koFade/0.35);
      cx.drawImage(koImg,kX,floorY-Math.round(kc.ay*koH),kW,koH);
      cx.restore();
    }
  }

  cx.restore(); // ═══ end CAMERA — HUD below is not zoomed or shaken ═══

  // ═══ L3: TENSION METERS ═══
  // These were health bars, but with the ambient attack loop gone they were two frozen
  // props (PRO hardcoded full; AMATEUR only ever written by the POV scene). Repurposed:
  // both fill with the round's tension — the game's core signal gets a readout, and the
  // colour walks green → amber → red as the punch gets closer.
  if(G.phase!=='BETTING'&&G.phase!=='WAITING'&&G.phase!=='INIT'){
    var bW=Math.min(150,W*0.2),bH=8,bY=H*0.04;
    var tCol=t<0.4?'#4caf50':t<0.75?'#ffaa00':'#ff2255';
    var tW=Math.round(bW*t);
    // Pro (left) — fills left-to-right
    cx.fillStyle='rgba(0,0,0,0.5)';cx.fillRect(W*0.1,bY,bW,bH);
    cx.fillStyle=tCol;cx.fillRect(W*0.1,bY,tW,bH);
    cx.fillStyle='#fff';cx.font='bold 9px sans-serif';cx.textAlign='center';
    cx.fillText('PRO',W*0.1+bW/2,bY-3);
    // Amateur (right) — mirrored, fills right-to-left toward the centre
    cx.fillStyle='rgba(0,0,0,0.5)';cx.fillRect(W*0.9-bW,bY,bW,bH);
    cx.fillStyle=tCol;cx.fillRect(W*0.9-tW,bY,tW,bH);
    cx.fillStyle='#fff';cx.textAlign='center';
    cx.fillText('AMATEUR',W*0.9-bW/2,bY-3);
  }

  // ═══ L3.5: CASH-OUT MOMENT — gold rings + multiplier stamp ═══
  // Player-layer celebration: the fighters hold their face-off (you escaped the
  // fight, they didn't), so the win reads as yours, not theirs. Drawn outside the
  // camera transform so the push-in doesn't move it.
  if(G.cashoutFx){
    var cf=G.cashoutFx;              // aged + expired by the update loop in app.js
    var cfDur=1.1,cp=cf.t/cfDur;
    if(cp<1){
      var cfX=W*0.5,cfY=H*0.40;
      var easeOut=1-Math.pow(1-Math.min(1,cp),3);
      cx.save();
      // two expanding rings, the second trailing
      for(var ri=0;ri<2;ri++){
        var rp=Math.min(1,Math.max(0,(cp-ri*0.15)/(1-ri*0.15)));
        if(rp<=0)continue;
        var re=1-Math.pow(1-rp,3);
        cx.beginPath();
        cx.arc(cfX,cfY,H*(0.04+0.40*re),0,Math.PI*2);
        cx.strokeStyle='rgba(255,215,0,'+((1-rp)*(ri?0.35:0.7)).toFixed(3)+')';
        cx.lineWidth=(ri?2:3)+5*(1-rp);
        cx.shadowColor='#ffd700';cx.shadowBlur=18*(1-rp);
        cx.stroke();
      }
      // multiplier stamp: quick pop, hold, fade
      var sp=Math.min(1,cp/0.12);                       // pop in over first 12%
      var scale=1.35-0.35*(1-Math.pow(1-sp,3));
      var fade=cp<0.65?1:1-(cp-0.65)/0.35;
      cx.globalAlpha=Math.max(0,fade);
      cx.translate(cfX,cfY-easeOut*H*0.06);
      cx.scale(scale,scale);
      cx.font='800 46px sans-serif';cx.textAlign='center';cx.textBaseline='middle';
      cx.shadowColor='#ffd700';cx.shadowBlur=24;
      cx.fillStyle='#ffd700';
      cx.fillText(cf.mult.toFixed(2)+'×',0,0);
      cx.font='700 18px sans-serif';cx.shadowBlur=10;
      cx.fillStyle='rgba(255,255,255,0.92)';
      cx.fillText('+$'+cf.win.toFixed(2),0,38);
      cx.restore();
    }
  }

  // ═══ L4: BONUS POPUPS ═══
  if(G.bonusPopups&&G.bonusPopups.length>0){
    for(var bi=0;bi<G.bonusPopups.length;bi++){
      var bp=G.bonusPopups[bi];
      var bpAlpha=Math.min(1,bp.life*2);
      cx.save();
      cx.globalAlpha=bpAlpha;
      cx.shadowColor='#ffd700';cx.shadowBlur=12;
      cx.font='bold 22px sans-serif';cx.textAlign='center';cx.textBaseline='middle';
      cx.fillStyle='#ffd700';
      cx.fillText('+'+bp.val.toFixed(2)+'x',bp.x,bp.y);
      cx.shadowBlur=0;
      cx.restore();
    }
  }

  // ═══ L5: PARTICLES ═══
  G.particles=(G.particles||[]).filter(function(p){
    p.x+=p.vx*(G.dt||0.016)*60;p.y+=p.vy*(G.dt||0.016)*60;
    p.vy+=(G.dt||0.016)*7;p.life-=(G.dt||0.016)*1.2;
    if(p.life<=0)return false;
    var a=p.life*p.life;
    cx.beginPath();cx.arc(p.x,p.y,p.r*(0.5+p.life*0.5),0,Math.PI*2);
    cx.fillStyle='hsla('+(p.hue||20)+','+(p.sat||100)+'%,'+(p.lit||55)+'%,'+a+')';
    cx.fill();return true;
  });

  // ═══ L6: VIGNETTE ═══
  // One cached gradient per canvas size; tension applied via globalAlpha instead of
  // baking it into the colour stops (which forced a new gradient object every frame).
  var vS=0.2+t*0.3;
  if(!SIDE._vig||SIDE._vigKey!==W+'x'+H){
    SIDE._vigKey=W+'x'+H;
    SIDE._vig=cx.createRadialGradient(W/2,H*0.4,H*0.2,W/2,H/2,H*0.85);
    SIDE._vig.addColorStop(0,'rgba(0,0,0,0)');
    SIDE._vig.addColorStop(0.5,'rgba(0,0,0,0.15)');
    SIDE._vig.addColorStop(1,'rgba(0,0,0,1)');
  }
  cx.save();cx.globalAlpha=vS;
  cx.fillStyle=SIDE._vig;cx.fillRect(0,0,W,H);
  cx.restore();

  cx.restore();
  }catch(e){console.error('Side Render error:',e);try{cx.restore()}catch(e2){}}
}
