// =====================================================================
// MMA SIDE VIEW — Two fighters visible from the side
// Pro (left, you) vs Amateur (right, opponent)
// =====================================================================

var SIDE={
  ready:false,img:{},_loaded:0,
  _list:[
    {key:'bg',src:'assets/side/BG.png'}
  ],
  // Fight state for side view
  pro:{pose:'idle',poseTimer:0,punchArm:0},
  am:{pose:'idle',poseTimer:0}
};

// ── Pro frame-by-frame animation system ──
var PRO_ANIM={
  loaded:false,_loadCount:0,_totalFrames:0,
  anims:{},  // {idle:[Image,...], leftpunch:[...], rightpunch:[...], legkick:[...], gettinghit:[...], victory:[...]}
  current:'idle',
  frame:0,
  frameTimer:0
};

function _loadProFrames(){
  var sets=[
    {name:'idle',       path:'assets/side/pro-frames/idle/',       prefix:'Idle_',         start:37,  end:67,  skip:1},
    {name:'leftpunch',  path:'assets/side/pro-frames/leftpunch/',  prefix:'Left_Punch_',   start:0,   end:118, skip:1},
    {name:'rightpunch', path:'assets/side/pro-frames/rightpunch/', prefix:'Right_Punch_',  start:54,  end:106, skip:1},
    {name:'legkick',    path:'assets/side/pro-frames/legkick/',    prefix:'Leg_Kick_',     start:57,  end:134, skip:1},
    {name:'gettinghit', path:'assets/side/pro-frames/gettinghit/', prefix:'Getting_Hit_',  start:51,  end:111, skip:1},
    {name:'victory',    path:'assets/side/pro-frames/victory/',    prefix:'Victory_',      start:83,  end:157, skip:1},
    {name:'ko',         path:'assets/side/pro-frames/ko/',         prefix:'KOO_',          start:31,  end:120, skip:1}
  ];
  sets.forEach(function(s){
    PRO_ANIM.anims[s.name]=[];
    for(var i=s.start;i<=s.end;i+=s.skip){
      PRO_ANIM._totalFrames++;
      var img=new Image();
      (function(){
        img.onload=function(){
          PRO_ANIM._loadCount++;
          if(PRO_ANIM._loadCount>=PRO_ANIM._totalFrames)PRO_ANIM.loaded=true;
        };
        img.onerror=function(){PRO_ANIM._loadCount++};
      })();
      var num=('00000'+i).slice(-5);
      img.src=s.path+s.prefix+num+'.png';
      PRO_ANIM.anims[s.name].push(img);
    }
  });
}
_loadProFrames();

// Set pro animation — switch instantly
function _setProAnim(name){
  if(PRO_ANIM.current!==name){
    PRO_ANIM.current=name;
    PRO_ANIM.frame=0;
    PRO_ANIM.frameTimer=0;
  }
}

// FPS per animation
function _animFPS(name){
  return 30;
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

  // Idle and victory loop, others play once then hold last frame
  if(PRO_ANIM.current==='idle'||PRO_ANIM.current==='victory'){
    PRO_ANIM.frame=PRO_ANIM.frame%anim.length;
  }else{
    if(PRO_ANIM.frame>=anim.length)PRO_ANIM.frame=anim.length-1;
  }

  var img=anim[PRO_ANIM.frame];
  return (img&&img.complete&&img.naturalWidth>0)?img:null;
}

// ── Amateur frame animation — shares Pro's images, flipped when drawn ──
var AM_ANIM={
  current:'idle',
  frame:0,
  frameTimer:0
};

function _setAmAnim(name){
  if(AM_ANIM.current!==name){
    AM_ANIM.current=name;
    AM_ANIM.frame=0;
    AM_ANIM.frameTimer=0;
  }
}

