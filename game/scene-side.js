// =====================================================================
// MMA SIDE VIEW — Two fighters visible from the side
// Pro (left, you) vs Amateur (right, opponent)
// =====================================================================

var SIDE={
  ready:false,img:{},_loaded:0,
  _list:[
    {key:'bg',src:'assets/side/BG.png'},
    {key:'proIdle',src:'assets/side/Pro-Idle.png'},
    {key:'proHL',src:'assets/side/Pro-hleft.png'},
    {key:'proHR',src:'assets/side/Pro-hright.png'},
    {key:'proHit1',src:'assets/side/Pro-Hit1.png'},
    {key:'proHit2',src:'assets/side/Pro-Hit2.png'},
    {key:'proLeg',src:'assets/side/Pro-Leg.png'},
    {key:'proVictory',src:'assets/side/Pro-victory.png'},
    {key:'amIdle',src:'assets/side/Amateur-Idle.png'},
    {key:'amHand',src:'assets/side/Amateur-hand.png'},
    {key:'amHit',src:'assets/side/Amateur-hit.png'},
    {key:'amHit1',src:'assets/side/Amateur-hit1.png'},
    {key:'amHit2',src:'assets/side/Amateur-hit2.png'},
    {key:'amKO',src:'assets/side/Amateur-KO.png'}
  ],
  // Fight state for side view
  pro:{pose:'idle',poseTimer:0,punchArm:0},
  am:{pose:'idle',poseTimer:0}
};

function _loadSideImages(){
  SIDE._list.forEach(function(item){
    var img=new Image();
    img.onload=function(){SIDE._loaded++;if(SIDE._loaded>=SIDE._list.length)SIDE.ready=true};
    img.onerror=function(){SIDE._loaded++};
    img.src=item.src;
    SIDE.img[item.key]=img;
  });
}
_loadSideImages();

// ── Side View Update ──
function updateSideView(){
  var dt=G.dt||0.016,t=G.tension||0;
  var pro=SIDE.pro,am=SIDE.am;

  // Decay pose timers
  if(pro.poseTimer>0){pro.poseTimer-=dt;if(pro.poseTimer<=0)pro.pose='idle'}
  if(am.poseTimer>0){am.poseTimer-=dt;if(am.poseTimer<=0)am.pose='idle'}

  if(G.phase==='BETTING'){
    pro.pose='idle';am.pose='idle';
    pro.poseTimer=0;am.poseTimer=0;
    SIDE._koTimer=0;
  }
  else if(G.phase==='FREEFALL'){
    // Pro (you) attacks amateur — gives +X bonus
    if(!pro._atkTimer)pro._atkTimer=0;
    pro._atkTimer-=dt;
    var myInterval=Math.max(0.8,2.2-t*0.9);
    if(pro._atkTimer<=0&&pro.pose==='idle'){
      if(Math.random()<Math.max(0.25,0.5-t*0.2)){
        pro._atkTimer=myInterval*(1+Math.random()*0.8);
        // Pro punches — alternate left/right
        pro.punchArm=((pro.punchArm||0)+1)%2;
        pro.pose=pro.punchArm===0?'punchL':'punchR';
        pro.poseTimer=0.3;
        // Amateur gets hit
        setTimeout(function(){
          am.pose=Math.random()<0.5?'hit1':'hit2';
          am.poseTimer=0.25;
          G.arenaShake=Math.max(G.arenaShake||0,1.5);
          G.crowdRoar=Math.min(1,(G.crowdRoar||0)+0.1);
          if(typeof SND!=='undefined')SND.play('punch',0.5);
          // Bonus popup
          var bonus=+(0.05+Math.random()*0.2+t*0.15).toFixed(2);
          if(G.bonusPopups)G.bonusPopups.push({x:cv.width*0.65+(Math.random()-0.5)*40,y:cv.height*0.3,val:bonus,life:1.2});
          spawnParticles(cv.width*0.62,cv.height*0.4,'gold',Math.floor(3+t*4));
        },120);
      }else{
        pro._atkTimer=myInterval*(0.5+Math.random());
      }
    }

    // Amateur attacks pro — more frequent
    if(!am._atkTimer)am._atkTimer=0;
    am._atkTimer-=dt;
    var oppInterval=Math.max(0.4,1.4-t*0.7);
    if(am._atkTimer<=0&&am.pose==='idle'){
      if(Math.random()<Math.max(0.5,0.75-t*0.15)){
        am._atkTimer=oppInterval*(0.5+Math.random()*0.6);
        am.pose='hand';
        am.poseTimer=0.3;
        // Pro gets hit
        setTimeout(function(){
          pro.pose=Math.random()<0.5?'hit1':'hit2';
          pro.poseTimer=0.25;
          G.arenaShake=Math.max(G.arenaShake||0,1+t*2);
          if(typeof SND!=='undefined')SND.play('punch',0.3+t*0.3);
          spawnParticles(cv.width*0.38,cv.height*0.4,'fire',Math.floor(2+t*5));
        },100);
      }else{
        am._atkTimer=oppInterval*(0.5+Math.random());
      }
    }
  }
  else if(G.phase==='CRASH'){
    if(!SIDE._koTimer)SIDE._koTimer=0;
    SIDE._koTimer+=dt;
    if(SIDE._koTimer<0.05){
      pro.pose='leg';pro.poseTimer=1.5;
      am.pose='ko';am.poseTimer=99; // instant KO on kick
      G.arenaShake=Math.max(G.arenaShake||0,12);
      G.crowdRoar=1;
      if(typeof SND!=='undefined'){SND.play('punch',0.7);SND.play('cheer',0.4)}
    }
    if(SIDE._koTimer>0.8){
      pro.pose='victory';pro.poseTimer=99;
    }
  }
}

