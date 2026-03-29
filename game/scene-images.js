// =====================================================================
// MMA FIRST-PERSON SCENE — You ARE the fighter
// Perspective: Your fists at bottom, opponent facing you, crowd behind
// KO: Your foot kicks across screen and knocks out opponent
// =====================================================================

// ── Easing + helpers ──
function _easeOutBack(x){return 1+2.7*Math.pow(x-1,3)+1.7*Math.pow(x-1,2)}
function _easeOutCubic(x){return 1-Math.pow(1-x,3)}
function _easeInOutCubic(x){return x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}
function _easeInBack(x){return 2.7*x*x*x-1.7*x*x}
function _lerp(a,b,t){return a+(b-a)*t}

// ── State ──
function initFighterState(){
  G.opp={health:1,hitFlash:0,staggerX:0,staggerY:0,recoilTimer:0,leanAngle:0,breathCycle:0,blinkTimer:3,blinkAmount:0,flinchTimer:0};
  G.myFists={leftX:0,leftY:0,rightX:0,rightY:0,punchArm:0,punchPhase:'idle',punchTimer:0,punchWindup:0,combo:0};
  G.koKick={active:false,timer:0,footX:0,footY:0};
  G.tension=0;G.koTimer=0;G.koFlash=0;G.bellRing=0;G.arenaShake=0;G.crowdRoar=0;G.crowdRoarSmooth=0;G.fightStarted=false;
  // Keep f1/f2 for compatibility with app.js
  G.f1={x:0,y:0,health:1,punchPhase:'idle',punchTimer:0,punchWindup:0,punchArm:1,kickPhase:'idle',kickTimer:0,kickWindup:0,combo:0,hitFlash:0,staggerX:0,staggerY:0,recoilTimer:0,leanAngle:0,blockTimer:0,blockAmount:0,stanceTimer:0,walkCycle:0,breathCycle:0,blinkTimer:3,blinkAmount:0,weightShift:0,weightTarget:0,stance:0};
  G.f2=G.opp;
}
function getTension(m){if(m<=1)return 0;if(m<=1.5)return(m-1)/0.5*0.25;if(m<=3)return 0.25+(m-1.5)/1.5*0.25;if(m<=7)return 0.5+(m-3)/4*0.25;return Math.min(1,0.75+(m-7)/13*0.25)}
function initCrowd(){G.crowd=[];var n=Math.min(120,Math.floor(cv.width/8));for(var i=0;i<n;i++){G.crowd.push({x:Math.random(),row:i<n*0.4?1:0,phase:Math.random()*6.28,speed:0.5+Math.random()*2.5,height:0.7+Math.random()*0.4,hue:Math.floor(Math.random()*360),_armRaise:0})}}

