// =====================================================================
// MMA FIRST-PERSON SCENE — Real image assets
// Uses pre-made PNG images for fighter, fists, and arena background
// =====================================================================

// ── Easing + helpers ──
function _easeOutBack(x){return 1+2.7*Math.pow(x-1,3)+1.7*Math.pow(x-1,2)}
function _easeOutCubic(x){return 1-Math.pow(1-x,3)}
function _easeInOutCubic(x){return x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}
function _lerp(a,b,t){return a+(b-a)*t}

// ── Image loader ──
var IMG={};
var _imgList=[
  {key:'bg',src:'assets/arena-bg.png'},
  {key:'idle',src:'assets/Fighter-Idle.png'},
  {key:'face',src:'assets/Fighter-face.png'},
  {key:'body',src:'assets/Fighter-body.png'},
  {key:'ko',src:'assets/Fighter-ko.png'},
  {key:'fistL',src:'assets/Left.png'},
  {key:'fistR',src:'assets/Right.png'}
];
var _imgsLoaded=0;
function _loadImages(){
  _imgList.forEach(function(item){
    var img=new Image();
    img.onload=function(){_imgsLoaded++;if(_imgsLoaded>=_imgList.length)IMG._ready=true};
    img.onerror=function(){_imgsLoaded++;console.warn('Failed to load:',item.src)};
    img.src=item.src;
    IMG[item.key]=img;
  });
}
_loadImages();

// ── State ──
function initFighterState(){
  G.opp={health:1,hitFlash:0,staggerX:0,staggerY:0,recoilTimer:0,leanAngle:0,breathCycle:0,blinkTimer:3,blinkAmount:0,flinchTimer:0,shakeX:0,shakeY:0,hitPose:'idle',hitPoseTimer:0};
  G.myFists={punchArm:0,punchPhase:'idle',punchTimer:0,punchWindup:0,combo:0,_stanceTimer:0};
  G.koKick={active:false,timer:0};
  G.tension=0;G.koTimer=0;G.koFlash=0;G.bellRing=0;G.arenaShake=0;G.crowdRoar=0;G.crowdRoarSmooth=0;G.fightStarted=false;
  G.f1={x:0,y:0,health:1,punchPhase:'idle',punchTimer:0,punchWindup:0,punchArm:1,kickPhase:'idle',kickTimer:0,kickWindup:0,combo:0,hitFlash:0,staggerX:0,staggerY:0,recoilTimer:0,leanAngle:0,blockTimer:0,blockAmount:0,stanceTimer:0,walkCycle:0,breathCycle:0,blinkTimer:3,blinkAmount:0,weightShift:0,weightTarget:0,stance:0};
  G.f2=G.opp;
}
function getTension(m){if(m<=1)return 0;if(m<=1.5)return(m-1)/0.5*0.25;if(m<=3)return 0.25+(m-1.5)/1.5*0.25;if(m<=7)return 0.5+(m-3)/4*0.25;return Math.min(1,0.75+(m-7)/13*0.25)}
function initCrowd(){}

