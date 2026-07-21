// =====================================================================
// MMA FRONT SCENE — the pro fighter faces the camera, knees-up shot
// The round is a tension arc driven by the multiplier (2026-07 boss spec):
// below 2x he just breathes; from 2x he feints; from 5x a RARE single
// jab/hook lands on your guard (small shake+thud, multiplier untouched);
// past ~10x the vignette throbs with the heartbeat. The crash is ONE
// slow-mo KO blow -> your gloves drop -> blackout. No blood, no
// celebration. Boxing is the tension metaphor, not a simulator.
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
  anims:{},          // {idle:[Image,...], punch:[...], feint:[...], jab:[...], hook:[...], bg:[...]}
  cur:'idle',
  frame:0,timer:0,
  bgFrame:0,bgTimer:0
};
// Draw config per set — measured from the green-screen clips (figure centered
// at x=960, knee-up body pinned to the canvas bottom y=1080 of 1920x1080).
// s = crop height / frame-0 body height; ax = body center inside the crop;
// ay = the body's bottom edge inside the crop. Filled by extraction metrics.
// ax = MEAN body center across the clip (not frame 0): the full-body boxer
// shifts on his feet inside the union crop, so the mean keeps him wandering
// around screen center instead of parking off to one side.
var POVCFG={
  idle:   {s:1.018,ax:0.511,ay:1.0},
  punch:  {s:1.050,ax:0.611,ay:1.0},
  feint:  {s:1.056,ax:0.438,ay:1.0},
  jab:    {s:1.006,ax:0.465,ay:1.0},
  hook:   {s:1.015,ax:0.402,ay:1.0}
};
// True-speed playback at 10fps sampling density (idle&feint 50/5s, jab&hook
// 40/4s, punch 50/5s). Dense frames keep the inter-frame blend ghost-free.
var POVFPS={idle:10,idleRamp:3,punch:10,feint:10,jab:10,hook:10};
// Static ring bg (boss spec: the background does not move) — no bg frame set.
var POVSETS=[
  {name:'idle', path:'assets/anim3/hero/idle/', prefix:'idle_', count:50},
  {name:'punch',path:'assets/anim3/hero/punch/',prefix:'punch_',count:50},
  {name:'feint',path:'assets/anim3/hero/feint/',prefix:'feint_',count:50},
  {name:'jab',  path:'assets/anim3/hero/jab/',  prefix:'jab_',  count:40},
  {name:'hook', path:'assets/anim3/hero/hook/', prefix:'hook_', count:40}
];
// Clips that play once and hand back to idle (everything except the loops)
var POV_ONESHOT={punch:1,feint:1,jab:1,hook:1};
// The punch clip is one slow-motion KO blow: deliberate wind-up, single full
// extension toward the camera (measured fill peak), slow settle back.
var PUNCH_HITS=[32];
// Mid-round strikes land on YOUR guard: contact frame per clip (measured fill peak)
var STRIKE_HIT={jab:25,hook:13};

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
  POV._hitIdx=0;POV._flashT=0;
  POV._nextAct=null;POV._struck=false;POV._lastStrike=null;
  POV._gloveDipT=0;POV._koT=0;
}
function getTension(m){if(m<=1)return 0;if(m<=1.5)return(m-1)/0.5*0.25;if(m<=3)return 0.25+(m-1.5)/1.5*0.25;if(m<=7)return 0.5+(m-3)/4*0.25;return Math.min(1,0.75+(m-7)/13*0.25)}
function initCrowd(){}

