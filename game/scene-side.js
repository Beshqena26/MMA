// =====================================================================
// MMA SIDE VIEW — Two fighters visible from the side
// Pro (left, you) vs Amateur (right, opponent)
// =====================================================================

// Mobile gets the 720px-tall frame set — same frames, ~2.2x fewer pixels to
// decode and hold in memory. Read once at load, same convention as the POV scene.
var _sideMobile=window.innerWidth<600;
var _sideFrameDir=_sideMobile?'assets/side/pro-frames-sm/':'assets/side/pro-frames/';

// ── SKIN: 'real' (current renders, default) | 'cartoon' (CC0 Mini Boxing, red vs blue) ──
// Trial system — the boss decides. ?skin=cartoon in the URL wins and persists;
// otherwise the stored choice; otherwise the current look. Nothing replaced.
var SKIN=(function(){
  try{
    var m=(location.search||'').match(/[?&]skin=(real3d|cartoon|real)/);
    if(m){localStorage.setItem('mma_skin',m[1]);return m[1]}
    var st=localStorage.getItem('mma_skin');
    return (st==='cartoon'||st==='real3d')?st:'real';
  }catch(e){return 'real'}
})();

// Per-skin layout: the two art sets have wildly different proportions.
// real: wide 1936x1072 renders, fighters overlap heavily. cartoon: square-ish
// 499x489 chibis that should stand toe to toe with a small gap.
var SKINCFG=SKIN==='cartoon'?{
  aspect:499/489, baseH:0.50, baseHMob:0.44,
  overlap:0.16, overlapMob:0.16,   // fraction of baseW; small = gloves nearly touch
  koYOff:0.02,                     // ko art already lies at the frame bottom
  drawArena:true                   // code-drawn cartoon arena instead of BG image
}:SKIN==='real3d'?{
  // Blender-rendered fighters (MPFB + Mixamo anim), 1280x720 frames, fighter centered
  aspect:1280/720, baseH:0.66, baseHMob:0.58,
  overlap:0.34, overlapMob:0.30,
  koYOff:0,                        // placeholder KO is a standing pose for now
  drawArena:false                  // same photoreal cage as the current art
}:{
  aspect:1936/1072, baseH:0.62, baseHMob:0.55,
  overlap:0.40, overlapMob:0.35,
  koYOff:0.15,
  drawArena:false
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
var FACEOFF={
  idleFPS:8, idleFPSRamp:6,   // idle playback: 8fps calm -> 14fps at full tension
  punchFPS:45,                // crash punch: explosive
  contactAt:0.13,             // s from CRASH start to impact
  blackoutAt:0.23,            // s from CRASH start to hard cut to black
  koAt:0.30,                  // s: amateur drops + pro resets to guard (hidden by the black)
  fadeUpAt:0.85,              // s: start revealing the KO
  fadeUpDur:0.35,             // s: reveal fade length (fully up at ~1.20s)
  impactShake:8,              // px, decays via app.js camera.shake *= 0.94
  pushIn:0.06,                // max zoom-in at full tension
  amPhase:3, amRate:0.93      // amateur desync so the two don't breathe in lockstep
};

// ── Pro frame-by-frame animation system ──
var PRO_ANIM={
  loaded:false,_loadCount:0,_totalFrames:0,
  anims:{},  // {idle:[Image,...], rightpunch:[...], gettinghit:[...]}
  current:'idle',
  frame:0,
  frameTimer:0
};

// Blue-corner frames — only used by the cartoon skin (the real skin's amateur
// reuses the pro's frames mirrored, because that art only exists in one colour).
var AM_FRAMES={anims:{}};

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
    })(img,s.path+s.prefix+('00000'+i).slice(-(s.pad||5))+'.webp');
    target[s.name].push(img);
  }
}

