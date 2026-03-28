// =====================================================================
// MMA PREMIUM SCENE — Cinematic image-based rendering
// Pre-renders high-quality layers, composites each frame
// Style: UFC broadcast, cinematic lighting, 3D depth illusion
// =====================================================================

// ── Easing + helpers ──
function _easeOutBack(x){return 1+2.7*Math.pow(x-1,3)+1.7*Math.pow(x-1,2)}
function _easeOutCubic(x){return 1-Math.pow(1-x,3)}
function _easeInOutCubic(x){return x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}
function _easeInBack(x){return 2.7*x*x*x-1.7*x*x}
function _lerp(a,b,t){return a+(b-a)*t}

// ── Fighter state ──
function initFighterState(){
  function _mk(){return{x:0,y:0,targetX:0,targetY:0,health:1,stance:0,stanceTimer:0,punchTimer:0,punchPhase:'idle',punchWindup:0,punchArm:1,kickTimer:0,kickPhase:'idle',kickWindup:0,blockTimer:0,blockAmount:0,combo:0,hitFlash:0,staggerX:0,staggerY:0,recoilTimer:0,dodgeX:0,leanAngle:0,hipShift:0,walkCycle:0,breathCycle:0,blinkTimer:2+Math.random()*3,blinkAmount:0,weightShift:0,weightTarget:0}}
  G.f1=_mk();G.f2=_mk();G.crowd=[];G.tension=0;G.koTimer=0;G.koFlash=0;G.bellRing=0;G.arenaShake=0;G.crowdRoar=0;G.crowdRoarSmooth=0;G.fightStarted=false;
}
function getTension(m){if(m<=1)return 0;if(m<=1.5)return(m-1)/0.5*0.25;if(m<=3)return 0.25+(m-1.5)/1.5*0.25;if(m<=7)return 0.5+(m-3)/4*0.25;return Math.min(1,0.75+(m-7)/13*0.25)}
function initCrowd(){G.crowd=[];var n=Math.min(160,Math.floor(cv.width/6));for(var i=0;i<n;i++){G.crowd.push({x:Math.random(),row:i<n*0.35?2:i<n*0.65?1:0,phase:Math.random()*6.28,speed:0.5+Math.random()*2.5,height:0.7+Math.random()*0.4,hue:Math.random()*360,_armRaise:0})}}

