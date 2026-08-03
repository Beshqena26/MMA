// =====================================================================
// SPRITE-FIGHTERS v4 — reference-locked sprite boxing (STANDIT black/gold)
// Video-SOURCED, sprite-DELIVERED: every state is a short generated clip
// reduced to aligned WebP frames (locked camera + one shared crop per
// character => no pop between states). NO video plays at runtime.
// Layers: animated arena bg -> opponent -> player gloves -> code fx.
// States: OPPONENT idle/jab/cross/step/final, PLAYER idle/block/hitL/hitR/ko.
// KO: final punch impact -> PLAYER_KO + camera tilt/fall (code transform),
// feeds POV._koT so the existing blackout + KO text layers work untouched.
// =====================================================================
var SF=(function(){
  var A='assets/sprites/';
  var VER='?v=20';  // bump to force-refresh sprites after re-extraction
  var CFG={
    bg:{ dir:A+'bg/', pre:'bg_', n:33, fps:10, pad3:true },   // hand-made ambient arena loop (wrap + crossfade)
    opponent:{
      anchor:{x:0.5,y:0.99},
      // hand-made 30fps idle loop (user's sprite_frames): tight-cropped figure,
      // scale-matched to the action set via s (figure fraction) + gap (bottom gap)
      idle :{dir:A+'opponent/idle/',       pre:'opponent_idle_',       n:97,fps:30, loop:true, wrap:true, pad3:true, s:0.813, gap:0.040, ay:1.0},
      // hand-made 30fps left jab (user frames, same camera as idle): impact
      // measured at max extension; s from figure-height ratio vs idle (595/587)
      jab  :{dir:A+'opponent/jab-left/',   pre:'opponent_jab_left_',   n:20,fps:30, loop:false, pad3:true, impact:9, s:0.824, gap:0.040, ay:1.0},
      // hand-made 30fps left-right combo: TWO measured impacts (left, right)
      combo:{dir:A+'opponent/combo/',      pre:'opponent_combo_',      n:43,fps:30, loop:false, pad3:true, impacts:[13,25], s:0.855, gap:0.040, ay:1.0},
      cross:{dir:A+'opponent/cross-right/',pre:'opponent_cross_right_',n:41,fps:30, loop:false, pad3:true, impact:18, s:0.832, gap:0.040, ay:1.0},
      step :{dir:A+'opponent/step-punch/', pre:'opponent_step_punch_', n:58,fps:30, loop:false, pad3:true, impact:21, s:0.993, gap:0.040, ay:1.0},
      final:{dir:A+'opponent/final-punch/',pre:'opponent_final_punch_',n:88,fps:30, loop:false, pad3:true, impact:28, s:0.997, gap:0.040, ay:1.0}
    },
    player:{
      anchor:{x:0.5,y:1.0},
      // block / hit reactions are CODE TRANSFORMS on the idle footage (same
      // gloves every frame -> no clip-swap glitch at impact); only KO is a clip.
      idle :{dir:A+'player/idle/',     pre:'player_idle_',     n:97,fps:30, loop:true, wrap:true, pad3:true},
      hitA :{dir:A+'player/hit-react/', pre:'player_hita_',     n:20,fps:30, loop:false, pad3:true},
      hitB :{dir:A+'player/hit-react/', pre:'player_hitb_',     n:14,fps:30, loop:false, pad3:true},
      hitC :{dir:A+'player/hit-react/', pre:'player_hitc_',     n:25,fps:30, loop:false, pad3:true},
      ko   :{dir:A+'player/ko/',       pre:'player_ko_',       n:78,fps:30, loop:false, hold:true, pad3:true}
    }
  };
  // priority: a one-shot in flight is only replaced by an equal/higher state;
  // ko/final are terminal for the round and can never be interrupted.
  var PRI={idle:0, jab:2, cross:2, combo:2, step:3, block:3, hitA:4, hitB:4, hitC:4, final:9, ko:9};

  // HALF-RATE DELIVERY: fighter clips ship every 2nd source frame at fps/2 —
  // the inter-frame blend in draw() restores perceived smoothness. Halves
  // both the download (~600→~330 files) and the decoded-RAM footprint. The
  // bg loop is tiny and crossfaded, so it stays full-rate.
  (function decimate(){
    function d(c){ if(!c||!c.dir)return; c.step=2;
      if(c.impact!=null)c.impact=Math.max(1,Math.round(c.impact/2));
      if(c.impacts)c.impacts=c.impacts.map(function(i){return Math.max(1,Math.round(i/2))});
      c.n=Math.ceil(c.n/2); c.fps=c.fps/2; }
    for(var who in CFG){ if(who==='bg')continue;
      for(var name in CFG[who]){ if(name==='anchor')continue; d(CFG[who][name]); } }
  })();

  var frames={bg:{},opponent:{},player:{}}, loaded=0, total=0;
  function loadAnim(bucket,name,c){
    frames[bucket][name]=[];
    for(var i=1;i<=c.n;i++){
      total++;
      var si=c.step?((i-1)*c.step+1):i;   // decimated clip: frame i maps to source frame 1,3,5,…
      var src=c.dir+c.pre+(c.pad3?('00'+si).slice(-3):('0'+si).slice(-2))+'.webp'+VER;
      var im=new Image();
      im.onload=function(){loaded++};
      im.onerror=(function(im,src){return function(){if(!im._r){im._r=1;setTimeout(function(){im.src=src+'&r=1'},1200)}else{loaded++}}})(im,src);
      im.src=src;
      frames[bucket][name].push(im);
    }
  }
  (function init(){
    // PHASE 1 — the playable set: arena loop + both idles (~3MB). The action
    // clips stream in the background once these land, so a slow connection
    // gets a playable scene in seconds instead of racing 600 files at once.
    loadAnim('bg','loop',CFG.bg);
    loadAnim('opponent','idle',CFG.opponent.idle);
    loadAnim('player','idle',CFG.player.idle);
    var p1=total, rest=[], started=false;
    for(var who in CFG){ if(who==='bg')continue;
      for(var name in CFG[who]){ if(name==='anchor'||name==='idle')continue; rest.push([who,name,CFG[who][name]]); } }
    function loadRest(){ if(started)return; started=true; rest.forEach(function(r){loadAnim(r[0],r[1],r[2])}); }
    var iv=setInterval(function(){ if(loaded>=p1){clearInterval(iv);loadRest()} },200);
    setTimeout(function(){clearInterval(iv);loadRest()},10000);  // safety: never hold the actions hostage
  })();

  function mkState(){ return {cur:'idle',frame:0,t:0,once:false,_dir:1}; }
  var opp=mkState(), ply=mkState();
  var sched={atk:0}, fx={flash:0,shake:0,koT:0,reactType:null,reactT:9}, finalFired=false, lastPhase='';
  var bgT=0, bgFrame=0, bgDir=1;

  function setState(who,name,once){
    var st=(who==='opponent')?opp:ply;   // resolve live state object (callers pass 3 args)
    var c=CFG[who][name]; if(!c)return;
    if(st.cur==='ko')return;                                   // KO is never interrupted
    if(st.cur===name&&c.loop)return;
    if(PRI[name]<PRI[st.cur]&&st.once&&!_done(who,st))return;  // don't cut a higher one-shot
    st.cur=name; st.frame=0; st.t=0; st.once=!!once; st._impactDone=false; st._impactIdx=0; st._dir=1;
  }
  function _clip(who,st){ return CFG[who][st.cur]; }
  function _done(who,st){ var c=_clip(who,st); return !c.loop&&st.frame>=c.n-1; }

  function advance(who,st,dt,onImpact){
    var c=_clip(who,st); if(!c)return;
    st.t+=dt;
    var step=1/c.fps;
    while(st.t>=step){
      st.t-=step;
      if(c.loop){
        if(c.wrap){ st.frame=(st.frame+1)%c.n; }        // full-cycle clip: wrap around
        else if(c.n>1){ st.frame+=st._dir;              // few-frame loop: ping-pong
          if(st.frame>=c.n-1){st.frame=c.n-1;st._dir=-1;}
          else if(st.frame<=0){st.frame=0;st._dir=1;} }
      } else if(st.frame<c.n-1){ st.frame++; }
      if(c.impact!=null&&!st._impactDone&&st.frame>=c.impact-1){ st._impactDone=true; if(onImpact)onImpact(st.cur); }
      if(c.impacts){ st._impactIdx=st._impactIdx||0;
        while(st._impactIdx<c.impacts.length&&st.frame>=c.impacts[st._impactIdx]-1){ st._impactIdx++; if(onImpact)onImpact(st.cur); } }
    }
    if(!c.loop&&!c.hold&&st.frame>=c.n-1&&st.t>=step*0.6){ st.cur='idle'; st.frame=0; st.t=0; st.once=false; st._dir=1; }
  }

  // ---------- round-synced state machine ----------
  function update(dt,phase,mult,time){
    dt=Math.min(dt||0.016,0.05);
    if(phase!==lastPhase){
      if(phase==='BETTING'){ opp=mkState(); ply=mkState(); sched.atk=0; finalFired=false; fx.koT=0; }
      lastPhase=phase;
    }
    var onImpact=function(atk){
      // his punch arrives: mostly you block it, sometimes it rocks your guard
      var blocked=Math.random()<0.7;
      var hits=['hitA','hitB','hitC'].filter(function(h){return _clipReady('player',h)});
      if(hits.length)setState('player',hits[(Math.random()*hits.length)|0],true);
      fx.flash=Math.max(fx.flash,0.12); fx.shake=Math.max(fx.shake,blocked?6:9);
      if(typeof G!=='undefined'){G.arenaShake=Math.max(G.arenaShake||0,blocked?5:8);G.crowdRoar=Math.min(1,(G.crowdRoar||0)+0.3);}
      try{if(typeof SND!=='undefined')SND.play('punch',blocked?0.5:0.65)}catch(e){}
    };
    var onFinalImpact=function(){
      setState('player','ko',true);
      fx.flash=0.25; fx.shake=14;
      if(typeof G!=='undefined'){G.arenaShake=12;G.crowdRoar=1;}
      try{if(typeof SND!=='undefined'){SND.play('punch',0.95);SND.play('cheer',0.5)}}catch(e){}
      try{document.body.classList.add('ko-shake');setTimeout(function(){document.body.classList.remove('ko-shake')},650)}catch(e){}
    };

    if(phase==='FREEFALL'){
      if(opp.cur==='idle'&&mult>=1.5){
        if(!sched.atk)sched.atk=time+1.2+Math.random()*1.6;
        if(time>=sched.atk){
          var pool=['jab'];
          if(mult>=3)pool.push('cross','combo');
          if(mult>=6&&Math.random()<0.35)pool.push('step');
          // slow connection: only throw punches whose clip has fully streamed in
          pool=pool.filter(function(p){return _clipReady('opponent',p)});
          if(pool.length)setState('opponent',pool[(Math.random()*pool.length)|0],true);
          sched.atk=time+1.8+Math.random()*2.4;
        }
      }
    } else if(phase==='CRASH'){
      if(!finalFired){ finalFired=true; setState('opponent','final',true); }
      if(ply.cur==='ko')fx.koT+=dt;
      if(typeof G!=='undefined')G.koTimer=(G.koTimer||0)+dt;
      // feed the legacy blackout + KO-text layers (they read POV._koT)
      if(typeof POV!=='undefined'&&ply.cur==='ko')POV._koT=fx.koT;
    }

    advance('opponent',opp,dt,(opp.cur==='final')?onFinalImpact:onImpact);
    advance('player',ply,dt,null);
    bgT+=dt;
    var bstep=1/CFG.bg.fps;
    while(bgT>=bstep){ bgT-=bstep; if(CFG.bg.n>1)bgFrame=(bgFrame+1)%CFG.bg.n; }
    fx.reactT+=dt;
    fx.flash=Math.max(0,fx.flash-dt*2.5);
    fx.shake=Math.max(0,fx.shake*(1-dt*9));
    if(typeof G!=='undefined')G.arenaShake=Math.max(0,(G.arenaShake||0)*(1-dt*8));
  }

  function _ok(im){ return im&&im.complete&&im.naturalWidth>0; }
  // If the exact frame isn't decoded yet (mobile: clips still streaming in
  // mid-fight), fall back to the nearest loaded frame in the clip, then to
  // the last frame we drew — a slightly stale pose beats a vanishing fighter.
  var _lastDrawn={opponent:null,player:null};
  function _img(bucket,st){
    var f=frames[bucket][st.cur]; if(!f)return _lastDrawn[bucket];
    var idx=Math.min(st.frame,f.length-1), im=f[idx];
    if(!_ok(im)){
      im=null;
      for(var i=idx-1;i>=0&&!im;i--){ if(_ok(f[i]))im=f[i]; }
      if(!im)im=_lastDrawn[bucket];
    }
    if(im)_lastDrawn[bucket]=im;
    return im;
  }
  // Next frame + mix weight for the half-rate blend (perceived 30fps from
  // 15fps frames). Returns null when there's nothing valid to blend toward.
  function _blend(bucket,st){
    var c=CFG[bucket][st.cur], f=frames[bucket][st.cur]; if(!c||!f)return null;
    var ni=(c.loop&&c.wrap)?(st.frame+1)%c.n:Math.min(st.frame+1,c.n-1);
    if(ni===st.frame)return null;
    var im=f[ni]; if(!_ok(im))return null;
    return {im:im,mix:Math.min(1,st.t*c.fps)};
  }
  // A clip counts as ready once its last frame is decoded (frames load in order)
  function _clipReady(who,name){ var f=frames[who][name]; return f&&f.length&&_ok(f[f.length-1]); }

  function _drawCover(cx,im,W,H,alpha){
    var a=im.naturalWidth/im.naturalHeight, sA=W/H, dW,dH;
    if(sA>a){dW=W;dH=W/a}else{dH=H;dW=H*a}
    if(alpha!=null){cx.save();cx.globalAlpha=alpha;}
    cx.drawImage(im,(W-dW)/2,(H-dH)/2,dW,dH);
    if(alpha!=null)cx.restore();
  }

  function draw(cx,W,H,time){
    var isMob=W<600;
    var sh=fx.shake, sx=sh?(Math.sin(time*70)*sh):0, sy=sh?(Math.cos(time*61)*sh*0.6):0;
    // KO camera: the whole scene tilts and sinks as your hands drop
    var koE=fx.koT>0?Math.min(1,fx.koT/1.1):0; koE=1-Math.pow(1-koE,3);
    cx.save();
    if(koE>0){ cx.translate(W/2,H/2); cx.rotate(koE*0.07); cx.translate(-W/2,-H/2+koE*H*0.10); }

    // L1: ANIMATED ARENA — crossfade between ambient frames
    var bgf=frames.bg.loop||[];
    var bA=bgf[bgFrame], bB=bgf[(bgFrame+1)%bgf.length];
    if(_ok(bA)){
      _drawCover(cx,bA,W,H,null);
      var mixv=Math.min(1,bgT*CFG.bg.fps);
      if(_ok(bB)&&bB!==bA&&mixv>0.02)_drawCover(cx,bB,W,H,mixv*0.9);
    }
    // L2: OPPONENT — feet on the canvas, centered. Per-clip s/gap/ay let a
    // tight-cropped clip (the 30fps idle) render at the same on-screen size
    // and floor position as the shared-crop action clips.
    var oi=_img('opponent',opp);
    if(oi){
      var oc=_clip('opponent',opp)||{};
      var bodyH=H*(isMob?0.74:0.82);
      var dh=bodyH*(oc.s||1);
      var dw=dh*(oi.naturalWidth/oi.naturalHeight);
      var ax=CFG.opponent.anchor;
      var ayv=(oc.ay!=null)?oc.ay:ax.y;
      var bottomY=H*(isMob?0.93:0.95)-(oc.gap||0)*bodyH;
      var _ox=W*0.5-ax.x*dw+sx,_oy=bottomY-ayv*dh+sy;
      cx.drawImage(oi,_ox,_oy,dw,dh);
      var ob=_blend('opponent',opp);
      if(ob&&ob.im!==oi&&ob.mix>0.02){cx.save();cx.globalAlpha=ob.mix;cx.drawImage(ob.im,_ox,_oy,dw,dh);cx.restore();}
    }
    // L3: PLAYER — full-frame first-person overlay (sprite keeps the source
    // video's framing): width-fit, bottom-anchored, lifted clear of the
    // mobile bet panel. Hands sink out of view on KO.
    var pi=_img('player',ply);
    if(pi){
      var pw=W*(isMob?1.45:1.0);
      var pdh=pw*(pi.naturalHeight/pi.naturalWidth);
      var lift=isMob?H*0.17:-32;   // desktop: hands sit 32px lower
      var py=H-lift-pdh+koE*H*0.45;
      // impact reaction: fast eased pulse on the SAME footage (no clip swap)
      var RD=0.34, ru=fx.reactT/RD, rp=(ru<1)?Math.sin(Math.min(1,ru)*Math.PI):0;
      var rdx=0, rdy=0, rrot=0, rsc=1;
      // positional reaction DISABLED (user: hands must not jump) — impact reads
      // via flash/shake only, until the user's own reaction sprites arrive.
      rp=0;
      cx.save();
      cx.translate(W*0.5+rdx+sx*0.5, H+rdy+sy*0.5);
      if(rrot)cx.rotate(rrot);
      if(rsc!==1)cx.scale(rsc,rsc);
      // Per-hand tuning: the sprite is one image, so draw it in two clipped
      // halves with separate y offsets (mobile: left glove up / right glove
      // down a touch; desktop: right glove down only). During idle the seam
      // at screen center is empty air — but when a movement clip plays a
      // glove can cross the center and the mismatched halves double up, so
      // the offsets ease to 0 for any non-idle clip and ease back in idle.
      var _t=SF._offT||time; SF._offT=time;
      var _dtb=Math.min(0.05,Math.max(0,time-_t));
      var _tgt=(ply.cur==='idle')?1:0;
      if(SF._offMix==null)SF._offMix=1;
      SF._offMix+=(_tgt-SF._offMix)*Math.min(1,_dtb*8);
      var om=SF._offMix;
      var offL=(isMob?-32:0)*om, offR=(isMob?12:80)*om;
      // outward tilt per hand (degrees): left rotates left, right rotates
      // right, pivoting at the bottom of each half where the forearm exits
      var ROT=0*Math.PI/180*om;
      var drawHands=function(im,alpha){
        if(alpha!=null)cx.globalAlpha=alpha;
        if(om<0.02){cx.drawImage(im,-pw*0.5,py-H,pw,pdh);}
        else{
          var half=function(side,off,ang){
            cx.save();cx.beginPath();
            cx.rect(side===0?-pw*0.5:0,-H*2,pw*0.5,H*4);cx.clip();
            var pvx=(side===0)?-pw*0.25:pw*0.25;
            cx.translate(pvx,0);cx.rotate(ang);cx.translate(-pvx,0);
            cx.drawImage(im,-pw*0.5,py-H+off,pw,pdh);
            cx.restore();
          };
          half(0,offL,-ROT);
          half(1,offR,ROT);
        }
        if(alpha!=null)cx.globalAlpha=1;
      };
      drawHands(pi,null);
      var pb=_blend('player',ply);
      if(pb&&pb.im!==pi&&pb.mix>0.02)drawHands(pb.im,pb.mix);
      cx.restore();
    }
    // L4: IMPACT FLASH
    if(fx.flash>0){
      cx.save(); cx.globalAlpha=Math.min(0.5,fx.flash);
      var g=cx.createRadialGradient(W*0.5,H*0.42,0,W*0.5,H*0.42,W*0.14);
      g.addColorStop(0,'rgba(255,240,200,0.9)'); g.addColorStop(0.4,'rgba(230,180,90,0.35)'); g.addColorStop(1,'transparent');
      cx.fillStyle=g; cx.fillRect(0,0,W,H); cx.restore();
    }
    cx.restore();
  }

  function ready(){
    var o=frames.opponent.idle,p=frames.player.idle;
    return o&&_ok(o[0])&&p&&_ok(p[0]);
  }
  function bgReady(){ var b=frames.bg.loop; return b&&_ok(b[0]); }

  return {update:update, draw:draw,
    get ready(){return ready();}, get bgReady(){return bgReady();},
    _dbg:function(){return {opp:opp,ply:ply,loaded:loaded,total:total,koT:fx.koT};}};
})();