function _loadProFrames(){
  if(PRO_ANIM._started)return;
  PRO_ANIM._started=true;
  if(SKIN==='real3d'){
    // Blender/MPFB renders. blue 'hurt' and 'ko' are boxing-segment placeholders
    // until the real reaction animations are rendered (drop-in replacement).
    var R='assets/side/real3d/';
    _loadSet(PRO_ANIM.anims,{name:'idle',      path:R+'red/idle/',  prefix:'F_',start:0,end:13,pad:3});
    _loadSet(PRO_ANIM.anims,{name:'rightpunch',path:R+'red/punch/', prefix:'F_',start:0,end:12,pad:3});
    _loadSet(AM_FRAMES.anims,{name:'idle',      path:R+'blue/idle/',prefix:'F_',start:0,end:13,pad:3});
    _loadSet(AM_FRAMES.anims,{name:'gettinghit',path:R+'blue/hurt/',prefix:'F_',start:0,end:8, pad:3});
    _loadSet(AM_FRAMES.anims,{name:'ko',        path:R+'blue/ko/',  prefix:'F_',start:0,end:12,pad:3});
    return;
  }
  if(SKIN==='cartoon'){
    // CC0 "Mini Boxing" by Segel (opengameart.org/content/mini-boxing-character).
    // Red corner = pro; blue corner = amateur with its OWN art — no mirror-clone.
    var C='assets/side/cartoon/';
    _loadSet(PRO_ANIM.anims,{name:'idle',      path:C+'red/idle/',  prefix:'__Boxing04_Idle_',      start:0,end:9,pad:3});
    _loadSet(PRO_ANIM.anims,{name:'rightpunch',path:C+'red/punch/', prefix:'__Boxing04_PunchRight_',start:0,end:5,pad:3});
    _loadSet(AM_FRAMES.anims,{name:'idle',      path:C+'blue/idle/',prefix:'__Boxing04_Idle_',      start:0,end:9,pad:3});
    _loadSet(AM_FRAMES.anims,{name:'gettinghit',path:C+'blue/hurt/',prefix:'__Boxing04_Hurt_',      start:0,end:7,pad:3});
    _loadSet(AM_FRAMES.anims,{name:'ko',        path:C+'blue/ko/',  prefix:'__Boxing04_KO_',        start:0,end:9,pad:3});
    return;
  }
  // Only the frames the face-off actually reaches. The full sequences are 507 frames / 162MB
  // and every one was loaded eagerly at startup; ambient attacks and the victory
  // follow-through are gone, so leftpunch/legkick/victory are unreachable.
  var sets=[
    // Idle: a quiet slice at the top of the bounce, ping-ponged (see _getProFrame).
    // The full 37-67 range contains a deep crouch, a weight shift and a step — all baked
    // into the art. 48-54 holds the guard with feet planted. Tune by eye.
    {name:'idle',       path:_sideFrameDir+'idle/',       prefix:'Idle_',         start:48,  end:54},
    // Right cross, wind-up trimmed: index 0 = source frame 66, contact lands at index 6
    // (source frame 72 = full extension). The 1.1s retract past 78 is never seen — we cut to black.
    {name:'rightpunch', path:_sideFrameDir+'rightpunch/', prefix:'Right_Punch_',  start:66,  end:78},
    // Amateur's reaction — only ~4 frames are visible before the blackout.
    {name:'gettinghit', path:_sideFrameDir+'gettinghit/', prefix:'Getting_Hit_',  start:51,  end:62},
    // KO — the TAIL only: he's already flat on the mat and settled by 112, so this is a
    // held reveal pose, not the 90-frame fall (which happens unseen behind the blackout).
    {name:'ko',         path:_sideFrameDir+'ko/',         prefix:'KOO_',          start:112, end:120}
  ];
  sets.forEach(function(s){_loadSet(PRO_ANIM.anims,s)});
}

// The amateur's frame source: own blue art on the cartoon skin, shared red/real otherwise
var AM_OWN=(SKIN==='cartoon'||SKIN==='real3d');
function _amAnims(){return AM_OWN?AM_FRAMES.anims:PRO_ANIM.anims}

// Set pro animation — switch instantly
function _setProAnim(name){
  if(PRO_ANIM.current!==name){
    PRO_ANIM.current=name;
    PRO_ANIM.frame=0;
    PRO_ANIM.frameTimer=0;
  }
}

// FPS per animation — idle rate is the tension dial: faster breathing, same amplitude
function _animFPS(name){
  if(name==='idle')return FACEOFF.idleFPS+(G.tension||0)*FACEOFF.idleFPSRamp;
  if(name==='rightpunch')return FACEOFF.punchFPS;
  return 30;
}