// ── Update ──
function updateFighters(){
  var dt=G.dt||0.016,t=G.tension,opp=G.opp,fists=G.myFists;
  if(!opp||!fists)return;
  var time=G.time||0,W=cv.width,H=cv.height;

  opp.breathCycle+=dt*2.8;
  // Blink
  opp.blinkTimer-=dt;if(opp.blinkTimer<=0){opp.blinkAmount=1;opp.blinkTimer=2.5+Math.random()*4}
  if(opp.blinkAmount>0)opp.blinkAmount=Math.max(0,opp.blinkAmount-dt*8);
  // Hit decay
  if(opp.recoilTimer>0){opp.recoilTimer-=dt;opp.staggerX*=(1-dt*5);opp.staggerY*=(1-dt*6)}else{opp.staggerX*=(1-dt*8);opp.staggerY*=(1-dt*8)}
  opp.hitFlash=Math.max(0,opp.hitFlash-dt*2.5);
  opp.leanAngle=_lerp(opp.leanAngle,0,dt*4);
  opp.flinchTimer=Math.max(0,(opp.flinchTimer||0)-dt*3);
  opp.shakeX=_lerp(opp.shakeX||0,0,dt*10);
  // Hit pose timer — shows face/body hit image then returns to idle
  if(opp.hitPoseTimer>0){opp.hitPoseTimer-=dt;if(opp.hitPoseTimer<=0)opp.hitPose='idle'}
  opp.shakeY=_lerp(opp.shakeY||0,0,dt*10);

  // Punch phases
  if(fists.punchPhase!=='idle'){
    fists.punchTimer-=dt;
    if(fists.punchPhase==='windup'){fists.punchWindup=Math.min(1,fists.punchWindup+dt*14);if(fists.punchTimer<=0){fists.punchPhase='extend';fists.punchTimer=0.08}}
    else if(fists.punchPhase==='extend'){fists.punchWindup=0;if(fists.punchTimer<=0){fists.punchPhase='hold';fists.punchTimer=0.04}}
    else if(fists.punchPhase==='hold'){if(fists.punchTimer<=0){fists.punchPhase='retract';fists.punchTimer=0.15}}
    else if(fists.punchPhase==='retract'){if(fists.punchTimer<=0){fists.punchPhase='idle';fists.punchTimer=0}}
  }

  if(G.koKick&&G.koKick.active)G.koKick.timer+=dt;

  // Phase logic
  if(G.phase==='BETTING'){
    opp.health=1;opp.hitFlash=0;opp.staggerX=0;opp.staggerY=0;opp.leanAngle=0;opp.flinchTimer=0;opp.shakeX=0;opp.shakeY=0;
    fists.punchPhase='idle';fists.combo=0;
    G.koKick={active:false,timer:0};G.koTimer=0;
  }
  else if(G.phase==='EXPLODE'){
    G.bellRing=Math.max(0,(G.bellRing||0)-dt);
    if(G.phaseTimer>1.2&&G.bellRing<=0)G.bellRing=0.5;
  }
  else if(G.phase==='FREEFALL'){
    G.fightStarted=true;
    if(!fists._stanceTimer)fists._stanceTimer=0;
    fists._stanceTimer-=dt;
    var pi=Math.max(0.18,0.85-t*0.6);
    if(fists._stanceTimer<=0&&fists.punchPhase==='idle'){
      if(Math.random()<0.7){
        fists.punchPhase='windup';fists.punchTimer=0.06;fists.punchWindup=0;
        fists.combo=Math.min(6,fists.combo+1);
        fists.punchArm=fists.combo%2===0?1:-1;
        fists._stanceTimer=pi*(0.5+Math.random()*0.6);
        var _hitArm=fists.punchArm; // capture before setTimeout
        setTimeout(function(){
          // Left fist (-1) = face hit, Right fist (1) = body hit
          opp.hitPose=_hitArm===-1?'face':'body';
          opp.hitPoseTimer=0.25;
          opp.hitFlash=0.35;opp.recoilTimer=0.25;
          opp.staggerX=(Math.random()-0.5)*10;
          opp.staggerY=-2-Math.random()*3;
          opp.leanAngle=(Math.random()-0.5)*0.12;
          opp.flinchTimer=0.3;
          opp.shakeX=(Math.random()-0.5)*15;
          opp.shakeY=(Math.random()-0.5)*8;
          opp.health=Math.max(0,opp.health-(0.005+t*0.018));
          G.arenaShake=Math.max(G.arenaShake,1+t*3);
          G.crowdRoar=Math.min(1,G.crowdRoar+0.12);
          spawnParticles(W*0.5+opp.staggerX*3,H*0.35,t>0.5?'fire':'gold',Math.floor(2+t*6));
        },100);
      }else{
        fists._stanceTimer=pi*(0.7+Math.random());fists.combo=0;
      }
    }
    if(t>0.75)opp.health=Math.max(0,opp.health-dt*0.02*(t-0.5));
  }
  else if(G.phase==='CRASH'){
    G.koTimer+=dt;
    if(G.koTimer<0.05&&!G.koKick.active){
      G.koKick={active:true,timer:0};G.koFlash=1;G.arenaShake=18;G.crowdRoar=1;
    }
    G.koFlash=Math.max(0,G.koFlash-dt*1.5);
    var fp=_easeOutCubic(Math.min(1,G.koTimer/0.8));
    opp.leanAngle=_lerp(0,0.35,fp);
    opp.staggerY=_lerp(0,60,fp);
    opp.staggerX=_lerp(0,30,fp);
    opp.health=Math.max(0,1-fp*3);
  }

  G.arenaShake=Math.max(0,G.arenaShake*(1-dt*8));
  G.crowdRoar=Math.max(0,G.crowdRoar-dt*0.4);
  G.crowdRoarSmooth=_lerp(G.crowdRoarSmooth||0,G.crowdRoar,dt*5);
  if(G.arenaShake>0.3)G.camera.shake=Math.max(G.camera.shake,G.arenaShake*0.6);
  if(G.f1)G.f1.health=1;
  if(G.f2)G.f2.health=opp.health;
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

  // Camera shake
  var cam=G.camera||{};
  if((cam.shake||0)>0.1)cx.translate((Math.random()-0.5)*cam.shake,(Math.random()-0.5)*cam.shake);
  var z=cam.zoom||1;
  if(z!==1){var zx=cam.zoomX||W*0.5,zy=cam.zoomY||H*0.45;cx.translate(zx,zy);cx.scale(z,z);cx.translate(-zx,-zy)}

  var t=G.tension=getTension(G.mult||1);
  var opp=G.opp||{},fists=G.myFists||{};
  var time=G.time||0;

  // ═══ L1: ARENA BACKGROUND (full screen cover) ═══
  if(IMG.bg&&IMG.bg.complete&&IMG.bg.naturalWidth){
    var bgA=IMG.bg.naturalWidth/IMG.bg.naturalHeight,scA=W/H;
    var dW,dH;
    if(scA>bgA){dW=W;dH=W/bgA}else{dH=H;dW=H*bgA}
    cx.drawImage(IMG.bg,(W-dW)/2,(H-dH)/2,dW,dH);
  }else{
    // Fallback black
    cx.fillStyle='#060414';cx.fillRect(0,0,W,H);
  }

  // ═══ L2: OPPONENT ═══
  var isKO=G.phase==='CRASH';
  var hitPose=opp.hitPose||'idle';
  var oppImg;
  if(isKO&&IMG.ko&&IMG.ko.complete){oppImg=IMG.ko}
  else if(hitPose==='face'&&IMG.face&&IMG.face.complete){oppImg=IMG.face}
  else if(hitPose==='body'&&IMG.body&&IMG.body.complete){oppImg=IMG.body}
  else{oppImg=IMG.idle&&IMG.idle.complete?IMG.idle:null}
  if(oppImg&&oppImg.naturalWidth){
    cx.save();
    var oppScale=Math.min(W*0.5/oppImg.naturalWidth,H*0.75/oppImg.naturalHeight);
    var oppW=oppImg.naturalWidth*oppScale;
    var oppH=oppImg.naturalHeight*oppScale;
    var oppX=W*0.5-oppW/2+(opp.staggerX||0)+(opp.shakeX||0);
    var oppY=H*0.08+(opp.staggerY||0)+(opp.shakeY||0)+Math.sin(opp.breathCycle||0)*2;

    // Lean from hits
    if(opp.leanAngle){
      cx.translate(W*0.5,H*0.45);cx.rotate(opp.leanAngle);cx.translate(-W*0.5,-H*0.45);
    }

    // Flinch offset
    var flinch=opp.flinchTimer||0;
    if(flinch>0){oppY+=flinch*10;oppX+=(Math.random()-0.5)*flinch*6}

    // Draw opponent
    cx.drawImage(oppImg,oppX,oppY,oppW,oppH);

    // Hit flash white overlay
    if((opp.hitFlash||0)>0){
      cx.globalAlpha=opp.hitFlash*0.3;
      cx.fillStyle='#fff';
      cx.fillRect(oppX,oppY,oppW,oppH);
      cx.globalAlpha=1;
    }

    // Damage red tint at low health
    if(opp.health<0.4&&G.fightStarted){
      cx.globalAlpha=(0.4-opp.health)*0.3;
      cx.fillStyle='#ff0000';
      cx.fillRect(oppX,oppY,oppW,oppH);
      cx.globalAlpha=1;
    }

    cx.restore();
  }

  // ═══ L3: HEALTH BAR ═══
  if(G.phase!=='BETTING'&&G.phase!=='WAITING'&&G.phase!=='INIT'){
    var bW=Math.min(300,W*0.35),bH=12,bY=H*0.04;
    var bX=W*0.5-bW/2;
    // Background
    cx.fillStyle='rgba(0,0,0,0.5)';
    cx.beginPath();
    cx.moveTo(bX+4,bY);cx.lineTo(bX+bW-4,bY);cx.quadraticCurveTo(bX+bW,bY,bX+bW,bY+4);
    cx.lineTo(bX+bW,bY+bH-4);cx.quadraticCurveTo(bX+bW,bY+bH,bX+bW-4,bY+bH);
    cx.lineTo(bX+4,bY+bH);cx.quadraticCurveTo(bX,bY+bH,bX,bY+bH-4);
    cx.lineTo(bX,bY+4);cx.quadraticCurveTo(bX,bY,bX+4,bY);
    cx.fill();
    // Health fill
    var hp=Math.max(0,Math.min(1,opp.health||1));
    var hpG=cx.createLinearGradient(bX,0,bX+bW*hp,0);
    hpG.addColorStop(0,hp>0.5?'#22aa44':hp>0.25?'#cc8800':'#cc2222');
    hpG.addColorStop(1,hp>0.5?'#44dd66':hp>0.25?'#ffaa00':'#ff4444');
    cx.fillStyle=hpG;
    cx.fillRect(bX+1,bY+1,(bW-2)*hp,bH-2);
    // Border
    cx.strokeStyle='rgba(255,255,255,0.15)';cx.lineWidth=1;
    cx.strokeRect(bX,bY,bW,bH);
    // Label
    cx.fillStyle='rgba(255,255,255,0.7)';cx.font='bold 10px sans-serif';cx.textAlign='center';
    cx.fillText('OPPONENT',W*0.5,bY-3);
  }

  // ═══ L4: YOUR FISTS ═══
  if(G.phase!=='CRASH'||G.koTimer<0.2){
    var fistScale=Math.min(W/2752,H/1536)*0.88;
    var fistLW=(IMG.fistL?IMG.fistL.naturalWidth:600)*fistScale;
    var fistLH=(IMG.fistL?IMG.fistL.naturalHeight:400)*fistScale;
    var fistRW=(IMG.fistR?IMG.fistR.naturalWidth:600)*fistScale;
    var fistRH=(IMG.fistR?IMG.fistR.naturalHeight:400)*fistScale;

    var idleBobL=Math.sin(time*2)*5;
    var idleBobR=Math.sin(time*2+1)*5;

    // Base positions (bottom corners)
    var lBaseX=-fistLW*0.15;
    var lBaseY=H-fistLH*0.65+idleBobL;
    var rBaseX=W-fistRW*0.85;
    var rBaseY=H-fistRH*0.65+idleBobR;

    // Punch animation offsets
    var lOffX=0,lOffY=0,rOffX=0,rOffY=0;
    if(fists.punchPhase==='windup'){
      var wb=fists.punchWindup||0;
      if(fists.punchArm===-1){lOffY=15*wb;lOffX=-10*wb}else{rOffY=15*wb;rOffX=10*wb}
    }else if(fists.punchPhase==='extend'||fists.punchPhase==='hold'){
      if(fists.punchArm===-1){lOffY=-H*0.2;lOffX=W*0.15}else{rOffY=-H*0.2;rOffX=-W*0.15}
    }else if(fists.punchPhase==='retract'){
      var rp=Math.max(0,(fists.punchTimer||0)/0.15);
      if(fists.punchArm===-1){lOffY=-H*0.2*rp;lOffX=W*0.15*rp}else{rOffY=-H*0.2*rp;rOffX=-W*0.15*rp}
    }

    // Draw left fist
    if(IMG.fistL&&IMG.fistL.complete){
      cx.drawImage(IMG.fistL,lBaseX+lOffX,lBaseY+lOffY,fistLW,fistLH);
    }
    // Draw right fist
    if(IMG.fistR&&IMG.fistR.complete){
      cx.drawImage(IMG.fistR,rBaseX+rOffX,rBaseY+rOffY,fistRW,fistRH);
    }
  }

  // ═══ L5: IMPACT FLASH ═══
  if(fists.punchPhase==='hold'||(fists.punchPhase==='extend'&&(fists.punchTimer||0)<0.03)){
    var impX=W*0.5+(opp.staggerX||0)*2;
    var impY=H*0.35;
    cx.save();cx.globalAlpha=0.5;
    var ig=cx.createRadialGradient(impX,impY,0,impX,impY,W*0.07);
    ig.addColorStop(0,'rgba(255,255,255,0.9)');ig.addColorStop(0.3,'rgba(255,240,150,0.4)');ig.addColorStop(1,'transparent');
    cx.fillStyle=ig;cx.beginPath();cx.arc(impX,impY,W*0.07,0,Math.PI*2);cx.fill();
    // Speed lines
    cx.strokeStyle='rgba(255,230,100,0.5)';cx.lineWidth=2;
    for(var sl=0;sl<8;sl++){var sa=sl/8*Math.PI*2+time*15;cx.beginPath();cx.moveTo(impX+Math.cos(sa)*W*0.025,impY+Math.sin(sa)*W*0.025);cx.lineTo(impX+Math.cos(sa)*W*0.06,impY+Math.sin(sa)*W*0.06);cx.stroke()}
    cx.restore();
  }

  // ═══ L6: PARTICLES ═══
  G.particles=(G.particles||[]).filter(function(p){
    p.x+=p.vx*(G.dt||0.016)*60;p.y+=p.vy*(G.dt||0.016)*60;
    p.vy+=(G.dt||0.016)*7;p.life-=(G.dt||0.016)*1.2;
    if(p.life<=0)return false;
    var a=p.life*p.life;
    cx.beginPath();cx.arc(p.x,p.y,p.r*(0.5+p.life*0.5),0,Math.PI*2);
    cx.fillStyle='hsla('+(p.hue||20)+','+(p.sat||100)+'%,'+(p.lit||55)+'%,'+a+')';
    cx.fill();return true;
  });

  // ═══ L7: KO SEQUENCE ═══
  if(G.phase==='CRASH'){
    var koT=G.koTimer||0;

    // Red flash
    if((G.koFlash||0)>0){
      cx.globalAlpha=G.koFlash*0.4;cx.fillStyle='#ff0000';cx.fillRect(0,0,W,H);cx.globalAlpha=1;
    }

    // K.O. text
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

  // ═══ L8: BELL FLASH ═══
  if((G.bellRing||0)>0){cx.globalAlpha=G.bellRing*0.15;cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.globalAlpha=1}

  // ═══ L9: VIGNETTE ═══
  var vS=0.2+t*0.3;
  var vG=cx.createRadialGradient(W/2,H*0.4,H*0.2,W/2,H/2,H*0.85);
  vG.addColorStop(0,'transparent');vG.addColorStop(0.5,'rgba(0,0,0,'+vS*0.15+')');vG.addColorStop(1,'rgba(0,0,0,'+vS+')');
  cx.fillStyle=vG;cx.fillRect(0,0,W,H);

  cx.restore();
  }catch(e){console.error('MMA Render error:',e);try{cx.restore()}catch(e2){}}
}