// ── Update (first-person fight logic) ──
function updateFighters(){
  var dt=G.dt||0.016,t=G.tension,opp=G.opp,fists=G.myFists;
  if(!opp||!fists)return;
  var W=cv.width,H=cv.height,time=G.time||0;

  // Opponent breathing
  opp.breathCycle+=(dt||0.016)*2.8;
  // Blink
  opp.blinkTimer-=dt;if(opp.blinkTimer<=0){opp.blinkAmount=1;opp.blinkTimer=2.5+Math.random()*4}
  if(opp.blinkAmount>0)opp.blinkAmount=Math.max(0,opp.blinkAmount-dt*8);
  // Hit reaction decay
  if(opp.recoilTimer>0){opp.recoilTimer-=dt;opp.staggerX*=(1-dt*5);opp.staggerY*=(1-dt*6)}else{opp.staggerX*=(1-dt*8);opp.staggerY*=(1-dt*8)}
  opp.hitFlash=Math.max(0,opp.hitFlash-dt*2.5);
  opp.leanAngle=_lerp(opp.leanAngle,0,dt*4);
  opp.flinchTimer=Math.max(0,(opp.flinchTimer||0)-dt*3);

  // Punch phase update
  if(fists.punchPhase!=='idle'){
    fists.punchTimer-=dt;
    if(fists.punchPhase==='windup'){fists.punchWindup=Math.min(1,fists.punchWindup+dt*14);if(fists.punchTimer<=0){fists.punchPhase='extend';fists.punchTimer=0.08}}
    else if(fists.punchPhase==='extend'){fists.punchWindup=0;if(fists.punchTimer<=0){fists.punchPhase='hold';fists.punchTimer=0.04}}
    else if(fists.punchPhase==='hold'){if(fists.punchTimer<=0){fists.punchPhase='retract';fists.punchTimer=0.15}}
    else if(fists.punchPhase==='retract'){if(fists.punchTimer<=0){fists.punchPhase='idle';fists.punchTimer=0}}
  }

  // KO kick update
  if(G.koKick.active){G.koKick.timer+=dt}

  // ── Phase logic ──
  if(G.phase==='BETTING'){
    opp.health=1;opp.hitFlash=0;opp.staggerX=0;opp.staggerY=0;opp.leanAngle=0;opp.flinchTimer=0;
    fists.punchPhase='idle';fists.combo=0;
    G.koKick.active=false;G.koKick.timer=0;G.koTimer=0;
  }
  else if(G.phase==='EXPLODE'){
    G.bellRing=Math.max(0,(G.bellRing||0)-dt);
    if(G.phaseTimer>1.2&&G.bellRing<=0)G.bellRing=0.5;
  }
  else if(G.phase==='FREEFALL'){
    G.fightStarted=true;
    // Schedule punches from player (your fists)
    if(!fists._stanceTimer)fists._stanceTimer=0;
    fists._stanceTimer-=dt;
    var punchInterval=Math.max(0.18,0.85-t*0.6);

    if(fists._stanceTimer<=0&&fists.punchPhase==='idle'){
      if(Math.random()<0.7){
        // Throw punch
        fists.punchPhase='windup';fists.punchTimer=0.06;fists.punchWindup=0;
        fists.combo=Math.min(6,fists.combo+1);
        fists.punchArm=fists.combo%2===0?1:-1; // alternate left/right
        fists._stanceTimer=punchInterval*(0.5+Math.random()*0.6);
        // Delayed impact on opponent
        setTimeout(function(){
          opp.hitFlash=0.35;opp.recoilTimer=0.25;
          opp.staggerX=(Math.random()-0.5)*12;
          opp.staggerY=-3-Math.random()*4;
          opp.leanAngle=(Math.random()-0.5)*0.15;
          opp.flinchTimer=0.3;
          opp.health=Math.max(0,opp.health-(0.005+t*0.018));
          G.arenaShake=Math.max(G.arenaShake,1+t*3);
          G.crowdRoar=Math.min(1,G.crowdRoar+0.12);
          spawnParticles(W*0.5+opp.staggerX*3,H*0.35,t>0.5?'fire':'gold',Math.floor(2+t*6));
        },100);
      }else{
        fists._stanceTimer=punchInterval*(0.7+Math.random());
        fists.combo=0;
      }
    }
    // Health pressure
    if(t>0.75)opp.health=Math.max(0,opp.health-dt*0.02*(t-0.5));
  }
  else if(G.phase==='CRASH'){
    // KO — activate kick
    G.koTimer+=dt;
    if(G.koTimer<0.05&&!G.koKick.active){
      G.koKick.active=true;G.koKick.timer=0;
      G.koFlash=1;G.arenaShake=18;G.crowdRoar=1;
    }
    G.koFlash=Math.max(0,G.koFlash-dt*1.5);
    // Opponent falls
    var fp=_easeOutCubic(Math.min(1,G.koTimer/0.8));
    opp.leanAngle=_lerp(0,0.5,fp);
    opp.staggerY=_lerp(0,80,fp);
    opp.health=Math.max(0,1-fp*3);
  }

  // Global decays
  G.arenaShake=Math.max(0,G.arenaShake*(1-dt*8));
  G.crowdRoar=Math.max(0,G.crowdRoar-dt*0.4);
  G.crowdRoarSmooth=_lerp(G.crowdRoarSmooth||0,G.crowdRoar,dt*5);
  if(G.arenaShake>0.3)G.camera.shake=Math.max(G.camera.shake,G.arenaShake*0.6);
  // Compat
  if(G.f1)G.f1.health=1;
  if(G.f2){G.f2.health=opp.health;G.f2.punchPhase=fists.punchPhase}
}