// Ping-pong index for the idle slice. The span is a monotonic slice of the bounce, so a plain
// loop would snap 54->48 every cycle; bouncing it turns the slice into a rise-and-settle — breathing.
function _pingPong(frame,len){
  if(len<2)return 0;
  var period=(len-1)*2;
  var p=frame%period;
  return (p<len)?p:period-p;
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

  // Idle ping-pongs forever; others play once then hold last frame
  var idx;
  if(PRO_ANIM.current==='idle'){
    var period=Math.max(1,(anim.length-1)*2);
    PRO_ANIM.frame=PRO_ANIM.frame%period;
    idx=_pingPong(PRO_ANIM.frame,anim.length);
  }else{
    if(PRO_ANIM.frame>=anim.length)PRO_ANIM.frame=anim.length-1;
    idx=PRO_ANIM.frame;
  }

  var img=anim[idx];
  return (img&&img.complete&&img.naturalWidth>0)?img:null;
}

// ── Amateur frame animation — shares Pro's images, flipped when drawn ──
var AM_ANIM={
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

  // Slightly off the pro's rate so the two drift apart instead of twinning
  var fps=_animFPS(AM_ANIM.current)*FACEOFF.amRate;
  AM_ANIM.frameTimer+=dt;
  var frameDur=1/fps;
  while(AM_ANIM.frameTimer>=frameDur){
    AM_ANIM.frameTimer-=frameDur;
    AM_ANIM.frame++;
  }

  var idx;
  if(AM_ANIM.current==='idle'){
    var period=Math.max(1,(anim.length-1)*2);
    AM_ANIM.frame=AM_ANIM.frame%period;
    idx=_pingPong(AM_ANIM.frame,anim.length);
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
  if(SKINCFG.drawArena){SIDE.ready=true;return}   // cartoon arena is drawn, not downloaded
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
  }
  else if(G.phase==='FREEFALL'){
    // The face-off: both fighters hold. Nothing is thrown until the crash punch — the
    // tension is carried by breathing rate, the push-in and the vignette, not by activity.
    pro.pose='idle';
    am.pose='idle';
  }
  else if(G.phase==='CRASH'){
    // One punch -> impact -> hard cut to black -> the KO is revealed out of the black.
    // The drop itself is never seen: it happens behind the blackout, so there is still
    // no follow-through animation on screen — only a held reveal pose.
    var ct=G.phaseTimer||0;
    if(!SIDE._crashInit){
      SIDE._crashInit=true;SIDE._impact=false;SIDE._koSet=false;
      pro.pose='punchR';pro._poseTime=0;
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
    // Hidden by the black: amateur drops, pro settles back to his guard
    if(!SIDE._koSet&&ct>=FACEOFF.koAt){
      SIDE._koSet=true;
      am.pose='ko';am._poseTime=0;
      pro.pose='idle';pro._poseTime=0;
      if(typeof SND!=='undefined')SND.play('punch',0.6);
    }
  }

  // ── Sync pro pose → frame animation ──
  if(pro.pose==='idle')_setProAnim('idle');
  else if(pro.pose==='punchR')_setProAnim('rightpunch');

  // ── Sync amateur pose → frame animation ──
  if(am.pose==='idle')_setAmAnim('idle');
  else if(am.pose==='hit')_setAmAnim('gettinghit');
  else if(am.pose==='ko')_setAmAnim('ko');

  // KO -> standing crossfade: when the next round snaps him back to idle, fade the
  // body off the mat instead of an instant pop (render draws the overlay).
  if(SIDE._lastAmPose==='ko'&&am.pose!=='ko')SIDE._koFade=0.35;
  SIDE._lastAmPose=am.pose;
}

// ── Cartoon arena — drawn once per canvas size, cached ──
// Authored for this game (license-free): hall gradient, spotlight cones, crowd
// silhouettes with glow-stick glints, blue mat, ropes and corner posts. Geometry is
// tied to the fighters' floor line (H*0.82) so they stand mid-ring.
function _cartoonArena(W,H){
  if(SIDE._arena&&SIDE._arenaKey===W+'x'+H)return SIDE._arena;
  var c=document.createElement('canvas');c.width=W;c.height=H;
  var g=c.getContext('2d');
  var matTop=H*0.56;
  // hall
  var hall=g.createLinearGradient(0,0,0,H);
  hall.addColorStop(0,'#141a2e');hall.addColorStop(0.55,'#1c2440');hall.addColorStop(1,'#0d1120');
  g.fillStyle=hall;g.fillRect(0,0,W,H);
  // spotlight cones
  [[W*0.3,150,0.10],[W*0.7,150,0.10],[W*0.5,190,0.13]].forEach(function(s){
    var lg=g.createLinearGradient(s[0],0,s[0],H*0.7);
    lg.addColorStop(0,'rgba(255,240,200,'+s[2]+')');lg.addColorStop(1,'rgba(255,240,200,0)');
    g.fillStyle=lg;g.beginPath();
    g.moveTo(s[0]-14,0);g.lineTo(s[0]+14,0);g.lineTo(s[0]+s[1],H*0.68);g.lineTo(s[0]-s[1],H*0.68);
    g.closePath();g.fill();
  });
  // crowd rows (deterministic wobble — no Math.random so the cache is stable)
  [[H*0.14,9,'#232c49',46],[H*0.20,11,'#1e2740',40],[H*0.27,13,'#1a2136',34],[H*0.35,15,'#151b2c',30]]
  .forEach(function(row){
    g.fillStyle=row[2];
    for(var i=0;i<row[3];i++){
      var x=(i+0.5)*(W/row[3])+Math.sin(i*7.3+row[0])*6;
      var y=row[0]+Math.sin(i*3.1)*4,r=row[1];
      g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
      g.beginPath();g.arc(x,y+r*1.6,r*1.25,0,Math.PI,true);g.fill();
    }
  });
  // glow sticks
  var cols=['#ffd75e','#ff5e7a','#5ec8ff','#7dff8a'];
  for(var i=0;i<28;i++){
    g.fillStyle=cols[i%4];g.globalAlpha=0.5;
    g.fillRect(((i*97)%W),H*(0.12+((i*53)%24)/100),3,3);
    g.globalAlpha=1;
  }
  // mat
  var mat=g.createLinearGradient(0,matTop,0,H);
  mat.addColorStop(0,'#3f74d6');mat.addColorStop(1,'#2a4f97');
  g.fillStyle=mat;g.beginPath();
  g.moveTo(W*0.06,matTop);g.lineTo(W*0.94,matTop);g.lineTo(W*1.04,H);g.lineTo(-W*0.04,H);
  g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,0.06)';
  g.beginPath();g.ellipse(W*0.5,H*0.88,W*0.34,H*0.09,0,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(255,255,255,0.3)';g.lineWidth=4;
  g.beginPath();g.ellipse(W*0.5,H*0.87,W*0.12,H*0.04,0,0,Math.PI*2);g.stroke();
  g.font='800 '+Math.round(H*0.045)+'px "Arial Black",sans-serif';
  g.textAlign='center';g.textBaseline='middle';
  g.fillStyle='rgba(255,255,255,0.4)';g.fillText('MMA',W*0.5,H*0.87);
  // ropes — full-bleed, no corner posts: on desktop the sidebar covers the canvas's
  // left edge, so posts read asymmetric; edge-to-edge ropes read as a ringside camera
  // on a ring wider than the frame.
  [[matTop-118,'#e63946'],[matTop-78,'#f1f1f6'],[matTop-38,'#3d6fd0']].forEach(function(r){
    g.strokeStyle=r[1];g.lineWidth=6;
    g.beginPath();g.moveTo(-10,r[0]);g.quadraticCurveTo(W*0.5,r[0]+9,W+10,r[0]);g.stroke();
    g.strokeStyle='rgba(0,0,0,0.25)';g.lineWidth=2;
    g.beginPath();g.moveTo(-10,r[0]+3);g.quadraticCurveTo(W*0.5,r[0]+12,W+10,r[0]+3);g.stroke();
  });
  SIDE._arena=c;SIDE._arenaKey=W+'x'+H;
  return c;
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

  // ── Blackout, then the KO reveal fades up out of it ──
  // Canvas only — #cine / KNOCKOUT! / the final multiplier are DOM overlays sitting above
  // the canvas, so the result stays readable even while fully black.
  var blackA=0;
  if(G.phase==='CRASH'){
    var ct=G.phaseTimer||0;
    if(ct>=FACEOFF.blackoutAt){
      blackA=(ct<FACEOFF.fadeUpAt)?1
            :Math.max(0,1-(ct-FACEOFF.fadeUpAt)/FACEOFF.fadeUpDur);
    }
  }
  // Fully black — skip the scene entirely rather than draw under an opaque cover
  if(blackA>=0.999){
    cx.fillStyle='#000';cx.fillRect(0,0,W,H);
    return;
  }

  cx.save();

  // Layout is computed up front: the camera transform has to wrap the background too
  var pro=SIDE.pro,am=SIDE.am;
  var isMob=W<600;

  // Base height for fighters — fixed box size so position never jumps (per skin)
  var baseH=Math.round(H*(isMob?SKINCFG.baseHMob:SKINCFG.baseH));
  var baseAspect=SKINCFG.aspect;
  var baseW=Math.round(baseH*baseAspect);
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
    var zx=W*0.5-baseW*0.12,zy=floorY-baseH*0.45;
    cx.translate(zx,zy);cx.scale(zoom,zoom);cx.translate(-zx,-zy);
  }

  // ═══ L1: BACKGROUND ═══
  if(SKINCFG.drawArena){
    // Cartoon skin: the arena is drawn in code (license-free, zero download) and
    // cached to an offscreen canvas per size.
    cx.drawImage(_cartoonArena(W,H),0,0);
  }else if(S.bg&&S.bg.complete&&S.bg.naturalWidth){
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
  var _idleReady=_setReady(PRO_ANIM.anims.idle)&&(!AM_OWN||_setReady(AM_FRAMES.anims.idle));
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

  // Fixed positions using stable box — scale overlap for mobile
  var overlap=Math.round(baseW*(isMob?SKINCFG.overlapMob:SKINCFG.overlap));
  var proBoxX=W*0.5-baseW+overlap;
  var proBoxY=floorY-baseH;
  var amBoxX=W*0.5-overlap;
  var amBoxY=floorY-baseH;

  // ── Pro (left, you) — frame animation ──
  // Fighters wait for the FULL idle set before appearing: drawing per-frame while it
  // streams makes them flicker as the ping-pong hits undecoded indices, and they'd
  // stand on top of the loading line. One clean reveal instead.
  var proFrame=_idleReady?_getProFrame(dt):null;

  if(proFrame){
    var pNW=proFrame.naturalWidth||1936,pNH=proFrame.naturalHeight||1072;
    var pAspect=pNW/pNH;
    var drawW=Math.round(baseH*pAspect);
    var drawH=baseH;
    var drawX=proBoxX+Math.round((baseW-drawW)*0.5);
    var drawY=proBoxY;
    cx.drawImage(proFrame,drawX,drawY,drawW,drawH);
  }

  // ── Amateur (right, opponent) — same frames as Pro, flipped ──
  var amFrame=_idleReady?_getAmFrame(dt):null;

  if(amFrame){
    var aNW=amFrame.naturalWidth||1936,aNH=amFrame.naturalHeight||1072;
    var aAspect=aNW/aNH;
    var aDrawW=Math.round(baseH*aAspect);
    var aDrawH=baseH;
    var aDrawX=amBoxX+Math.round((baseW-aDrawW)*0.5);
    var aDrawY=amBoxY;
    // KO frames sit differently in-frame than the standing poses — per-skin push down
    if(am.pose==='ko')aDrawY+=Math.round(baseH*SKINCFG.koYOff);

    // Normal draw — flipped horizontally, centered in fixed box
    cx.save();
    cx.translate(amBoxX+baseW*0.5,aDrawY);
    cx.scale(-1,1);
    cx.drawImage(amFrame,-aDrawW*0.5,0,aDrawW,aDrawH);
    cx.restore();
  }

  // KO body fading off the mat while the standing idle takes over (see updateSideView)
  if(SIDE._koFade>0){
    SIDE._koFade-=dt;
    var koAnim=_amAnims().ko;
    var koImg=koAnim&&koAnim.length?koAnim[koAnim.length-1]:null;
    if(koImg&&koImg.complete&&koImg.naturalWidth>0){
      var kAspect=koImg.naturalWidth/koImg.naturalHeight;
      var kW=Math.round(baseH*kAspect),kH=baseH;
      var kY=amBoxY+Math.round(baseH*SKINCFG.koYOff);   // same mat offset as the held ko pose
      cx.save();
      cx.globalAlpha=Math.max(0,SIDE._koFade/0.35);
      cx.translate(amBoxX+baseW*0.5,kY);
      cx.scale(-1,1);
      cx.drawImage(koImg,-kW*0.5,0,kW,kH);
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

  // ═══ L7: KO REVEAL FADE — the tail of the blackout lifting off the scene ═══
  if(blackA>0){
    cx.fillStyle='rgba(0,0,0,'+blackA.toFixed(3)+')';
    cx.fillRect(0,0,W,H);
  }

  cx.restore();
  }catch(e){console.error('Side Render error:',e);try{cx.restore()}catch(e2){}}
}