// ── Side View Render ──
function renderSideView(){
  try{
  if(!cv||!cx)return;
  var W=cv.width,H=cv.height;if(!W||!H)return;
  cx.clearRect(0,0,W,H);cx.save();

  var cam=G.camera||{};
  if((cam.shake||0)>0.1)cx.translate((Math.random()-0.5)*cam.shake,(Math.random()-0.5)*cam.shake);
  var z=cam.zoom||1;
  if(z!==1){var zx=cam.zoomX||W*0.5,zy=cam.zoomY||H*0.45;cx.translate(zx,zy);cx.scale(z,z);cx.translate(-zx,-zy)}

  var t=G.tension=getTension(G.mult||1);
  var S=SIDE.img;

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
  var pro=SIDE.pro,am=SIDE.am;
  var isMob=W<600;
  // Always 70% screen height, width from aspect ratio
  var fH=Math.round(H*0.7);
  var fW=Math.round(fH*(2752/1536));

  // ── Pro (left, you) ──
  var proImg=S.proIdle;
  if(pro.pose==='punchL'&&S.proHL&&S.proHL.complete)proImg=S.proHL;
  else if(pro.pose==='punchR'&&S.proHR&&S.proHR.complete)proImg=S.proHR;
  else if(pro.pose==='hit1'&&S.proHit1&&S.proHit1.complete)proImg=S.proHit1;
  else if(pro.pose==='hit2'&&S.proHit2&&S.proHit2.complete)proImg=S.proHit2;
  else if(pro.pose==='leg'&&S.proLeg&&S.proLeg.complete)proImg=S.proLeg;
  else if(pro.pose==='victory'&&S.proVictory&&S.proVictory.complete)proImg=S.proVictory;

  if(proImg&&proImg.complete){
    var overlap=(fW-200)/2; // 48px gap between fighters
    var proX=W*0.5-fW+overlap;
    var proY=H-fH-(isMob?56:20);
    cx.drawImage(proImg,proX,proY,fW,fH);
  }

  // ── Amateur (right, opponent) ──
  var amImg=S.amIdle;
  if(am.pose==='hand'&&S.amHand&&S.amHand.complete)amImg=S.amHand;
  else if(am.pose==='hit'&&S.amHit&&S.amHit.complete)amImg=S.amHit;
  else if(am.pose==='hit1'&&S.amHit1&&S.amHit1.complete)amImg=S.amHit1;
  else if(am.pose==='hit2'&&S.amHit2&&S.amHit2.complete)amImg=S.amHit2;
  else if(am.pose==='ko'&&S.amKO&&S.amKO.complete)amImg=S.amKO;

  if(amImg&&amImg.complete){
    var amOverlap=(fW-200)/2;
    var amX=W*0.5-amOverlap;
    var amY=H-fH-(isMob?56:20);
    // KO: amateur falls down
    if(am.pose==='ko'&&SIDE._koTimer){
      var fallProg=Math.min(1,(SIDE._koTimer-0.3)/0.5);
      if(fallProg>0)amY+=fallProg*88;
    }
    cx.drawImage(amImg,amX,amY,fW,fH);
  }

  // ═══ L3: HEALTH BARS (both fighters) ═══
  if(G.phase!=='BETTING'&&G.phase!=='WAITING'&&G.phase!=='INIT'){
    var bW=Math.min(150,W*0.2),bH=8,bY=H*0.04;
    // Pro health (left)
    cx.fillStyle='rgba(0,0,0,0.5)';cx.fillRect(W*0.1,bY,bW,bH);
    cx.fillStyle='#4caf50';cx.fillRect(W*0.1,bY,bW,bH);
    cx.fillStyle='#fff';cx.font='bold 9px sans-serif';cx.textAlign='center';
    cx.fillText('PRO',W*0.1+bW/2,bY-3);

    // Amateur health
    var amHP=Math.max(0,G.opp?G.opp.health:1);
    cx.fillStyle='rgba(0,0,0,0.5)';cx.fillRect(W*0.9-bW,bY,bW,bH);
    var hpCol=amHP>0.5?'#ef5350':amHP>0.25?'#ff9800':'#f44336';
    cx.fillStyle=hpCol;cx.fillRect(W*0.9-bW,bY,bW*amHP,bH);
    cx.fillStyle='#fff';cx.textAlign='center';
    cx.fillText('AMATEUR',W*0.9-bW/2,bY-3);
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

  // ═══ L6: KO TEXT ═══
  if(G.phase==='CRASH'&&SIDE._koTimer>0.5){
    var koT=SIDE._koTimer;
    var tp=Math.min(1,(koT-0.5)/0.4),ts=0.5+tp*0.5;
    cx.save();cx.translate(W/2,H*0.3);cx.scale(ts,ts);cx.globalAlpha=tp;
    cx.shadowColor='#ff2222';cx.shadowBlur=30;
    cx.font='bold 72px sans-serif';cx.textAlign='center';cx.textBaseline='middle';
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

  // ═══ L7: VIGNETTE ═══
  var vS=0.2+t*0.3;
  var vG=cx.createRadialGradient(W/2,H*0.4,H*0.2,W/2,H/2,H*0.85);
  vG.addColorStop(0,'transparent');vG.addColorStop(0.5,'rgba(0,0,0,'+vS*0.15+')');vG.addColorStop(1,'rgba(0,0,0,'+vS+')');
  cx.fillStyle=vG;cx.fillRect(0,0,W,H);

  cx.restore();
  }catch(e){console.error('Side Render error:',e);try{cx.restore()}catch(e2){}}
}