function _getAmFrame(dt){
  var anim=PRO_ANIM.anims[AM_ANIM.current]; // reuse pro's images
  if(!anim||anim.length===0)return null;

  var fps=_animFPS(AM_ANIM.current);
  AM_ANIM.frameTimer+=dt;
  var frameDur=1/fps;
  while(AM_ANIM.frameTimer>=frameDur){
    AM_ANIM.frameTimer-=frameDur;
    AM_ANIM.frame++;
  }

  if(AM_ANIM.current==='idle'||AM_ANIM.current==='victory'){
    AM_ANIM.frame=AM_ANIM.frame%anim.length;
  }else{
    if(AM_ANIM.frame>=anim.length)AM_ANIM.frame=anim.length-1;
  }

  var img=anim[AM_ANIM.frame];
  return (img&&img.complete&&img.naturalWidth>0)?img:null;
}

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

  // Timer-based pose system
  if(!pro._poseTime)pro._poseTime=0;
  pro._poseTime+=dt;
  if(!am._poseTime)am._poseTime=0;
  am._poseTime+=dt;

  if(G.phase==='BETTING'){
    pro.pose='idle';pro._poseTime=0;
    am.pose='idle';am._poseTime=0;
  }
  else if(G.phase==='FREEFALL'){
    // ── Combo definitions per fighter ──
    var PRO_COMBOS=[
      {name:'jab',           moves:['punchL']},
      {name:'cross',         moves:['punchR']},
      {name:'jabCross',      moves:['punchL','punchR']},
      {name:'dblJabCross',   moves:['punchL','punchL','punchR']},
      {name:'jabJabCross',   moves:['punchL','punchL','punchR']},
      {name:'crossJab',      moves:['punchR','punchL']}
    ];
    var AM_COMBOS=[
      {name:'jab',       moves:['punchL']},
      {name:'cross',     moves:['punchR']},
      {name:'doubleJab', moves:['punchL','punchL']},
      {name:'jabCross',  moves:['punchL','punchR']}
    ];
    var moveDur=1.0; // duration per move in combo
    var hitDelay=0.1;

    // ── Run combo for a fighter (attacker, defender) ──
    function _runCombo(atk,def,atkSide){
      if(atk._combo&&atk._combo.length>0){
        var moveIdx=atk._comboIdx||0;
        var moveTime=atk._poseTime;

        // Time to land hit — restart getting hit on every punch
        if(atk._hitQueued&&moveTime>=hitDelay){
          atk._hitQueued=false;
          def.pose='hit';def._poseTime=0;
          // Force restart getting hit animation even if already playing
          if(def===am){AM_ANIM.frame=0;AM_ANIM.frameTimer=0;}
          else{PRO_ANIM.frame=0;PRO_ANIM.frameTimer=0;}
          G.arenaShake=Math.max(G.arenaShake||0,1.5);
          G.crowdRoar=Math.min(1,(G.crowdRoar||0)+0.1);
          // Different sound per move type
          if(typeof SND!=='undefined'){
            var move=atk._combo[atk._comboIdx||0];
            if(move==='punchL')SND.play('punch',0.5);
            else if(move==='punchR')SND.play('punch',0.7);
            else if(move==='leg')SND.play('punch',0.9);
            else SND.play('punch',0.4);
          }
          if(atkSide==='pro'){
            var bonus=+(0.05+Math.random()*0.2+t*0.15).toFixed(2);
            if(G.bonusPopups)G.bonusPopups.push({x:cv.width*0.55+(Math.random()-0.5)*30,y:cv.height*0.35,val:bonus,life:1.2});
            spawnParticles(cv.width*0.55,cv.height*0.5,'gold',Math.floor(3+t*4));
          }else{
            spawnParticles(cv.width*0.45,cv.height*0.5,'fire',Math.floor(2+t*5));
          }
        }

        // Move to next move in combo — chain directly, no idle gap
        if(moveTime>=moveDur){
          moveIdx++;
          if(moveIdx<atk._combo.length){
            atk._comboIdx=moveIdx;
            var nextMove=atk._combo[moveIdx];
            // Only reset animation if move type changes
            if(atk.pose!==nextMove){
              atk.pose=nextMove;
            }
            atk._poseTime=0;
            atk._hitQueued=true;
          }else{
            // Combo finished
            atk._combo=null;atk._comboIdx=0;
            atk.pose='idle';atk._poseTime=0;
            def.pose='idle';def._poseTime=0;
          }
        }
      }
    }

    _runCombo(pro,am,'pro');
    _runCombo(am,pro,'am');

    // ── Pro starts a combo ──
    if(!pro._atkTimer)pro._atkTimer=0;
    pro._atkTimer-=dt;
    var myInterval=Math.max(0.8,2.2-t*0.9);
    if(pro._atkTimer<=0&&pro.pose==='idle'&&am.pose==='idle'&&!pro._combo){
      if(Math.random()<Math.max(0.25,0.5-t*0.2)){
        pro._atkTimer=myInterval*(1+Math.random()*0.8);
        var combo=PRO_COMBOS[Math.floor(Math.random()*PRO_COMBOS.length)];
        pro._combo=combo.moves.slice();
        pro._comboIdx=0;
        pro.pose=combo.moves[0];
        pro._poseTime=0;
        pro._hitQueued=true;
      }else{
        pro._atkTimer=myInterval*(0.5+Math.random());
      }
    }

    // ── Amateur starts a combo ──
    if(!am._atkTimer)am._atkTimer=0;
    am._atkTimer-=dt;
    var oppInterval=Math.max(0.4,1.4-t*0.7);
    if(am._atkTimer<=0&&am.pose==='idle'&&pro.pose==='idle'&&!am._combo){
      if(Math.random()<Math.max(0.5,0.75-t*0.15)){
        am._atkTimer=oppInterval*(0.5+Math.random()*0.6);
        var aCombo=AM_COMBOS[Math.floor(Math.random()*AM_COMBOS.length)];
        am._combo=aCombo.moves.slice();
        am._comboIdx=0;
        am.pose=aCombo.moves[0];
        am._poseTime=0;
        am._hitQueued=true;
      }else{
        am._atkTimer=oppInterval*(0.5+Math.random());
      }
    }
  }
  else if(G.phase==='CRASH'){
    var ct=G.phaseTimer||0;
    // Phase 1: Pro leg kick, Amateur gets hit
    if(pro.pose!=='leg'&&pro.pose!=='victory'){
      pro.pose='leg';pro._poseTime=0;
      am.pose='hit';am._poseTime=0;
      G.arenaShake=Math.max(G.arenaShake||0,12);
      G.crowdRoar=1;
      if(typeof SND!=='undefined'){SND.play('punch',0.9);SND.play('cheer',0.4)}
    }
    // Phase 2: Amateur falls KO after getting hit
    if(ct>1.0&&am.pose==='hit'){
      am.pose='ko';am._poseTime=0;
      if(typeof SND!=='undefined')SND.play('punch',0.6);
    }
    // Phase 3: Pro victory
    if(ct>2.0&&pro.pose!=='victory'){
      pro.pose='victory';pro._poseTime=0;
      if(typeof SND!=='undefined')SND.play('victory',0.5);
    }
  }

  // ── Sync pro pose → frame animation ──
  if(pro.pose==='idle')_setProAnim('idle');
  else if(pro.pose==='punchL')_setProAnim('leftpunch');
  else if(pro.pose==='punchR')_setProAnim('rightpunch');
  else if(pro.pose==='hit')_setProAnim('gettinghit');
  else if(pro.pose==='leg')_setProAnim('legkick');
  else if(pro.pose==='victory')_setProAnim('victory');

  // ── Sync amateur pose → frame animation ──
  if(am.pose==='idle')_setAmAnim('idle');
  else if(am.pose==='punchL')_setAmAnim('leftpunch');
  else if(am.pose==='punchR')_setAmAnim('rightpunch');
  else if(am.pose==='hit')_setAmAnim('gettinghit');
  else if(am.pose==='ko')_setAmAnim('ko');
  else if(am.pose==='victory')_setAmAnim('victory');
}