// ── Update fighters ──
function updateFighters(){
  var dt=G.dt||0.016,t=G.tension,f1=G.f1,f2=G.f2;if(!f1||!f2)return;
  var W=cv.width,H=cv.height,acx=W*0.5,acy=H*0.55,arenaR=Math.min(W,H)*0.28,time=G.time;
  f1.walkCycle+=dt*(1.5+t*3);f2.walkCycle+=dt*(1.5+t*2.5);f1.breathCycle+=dt*2.8;f2.breathCycle+=dt*3.1;
  function _blink(f){f.blinkTimer-=dt;if(f.blinkTimer<=0){f.blinkAmount=1;f.blinkTimer=2.5+Math.random()*4}if(f.blinkAmount>0)f.blinkAmount=Math.max(0,f.blinkAmount-dt*8)}
  _blink(f1);_blink(f2);
  function _wt(f){f.weightShift=_lerp(f.weightShift,f.weightTarget,dt*4)}_wt(f1);_wt(f2);
  function _sp(f,tx,ty){f.targetX=tx;f.targetY=ty;f.x=_lerp(f.x,tx,dt*8);f.y=_lerp(f.y,ty,dt*8)}
  function _up(f){if(f.punchPhase==='idle')return;f.punchTimer-=dt;if(f.punchPhase==='windup'){f.punchWindup=Math.min(1,f.punchWindup+dt*12);if(f.punchTimer<=0){f.punchPhase='extend';f.punchTimer=0.1}}else if(f.punchPhase==='extend'){f.punchWindup=0;if(f.punchTimer<=0){f.punchPhase='hold';f.punchTimer=0.05}}else if(f.punchPhase==='hold'){if(f.punchTimer<=0){f.punchPhase='retract';f.punchTimer=0.12}}else if(f.punchPhase==='retract'){if(f.punchTimer<=0){f.punchPhase='idle';f.punchTimer=0}}}_up(f1);_up(f2);
  function _uk(f){if(f.kickPhase==='idle')return;f.kickTimer-=dt;if(f.kickPhase==='windup'){f.kickWindup=Math.min(1,f.kickWindup+dt*10);if(f.kickTimer<=0){f.kickPhase='extend';f.kickTimer=0.15}}else if(f.kickPhase==='extend'){f.kickWindup=0;if(f.kickTimer<=0){f.kickPhase='retract';f.kickTimer=0.15}}else if(f.kickPhase==='retract'){if(f.kickTimer<=0){f.kickPhase='idle';f.kickTimer=0}}}_uk(f1);_uk(f2);
  function _hr(f){if(f.recoilTimer>0){f.recoilTimer-=dt;f.staggerX*=(1-dt*6);f.staggerY*=(1-dt*8)}else{f.staggerX*=(1-dt*10);f.staggerY*=(1-dt*10)}f.hitFlash=Math.max(0,f.hitFlash-dt*2.5);f.blockAmount=_lerp(f.blockAmount,f.blockTimer>0?1:0,dt*8);f.blockTimer=Math.max(0,f.blockTimer-dt);f.leanAngle=_lerp(f.leanAngle,0,dt*5)}_hr(f1);_hr(f2);
  function _tp(atk,def,dx,dy,dmg,shake,pc){atk.punchPhase='windup';atk.punchTimer=0.08;atk.punchWindup=0;atk.combo=Math.min(5,atk.combo+1);atk.punchArm=atk.combo%2===0?1:-1;atk.weightTarget=atk.punchArm*0.5;atk.leanAngle=atk.punchArm*0.08;setTimeout(function(){def.hitFlash=0.35;def.recoilTimer=0.3;def.staggerX=(atk===f1?1:-1)*(6+t*8);def.staggerY=-2-Math.random()*3;def.leanAngle=(atk===f1?1:-1)*(0.05+t*0.1);def.health=Math.max(0,def.health-dmg);G.arenaShake=Math.max(G.arenaShake,shake);G.crowdRoar=Math.min(1,G.crowdRoar+0.15);spawnParticles(dx,dy-30,'fire',pc)},130)}
  function _tkk(atk,def,dx,dy){atk.kickPhase='windup';atk.kickTimer=0.1;atk.kickWindup=0;atk.weightTarget=-0.6;atk.leanAngle=(atk===f1?-1:1)*0.12;setTimeout(function(){def.hitFlash=0.4;def.recoilTimer=0.35;def.staggerX=(atk===f1?1:-1)*(10+t*10);def.staggerY=-4;def.leanAngle=(atk===f1?1:-1)*0.15;def.health=Math.max(0,def.health-(0.012+t*0.025));G.arenaShake=Math.max(G.arenaShake,3+t*5);G.crowdRoar=Math.min(1,G.crowdRoar+0.25);spawnParticles(dx,dy-20,'fire',Math.floor(4+t*10))},180)}

  if(G.phase==='BETTING'){var cs=0.4;f1.stance+=dt*cs;f2.stance=f1.stance+Math.PI;var cr=arenaR*0.35;_sp(f1,acx+Math.cos(f1.stance)*cr,acy+Math.sin(f1.stance)*cr*0.4);_sp(f2,acx+Math.cos(f2.stance)*cr,acy+Math.sin(f2.stance)*cr*0.4);f1.health=1;f2.health=1;f1.punchPhase='idle';f2.punchPhase='idle';f1.kickPhase='idle';f2.kickPhase='idle';f1.hitFlash=0;f2.hitFlash=0;f1.staggerX=0;f2.staggerX=0;G.koTimer=0}
  else if(G.phase==='EXPLODE'){var prog=Math.min(1,G.phaseTimer/1.8),ep=_easeOutCubic(prog),sep=arenaR*0.6*(1-ep*0.6);_sp(f1,acx-sep,acy);_sp(f2,acx+sep,acy);G.bellRing=Math.max(0,(G.bellRing||0)-dt);if(G.phaseTimer>1.2&&G.bellRing<=0)G.bellRing=0.5}
  else if(G.phase==='FREEFALL'){G.fightStarted=true;var sep2=arenaR*(0.22-t*0.08),sw=Math.sin(time*2+t*4)*sep2*0.15;_sp(f1,acx-sep2+sw+Math.sin(time*3.5)*4*t,acy+Math.sin(time*2)*3);_sp(f2,acx+sep2-sw*0.5+Math.sin(time*2.8+1)*3*t,acy+Math.sin(time*2.3+0.5)*3);f2.x+=f2.staggerX;f2.y+=f2.staggerY;f1.x+=f1.staggerX;f1.y+=f1.staggerY;
    f1.stanceTimer-=dt;f2.stanceTimer-=dt;var pi2=Math.max(0.2,0.9-t*0.6),ki=Math.max(0.5,2.2-t*1.5);
    if(f1.stanceTimer<=0&&f1.punchPhase==='idle'&&f1.kickPhase==='idle'){var r=Math.random();if(t>0.3&&r<0.2){_tkk(f1,f2,f2.x,f2.y);f1.stanceTimer=ki*(0.8+Math.random()*0.4)}else if(r<0.65){_tp(f1,f2,f2.x,f2.y,0.005+t*0.015,1+t*2.5,Math.floor(3+t*6));f1.stanceTimer=pi2*(0.6+Math.random()*0.6)}else{f1.stanceTimer=pi2*(0.8+Math.random());f1.combo=0;f1.weightTarget=0}}
    if(f2.stanceTimer<=0&&f2.punchPhase==='idle'&&f2.kickPhase==='idle'&&f2.recoilTimer<=0){if(Math.random()<Math.max(0.08,0.45-t*0.35)){_tp(f2,f1,f1.x,f1.y,0.003,1,2);f2.stanceTimer=pi2*(1.2+Math.random()*0.8)}else{f2.stanceTimer=pi2*(1.2+Math.random());f2.blockTimer=0.5+Math.random()*0.3}}
    if(t>0.75)f2.health=Math.max(0,f2.health-dt*0.025*(t-0.5))}
  else if(G.phase==='CRASH'){G.koTimer+=dt;if(G.koTimer<0.1){G.koFlash=1;G.arenaShake=15;G.crowdRoar=1;f1.punchPhase='extend';f1.punchTimer=0.5}G.koFlash=Math.max(0,G.koFlash-dt*1.5);var fp=_easeOutCubic(Math.min(1,G.koTimer/0.8));f2.y=_lerp(acy,acy+40,fp);f2.leanAngle=_lerp(0,0.45,fp);f2.staggerX=_lerp(0,12,fp);f2.health=Math.max(0,1-fp*3);f1.leanAngle=_lerp(f1.leanAngle,-0.05,dt*3)}
  G.arenaShake=Math.max(0,G.arenaShake*(1-dt*8));G.crowdRoar=Math.max(0,G.crowdRoar-dt*0.4);G.crowdRoarSmooth=_lerp(G.crowdRoarSmooth||0,G.crowdRoar,dt*5);if(G.arenaShake>0.3)G.camera.shake=Math.max(G.camera.shake,G.arenaShake*0.6);
}