// ── Spine-style animation mixing (KingsMove principle, canvas edition) ──
// Playback runs on fractional time and every draw blends frame i with frame
// i+1 by the fractional part (perceived 60fps from 20-30 source frames), and
// switching clips crossfades the outgoing pose over MIX seconds instead of
// hard-cutting — the same idea as Spine's AnimationState mix.
var MIX=0.26;
function _povSet(name){
  if(POV.cur!==name){
    POV.prev=POV.cur;POV.prevT=POV.t||0;POV.mix=0;
    POV.cur=name;POV.frame=0;POV.timer=0;POV.t=0;
  }
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

function _povFPS(name){
  return (name==='idle')?POVFPS.idle+(G.tension||0)*POVFPS.idleRamp
        :(POVFPS[name]||POVFPS.punch);
}
// Advance playback clocks: fractional frame time for the current clip, and
// the crossfade mix progress toward 1.
function _povTick(dt){
  POV.t=(POV.t||0)+dt*_povFPS(POV.cur);
  if(POV.prev!=null){
    POV.mix+=dt/MIX;
    if(POV.mix>=1){POV.prev=null}
    else POV.prevT+=dt*_povFPS(POV.prev);   // outgoing clip keeps playing while it fades
  }
  // expose integer frame for the game logic (punch contacts, clip-end checks)
  var anim=POV.anims[POV.cur];
  if(anim&&anim.length){
    POV.frame=POV_ONESHOT[POV.cur]?Math.min(anim.length-1,Math.floor(POV.t)):Math.floor(POV.t)%anim.length;
  }
}
// Sample a clip at fractional time t -> {a:frameA,b:frameB,f:blend 0..1}
// Loops play PING-PONG (forward then backward): the wrap from the last frame
// back to frame 0 never happens, so the loop seam can't pop.
function _povSample(name,t){
  var anim=POV.anims[name];
  if(!anim||!anim.length)return null;
  var loop=!POV_ONESHOT[name];
  var i,f,b;
  if(loop){
    var period=2*(anim.length-1);
    var p=t%period,fl=Math.floor(p);f=p-fl;
    var fwd=fl<anim.length-1;
    i=fwd?fl:period-fl;
    b=anim[fwd?i+1:i-1];
  }
  else{
    if(t>=anim.length-1){i=anim.length-1;f=0}
    else{i=Math.floor(t);f=t-i}
    b=anim[Math.min(i+1,anim.length-1)];
  }
  var a=anim[i];
  var ok=function(im){return im&&im.complete&&im.naturalWidth>0};
  if(!ok(a))return null;
  return {a:a,b:ok(b)?b:a,f:f};
}

// ── Update ──
function updateFighters(){
  var dt=G.dt||0.016;
  if(!G.opp)return;

  // New sprite controller takes over state + fx once its frames are ready.
  if(typeof SF!=='undefined'&&SF.ready){ SF.update(dt,G.phase,G.mult||1,G.time||0); return; }

  if(G.phase==='BETTING'){
    G.koTimer=0;POV._hitIdx=0;POV._flashT=0;
    POV._nextAct=null;POV._struck=false;POV._koT=0;POV._gloveDipT=0;
    POV._jabT=0;POV._jabSide=1;POV._nextJab=null;POV._jabHit=false;POV._flinchT=0;
    _povSet('idle');
  }
  else if(G.phase==='EXPLODE'){
    G.bellRing=Math.max(0,(G.bellRing||0)-dt);
    if(G.phaseTimer>1.2&&G.bellRing<=0)G.bellRing=0.5;
  }
  // FREEFALL: the opponent escalates with the multiplier — calm below 2x,
  // feints from 2x, a rare single jab/hook from 5x. Strikes land on YOUR
  // guard: small shake + thud + glove dip, the multiplier is untouched.
  else if(G.phase==='FREEFALL'){
    var m=G.mult||1;
    // YOUR guard fights back: throw jabs through the round, alternating hands.
    // Purely your first-person gloves — the opponent AI above is untouched.
    if(POV._nextJab==null)POV._nextJab=(G.time||0)+1.0+Math.random()*1.4;
    if((G.time||0)>=POV._nextJab&&(POV._jabT||0)<=0){
      POV._jabT=0.24;POV._jabSide=(POV._jabSide===0)?1:0;POV._jabHit=false;
      // a soft whoosh sells the throw without stealing the KO's thunder
      try{var _jc=SND._getCtx();if(_jc&&_jc.state==='running')SND._noiseSweep(_jc.currentTime+0.04,0.13,2000,600,2.4,0.07,0.09)}catch(e){}
      POV._nextJab=(G.time||0)+1.1+Math.random()*1.6;
    }
    if(POV.cur==='feint'||POV.cur==='jab'||POV.cur==='hook'){
      var aAnim=POV.anims[POV.cur];
      // strike contact frame -> the "hit on your guard" beat
      var hitF=STRIKE_HIT[POV.cur];
      if(hitF!=null&&!POV._struck&&POV.frame>=hitF){
        POV._struck=true;
        POV._flashT=0.10;
        POV._gloveDipT=0.35;
        G.arenaShake=5;
        G.crowdRoar=Math.min(1,(G.crowdRoar||0)+0.25);
        if(typeof SND!=='undefined')SND.play('punch',0.55);
      }
      if(aAnim&&POV.frame>=aAnim.length-2)_povSet('idle');
    }
    else if(POV.cur==='idle'&&m>=2){
      if(POV._nextAct==null)POV._nextAct=(G.time||0)+2.5+Math.random()*3;
      if((G.time||0)>=POV._nextAct){
        var strikeOK=m>=5&&_povReady('jab')&&_povReady('hook');
        if(strikeOK&&Math.random()<0.4){
          var st=(POV._lastStrike==='jab')?'hook':'jab';
          POV._lastStrike=st;POV._struck=false;
          _povSet(st);
          POV._nextAct=(G.time||0)+6+Math.random()*6;   // strikes stay rare
        }else if(_povReady('feint')){
          _povSet('feint');
          // one soft whoosh so the feint reads without landing
          try{var _c=SND._getCtx();if(_c&&_c.state==='running')SND._noiseSweep(_c.currentTime+0.15,0.22,1400,350,2.5,0.10,0.15)}catch(e){}
          POV._nextAct=(G.time||0)+4+Math.random()*4;
        }else{
          POV._nextAct=(G.time||0)+2;                    // set not decoded yet, retry soon
        }
      }
    }
  }
  else if(G.phase==='CRASH'){
    // koTimer runs from the instant the multiplier dies — K.O. text and the
    // red flash are immediate; only the blackout waits for the blow (POV._koT)
    G.koTimer+=dt;
    // Start the KO clip 1.4s in: CRASH_WAIT is only ~3s live, and the full
    // wind-up would put the contact frame (32 @10fps = 3.2s) past the reset —
    // the hit, its punch sound and the blackout would never fire.
    if(POV.cur!=='punch'){_povSet('punch');POV.t=14;POV._hitIdx=0}
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
        // the KO blow rattles the whole page, not just the canvas
        if(last){try{document.body.classList.add('ko-shake');setTimeout(function(){document.body.classList.remove('ko-shake')},650)}catch(e){}}
      }
    }
    // After the blow lands: your guard drops and the round fades to black.
    // No celebration — the hit is the whole story (boss spec: hit rare & meaningful).
    if(POV._hitIdx>=PUNCH_HITS.length)POV._koT=(POV._koT||0)+dt;
  }
  // your jab connects at mid-extension: a small flash + the opponent flinches
  if((POV._jabT||0)>0){
    var _ju=1-POV._jabT/0.24;
    if(_ju>=0.5&&!POV._jabHit){POV._jabHit=true;POV._flashT=Math.max(POV._flashT||0,0.07);POV._flinchT=0.20;}
  }
  POV._jabT=Math.max(0,(POV._jabT||0)-dt);
  POV._flinchT=Math.max(0,(POV._flinchT||0)-dt);
  POV._flashT=Math.max(0,(POV._flashT||0)-dt);
  POV._gloveDipT=Math.max(0,(POV._gloveDipT||0)-dt);

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

  // ═══ L1: RING BACKGROUND — static fallback; skipped once the animated
  // sprite bg (SF) is decoded and drawing its own arena frames ═══
  var _sfBg=(typeof SF!=='undefined')&&SF.ready&&SF.bgReady;
  var bgImg=null;
  if(!_sfBg&&IMG.bg&&IMG.bg.complete&&IMG.bg.naturalWidth)bgImg=IMG.bg;
  if(bgImg){
    var bgA=bgImg.naturalWidth/bgImg.naturalHeight,scA=W/H;
    var dW,dH;
    if(scA>bgA){dW=W;dH=W/bgA}else{dH=H;dW=H*bgA}
    cx.drawImage(bgImg,(W-dW)/2,(H-dH)/2,dW,dH);
  }else{
    cx.fillStyle='#060414';cx.fillRect(0,0,W,H);
  }

  // ═══ NEW SPRITE SYSTEM — video-sourced sprites draw the opponent + player
  // gloves (and impact fx) in place of the legacy POV layers below. ═══
  var _useSF=(typeof SF!=='undefined')&&SF.ready;
  if(_useSF){ SF.draw(cx,W,H,time); }

  // ═══ L2: THE FIGHTER — knees-up, faces the camera ═══
  // Spine-style playback: fractional time advances the clip, each draw blends
  // frame i with i+1, and clip switches crossfade over MIX seconds.
  _povTick(dt);
  var heroReady=_povReady('idle');
  // The branded loading screen lifts once he can be drawn, but never before
  // ~2.4s — on fast connections the assets decode in milliseconds and the
  // logo/progress bar would flash away unseen. (index.html force-hides at 6s.)
  if(heroReady&&!POV._loadHidden&&performance.now()>2400){
    POV._loadHidden=true;
    try{var ls=document.getElementById('loadingScreen');if(ls)ls.classList.add('hidden')}catch(e){}
  }
  if(heroReady&&!_useSF){
    // Camera per the boss reference: the boxer is FULL BODY at mid-distance,
    // standing on the ring floor — not the old knees-up close-up.
    var isMob=W<600;
    var bodyH=Math.round(H*(isMob?0.62:0.66));   // mobile: bring the fighter more forward
    var bottomY=Math.round(H*(isMob?0.86:0.90));  // ...and a touch lower/closer
    // flinch: your landed jab snaps his head back — a quick up + shake recoil
    var _fl=POV._flinchT>0?POV._flinchT/0.20:0;
    var flY=-Math.round(bodyH*0.035*_fl);
    var flX=Math.round(Math.sin(time*55)*7*_fl);
    var drawClip=function(name,t,alpha){
      var smp=_povSample(name,t);if(!smp)return;
      var pc=POVCFG[name]||{s:1,ax:0.5,ay:1};
      var drawH=Math.round(bodyH*pc.s);
      var drawW=Math.round(drawH*(smp.a.naturalWidth/smp.a.naturalHeight));
      var x=Math.round(W*0.5-pc.ax*drawW)+flX,y=bottomY-Math.round(pc.ay*drawH)+flY;
      cx.save();
      cx.globalAlpha=alpha;
      cx.drawImage(smp.a,x,y,drawW,drawH);           // base frame, fully weighted
      if(smp.f>0.02){cx.globalAlpha=alpha*smp.f;cx.drawImage(smp.b,x,y,drawW,drawH)} // next frame fades in on top
      cx.restore();
    };
    if(POV.prev!=null){
      var mp=_easeOutCubic(Math.min(1,POV.mix));
      drawClip(POV.prev,POV.prevT,1);                // outgoing clip underneath
      drawClip(POV.cur,POV.t,mp);                    // incoming clip fades in over it
    }else{
      drawClip(POV.cur,POV.t,1);
    }
  }

  // ═══ L2b: MY GLOVES — black boxing gloves anchored in the bottom corners,
  // forearms bleeding off-frame (boss reference), calm idle bob ═══
  var fistW2=W<600?W*0.72:W<900?W*0.46:W*0.44;  // mobile upscaled; bigger = higher knuckle line (boss: "it's down")
  var fistH2=fistW2*0.715;  // 610x436 source aspect
  var idleBobL=Math.sin(time*2)*(W<600?3:5);
  var idleBobR=Math.sin(time*2+1)*(W<600?3:5);
  var fistBottomOffset=(W<600?124:0)+fistH2*0.08;  // mobile: lift above the bet panel; +8% raises the guard a touch
  // a landed strike dips your guard for a beat (first-person head reaction)
  var gDip=(POV._gloveDipT||0)>0?(POV._gloveDipT/0.35)*(W<600?10:15):0;
  // the KO blow drops your guard for good: gloves slide down and out
  var koT2=POV._koT||0;
  var koDrop=koT2>0?_easeOutCubic(Math.min(1,koT2/0.9))*fistH2*1.7:0;
  // Tight guard: gloves near center with forearms bleeding off the bottom
  // corners (boss ref) — closes the old ~0.37W center gap down to ~0.16W.
  var fistLx=W*0.42-fistW2-koDrop*0.25;
  var fistRx=W*0.58+koDrop*0.25;
  var fistBaseY=H-fistH2-fistBottomOffset;
  // active jab extension: 0 -> 1 (peak) -> 0 over the clip (sine ease)
  var jabAmt=(POV._jabT||0)>0?Math.sin((1-POV._jabT/0.24)*Math.PI):0;
  // draw a glove; the jab side lunges up + inward toward the opponent, scaled up
  var drawFist=function(img,x,y,side){
    if(!(img&&img.complete&&img.naturalWidth>0))return;
    var jp=(side===POV._jabSide)?jabAmt:0;
    if(jp<=0.002){cx.drawImage(img,x,y,fistW2,fistH2);return;}
    var sc=1+0.24*jp,w=fistW2*sc,h=fistH2*sc;
    var ny=(y+fistH2)-h-fistH2*0.40*jp;             // keep bottom anchored, grow up + lunge up
    var nx=(side===0)?(x+fistW2*0.28*jp):((x+fistW2)-w-fistW2*0.28*jp); // lunge inward, outer edge anchored
    cx.drawImage(img,nx,ny,w,h);
  };
  if(!_useSF){
    drawFist(IMG.fistL,fistLx,fistBaseY+idleBobL+gDip+koDrop,0);
    drawFist(IMG.fistR,fistRx,fistBaseY+idleBobR+gDip+koDrop*1.15,1);
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

  // ═══ L4a: BLACKOUT — the lights go out after the KO blow (no blood, no
  // celebration: guard down, head down, round over). KO text renders above it.
  if(koT2>0.3){
    var ba=_easeOutCubic(Math.min(1,(koT2-0.3)/0.8))*0.92;
    cx.fillStyle='rgba(0,0,0,'+ba+')';cx.fillRect(0,0,W,H);
  }

  // ═══ L4b: KO DAMAGE VIGNETTE — slams in the INSTANT the multiplier dies,
  // settles, and STAYS (over the blackout) for the whole crash — it only
  // clears when the next-round counter takes over (KingsMove-style) ═══
  var koFlashT=(G.phase==='CRASH')?(G.koTimer||0):0;
  if(koFlashT>0){
    // 0.5 slam -> eases to a sustained 0.32 glow
    var ra=koFlashT<0.5?0.5-(koFlashT/0.5)*0.18:0.32;
    var rg=cx.createRadialGradient(W/2,H/2,H*0.22,W/2,H/2,H*0.95);
    rg.addColorStop(0,'rgba(255,10,40,'+(ra*0.22)+')');
    rg.addColorStop(0.65,'rgba(255,10,40,'+(ra*0.55)+')');
    rg.addColorStop(1,'rgba(180,0,20,'+ra+')');
    cx.fillStyle=rg;cx.fillRect(0,0,W,H);
  }

  // ═══ L5: KO TEXT ═══
  if(G.phase==='CRASH'){
    var koT=G.koTimer||0;
    if(koT>0.03){
      var tp=Math.min(1,(koT-0.03)/0.3),ts=0.5+tp*0.5;
      cx.save();cx.translate(W/2,H*0.4);cx.scale(ts,ts);cx.globalAlpha=tp;
      cx.shadowColor='#ff2222';cx.shadowBlur=30;
      cx.font='bold 80px sans-serif';cx.textAlign='center';cx.textBaseline='middle';
      cx.fillStyle='#ff2222';cx.fillText('K.O.',0,0);
      cx.strokeStyle='rgba(255,255,255,0.3)';cx.lineWidth=2;cx.strokeText('K.O.',0,0);
      cx.shadowBlur=0;
      if(koT>0.6){
        cx.globalAlpha=Math.min(1,(koT-0.6)/0.4);
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
  // 10x+ danger: the vignette throbs at the heartbeat-loop rate (see _tickLoops)
  if(t>0.75)vS+=0.10*Math.max(0,Math.sin(time*Math.PI*2*(1+(t-0.3)*0.7)));
  var vG=cx.createRadialGradient(W/2,H*0.4,H*0.2,W/2,H/2,H*0.85);
  vG.addColorStop(0,'transparent');vG.addColorStop(0.5,'rgba(0,0,0,'+vS*0.15+')');vG.addColorStop(1,'rgba(0,0,0,'+vS+')');
  cx.fillStyle=vG;cx.fillRect(0,0,W,H);

  cx.restore();
  }catch(e){console.error('MMA Render error:',e);try{cx.restore()}catch(e2){}}
}