// ══════════════════════════════════════════════════════════════
// PRE-RENDER HELPERS
// ══════════════════════════════════════════════════════════════
var SCENE={ready:false,images:{},_lastW:0,_lastH:0};
function _oc(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return{c:c,x:c.getContext('2d')}}
function _dHex(hex,amt){hex=hex.replace('#','');var r=Math.max(0,parseInt(hex.substr(0,2),16)-amt),g=Math.max(0,parseInt(hex.substr(2,2),16)-amt),b=Math.max(0,parseInt(hex.substr(4,2),16)-amt);return'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function _blur(canvas,ctx2,radius){var w=canvas.width,h=canvas.height,s=Math.max(1,Math.floor(radius)),sw=Math.max(1,Math.floor(w/s)),sh=Math.max(1,Math.floor(h/s));var tmp=document.createElement('canvas');tmp.width=sw;tmp.height=sh;tmp.getContext('2d').drawImage(canvas,0,0,sw,sh);ctx2.clearRect(0,0,w,h);ctx2.drawImage(tmp,0,0,w,h)}

// ── Background (dark arena + lights) ──
function genBG(W,H){
  var o=_oc(W,H),c=o.x;
  var bg=c.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#020108');bg.addColorStop(0.1,'#050312');bg.addColorStop(0.3,'#0a061e');bg.addColorStop(0.6,'#0c0822');bg.addColorStop(1,'#040210');
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  // Ceiling
  c.fillStyle='#010106';c.fillRect(0,0,W,H*0.05);
  var cG=c.createLinearGradient(0,0,0,H*0.12);cG.addColorStop(0,'rgba(1,1,6,0.95)');cG.addColorStop(1,'transparent');c.fillStyle=cG;c.fillRect(0,0,W,H*0.12);
  // Arena lights
  var lc=Math.max(5,Math.floor(W/110));
  for(var i=0;i<lc;i++){var lx=W*(0.08+i*0.84/(lc-1)),ly=H*0.018;c.fillStyle='rgba(255,252,245,0.85)';c.beginPath();c.arc(lx,ly,3,0,Math.PI*2);c.fill();c.fillStyle='rgba(220,230,255,0.4)';c.beginPath();c.arc(lx,ly,7,0,Math.PI*2);c.fill();var fg=c.createRadialGradient(lx,ly,0,lx,ly,H*0.12);fg.addColorStop(0,'rgba(200,220,255,0.1)');fg.addColorStop(1,'transparent');c.fillStyle=fg;c.beginPath();c.arc(lx,ly,H*0.12,0,Math.PI*2);c.fill();c.save();c.globalAlpha=0.015;c.beginPath();c.moveTo(lx-3,ly+3);c.lineTo(lx-W*0.03,H*0.5);c.lineTo(lx+W*0.03,H*0.5);c.lineTo(lx+3,ly+3);c.closePath();var bG=c.createLinearGradient(lx,ly,lx,H*0.45);bG.addColorStop(0,'rgba(200,220,255,1)');bG.addColorStop(1,'transparent');c.fillStyle=bG;c.fill();c.restore()}
  // Center spotlight on opponent
  c.save();c.globalAlpha=0.06;var sp=c.createRadialGradient(W*0.5,H*0.3,0,W*0.5,H*0.35,H*0.5);sp.addColorStop(0,'rgba(255,250,230,1)');sp.addColorStop(0.5,'rgba(200,200,180,0.3)');sp.addColorStop(1,'transparent');c.fillStyle=sp;c.fillRect(0,0,W,H);c.restore();
  // Haze
  c.globalAlpha=0.03;var hz=c.createRadialGradient(W/2,H*0.35,0,W/2,H*0.4,H*0.6);hz.addColorStop(0,'rgba(140,120,200,1)');hz.addColorStop(1,'transparent');c.fillStyle=hz;c.fillRect(0,0,W,H);c.globalAlpha=1;
  return o.c;
}

// ── Crowd (behind opponent, blurred) ──
function genCrowd(W,H){
  var o=_oc(W,Math.ceil(H*0.35)),c=o.x;
  var shirts=['#c62828','#d32f2f','#b71c1c','#1565c0','#1976d2','#0d47a1','#2e7d32','#f57f17','#4a148c','#37474f','#e0e0e0','#fff'];
  var skins=['#d4a574','#c68642','#8d5524','#e0ac69','#f1c27d','#6b4423'];
  var rH=o.c.height,count=Math.floor(W/8),baseY=rH*0.9;
  // Two rows
  for(var row=0;row<2;row++){
    var sc=row===0?1.0:1.6,al=row===0?0.25:0.45;
    var rowY=row===0?baseY*0.5:baseY;
    for(var i=0;i<count;i++){
      var px=(i/count)*W+(Math.random()-0.5)*5;
      var bw=3.5*sc+Math.random()*2*sc,bh=7*sc+Math.random()*3*sc;
      var shirt=shirts[Math.floor(Math.random()*shirts.length)];
      var skin=skins[Math.floor(Math.random()*skins.length)];
      var hr=2.5*sc;
      c.globalAlpha=al;
      // Body
      c.fillStyle=shirt;c.beginPath();c.ellipse(px,rowY-bh*0.3,bw,bh*0.4,0,0,Math.PI*2);c.fill();
      // Head
      c.fillStyle=skin;c.beginPath();c.arc(px,rowY-bh-hr,hr,0,Math.PI*2);c.fill();
      // Hair
      c.fillStyle=Math.random()<0.5?'#0e0a05':shirts[Math.floor(Math.random()*shirts.length)];
      c.beginPath();c.arc(px,rowY-bh-hr-1,hr*0.85,Math.PI,0);c.fill();
      // Foam finger (rare)
      if(Math.random()<0.04){c.fillStyle=Math.random()<0.5?'#22c55e':'#ef4444';c.beginPath();c.moveTo(px-sc,rowY-bh+sc*2);c.lineTo(px,rowY-bh-sc*4);c.lineTo(px+sc,rowY-bh+sc*2);c.closePath();c.fill()}
    }
  }
  c.globalAlpha=1;
  _blur(o.c,c,2.5);
  return o.c;
}

// ── Opponent (large, facing camera) ──
function genOpponent(w,h){
  var o=_oc(w,h),c=o.x;
  var cx2=w/2,s=Math.min(w,h)/120;
  var skB='#c8956c',skD='#a07050',skL='#daa882';

  // ── TORSO (fills most of lower half, V-taper, facing camera) ──
  var torsoTop=h*0.32,torsoBot=h*0.95;
  var shoulderW=38*s,waistW=28*s;
  var tG=c.createLinearGradient(cx2-shoulderW,0,cx2+shoulderW,0);
  tG.addColorStop(0,skD);tG.addColorStop(0.15,skL);tG.addColorStop(0.4,skB);tG.addColorStop(0.6,skB);tG.addColorStop(0.85,skD);tG.addColorStop(1,'#704830');
  c.fillStyle=tG;
  c.beginPath();
  c.moveTo(cx2-shoulderW,torsoTop);
  c.quadraticCurveTo(cx2-shoulderW-5*s,torsoTop+(torsoBot-torsoTop)*0.5,cx2-waistW,torsoBot);
  c.lineTo(cx2+waistW,torsoBot);
  c.quadraticCurveTo(cx2+shoulderW+5*s,torsoTop+(torsoBot-torsoTop)*0.5,cx2+shoulderW,torsoTop);
  c.quadraticCurveTo(cx2,torsoTop-10*s,cx2-shoulderW,torsoTop);
  c.fill();

  // Pecs
  c.fillStyle=skD;c.globalAlpha=0.1;
  c.beginPath();c.ellipse(cx2-14*s,torsoTop+18*s,14*s,9*s,-0.1,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(cx2+14*s,torsoTop+18*s,14*s,9*s,0.1,0,Math.PI*2);c.fill();
  c.globalAlpha=1;
  // Pec highlights
  c.fillStyle=skL;c.globalAlpha=0.08;
  c.beginPath();c.ellipse(cx2-14*s,torsoTop+14*s,8*s,5*s,0,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(cx2+14*s,torsoTop+14*s,8*s,5*s,0,0,Math.PI*2);c.fill();
  c.globalAlpha=1;

  // Abs
  c.strokeStyle=skD;c.globalAlpha=0.08;c.lineWidth=0.6*s;
  c.beginPath();c.moveTo(cx2,torsoTop+28*s);c.lineTo(cx2,torsoBot-10*s);c.stroke();
  for(var ai=0;ai<3;ai++){var ay=torsoTop+32*s+ai*10*s;c.beginPath();c.moveTo(cx2-12*s,ay);c.quadraticCurveTo(cx2,ay+s,cx2+12*s,ay);c.stroke()}
  c.globalAlpha=1;

  // Deltoids (big, because facing camera = wide shoulders)
  c.fillStyle=skB;
  c.beginPath();c.ellipse(cx2-shoulderW-4*s,torsoTop+6*s,12*s,10*s,-0.15,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(cx2+shoulderW+4*s,torsoTop+6*s,12*s,10*s,0.15,0,Math.PI*2);c.fill();
  // Delt highlights
  c.fillStyle=skL;c.globalAlpha=0.1;
  c.beginPath();c.ellipse(cx2-shoulderW-4*s,torsoTop+3*s,6*s,5*s,0,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(cx2+shoulderW+4*s,torsoTop+3*s,6*s,5*s,0,0,Math.PI*2);c.fill();
  c.globalAlpha=1;

  // Neck (thick)
  c.fillStyle=skB;c.fillRect(cx2-8*s,torsoTop-12*s,16*s,16*s);
  c.fillStyle=skD;c.globalAlpha=0.05;
  c.beginPath();c.moveTo(cx2-6*s,torsoTop);c.lineTo(cx2-shoulderW,torsoTop+4*s);c.lineTo(cx2-shoulderW,torsoTop);c.fill();
  c.beginPath();c.moveTo(cx2+6*s,torsoTop);c.lineTo(cx2+shoulderW,torsoTop+4*s);c.lineTo(cx2+shoulderW,torsoTop);c.fill();
  c.globalAlpha=1;

  // ── HEAD (large, facing camera directly) ──
  var headR=22*s,headY=torsoTop-22*s;
  var hG=c.createRadialGradient(cx2-4*s,headY-4*s,headR*0.2,cx2,headY,headR);
  hG.addColorStop(0,skL);hG.addColorStop(0.45,skB);hG.addColorStop(1,skD);
  c.fillStyle=hG;c.beginPath();c.ellipse(cx2,headY,headR*0.92,headR,0,0,Math.PI*2);c.fill();

  // Jaw
  c.fillStyle=skD;c.globalAlpha=0.06;
  c.beginPath();c.ellipse(cx2,headY+headR*0.45,headR*0.65,headR*0.45,0,0,Math.PI);c.fill();
  c.globalAlpha=1;

  // Short hair
  c.fillStyle='#1a1008';
  c.beginPath();c.arc(cx2,headY-3*s,headR*0.88,Math.PI*1.05,-Math.PI*0.05);c.fill();
  // Fade sides
  c.fillStyle='#0e0a05';
  c.beginPath();c.ellipse(cx2-headR*0.65,headY-4*s,headR*0.28,headR*0.55,0.1,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(cx2+headR*0.65,headY-4*s,headR*0.28,headR*0.55,-0.1,0,Math.PI*2);c.fill();

  // Ears
  c.fillStyle=skB;
  c.beginPath();c.ellipse(cx2-headR*0.9,headY,4*s,6*s,0,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(cx2+headR*0.9,headY,4*s,6*s,0,0,Math.PI*2);c.fill();

  // Brow ridge
  c.fillStyle=skD;c.globalAlpha=0.08;
  c.beginPath();c.ellipse(cx2,headY-6*s,headR*0.7,4*s,0,0,Math.PI);c.fill();
  c.globalAlpha=1;

  // Eyes (large, intense, staring at YOU)
  var eyeW=6*s,eyeH=4*s;
  c.fillStyle='#f0ede8';
  c.beginPath();c.ellipse(cx2-8*s,headY-2*s,eyeW,eyeH,0,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(cx2+8*s,headY-2*s,eyeW,eyeH,0,0,Math.PI*2);c.fill();
  // Iris
  c.fillStyle='#3a2a18';
  c.beginPath();c.arc(cx2-8*s,headY-2*s,3.5*s,0,Math.PI*2);c.fill();
  c.beginPath();c.arc(cx2+8*s,headY-2*s,3.5*s,0,Math.PI*2);c.fill();
  // Pupils
  c.fillStyle='#0a0a0a';
  c.beginPath();c.arc(cx2-8*s,headY-2*s,1.8*s,0,Math.PI*2);c.fill();
  c.beginPath();c.arc(cx2+8*s,headY-2*s,1.8*s,0,Math.PI*2);c.fill();
  // Catchlights
  c.fillStyle='rgba(255,255,255,0.45)';
  c.beginPath();c.arc(cx2-7*s,headY-3.5*s,1*s,0,Math.PI*2);c.fill();
  c.beginPath();c.arc(cx2+9*s,headY-3.5*s,1*s,0,Math.PI*2);c.fill();
  // Eyelids
  c.strokeStyle=skD;c.lineWidth=s;
  c.beginPath();c.ellipse(cx2-8*s,headY-2*s,eyeW,eyeH,0,Math.PI*1.05,Math.PI*1.95);c.stroke();
  c.beginPath();c.ellipse(cx2+8*s,headY-2*s,eyeW,eyeH,0,Math.PI*1.05,Math.PI*1.95);c.stroke();

  // Eyebrows (angry/intense)
  c.strokeStyle='#1a1008';c.lineWidth=2.5*s;c.lineCap='round';
  c.beginPath();c.moveTo(cx2-16*s,headY-7*s);c.quadraticCurveTo(cx2-8*s,headY-10*s,cx2-2*s,headY-7*s);c.stroke();
  c.beginPath();c.moveTo(cx2+2*s,headY-7*s);c.quadraticCurveTo(cx2+8*s,headY-10*s,cx2+16*s,headY-7*s);c.stroke();

  // Nose
  c.strokeStyle=skD;c.lineWidth=1.2*s;
  c.beginPath();c.moveTo(cx2,headY+1*s);c.quadraticCurveTo(cx2+2*s,headY+7*s,cx2,headY+8*s);c.stroke();
  // Nostrils
  c.fillStyle=skD;c.globalAlpha=0.2;
  c.beginPath();c.arc(cx2-2.5*s,headY+8*s,1.2*s,0,Math.PI*2);c.fill();
  c.beginPath();c.arc(cx2+2.5*s,headY+8*s,1.2*s,0,Math.PI*2);c.fill();
  c.globalAlpha=1;

  // Mouth (determined, slightly open)
  c.strokeStyle='#5a3828';c.lineWidth=1.2*s;
  c.beginPath();c.moveTo(cx2-6*s,headY+13*s);c.quadraticCurveTo(cx2,headY+14*s,cx2+6*s,headY+13*s);c.stroke();

  // Stubble
  c.fillStyle=skD;c.globalAlpha=0.04;
  c.beginPath();c.ellipse(cx2,headY+11*s,headR*0.45,headR*0.3,0,0,Math.PI);c.fill();
  c.globalAlpha=1;

  // MMA shorts waistband hint at bottom
  c.fillStyle='#8a1a1a';
  c.fillRect(cx2-waistW,torsoBot-3*s,waistW*2,h-torsoBot+3*s);
  c.fillStyle='rgba(255,255,255,0.2)';
  c.fillRect(cx2-waistW,torsoBot-3*s,waistW*2,2.5*s);

  // Rim light
  c.save();c.globalAlpha=0.05;c.strokeStyle='#aaccff';c.lineWidth=3*s;
  c.beginPath();c.ellipse(cx2,torsoTop+20*s,shoulderW+8*s,50*s,0,Math.PI*1.25,Math.PI*1.75);c.stroke();
  c.restore();

  return o.c;
}

// ── Player fist (close-up, at bottom of screen) ──
function genFist(w,h,isLeft){
  var o=_oc(w,h),c=o.x;
  var cx2=w/2,cy2=h*0.5,s=Math.min(w,h)/60;
  var skB='#c08060',skD='#905840',skL='#d8a080';
  var glove='#aa2222',gloveD='#882020',gloveL='#cc3030';

  // Forearm coming from bottom
  var armG=c.createLinearGradient(cx2-12*s,0,cx2+12*s,0);
  armG.addColorStop(0,skD);armG.addColorStop(0.3,skL);armG.addColorStop(0.5,skB);armG.addColorStop(0.7,skB);armG.addColorStop(1,skD);
  c.fillStyle=armG;
  c.beginPath();
  c.moveTo(cx2-10*s,h);c.lineTo(cx2-12*s,cy2+10*s);
  c.quadraticCurveTo(cx2-13*s,cy2,cx2-10*s,cy2-5*s);
  c.lineTo(cx2+10*s,cy2-5*s);
  c.quadraticCurveTo(cx2+13*s,cy2,cx2+12*s,cy2+10*s);
  c.lineTo(cx2+10*s,h);
  c.fill();

  // Wrist wrap
  c.fillStyle='rgba(255,255,255,0.2)';
  c.fillRect(cx2-11*s,cy2+5*s,22*s,4*s);

  // Glove (big fist)
  var gG=c.createRadialGradient(cx2-3*s,cy2-10*s,0,cx2,cy2-5*s,18*s);
  gG.addColorStop(0,gloveL);gG.addColorStop(0.5,glove);gG.addColorStop(1,gloveD);
  c.fillStyle=gG;
  c.beginPath();
  c.ellipse(cx2,cy2-8*s,16*s,14*s,0,0,Math.PI*2);
  c.fill();

  // Knuckle bumps
  c.fillStyle=gloveL;c.globalAlpha=0.2;
  for(var ki=0;ki<4;ki++){
    c.beginPath();c.arc(cx2-9*s+ki*6*s,cy2-18*s,2.5*s,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;

  // Glove wrap lines
  c.strokeStyle='rgba(255,255,255,0.1)';c.lineWidth=0.6*s;
  c.beginPath();c.ellipse(cx2,cy2-8*s,13*s,11*s,0,0.5,2.5);c.stroke();
  c.beginPath();c.ellipse(cx2,cy2-8*s,14*s,12*s,0,0.8,2.2);c.stroke();

  // Thumb
  c.fillStyle=glove;
  c.beginPath();
  c.ellipse(isLeft?cx2+14*s:cx2-14*s,cy2-4*s,4*s,7*s,isLeft?0.3:-0.3,0,Math.PI*2);
  c.fill();

  // Highlight
  c.fillStyle='rgba(255,255,255,0.12)';
  c.beginPath();c.ellipse(cx2+3*s,cy2-14*s,8*s,5*s,-0.2,0,Math.PI*2);c.fill();

  return o.c;
}

// ── KO Foot (comes from bottom of screen) ──
function genFoot(w,h){
  var o=_oc(w,h),c=o.x;
  var cx2=w/2,cy2=h*0.45,s=Math.min(w,h)/80;
  var skB='#c08060',skD='#905840',skL='#d8a080';

  // Leg/shin coming from bottom-right
  c.fillStyle=skB;c.lineWidth=14*s;c.lineCap='round';
  c.strokeStyle=skB;
  c.beginPath();c.moveTo(w,h*1.2);c.quadraticCurveTo(w*0.7,h*0.7,cx2+5*s,cy2+15*s);c.stroke();

  // Shin guard
  c.strokeStyle='#1a1a1a';c.lineWidth=10*s;
  c.beginPath();c.moveTo(w*0.8,h*0.85);c.quadraticCurveTo(w*0.6,h*0.6,cx2+8*s,cy2+18*s);c.stroke();

  // Foot (sole facing opponent)
  var footG=c.createRadialGradient(cx2,cy2,0,cx2,cy2,22*s);
  footG.addColorStop(0,skL);footG.addColorStop(0.5,skB);footG.addColorStop(1,skD);
  c.fillStyle=footG;
  c.beginPath();
  c.ellipse(cx2,cy2,20*s,16*s,0.15,0,Math.PI*2);
  c.fill();

  // Sole
  c.fillStyle=skD;c.globalAlpha=0.15;
  c.beginPath();c.ellipse(cx2+2*s,cy2+2*s,16*s,12*s,0.15,0,Math.PI*2);c.fill();
  c.globalAlpha=1;

  // Toes
  c.fillStyle=skB;
  for(var ti=0;ti<5;ti++){
    var ta=-0.3+ti*0.15;
    var tx=cx2-12*s+ti*5.5*s,ty=cy2-12*s+Math.abs(ti-2)*2*s;
    c.beginPath();c.ellipse(tx,ty,2.5*s,3.5*s,ta,0,Math.PI*2);c.fill();
  }

  // Impact lines
  c.strokeStyle='rgba(255,200,50,0.4)';c.lineWidth=2*s;
  for(var li=0;li<6;li++){
    var la=li/6*Math.PI*2;
    c.beginPath();
    c.moveTo(cx2+Math.cos(la)*22*s,cy2+Math.sin(la)*18*s);
    c.lineTo(cx2+Math.cos(la)*35*s,cy2+Math.sin(la)*28*s);
    c.stroke();
  }

  return o.c;
}

// ══════════════════════════════════════════════════════════════
// RENDER — First person perspective
// ══════════════════════════════════════════════════════════════
function render(){
  try{
  if(!cv||!cx)return;var W=cv.width,H=cv.height;if(!W||!H)return;
  // Generate images
  if(!SCENE.ready||SCENE._lastW!==W||SCENE._lastH!==H){
    SCENE.images.bg=genBG(W,H);
    SCENE.images.crowd=genCrowd(W,H);
    SCENE.images.opponent=genOpponent(Math.floor(W*0.7),Math.floor(H*0.8));
    SCENE.images.fistL=genFist(Math.floor(W*0.3),Math.floor(H*0.45),true);
    SCENE.images.fistR=genFist(Math.floor(W*0.3),Math.floor(H*0.45),false);
    SCENE.images.foot=genFoot(Math.floor(W*0.6),Math.floor(H*0.6));
    SCENE.ready=true;SCENE._lastW=W;SCENE._lastH=H;
  }
  if(!G.opp){try{initFighterState()}catch(e){}}
  if(!G.crowd||!G.crowd.length){try{initCrowd()}catch(e){}}
  cx.clearRect(0,0,W,H);cx.save();
  var cam=G.camera||{};
  if((cam.shake||0)>0.1)cx.translate((Math.random()-0.5)*cam.shake,(Math.random()-0.5)*cam.shake);
  var z=cam.zoom||1;if(z!==1){var zx=cam.zoomX||W*0.5,zy=cam.zoomY||H*0.45;cx.translate(zx,zy);cx.scale(z,z);cx.translate(-zx,-zy)}
  var t=G.tension=getTension(G.mult||1);
  var opp=G.opp||{},fists=G.myFists||{};
  var time=G.time||0;

  // L1: Background
  cx.drawImage(SCENE.images.bg,0,0);

  // L2: Crowd (behind opponent)
  var cBob=Math.sin(time*1.5)*(1+(G.crowdRoarSmooth||0)*5);
  cx.drawImage(SCENE.images.crowd,0,H*0.02+cBob);

  // L3: Opponent (centered, large, slight sway)
  cx.save();
  var oppW=W*0.7,oppH=H*0.8;
  var oppX=W*0.5-oppW/2+(opp.staggerX||0);
  var oppY=H*0.12+(opp.staggerY||0)+Math.sin((opp.breathCycle||0))*3;
  // Lean from hits
  if(opp.leanAngle){cx.translate(W*0.5,H*0.5);cx.rotate(opp.leanAngle);cx.translate(-W*0.5,-H*0.5)}
  // Flinch (close eyes, pull back slightly)
  var flinch=opp.flinchTimer||0;
  if(flinch>0){oppY+=flinch*15;oppX+=(Math.random()-0.5)*flinch*8}
  cx.drawImage(SCENE.images.opponent,oppX,oppY,oppW,oppH);
  // Hit flash white overlay
  if((opp.hitFlash||0)>0){
    cx.globalAlpha=opp.hitFlash*0.35;cx.fillStyle='#fff';
    cx.fillRect(oppX,oppY,oppW,oppH);
    cx.globalAlpha=1;
  }
  cx.restore();

  // L4: Health bar (opponent only, at top)
  if(G.phase!=='BETTING'&&G.phase!=='WAITING'&&G.phase!=='INIT'){
    var bW=Math.min(300,W*0.35),bH=12,bY=H*0.04;
    var bX=W*0.5-bW/2;
    cx.fillStyle='rgba(0,0,0,0.5)';cx.fillRect(bX-1,bY-1,bW+2,bH+2);
    var hp=Math.max(0,Math.min(1,opp.health||1));
    var hpG=cx.createLinearGradient(bX,0,bX+bW*hp,0);
    hpG.addColorStop(0,hp>0.5?'#22aa44':hp>0.25?'#cc8800':'#cc2222');
    hpG.addColorStop(1,hp>0.5?'#44dd66':hp>0.25?'#ffaa00':'#ff4444');
    cx.fillStyle=hpG;cx.fillRect(bX,bY,bW*hp,bH);
    cx.fillStyle='#fff';cx.font='bold 11px sans-serif';cx.textAlign='center';
    cx.fillText('OPPONENT',W*0.5,bY-3);
  }

  // L5: Your fists (at bottom of screen)
  if(G.phase!=='CRASH'){
    var fistW=W*0.3,fistH=H*0.45;
    var baseLeftX=W*0.08,baseRightX=W*0.62;
    var baseY2=H*0.62;
    var idleBob=Math.sin(time*2)*4;
    var idleBob2=Math.sin(time*2+1)*4;

    // Punch extension
    var leftExt=0,rightExt=0;
    if(fists.punchPhase==='windup'){
      var wb=fists.punchWindup||0;
      if(fists.punchArm===-1)leftExt=-15*wb;else rightExt=-15*wb; // pull back
    }else if(fists.punchPhase==='extend'||fists.punchPhase==='hold'){
      if(fists.punchArm===-1){leftExt=-H*0.25;baseLeftX+=W*0.12}
      else{rightExt=-H*0.25;baseRightX-=W*0.12}
    }else if(fists.punchPhase==='retract'){
      var rp=fists.punchTimer/0.15;
      if(fists.punchArm===-1)leftExt=-H*0.25*(rp);
      else rightExt=-H*0.25*(rp);
    }

    // Left fist
    cx.drawImage(SCENE.images.fistL,baseLeftX,baseY2+idleBob+leftExt,fistW,fistH);
    // Right fist
    cx.drawImage(SCENE.images.fistR,baseRightX,baseY2+idleBob2+rightExt,fistW,fistH);
  }

  // L6: Impact flash (when punch connects)
  if(fists.punchPhase==='hold'||(fists.punchPhase==='extend'&&(fists.punchTimer||0)<0.04)){
    var impX=W*0.5+(opp.staggerX||0)*2;
    var impY=H*0.35;
    cx.save();cx.globalAlpha=0.5;
    var ig=cx.createRadialGradient(impX,impY,0,impX,impY,W*0.08);
    ig.addColorStop(0,'rgba(255,255,255,0.9)');ig.addColorStop(0.3,'rgba(255,240,150,0.4)');ig.addColorStop(1,'transparent');
    cx.fillStyle=ig;cx.beginPath();cx.arc(impX,impY,W*0.08,0,Math.PI*2);cx.fill();
    // Speed lines
    cx.strokeStyle='rgba(255,230,100,0.5)';cx.lineWidth=2;
    for(var sl=0;sl<8;sl++){var sa=sl/8*Math.PI*2+time*15;cx.beginPath();cx.moveTo(impX+Math.cos(sa)*W*0.03,impY+Math.sin(sa)*W*0.03);cx.lineTo(impX+Math.cos(sa)*W*0.07,impY+Math.sin(sa)*W*0.07);cx.stroke()}
    cx.restore();
  }

  // L7: Particles
  G.particles=(G.particles||[]).filter(function(p){p.x+=p.vx*(G.dt||0.016)*60;p.y+=p.vy*(G.dt||0.016)*60;p.vy+=(G.dt||0.016)*7;p.life-=(G.dt||0.016)*1.2;if(p.life<=0)return false;var a=p.life*p.life;cx.beginPath();cx.arc(p.x,p.y,p.r*(0.5+p.life*0.5),0,Math.PI*2);cx.fillStyle='hsla('+(p.hue||20)+','+(p.sat||100)+'%,'+(p.lit||55)+'%,'+a+')';cx.fill();return true});

  // L8: KO KICK (foot sweeps across screen)
  if(G.koKick&&G.koKick.active){
    var kt=G.koKick.timer;
    var kickProg=Math.min(1,kt/0.3);
    var kickEased=_easeOutBack(kickProg);
    var footW=W*0.6,footH=H*0.6;
    // Foot comes from bottom-right to center
    var footX=_lerp(W*0.8,W*0.2,kickEased);
    var footY=_lerp(H*1.2,H*0.15,kickEased);
    var footRot=_lerp(0.8,-0.3,kickEased);
    var footScale=_lerp(0.3,1.2,kickEased);

    cx.save();
    cx.translate(footX+footW*0.3,footY+footH*0.3);
    cx.rotate(footRot);
    cx.scale(footScale,footScale);
    cx.globalAlpha=Math.min(1,kickProg*2);
    cx.drawImage(SCENE.images.foot,-footW/2,-footH/2,footW,footH);

    // Impact flash at foot contact
    if(kickProg>0.6){
      cx.globalAlpha=(kickProg-0.6)*2;
      var impR=footW*0.4*(kickProg-0.6)*2;
      var impG2=cx.createRadialGradient(0,0,0,0,0,impR);
      impG2.addColorStop(0,'rgba(255,255,255,0.8)');impG2.addColorStop(0.5,'rgba(255,200,100,0.3)');impG2.addColorStop(1,'transparent');
      cx.fillStyle=impG2;cx.beginPath();cx.arc(0,0,impR,0,Math.PI*2);cx.fill();
    }
    cx.restore();
  }

  // L9: KO text
  if(G.phase==='CRASH'){
    var koT=G.koTimer||0;
    if((G.koFlash||0)>0){cx.globalAlpha=G.koFlash*0.4;cx.fillStyle='#ff0000';cx.fillRect(0,0,W,H);cx.globalAlpha=1}
    if(koT>0.4){
      var tp=Math.min(1,(koT-0.4)/0.4),ts=0.5+tp*0.5;
      cx.save();cx.translate(W/2,H*0.4);cx.scale(ts,ts);cx.globalAlpha=tp;
      cx.shadowColor='#ff2222';cx.shadowBlur=30;cx.font='bold 80px sans-serif';cx.textAlign='center';cx.textBaseline='middle';
      cx.fillStyle='#ff2222';cx.fillText('K.O.',0,0);
      cx.strokeStyle='rgba(255,255,255,0.3)';cx.lineWidth=2;cx.strokeText('K.O.',0,0);
      cx.shadowBlur=0;
      if(koT>1.2){cx.globalAlpha=Math.min(1,(koT-1.2)/0.5);cx.font='bold 28px sans-serif';cx.fillStyle='rgba(255,255,255,0.8)';cx.fillText((G.mult||1).toFixed(2)+'x',0,50)}
      cx.restore();
    }
  }

  // L10: Bell flash
  if((G.bellRing||0)>0){cx.globalAlpha=G.bellRing*0.15;cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.globalAlpha=1}

  // L11: Vignette
  var vS=0.25+t*0.35;
  var vG=cx.createRadialGradient(W/2,H*0.35,H*0.15,W/2,H/2,H*0.85);
  vG.addColorStop(0,'transparent');vG.addColorStop(0.5,'rgba(0,0,0,'+vS*0.2+')');vG.addColorStop(1,'rgba(0,0,0,'+vS+')');
  cx.fillStyle=vG;cx.fillRect(0,0,W,H);

  cx.restore();
  }catch(e){console.error('MMA Render error:',e);try{cx.restore()}catch(e2){}}
}
