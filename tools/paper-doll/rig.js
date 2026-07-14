const RIG = {
  hips:      {src:'parts/hips.png',      pivot:[165,120], parent:null, anchor:[450,470], rot:0,  z:30},
  torso:     {src:'parts/torso.png',     pivot:[190,460], parent:'hips', anchor:[165,55],  rot:0,  z:40},
  head:      {src:'parts/head.png',      pivot:[125,290], parent:'torso', anchor:[172,55], rot:0,  z:45},
  // native art: both arms hang straight down; +rot swings the limb toward viewer-left.
  // far (right) arm: elbow is at the part's bottom-RIGHT (185,265)
  upperarm_R:{src:'parts/upperarm_R.png',pivot:[85,70],   parent:'torso', anchor:[318,110],rot:5,   z:38},
  forearm_R: {src:'parts/forearm_R.png', pivot:[110,55],  parent:'upperarm_R', anchor:[185,265], rot:140, z:55},
  // lead (left) arm forward, fist raised
  upperarm_L:{src:'parts/upperarm_L.png',pivot:[115,45],  parent:'torso', anchor:[52,115], rot:50,  z:50},
  forearm_L: {src:'parts/forearm_L.png', pivot:[120,50],  parent:'upperarm_L', anchor:[105,285], rot:105, z:51},
  thigh_R:   {src:'parts/thigh_R.png',   pivot:[178,158], parent:'hips', anchor:[220,112], rot:-6, z:25},
  shin_R:    {src:'parts/shin_R.png',    pivot:[399,62],  parent:'thigh_R', anchor:[445,440], rot:2, z:24},
  thigh_L:   {src:'parts/thigh_L.png',   pivot:[150,120], parent:'hips', anchor:[125,142], rot:8, z:20},
  shin_L:    {src:'parts/shin_L.png',    pivot:[395,62],  parent:'thigh_L', anchor:[445,440], rot:-10, z:19},
};

const SCALE = 0.5;
const POSES = {
  guard:   {},
  jab:     {upperarm_L:92, forearm_L:4, torso:-6, head:4, upperarm_R:14, forearm_R:148},
  cross:   {upperarm_R:96, forearm_R:-2, torso:-14, hips:-8, head:6,
            upperarm_L:16, forearm_L:132},
  block:   {upperarm_L:62, forearm_L:128, upperarm_R:20, forearm_R:155, head:6, torso:2},
  legkick: {thigh_R:78, shin_R:64, torso:-14, hips:-10, upperarm_L:30, forearm_L:120,
            upperarm_R:-18, forearm_R:150, thigh_L:16, shin_L:-4},
  hit:     {torso:14, head:22, upperarm_L:35, forearm_L:130, upperarm_R:-6, forearm_R:150, hips:4},
  victory: {upperarm_L:168, forearm_L:12, upperarm_R:-148, forearm_R:-12, head:-8},
  // KO: fallen on his back, head away from the opponent. hips IS the root, so its
  // rot lays the whole body down; __dy drops the root to the floor line.
  ko:      {hips:84, __dy:210, torso:4, head:-16,
            upperarm_L:18, forearm_L:14, upperarm_R:178, forearm_R:-8,
            thigh_L:4, shin_L:-10, thigh_R:12, shin_R:-12},
};

const BASEPOSE = {}; for(const k in RIG) BASEPOSE[k]=RIG[k].rot;
function poseAngles(name, blend){
  // returns {part:angle,...,__dx,__dy} for a pose (blend unused here)
  const p = POSES[name]||{};
  const out = {__dx:p.__dx||0, __dy:p.__dy||0};
  for(const k in RIG) out[k] = (k in p) ? p[k] : BASEPOSE[k];
  return out;
}
function lerpPose(a, b, t){
  const e = t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;   // easeInOutQuad
  const out = {__dx:a.__dx+(b.__dx-a.__dx)*e, __dy:a.__dy+(b.__dy-a.__dy)*e};
  for(const k in RIG) out[k] = a[k] + (b[k]-a[k])*e;
  return out;
}
function drawDoll(cx, imgs, angles, ox, oy, scale){
  const world={};
  const order=Object.keys(RIG).sort((x,y)=>RIG[x].z-RIG[y].z);
  function mat(name){
    if(world[name])return world[name];
    const p=RIG[name];let m;
    if(!p.parent){
      m=new DOMMatrix().translate(p.anchor[0]+ox+(angles.__dx||0), p.anchor[1]+oy+(angles.__dy||0))
        .scale(scale).rotate(angles[name]).translate(-p.pivot[0],-p.pivot[1]);
    }else{
      m=mat(p.parent).multiply(new DOMMatrix().translate(p.anchor[0],p.anchor[1])
        .rotate(angles[name]).translate(-p.pivot[0],-p.pivot[1]));
    }
    world[name]=m;return m;
  }
  for(const k of order){cx.setTransform(mat(k));cx.drawImage(imgs[k],0,0);}
  cx.setTransform(1,0,0,1,0,0);
}