// ── Side View Render ──
function renderSideView(){
  try{
  if(!cv||!cx)return;
  var W=cv.width,H=cv.height;if(!W||!H)return;
  cx.clearRect(0,0,W,H);cx.save();

  // ── Fixed camera — no zoom, no shake ──

  var t=G.tension=getTension(G.mult||1);
  var S=SIDE.img;
  var dt=G.dt||0.016;

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

  // Base height for fighters — fixed box size so position never jumps
  var baseH=Math.round(H*(isMob?0.55:0.62));
  var baseAspect=1936/1072; // largest frame ratio = fixed box
  var baseW=Math.round(baseH*baseAspect);
  var floorY=H*0.82;

  // Fixed positions using stable box — scale overlap for mobile
  var isTab=W>=600&&W<=1024;
  var overlap=isMob?Math.round(baseW*0.35):isTab?Math.round(baseW*0.35):Math.round(baseW*0.40);
  var proBoxX=W*0.5-baseW+overlap;
  var proBoxY=floorY-baseH;
  var amBoxX=W*0.5-overlap;
  var amBoxY=floorY-baseH;

  // ── Pro (left, you) — frame animation ──
  var proFrame=_getProFrame(dt);

  if(proFrame){
    var pNW=proFrame.naturalWidth||1936,pNH=proFrame.naturalHeight||1072;
    var pAspect=pNW/pNH;
    var drawW=Math.round(baseH*pAspect);
    var drawH=baseH;
    var drawX=proBoxX+Math.round((baseW-drawW)*0.5);
    var drawY=proBoxY;
    cx.drawImage(proFrame,drawX,drawY,drawW,drawH);
  }

  // ── Amateur (right, opponent) �� same frames as Pro, flipped ──
  var amFrame=_getAmFrame(dt);

  if(amFrame){
    var aNW=amFrame.naturalWidth||1936,aNH=amFrame.naturalHeight||1072;
    var aAspect=aNW/aNH;
    var aDrawW=Math.round(baseH*aAspect);
    var aDrawH=baseH;
    var aDrawX=amBoxX+Math.round((baseW-aDrawW)*0.5);
    var aDrawY=amBoxY;
    // KO frames have character higher in frame — push down
    if(am.pose==='ko')aDrawY+=Math.round(baseH*0.15);

    // Normal draw — flipped horizontally, centered in fixed box
    cx.save();
    cx.translate(amBoxX+baseW*0.5,aDrawY);
    cx.scale(-1,1);
    cx.drawImage(amFrame,-aDrawW*0.5,0,aDrawW,aDrawH);
    cx.restore();
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
