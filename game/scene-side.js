// =====================================================================
// MMA SIDE VIEW — Two fighters visible from the side
// Pro (left, you) vs Amateur (right, opponent)
// =====================================================================

var _sideMobile=window.innerWidth<600;

// Layout constants for the fighter sprite sets (tight portrait crops, 1024px tall,
// character fills the frame and faces LEFT in the source art).
var SKINCFG={
  baseH:0.62, baseHMob:0.55,        // fighter height as fraction of canvas
  centerOff:0.36, centerOffMob:0.31, // fighter center distance from screen center, ×baseH
  koYOff:0.22
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
  idleFPS:6, idleFPSRamp:5,   // idle playback: 6fps calm (~2.7s breath) -> 11fps at full tension
  punchFPS:24,                // crash punch — full extension is source frame 10
  hitFPS:18,                  // reaction playback
  contactAt:10/24,            // s from CRASH start to impact (= extension frame at punchFPS)
  blackoutAt:10/24+0.10,      // s from CRASH start to hard cut to black
  koAt:10/24+0.17,            // s: amateur drops + pro resets to guard (hidden by the black)
  fadeUpAt:1.05,              // s: start revealing the KO
  fadeUpDur:0.35,             // s: reveal fade length (fully up at ~1.40s)
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
  // The comic fighter sprite sets: 16 tight-cropped PNG frames each, numbered 00-15.
  var sets=[
    // Full breathing/bounce cycle, played as a forward loop.
    {name:'idle',       path:'assets/anim/idle/',  prefix:'idle_',        start:0, end:15, pad:2, ext:'.png'},
    // Punch combo — full extension lands at source frame 10 (= FACEOFF.contactAt at punchFPS).
    {name:'rightpunch', path:'assets/anim/punch/', prefix:'punch_combo_', start:0, end:15, pad:2, ext:'.png'},
    // Amateur's reaction — only the first few frames are visible before the blackout.
    {name:'gettinghit', path:'assets/anim/hit/',   prefix:'hit_',         start:0, end:15, pad:2, ext:'.png'},
    // KO reveal pose — no downed set in this skin yet, so hold the doubled-over
    // moment of the hit reaction, pushed toward the mat by SKINCFG.koYOff.
    {name:'ko',         path:'assets/anim/hit/',   prefix:'hit_',         start:8, end:8,  pad:2, ext:'.png'}
  ];
  sets.forEach(function(s){_loadSet(PRO_ANIM.anims,s)});
}

// The amateur reuses the pro's frames, mirrored at draw time
function _amAnims(){return PRO_ANIM.anims}

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

  // Idle is a designed cycle — loop it forward; others play once then hold last frame
  var idx;
  if(PRO_ANIM.current==='idle'){
    idx=PRO_ANIM.frame=PRO_ANIM.frame%anim.length;
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

// ── Amateur recolor ──
// The amateur shares the pro's frames, so without this the fight is two identical
// twins. Bake a recolored copy of each frame the first time the amateur needs it:
// skin shifts to a deeper brown, the blue wrist tape goes red. Greys and blacks
// (gloves, shorts, outlines, shoes) are left alone — both corners wear black.
function _amTint(img){
  if(img._am)return img._am;
  var c=document.createElement('canvas');
  c.width=img.naturalWidth;c.height=img.naturalHeight;
  var g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(img,0,0);
  var d=g.getImageData(0,0,c.width,c.height),p=d.data;
  for(var i=0;i<p.length;i+=4){
    if(p[i+3]===0)continue;
    var r=p[i],gr=p[i+1],b=p[i+2];
    var mx=Math.max(r,gr,b),mn=Math.min(r,gr,b),df=mx-mn;
    if(df<30)continue;                    // near-greys: white shoes, glove patch, black gear
    var h;
    if(mx===r)h=((gr-b)/df+6)%6;else if(mx===gr)h=(b-r)/df+2;else h=(r-gr)/df+4;
    h*=60;
    var l=(mx+mn)/2;
    if(h>=10&&h<=50&&l>60&&l<235){
      // Skin (and brown hair) → deeper brown, multiplicative so shading survives
      p[i]=Math.round(r*0.66);p[i+1]=Math.round(gr*0.52);p[i+2]=Math.round(b*0.46);
    }else if(h>=190&&h<=260){
      // Blue wrist tape → red corner
      p[i]=mx;p[i+1]=Math.round(mn*0.55);p[i+2]=Math.round(mn*0.6);
    }
  }
  g.putImageData(d,0,0);
  // The draw path sizes frames off naturalWidth/naturalHeight (Image API) —
  // mirror them onto the canvas so tinted frames measure identically.
  c.naturalWidth=c.width;c.naturalHeight=c.height;
  img._am=c;
  return c;
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
    idx=AM_ANIM.frame=AM_ANIM.frame%anim.length;
  }else{
    if(AM_ANIM.frame>=anim.length)AM_ANIM.frame=anim.length-1;
    idx=AM_ANIM.frame;
  }

  var img=anim[idx];
  return (img&&img.complete&&img.naturalWidth>0)?_amTint(img):null;
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
  var _idleReady=_setReady(PRO_ANIM.anims.idle);
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
  // the amateur draws as-is. Each frame keeps its own aspect at the shared height,
  // anchored center-bottom so differing set widths (punch reach) don't shift the body.
  var fightersY=floorY-baseH;

  // ── Pro (left, you) — frame animation, flipped to face right ──
  // Fighters wait for the FULL idle set before appearing: drawing per-frame while it
  // streams makes them flicker as the loop hits undecoded indices, and they'd
  // stand on top of the loading line. One clean reveal instead.
  var proFrame=_idleReady?_getProFrame(dt):null;

  if(proFrame){
    var drawW=Math.round(baseH*(proFrame.naturalWidth/proFrame.naturalHeight));
    cx.save();
    cx.translate(proCX,fightersY);
    cx.scale(-1,1);
    cx.drawImage(proFrame,-Math.round(drawW*0.5),0,drawW,baseH);
    cx.restore();
  }

  // ── Amateur (right, opponent) — same frames as Pro, unflipped (faces left) ──
  var amFrame=_idleReady?_getAmFrame(dt):null;

  if(amFrame){
    var aDrawW=Math.round(baseH*(amFrame.naturalWidth/amFrame.naturalHeight));
    var aDrawY=fightersY;
    // KO pose sits toward the mat — per-skin push down
    if(am.pose==='ko')aDrawY+=Math.round(baseH*SKINCFG.koYOff);
    cx.drawImage(amFrame,amCX-Math.round(aDrawW*0.5),aDrawY,aDrawW,baseH);
  }

  // KO body fading off the mat while the standing idle takes over (see updateSideView)
  if(SIDE._koFade>0){
    SIDE._koFade-=dt;
    var koAnim=_amAnims().ko;
    var koImg=koAnim&&koAnim.length?koAnim[koAnim.length-1]:null;
    if(koImg&&koImg.complete&&koImg.naturalWidth>0){
      koImg=_amTint(koImg);
      var kW=Math.round(baseH*(koImg.naturalWidth/koImg.naturalHeight));
      var kY=fightersY+Math.round(baseH*SKINCFG.koYOff);   // same mat offset as the held ko pose
      cx.save();
      cx.globalAlpha=Math.max(0,SIDE._koFade/0.35);
      cx.drawImage(koImg,amCX-Math.round(kW*0.5),kY,kW,baseH);
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