// ══════════════════════════════════════════════════════════════
// SCENE IMAGE GENERATION
// ══════════════════════════════════════════════════════════════
var SCENE={ready:false,images:{},_lastW:0,_lastH:0};
function _oc(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return{c:c,x:c.getContext('2d')}}
function _dHex(hex,amt){hex=hex.replace('#','');var r=Math.max(0,parseInt(hex.substr(0,2),16)-amt),g=Math.max(0,parseInt(hex.substr(2,2),16)-amt),b=Math.max(0,parseInt(hex.substr(4,2),16)-amt);return'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function _blur(canvas,ctx,radius){var w=canvas.width,h=canvas.height,s=Math.max(1,Math.floor(radius)),sw=Math.max(1,Math.floor(w/s)),sh=Math.max(1,Math.floor(h/s));var tmp=document.createElement('canvas');tmp.width=sw;tmp.height=sh;tmp.getContext('2d').drawImage(canvas,0,0,sw,sh);ctx.clearRect(0,0,w,h);ctx.drawImage(tmp,0,0,w,h)}

// ── BACKGROUND ──
function genBG(W,H){
  var o=_oc(W,H),c=o.x;
  var bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#020108');bg.addColorStop(0.08,'#040210');bg.addColorStop(0.2,'#080418');bg.addColorStop(0.5,'#0c0620');bg.addColorStop(0.8,'#080418');bg.addColorStop(1,'#030110');
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  c.fillStyle='#020108';c.fillRect(0,0,W,H*0.06);
  var cG=c.createLinearGradient(0,0,0,H*0.15);cG.addColorStop(0,'rgba(2,1,8,0.95)');cG.addColorStop(1,'transparent');c.fillStyle=cG;c.fillRect(0,0,W,H*0.15);
  var lc=Math.max(6,Math.floor(W/100));
  for(var i=0;i<lc;i++){var lx=W*(0.06+i*0.88/(lc-1)),ly=H*0.02;var fg=c.createRadialGradient(lx,ly,0,lx,ly,H*0.15);fg.addColorStop(0,'rgba(200,220,255,0.12)');fg.addColorStop(0.3,'rgba(150,180,255,0.04)');fg.addColorStop(1,'transparent');c.fillStyle=fg;c.beginPath();c.arc(lx,ly,H*0.15,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,252,245,0.9)';c.beginPath();c.arc(lx,ly,3,0,Math.PI*2);c.fill();c.fillStyle='rgba(220,230,255,0.5)';c.beginPath();c.arc(lx,ly,6,0,Math.PI*2);c.fill();c.save();c.globalAlpha=0.018;c.beginPath();c.moveTo(lx-3,ly+3);c.lineTo(lx-W*0.04,H*0.6);c.lineTo(lx+W*0.04,H*0.6);c.lineTo(lx+3,ly+3);c.closePath();var bG=c.createLinearGradient(lx,ly,lx,H*0.55);bG.addColorStop(0,'rgba(200,220,255,1)');bG.addColorStop(0.5,'rgba(180,200,240,0.3)');bG.addColorStop(1,'transparent');c.fillStyle=bG;c.fill();c.restore()}
  c.save();c.globalAlpha=0.07;c.beginPath();c.moveTo(W*0.28,0);c.lineTo(W*0.08,H*0.7);c.lineTo(W*0.48,H*0.7);c.closePath();var sb=c.createLinearGradient(W*0.28,0,W*0.28,H*0.65);sb.addColorStop(0,'rgba(40,100,255,0.7)');sb.addColorStop(1,'transparent');c.fillStyle=sb;c.fill();c.restore();
  c.save();c.globalAlpha=0.07;c.beginPath();c.moveTo(W*0.72,0);c.lineTo(W*0.52,H*0.7);c.lineTo(W*0.92,H*0.7);c.closePath();var sr=c.createLinearGradient(W*0.72,0,W*0.72,H*0.65);sr.addColorStop(0,'rgba(255,50,50,0.7)');sr.addColorStop(1,'transparent');c.fillStyle=sr;c.fill();c.restore();
  c.globalAlpha=0.035;var hz=c.createRadialGradient(W/2,H*0.4,0,W/2,H*0.4,H*0.7);hz.addColorStop(0,'rgba(140,120,200,1)');hz.addColorStop(0.5,'rgba(80,60,140,0.4)');hz.addColorStop(1,'transparent');c.fillStyle=hz;c.fillRect(0,0,W,H);c.globalAlpha=1;
  return o.c;
}

// ── CROWD ROW (with depth blur) ──
function genCrowd(W,H,rowIdx){
  var rowH=rowIdx===2?H*0.28:rowIdx===1?H*0.32:H*0.22;
  var o=_oc(W,Math.ceil(rowH)),c=o.x;
  var sc=rowIdx===2?0.8:rowIdx===1?1.3:2.0,alpha=rowIdx===2?0.3:rowIdx===1?0.45:0.6;
  var shirts=['#c62828','#d32f2f','#b71c1c','#1565c0','#1976d2','#0d47a1','#2e7d32','#f57f17','#4a148c','#37474f','#e0e0e0','#fff','#bf360c','#6a1b9a'];
  var skins=['#d4a574','#c68642','#8d5524','#e0ac69','#f1c27d','#6b4423'];
  var count=Math.floor(W/(10*sc)),baseY=rowH*0.9;
  for(var i=0;i<count;i++){var px=(i/count)*W+(Math.random()-0.5)*6,bw=4*sc+Math.random()*2*sc,bh=8*sc+Math.random()*3*sc,shirt=shirts[Math.floor(Math.random()*shirts.length)],skin=skins[Math.floor(Math.random()*skins.length)],hr=3*sc;c.globalAlpha=alpha;
    c.fillStyle=shirt;var sy=baseY-bh;c.beginPath();c.ellipse(px,sy+bh*0.4,bw,bh*0.45,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(px,sy+sc*0.5,bw*1.1,sc*1.5,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(0,0,0,0.12)';c.fillRect(px,sy,bw,bh*0.8);
    c.fillStyle=skin;c.fillRect(px-sc*0.6,sy-sc*1.2,sc*1.2,sc*2);c.beginPath();c.arc(px,sy-hr-sc*0.5,hr,0,Math.PI*2);c.fill();
    if(Math.random()<0.5){c.fillStyle='#0e0a05';c.beginPath();c.arc(px,sy-hr-sc*0.7,hr*0.85,Math.PI*1.1,-Math.PI*0.1);c.fill()}else{c.fillStyle=shirts[Math.floor(Math.random()*shirts.length)];c.beginPath();c.arc(px,sy-hr-sc*0.6,hr*0.9,Math.PI,0);c.fill()}
    c.fillStyle='rgba(0,0,0,0.3)';c.beginPath();c.arc(px-hr*0.2,sy-hr-sc*0.5,sc*0.3,0,Math.PI*2);c.arc(px+hr*0.2,sy-hr-sc*0.5,sc*0.3,0,Math.PI*2);c.fill();
    if(Math.random()<0.05){var fx2=px-bw*1.5,fy2=sy-bh*0.3;c.strokeStyle=skin;c.lineWidth=sc*1.2;c.lineCap='round';c.beginPath();c.moveTo(px-bw,sy+sc);c.lineTo(fx2,fy2);c.stroke();c.fillStyle=Math.random()<0.5?'#22c55e':'#ef4444';c.beginPath();c.moveTo(fx2-sc,fy2+sc*2);c.lineTo(fx2,fy2-sc*4);c.lineTo(fx2+sc,fy2+sc*2);c.closePath();c.fill();c.fillStyle='#fff';c.font='bold '+Math.floor(sc*1.5)+'px sans-serif';c.textAlign='center';c.fillText('#1',fx2,fy2-sc)}}
  c.globalAlpha=1;
  if(rowIdx===2)_blur(o.c,c,3);else if(rowIdx===1)_blur(o.c,c,1.5);
  return o.c;
}

// ── ARENA FLOOR ──
function genFloor(W,H){
  var o=_oc(W,H),c=o.x,cx2=W/2,cy2=H*0.55,r=Math.min(W,H)*0.38;
  var fg=c.createRadialGradient(cx2,cy2-r*0.1,r*0.1,cx2,cy2,r*1.1);fg.addColorStop(0,'#9a9490');fg.addColorStop(0.3,'#888078');fg.addColorStop(0.6,'#706860');fg.addColorStop(0.85,'#585048');fg.addColorStop(1,'#302828');
  c.fillStyle=fg;c.beginPath();for(var i=0;i<8;i++){var a=(i/8)*Math.PI*2-Math.PI/2;if(i===0)c.moveTo(cx2+Math.cos(a)*r,cy2+Math.sin(a)*r*0.48);else c.lineTo(cx2+Math.cos(a)*r,cy2+Math.sin(a)*r*0.48)}c.closePath();c.fill();
  c.globalAlpha=0.035;for(var ni=0;ni<300;ni++){c.fillStyle=Math.random()>0.5?'#fff':'#000';c.fillRect(cx2+(Math.random()-0.5)*r*1.8,cy2+(Math.random()-0.5)*r*0.8,1+Math.random()*2,1+Math.random()*2)}c.globalAlpha=1;
  c.strokeStyle='rgba(190,25,25,0.85)';c.lineWidth=3.5;c.beginPath();for(var i2=0;i2<8;i2++){var a2=(i2/8)*Math.PI*2-Math.PI/2;if(i2===0)c.moveTo(cx2+Math.cos(a2)*r*0.91,cy2+Math.sin(a2)*r*0.91*0.48);else c.lineTo(cx2+Math.cos(a2)*r*0.91,cy2+Math.sin(a2)*r*0.91*0.48)}c.closePath();c.stroke();
  c.strokeStyle='rgba(190,25,25,0.25)';c.lineWidth=2;c.beginPath();c.ellipse(cx2,cy2,r*0.18,r*0.18*0.48,0,0,Math.PI*2);c.stroke();
  var sp=c.createRadialGradient(cx2,cy2-r*0.15,0,cx2,cy2,r*0.7);sp.addColorStop(0,'rgba(255,255,250,0.07)');sp.addColorStop(0.5,'rgba(255,255,250,0.02)');sp.addColorStop(1,'transparent');c.fillStyle=sp;c.beginPath();c.ellipse(cx2,cy2,r,r*0.48,0,0,Math.PI*2);c.fill();
  return o.c;
}

// ── CAGE FENCE ──
function genCage(W,H){
  var o=_oc(W,H),c=o.x,cx2=W/2,cy2=H*0.55,r=Math.min(W,H)*0.4,fH=r*0.6;
  for(var pi=0;pi<8;pi++){var a1=(pi/8)*Math.PI*2-Math.PI/2,a2=((pi+1)/8)*Math.PI*2-Math.PI/2;var x1=cx2+Math.cos(a1)*r,y1=cy2+Math.sin(a1)*r*0.48,x2=cx2+Math.cos(a2)*r,y2=cy2+Math.sin(a2)*r*0.48;var isF=(y1+y2)/2>cy2-r*0.08,al=isF?0.5:0.18,t1=y1-fH*(isF?1:0.55),t2=y2-fH*(isF?1:0.55);
    c.globalAlpha=al;c.fillStyle='rgba(10,10,15,0.85)';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x2,t2);c.lineTo(x1,t1);c.closePath();c.fill();
    c.strokeStyle='rgba(90,100,110,'+al*0.5+')';c.lineWidth=0.5;var pw=Math.hypot(x2-x1,y2-y1),gs=9,hs=Math.floor(fH/gs),ws=Math.floor(pw/gs);
    for(var hi=0;hi<=hs;hi++){var hf=hi/hs;c.beginPath();c.moveTo(x1,y1-(y1-t1)*hf);c.lineTo(x2,y2-(y2-t2)*hf);c.stroke()}
    for(var wi=0;wi<=ws;wi++){var wf=wi/ws;c.beginPath();c.moveTo(x1+(x2-x1)*wf,y1+(y2-y1)*wf);c.lineTo(x1+(x2-x1)*wf,t1+(t2-t1)*wf);c.stroke()}
    c.globalAlpha=1}
  for(var i=0;i<8;i++){var pa=(i/8)*Math.PI*2-Math.PI/2,px=cx2+Math.cos(pa)*r,py=cy2+Math.sin(pa)*r*0.48,isP=py>cy2-r*0.08,pH=fH*(isP?1:0.55),pW=isP?8:5;
    c.fillStyle='rgba(0,0,0,0.35)';c.fillRect(px-pW/2+2,py-pH,pW,pH+3);
    var pG=c.createLinearGradient(px-pW/2,0,px+pW/2,0);pG.addColorStop(0,'#3a3a3a');pG.addColorStop(0.15,'#777');pG.addColorStop(0.35,'#aaa');pG.addColorStop(0.5,'#bbb');pG.addColorStop(0.65,'#999');pG.addColorStop(0.85,'#666');pG.addColorStop(1,'#3a3a3a');c.fillStyle=pG;c.fillRect(px-pW/2,py-pH,pW,pH);
    c.fillStyle='#bbb';c.beginPath();c.ellipse(px,py-pH,pW*0.65,3,0,0,Math.PI*2);c.fill();c.fillStyle='#555';c.fillRect(px-pW*0.7,py-2,pW*1.4,4);
    c.fillStyle=i<4?'rgba(30,70,200,0.45)':'rgba(200,25,25,0.45)';c.fillRect(px-pW/2-1,py-pH,pW+2,10);c.fillStyle='rgba(255,255,255,0.1)';c.fillRect(px-pW/2+1,py-pH,1.5,pH)}
  c.strokeStyle='rgba(130,140,150,0.45)';c.lineWidth=2.5;c.beginPath();for(var ri=0;ri<=8;ri++){var ra=(ri%8)/8*Math.PI*2-Math.PI/2,rpx=cx2+Math.cos(ra)*r,rpy=cy2+Math.sin(ra)*r*0.48,isFR=rpy>cy2-r*0.08,trY=rpy-fH*(isFR?1:0.55);if(ri===0)c.moveTo(rpx,trY);else c.lineTo(rpx,trY)}c.stroke();
  return o.c;
}

// ── FIGHTER (detailed, 3D shading) ──
function genFighter(w,h,masked){
  var o=_oc(w,h),c=o.x,fx=w/2,fy=h*0.52,s=Math.min(w,h)/110;
  var skB=masked?'#c08060':'#d4a574',skD=masked?'#905840':'#b08050',skL=masked?'#d8a080':'#e8c098';
  var shorts=masked?'#1a4a8a':'#8a1a1a',glove=masked?'#1844aa':'#aa2222',acc=masked?'#4488ff':'#ff4444';
  // Shadow
  c.fillStyle='rgba(0,0,0,0.18)';c.beginPath();c.ellipse(fx,fy+36*s,20*s,5*s,0,0,Math.PI*2);c.fill();
  // Feet
  c.fillStyle='#151515';c.beginPath();c.ellipse(fx-7*s,fy+33*s,4*s,2*s,0.1,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(fx+7*s,fy+33*s,4*s,2*s,-0.1,0,Math.PI*2);c.fill();
  // Legs
  var lG=c.createLinearGradient(fx-14*s,0,fx+14*s,0);lG.addColorStop(0,skD);lG.addColorStop(0.3,skB);lG.addColorStop(0.7,skB);lG.addColorStop(1,skD);c.fillStyle=lG;
  c.beginPath();c.moveTo(fx-3*s,fy+8*s);c.quadraticCurveTo(fx-13*s,fy+20*s,fx-9*s,fy+32*s);c.lineTo(fx-3*s,fy+32*s);c.quadraticCurveTo(fx-5*s,fy+20*s,fx+1*s,fy+8*s);c.fill();
  c.beginPath();c.moveTo(fx+3*s,fy+8*s);c.quadraticCurveTo(fx+13*s,fy+20*s,fx+9*s,fy+32*s);c.lineTo(fx+3*s,fy+32*s);c.quadraticCurveTo(fx+5*s,fy+20*s,fx-1*s,fy+8*s);c.fill();
  c.fillStyle=skL;c.globalAlpha=0.12;c.beginPath();c.ellipse(fx-7*s,fy+18*s,3*s,6*s,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(fx+7*s,fy+18*s,3*s,6*s,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
  // Shorts
  var sG=c.createLinearGradient(0,fy+1*s,0,fy+13*s);sG.addColorStop(0,shorts);sG.addColorStop(1,_dHex(shorts,30));c.fillStyle=sG;c.beginPath();c.moveTo(fx-10*s,fy+1*s);c.lineTo(fx-11*s,fy+13*s);c.quadraticCurveTo(fx,fy+14*s,fx+11*s,fy+13*s);c.lineTo(fx+10*s,fy+1*s);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,0.35)';c.fillRect(fx-10.5*s,fy+2*s,1.5*s,10*s);c.fillRect(fx+9*s,fy+2*s,1.5*s,10*s);c.fillStyle='rgba(255,255,255,0.15)';c.fillRect(fx-10*s,fy+0.5*s,20*s,2*s);
  // Torso
  var tG=c.createLinearGradient(fx-14*s,0,fx+14*s,0);tG.addColorStop(0,skD);tG.addColorStop(0.2,skL);tG.addColorStop(0.45,skB);tG.addColorStop(0.7,skB);tG.addColorStop(1,skD);c.fillStyle=tG;
  c.beginPath();c.moveTo(fx-12*s,fy-14*s);c.quadraticCurveTo(fx-14*s,fy-4*s,fx-10*s,fy+3*s);c.lineTo(fx+10*s,fy+3*s);c.quadraticCurveTo(fx+14*s,fy-4*s,fx+12*s,fy-14*s);c.quadraticCurveTo(fx,fy-17*s,fx-12*s,fy-14*s);c.fill();
  // Pecs + abs
  c.fillStyle=skD;c.globalAlpha=0.1;c.beginPath();c.ellipse(fx-5*s,fy-10*s,5.5*s,3.5*s,-0.1,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(fx+5*s,fy-10*s,5.5*s,3.5*s,0.1,0,Math.PI*2);c.fill();c.globalAlpha=1;
  c.strokeStyle=skD;c.globalAlpha=0.1;c.lineWidth=0.5*s;c.beginPath();c.moveTo(fx,fy-8*s);c.lineTo(fx,fy+2*s);c.stroke();for(var ai=0;ai<3;ai++){c.beginPath();c.moveTo(fx-5*s,fy-5*s+ai*3.5*s);c.lineTo(fx+5*s,fy-5*s+ai*3.5*s);c.stroke()}c.globalAlpha=1;
  // Deltoids
  c.fillStyle=skB;c.beginPath();c.ellipse(fx-14*s,fy-13*s,5*s,4.5*s,-0.2,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(fx+14*s,fy-13*s,5*s,4.5*s,0.2,0,Math.PI*2);c.fill();
  // Arms
  c.strokeStyle=skB;c.lineWidth=7*s;c.lineCap='round';c.beginPath();c.moveTo(fx-14*s,fy-12*s);c.quadraticCurveTo(fx-18*s,fy-4*s,fx-11*s,fy-18*s);c.stroke();c.beginPath();c.moveTo(fx+14*s,fy-12*s);c.quadraticCurveTo(fx+18*s,fy-4*s,fx+11*s,fy-18*s);c.stroke();
  // Gloves
  function _gl(gx,gy){var gg=c.createRadialGradient(gx-s,gy-s,0,gx,gy,7*s);gg.addColorStop(0,glove);gg.addColorStop(0.7,_dHex(glove,30));gg.addColorStop(1,_dHex(glove,60));c.fillStyle=gg;c.beginPath();c.arc(gx,gy,7*s,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,255,255,0.15)';c.beginPath();c.ellipse(gx+s,gy-2*s,3*s,2*s,0,0,Math.PI*2);c.fill()}
  _gl(fx-11*s,fy-18*s);_gl(fx+11*s,fy-18*s);
  // Neck
  c.fillStyle=skB;c.fillRect(fx-4*s,fy-20*s,8*s,7*s);
  // Head
  var headR=10*s,headY=fy-29*s;var hG=c.createRadialGradient(fx-2*s,headY-2*s,headR*0.2,fx,headY,headR);hG.addColorStop(0,skL);hG.addColorStop(0.5,skB);hG.addColorStop(1,skD);c.fillStyle=hG;c.beginPath();c.ellipse(fx,headY,headR*0.88,headR,0,0,Math.PI*2);c.fill();
  if(masked){
    var mG=c.createRadialGradient(fx,headY,headR*0.3,fx,headY,headR);mG.addColorStop(0,'#1a1a3a');mG.addColorStop(1,'#08081a');c.fillStyle=mG;c.beginPath();c.ellipse(fx,headY-s,headR*0.88,headR*0.6,0,Math.PI,0);c.fill();c.beginPath();c.ellipse(fx,headY+s,headR*0.88,headR*0.4,0,0,Math.PI);c.fill();
    c.fillStyle='#000';c.beginPath();c.moveTo(fx-7*s,headY-2*s);c.lineTo(fx-2*s,headY-3.5*s);c.lineTo(fx-1*s,headY-0.5*s);c.lineTo(fx-7.5*s,headY+0.5*s);c.fill();c.beginPath();c.moveTo(fx+1*s,headY-3.5*s);c.lineTo(fx+6*s,headY-2*s);c.lineTo(fx+6.5*s,headY+0.5*s);c.lineTo(fx+0.5*s,headY-0.5*s);c.fill();
    c.shadowColor=acc;c.shadowBlur=10;c.fillStyle=acc;c.beginPath();c.ellipse(fx-4*s,headY-1.5*s,2*s,1.2*s,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(fx+3.5*s,headY-1.5*s,2*s,1.2*s,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
    c.fillStyle=skB;c.beginPath();c.ellipse(fx,headY+headR*0.55,headR*0.5,headR*0.35,0,0,Math.PI);c.fill();c.strokeStyle=skD;c.lineWidth=0.7*s;c.beginPath();c.moveTo(fx-3*s,headY+5.5*s);c.lineTo(fx+3*s,headY+5.5*s);c.stroke();
  }else{
    c.fillStyle='#1a1008';c.beginPath();c.arc(fx,headY-2*s,headR*0.82,Math.PI*1.05,-Math.PI*0.05);c.fill();
    c.fillStyle='#f0f0f0';c.beginPath();c.ellipse(fx-3.5*s,headY-1.5*s,3*s,2*s,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(fx+3.5*s,headY-1.5*s,3*s,2*s,0,0,Math.PI*2);c.fill();
    c.fillStyle='#3a2a1a';c.beginPath();c.arc(fx-3*s,headY-1.5*s,1.5*s,0,Math.PI*2);c.fill();c.beginPath();c.arc(fx+4*s,headY-1.5*s,1.5*s,0,Math.PI*2);c.fill();
    c.fillStyle='#0a0a0a';c.beginPath();c.arc(fx-3*s,headY-1.5*s,0.8*s,0,Math.PI*2);c.fill();c.beginPath();c.arc(fx+4*s,headY-1.5*s,0.8*s,0,Math.PI*2);c.fill();
    c.strokeStyle='#1a1008';c.lineWidth=1.3*s;c.lineCap='round';c.beginPath();c.moveTo(fx-6.5*s,headY-4*s);c.quadraticCurveTo(fx-3*s,headY-5*s,fx-1*s,headY-3.5*s);c.stroke();c.beginPath();c.moveTo(fx+1*s,headY-3.5*s);c.quadraticCurveTo(fx+3*s,headY-5*s,fx+6.5*s,headY-4*s);c.stroke();
    c.strokeStyle=skD;c.lineWidth=0.8*s;c.beginPath();c.moveTo(fx,headY);c.quadraticCurveTo(fx+s,headY+2.5*s,fx,headY+3*s);c.stroke();
    c.beginPath();c.moveTo(fx-2.5*s,headY+5*s);c.quadraticCurveTo(fx,headY+5.5*s,fx+2.5*s,headY+5*s);c.stroke();
    c.fillStyle=skB;c.beginPath();c.ellipse(fx-headR*0.88,headY,2.5*s,3.5*s,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(fx+headR*0.88,headY,2.5*s,3.5*s,0,0,Math.PI*2);c.fill();
  }
  // Rim light
  c.save();c.globalAlpha=0.06;c.strokeStyle='#aaccff';c.lineWidth=2*s;c.beginPath();c.ellipse(fx,fy-5*s,13*s,22*s,0,Math.PI*1.3,Math.PI*1.7);c.stroke();c.restore();
  return o.c;
}

// ══════════════════════════════════════════════════════════════
// RENDER — Composite layers each frame
// ══════════════════════════════════════════════════════════════
function render(){
  try{
  if(!cv||!cx)return;var W=cv.width,H=cv.height;if(!W||!H)return;
  SCENE.ready=true;
  if(!G.f1||!G.f2){try{initFighterState()}catch(e){}}
  if(!G.crowd||G.crowd.length===0){try{initCrowd()}catch(e){}}
  cx.clearRect(0,0,W,H);cx.save();
  var cam=G.camera||{};if((cam.shake||0)>0.1)cx.translate((Math.random()-0.5)*cam.shake,(Math.random()-0.5)*cam.shake);
  var z=cam.zoom||1;if(z!==1){var zx=cam.zoomX||W*0.5,zy=cam.zoomY||H*0.45;cx.translate(zx,zy);cx.scale(z,z);cx.translate(-zx,-zy)}
  G.tension=getTension(G.mult||1);var t=G.tension,acx=W*0.5,acy=H*0.55;

  // Fight video — fullscreen cover
  var fightVid=document.getElementById('fightVideo');
  if(fightVid){
    if(fightVid.paused&&fightVid.readyState>=2){try{fightVid.play()}catch(e){}}
    if(fightVid.readyState>=2){
      var vidW=fightVid.videoWidth||1280,vidH=fightVid.videoHeight||720;
      var vidAspect=vidW/vidH,scrAspect=W/H;
      // Cover: fill entire screen, crop overflow
      var drawW,drawH;
      if(scrAspect>vidAspect){drawW=W;drawH=W/vidAspect}else{drawH=H;drawW=H*vidAspect}
      cx.drawImage(fightVid,(W-drawW)/2,(H-drawH)/2,drawW,drawH);
    }else{
      // Black until video loads
      cx.fillStyle='#000';cx.fillRect(0,0,W,H);
    }
  }else{
    cx.fillStyle='#000';cx.fillRect(0,0,W,H);
  }

  // Health bars
  if(f1&&f2&&G.phase!=='BETTING'&&G.phase!=='WAITING'&&G.phase!=='INIT'){var bW=Math.min(200,W*0.2),bH=10,bY=H*0.07;cx.fillStyle='rgba(0,0,0,0.55)';cx.fillRect(acx-bW-28,bY-1,bW+2,bH+2);var hp1=Math.max(0,Math.min(1,f1.health));var hg1=cx.createLinearGradient(acx-bW-27,0,acx-27,0);hg1.addColorStop(0,'#2266cc');hg1.addColorStop(1,'#44aaff');cx.fillStyle=hg1;cx.fillRect(acx-bW-27,bY,bW*hp1,bH);cx.fillStyle='#4488ff';cx.font='bold 11px sans-serif';cx.textAlign='right';cx.fillText('MASKED',acx-28,bY-3);cx.fillStyle='rgba(0,0,0,0.55)';cx.fillRect(acx+26,bY-1,bW+2,bH+2);var hp2=Math.max(0,Math.min(1,f2.health));var hg2=cx.createLinearGradient(acx+27,0,acx+27+bW*hp2,0);hg2.addColorStop(0,'#cc2222');hg2.addColorStop(1,'#ff4444');cx.fillStyle=hg2;cx.fillRect(acx+27,bY,bW*hp2,bH);cx.fillStyle='#ff4444';cx.textAlign='left';cx.fillText('FIGHTER',acx+28,bY-3)}

  // Particles
  G.particles=(G.particles||[]).filter(function(p){p.x+=p.vx*(G.dt||0.016)*60;p.y+=p.vy*(G.dt||0.016)*60;p.vy+=(G.dt||0.016)*7;p.life-=(G.dt||0.016)*1.2;if(p.life<=0)return false;var a=p.life*p.life;cx.beginPath();cx.arc(p.x,p.y,p.r*(0.5+p.life*0.5),0,Math.PI*2);cx.fillStyle='hsla('+(p.hue||20)+','+(p.sat||100)+'%,'+(p.lit||55)+'%,'+a+')';cx.fill();return true});

  // KO
  if(G.phase==='CRASH'){var koT=G.koTimer||0;if((G.koFlash||0)>0){cx.globalAlpha=G.koFlash*0.4;cx.fillStyle='#ff0000';cx.fillRect(0,0,W,H);cx.globalAlpha=1}if(koT>0.3){var tp=Math.min(1,(koT-0.3)/0.4),ts=0.5+tp*0.5;cx.save();cx.translate(acx,acy-H*0.15);cx.scale(ts,ts);cx.globalAlpha=tp;cx.shadowColor='#ff2222';cx.shadowBlur=30;cx.font='bold 72px sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillStyle='#ff2222';cx.fillText('K.O.',0,0);cx.strokeStyle='rgba(255,255,255,0.3)';cx.lineWidth=2;cx.strokeText('K.O.',0,0);cx.shadowBlur=0;if(koT>1){cx.globalAlpha=Math.min(1,(koT-1)/0.5);cx.font='bold 24px sans-serif';cx.fillStyle='rgba(255,255,255,0.8)';cx.fillText((G.mult||1).toFixed(2)+'x',0,45)}cx.restore()}}

  // Bell flash
  if((G.bellRing||0)>0){cx.globalAlpha=G.bellRing*0.15;cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.globalAlpha=1}

  // Vignette
  var vS=0.3+t*0.3;var vG=cx.createRadialGradient(W/2,H/2,H*0.18,W/2,H/2,H*0.85);vG.addColorStop(0,'transparent');vG.addColorStop(0.55,'rgba(0,0,0,'+vS*0.25+')');vG.addColorStop(1,'rgba(0,0,0,'+vS+')');cx.fillStyle=vG;cx.fillRect(0,0,W,H);
  cx.restore();
  }catch(e){console.error('MMA Render error:',e);try{cx.restore()}catch(e2){}}
}
