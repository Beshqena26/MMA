// ======================== EASING HELPERS ========================
function _easeOutBack(x) { return 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2); }
function _easeOutElastic(x) { if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1; }
function _easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
function _easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function _easeInBack(x) { return 2.7 * x * x * x - 1.7 * x * x; }
function _lerp(a, b, t) { return a + (b - a) * t; }

// ======================== FIGHTER STATE ========================
function initFighterState() {
  function _mkFighter() {
    return {
      x: 0, y: 0, targetX: 0, targetY: 0,
      health: 1,
      stance: 0, stanceTimer: 0,
      // Punch: windUp → extend → hold → retract
      punchTimer: 0, punchPhase: 'idle', punchWindup: 0, punchArm: 1,
      // Kick
      kickTimer: 0, kickPhase: 'idle', kickWindup: 0,
      // Block
      blockTimer: 0, blockAmount: 0,
      // Combo
      combo: 0,
      // Hit reaction
      hitFlash: 0, staggerX: 0, staggerY: 0, recoilTimer: 0,
      // Visual state (smoothly lerped)
      dodgeX: 0, leanAngle: 0, hipShift: 0,
      // Walk & idle
      walkCycle: 0, breathCycle: 0,
      // Blink
      blinkTimer: 2 + Math.random() * 3, blinkAmount: 0,
      // Weight shift
      weightShift: 0, weightTarget: 0
    };
  }
  G.f1 = _mkFighter();
  G.f2 = _mkFighter();
  G.crowd = [];
  G.tension = 0;
  G.koTimer = 0;
  G.koFlash = 0;
  G.bellRing = 0;
  G.arenaShake = 0;
  G.crowdRoar = 0;
  G.crowdRoarSmooth = 0;
  G.fightStarted = false;
}

// ======================== OCTAGON VERTICES ========================
var OCT_VERTS = [];
(function() {
  for (var i = 0; i < 8; i++) {
    var a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    OCT_VERTS.push({x: Math.cos(a), y: Math.sin(a)});
  }
})();

// ======================== CROWD ========================
// Stadium-style crowd: large colorful silhouettes, foam fingers, banners
var CROWD_SHIRT_COLORS = [
  '#c62828','#d32f2f','#e53935','#b71c1c', // reds
  '#1565c0','#1976d2','#1e88e5','#0d47a1', // blues
  '#2e7d32','#388e3c', // greens
  '#f57f17','#ff8f00', // golds
  '#4a148c','#6a1b9a', // purples
  '#37474f','#455a64','#546e7a', // grays
  '#bf360c','#e65100', // oranges
  '#fff','#e0e0e0' // whites
];
function initCrowd() {
  G.crowd = [];
  var count = Math.min(180, Math.floor(cv.width / 5));
  for (var i = 0; i < count; i++) {
    var row = i < count * 0.3 ? 2 : i < count * 0.6 ? 1 : 0;
    G.crowd.push({
      x: (i % Math.ceil(count / 3)) / Math.ceil(count / 3) + (Math.random() - 0.5) * 0.03,
      row: row,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2.5,
      height: 0.7 + Math.random() * 0.4,
      shirt: CROWD_SHIRT_COLORS[Math.floor(Math.random() * CROWD_SHIRT_COLORS.length)],
      skinTone: ['#d4a574','#c68642','#8d5524','#e0ac69','#f1c27d','#6b4423'][Math.floor(Math.random() * 6)],
      hasFoamFinger: Math.random() < 0.08,
      hasBanner: Math.random() < 0.04,
      bannerColor: Math.random() < 0.5 ? '#ef4444' : '#3b82f6',
      foamColor: Math.random() < 0.5 ? '#22c55e' : '#ef4444',
      hairType: Math.floor(Math.random() * 3), // 0=short, 1=none, 2=cap
      capColor: CROWD_SHIRT_COLORS[Math.floor(Math.random() * CROWD_SHIRT_COLORS.length)],
      armPhase: Math.random() * Math.PI * 2,
      bodyWidth: 0.8 + Math.random() * 0.5
    });
  }
}

// ======================== TENSION ========================
function getTension(mult) {
  if (mult <= 1.0) return 0;
  if (mult <= 1.5) return (mult - 1.0) / 0.5 * 0.25;
  if (mult <= 3.0) return 0.25 + (mult - 1.5) / 1.5 * 0.25;
  if (mult <= 7.0) return 0.50 + (mult - 3.0) / 4.0 * 0.25;
  return Math.min(1.0, 0.75 + (mult - 7.0) / 13.0 * 0.25);
}

function getTensionColor(t) {
  // Returns an rgba color string (without closing paren) for tension level
  var r = Math.floor(80 + t * 175);
  var g = Math.floor(180 - t * 150);
  var b = Math.floor(255 - t * 200);
  return 'rgba(' + r + ',' + g + ',' + b + ',';
}

// ======================== UPDATE FIGHTERS ========================
function updateFighters() {
  var dt = G.dt || 0.016;
  var t = G.tension;
  var f1 = G.f1, f2 = G.f2;
  if (!f1 || !f2) return;
  var W = cv.width, H = cv.height;
  var acx = W * 0.5, acy = H * 0.55;
  var arenaR = Math.min(W, H) * 0.28;
  var time = G.time;

  // ─── Smooth cycles ───
  f1.walkCycle += dt * (1.5 + t * 3);
  f2.walkCycle += dt * (1.5 + t * 2.5);
  f1.breathCycle += dt * 2.8;
  f2.breathCycle += dt * 3.1;

  // ─── Eye blink (both fighters) ───
  function _updateBlink(f) {
    f.blinkTimer -= dt;
    if (f.blinkTimer <= 0) {
      f.blinkAmount = 1;
      f.blinkTimer = 2.5 + Math.random() * 4;
    }
    if (f.blinkAmount > 0) {
      f.blinkAmount = Math.max(0, f.blinkAmount - dt * 8); // blink lasts ~0.12s
    }
  }
  _updateBlink(f1);
  _updateBlink(f2);

  // ─── Weight shift (smooth lerp to target) ───
  function _updateWeight(f) {
    f.weightShift = _lerp(f.weightShift, f.weightTarget, dt * 4);
  }
  _updateWeight(f1);
  _updateWeight(f2);

  // ─── Smooth position interpolation ───
  function _smoothPos(f, tx, ty) {
    f.targetX = tx; f.targetY = ty;
    f.x = _lerp(f.x, tx, dt * 8);
    f.y = _lerp(f.y, ty, dt * 8);
  }

  // ─── Punch system: windUp(0.08s) → extend(0.1s) → hold(0.05s) → retract(0.1s) ───
  function _updatePunch(f) {
    if (f.punchPhase === 'idle') return;
    f.punchTimer -= dt;
    if (f.punchPhase === 'windup') {
      f.punchWindup = Math.min(1, f.punchWindup + dt * 12); // coil back
      if (f.punchTimer <= 0) { f.punchPhase = 'extend'; f.punchTimer = 0.1; }
    } else if (f.punchPhase === 'extend') {
      f.punchWindup = 0;
      if (f.punchTimer <= 0) { f.punchPhase = 'hold'; f.punchTimer = 0.05; }
    } else if (f.punchPhase === 'hold') {
      if (f.punchTimer <= 0) { f.punchPhase = 'retract'; f.punchTimer = 0.12; }
    } else if (f.punchPhase === 'retract') {
      if (f.punchTimer <= 0) { f.punchPhase = 'idle'; f.punchTimer = 0; }
    }
  }
  _updatePunch(f1);
  _updatePunch(f2);

  // ─── Kick system: windup → extend → retract ───
  function _updateKick(f) {
    if (f.kickPhase === 'idle') return;
    f.kickTimer -= dt;
    if (f.kickPhase === 'windup') {
      f.kickWindup = Math.min(1, f.kickWindup + dt * 10);
      if (f.kickTimer <= 0) { f.kickPhase = 'extend'; f.kickTimer = 0.15; }
    } else if (f.kickPhase === 'extend') {
      f.kickWindup = 0;
      if (f.kickTimer <= 0) { f.kickPhase = 'retract'; f.kickTimer = 0.15; }
    } else if (f.kickPhase === 'retract') {
      if (f.kickTimer <= 0) { f.kickPhase = 'idle'; f.kickTimer = 0; }
    }
  }
  _updateKick(f1);
  _updateKick(f2);

  // ─── Hit reaction: stagger + recoil ───
  function _updateHitReaction(f) {
    if (f.recoilTimer > 0) {
      f.recoilTimer -= dt;
      var recoilProg = f.recoilTimer / 0.3;
      f.staggerX *= (1 - dt * 6); // smooth decay
      f.staggerY *= (1 - dt * 8);
    } else {
      f.staggerX *= (1 - dt * 10);
      f.staggerY *= (1 - dt * 10);
    }
    f.hitFlash = Math.max(0, f.hitFlash - dt * 2.5); // slower flash decay
    f.blockAmount = _lerp(f.blockAmount, f.blockTimer > 0 ? 1 : 0, dt * 8);
    f.blockTimer = Math.max(0, f.blockTimer - dt);
    f.leanAngle = _lerp(f.leanAngle, 0, dt * 5);
  }
  _updateHitReaction(f1);
  _updateHitReaction(f2);

  // ─── Trigger a punch with full animation phases ───
  function _triggerPunch(attacker, defender, defX, defY, damage, shakeAmt, particleCount) {
    attacker.punchPhase = 'windup';
    attacker.punchTimer = 0.08;
    attacker.punchWindup = 0;
    attacker.combo = Math.min(5, attacker.combo + 1);
    attacker.punchArm = attacker.combo % 2 === 0 ? 1 : -1;
    attacker.weightTarget = attacker.punchArm * 0.5;
    attacker.leanAngle = attacker.punchArm * 0.08;
    // Schedule hit impact (after windup + half of extend)
    setTimeout(function() {
      defender.hitFlash = 0.35;
      defender.recoilTimer = 0.3;
      defender.staggerX = (attacker === f1 ? 1 : -1) * (6 + t * 8);
      defender.staggerY = -2 - Math.random() * 3;
      defender.leanAngle = (attacker === f1 ? 1 : -1) * (0.05 + t * 0.1);
      defender.health = Math.max(0, defender.health - damage);
      G.arenaShake = Math.max(G.arenaShake, shakeAmt);
      G.crowdRoar = Math.min(1, G.crowdRoar + 0.15);
      spawnParticles(defX, defY - 30, 'fire', particleCount);
    }, 130);
  }

  // ─── Trigger a kick ───
  function _triggerKick(attacker, defender, defX, defY) {
    attacker.kickPhase = 'windup';
    attacker.kickTimer = 0.1;
    attacker.kickWindup = 0;
    attacker.weightTarget = -0.6;
    attacker.leanAngle = (attacker === f1 ? -1 : 1) * 0.12;
    setTimeout(function() {
      defender.hitFlash = 0.4;
      defender.recoilTimer = 0.35;
      defender.staggerX = (attacker === f1 ? 1 : -1) * (10 + t * 10);
      defender.staggerY = -4;
      defender.leanAngle = (attacker === f1 ? 1 : -1) * 0.15;
      defender.health = Math.max(0, defender.health - (0.012 + t * 0.025));
      G.arenaShake = Math.max(G.arenaShake, 3 + t * 5);
      G.crowdRoar = Math.min(1, G.crowdRoar + 0.25);
      spawnParticles(defX, defY - 20, 'fire', Math.floor(4 + t * 10));
    }, 180);
  }

  // ═══ PHASE LOGIC ═══

  if (G.phase === 'BETTING') {
    var circleSpeed = 0.4;
    f1.stance += dt * circleSpeed;
    f2.stance = f1.stance + Math.PI;
    var circR = arenaR * 0.35;
    _smoothPos(f1, acx + Math.cos(f1.stance) * circR, acy + Math.sin(f1.stance) * circR * 0.4);
    _smoothPos(f2, acx + Math.cos(f2.stance) * circR, acy + Math.sin(f2.stance) * circR * 0.4);
    f1.health = 1; f2.health = 1;
    f1.punchPhase = 'idle'; f2.punchPhase = 'idle';
    f1.kickPhase = 'idle'; f2.kickPhase = 'idle';
    f1.hitFlash = 0; f2.hitFlash = 0;
    f1.staggerX = 0; f2.staggerX = 0;
    G.koTimer = 0;
  }
  else if (G.phase === 'EXPLODE') {
    // Walkout — smooth approach with ease-out
    var prog = Math.min(1, G.phaseTimer / 1.8);
    var easedProg = _easeOutCubic(prog);
    var sep = arenaR * 0.6 * (1 - easedProg * 0.6);
    _smoothPos(f1, acx - sep, acy);
    _smoothPos(f2, acx + sep, acy);
    G.bellRing = Math.max(0, (G.bellRing || 0) - dt);
    if (G.phaseTimer > 1.2 && G.bellRing <= 0) G.bellRing = 0.5;
  }
  else if (G.phase === 'FREEFALL') {
    G.fightStarted = true;
    var sep2 = arenaR * (0.22 - t * 0.08);
    var sway = Math.sin(time * 2 + t * 4) * sep2 * 0.15;
    // Natural bob & weave
    var f1tx = acx - sep2 + sway + Math.sin(time * 3.5) * 4 * t;
    var f2tx = acx + sep2 - sway * 0.5 + Math.sin(time * 2.8 + 1) * 3 * t;
    var f1ty = acy + Math.sin(time * 2) * 3;
    var f2ty = acy + Math.sin(time * 2.3 + 0.5) * 3;
    _smoothPos(f1, f1tx, f1ty);
    _smoothPos(f2, f2tx, f2ty);

    // Apply stagger offset
    f2.x += f2.staggerX;
    f2.y += f2.staggerY;
    f1.x += f1.staggerX;
    f1.y += f1.staggerY;

    // ─── Attack scheduling ───
    f1.stanceTimer -= dt;
    f2.stanceTimer -= dt;
    var punchInterval = Math.max(0.2, 0.9 - t * 0.6);
    var kickInterval = Math.max(0.5, 2.2 - t * 1.5);

    // F1 attacks (only when not already attacking)
    if (f1.stanceTimer <= 0 && f1.punchPhase === 'idle' && f1.kickPhase === 'idle') {
      var roll = Math.random();
      if (t > 0.3 && roll < 0.2) {
        _triggerKick(f1, f2, f2.x, f2.y);
        f1.stanceTimer = kickInterval * (0.8 + Math.random() * 0.4);
      } else if (roll < 0.65) {
        var dmg = 0.005 + t * 0.015;
        _triggerPunch(f1, f2, f2.x, f2.y, dmg, 1 + t * 2.5, Math.floor(3 + t * 6));
        f1.stanceTimer = punchInterval * (0.6 + Math.random() * 0.6);
      } else {
        f1.stanceTimer = punchInterval * (0.8 + Math.random());
        f1.combo = 0;
        f1.weightTarget = 0;
      }
    }

    // F2 counter-attacks (less frequent)
    if (f2.stanceTimer <= 0 && f2.punchPhase === 'idle' && f2.kickPhase === 'idle' && f2.recoilTimer <= 0) {
      var counterChance = Math.max(0.08, 0.45 - t * 0.35);
      if (Math.random() < counterChance) {
        _triggerPunch(f2, f1, f1.x, f1.y, 0.003, 1, 2);
        f2.stanceTimer = punchInterval * (1.2 + Math.random() * 0.8);
      } else {
        f2.stanceTimer = punchInterval * (1.2 + Math.random());
        f2.blockTimer = 0.5 + Math.random() * 0.3;
      }
    }

    // Health pressure at extreme tension
    if (t > 0.75) {
      f2.health = Math.max(0, f2.health - dt * 0.025 * (t - 0.5));
    }
  }
  else if (G.phase === 'CRASH') {
    // ─── KO sequence with eased fall ───
    G.koTimer += dt;
    if (G.koTimer < 0.1) {
      G.koFlash = 1;
      G.arenaShake = 15;
      G.crowdRoar = 1;
      f1.punchPhase = 'extend'; f1.punchTimer = 0.5; // frozen punch pose
    }
    G.koFlash = Math.max(0, G.koFlash - dt * 1.5);

    // F2 falls with easing (fast start, slow at ground)
    var fallRaw = Math.min(1, G.koTimer / 0.8);
    var fallEased = _easeOutCubic(fallRaw);
    f2.y = _lerp(acy, acy + 40, fallEased);
    f2.leanAngle = _lerp(0, 0.45, fallEased);
    f2.staggerX = _lerp(0, 12, fallEased);
    f2.health = Math.max(0, 1 - fallEased * 3);

    // F1 victory pose — slight lean forward
    f1.leanAngle = _lerp(f1.leanAngle, -0.05, dt * 3);
  }

  // ─── Global decays ───
  G.arenaShake = Math.max(0, G.arenaShake * (1 - dt * 8));
  G.crowdRoar = Math.max(0, G.crowdRoar - dt * 0.4);
  G.crowdRoarSmooth = _lerp(G.crowdRoarSmooth || 0, G.crowdRoar, dt * 5);

  if (G.arenaShake > 0.3) {
    G.camera.shake = Math.max(G.camera.shake, G.arenaShake * 0.6);
  }
}
// =====================================================================
// MMA SCENE — Image-based rendering with canvas effects overlay
// Generates high-quality scene images at startup, positions via DOM
// Canvas only used for particles, impact flashes, vignette
// =====================================================================

var SCENE = {
  ready: false,
  layers: {},    // DOM elements
  images: {},    // pre-rendered canvas images (as Image objects)
  fighterScale: 1
};

// ======================== GENERATE SCENE IMAGES ========================
// Pre-render complex visuals to off-screen canvases, convert to images

function _createOffscreen(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { canvas: c, ctx: c.getContext('2d') };
}

function generateArenaFloor(w, h) {
  var oc = _createOffscreen(w, h);
  var c = oc.ctx;
  var cx = w / 2, cy = h / 2;
  var r = Math.min(w, h) * 0.45;

  // Concrete floor gradient
  var floorG = c.createRadialGradient(cx, cy - r * 0.1, r * 0.1, cx, cy, r * 1.1);
  floorG.addColorStop(0, '#a09890');
  floorG.addColorStop(0.3, '#908880');
  floorG.addColorStop(0.6, '#787068');
  floorG.addColorStop(0.85, '#605850');
  floorG.addColorStop(1, '#383030');

  // Draw octagon
  c.fillStyle = floorG;
  c.beginPath();
  for (var i = 0; i < 8; i++) {
    var a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    var px = cx + Math.cos(a) * r;
    var py = cy + Math.sin(a) * r * 0.5;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();

  // Concrete texture noise
  c.globalAlpha = 0.04;
  for (var ni = 0; ni < 200; ni++) {
    c.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
    var nx = cx + (Math.random() - 0.5) * r * 1.8;
    var ny = cy + (Math.random() - 0.5) * r * 0.8;
    c.fillRect(nx, ny, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  c.globalAlpha = 1;

  // Red octagon border
  c.strokeStyle = 'rgba(200, 30, 30, 0.85)';
  c.lineWidth = 3;
  c.beginPath();
  for (var i2 = 0; i2 < 8; i2++) {
    var a2 = (i2 / 8) * Math.PI * 2 - Math.PI / 2;
    var px2 = cx + Math.cos(a2) * r * 0.92;
    var py2 = cy + Math.sin(a2) * r * 0.92 * 0.5;
    if (i2 === 0) c.moveTo(px2, py2); else c.lineTo(px2, py2);
  }
  c.closePath();
  c.stroke();

  // Center circle
  c.strokeStyle = 'rgba(200, 30, 30, 0.3)';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(cx, cy, r * 0.2, r * 0.1, 0, 0, Math.PI * 2);
  c.stroke();

  // Center text
  c.globalAlpha = 0.06;
  c.font = 'bold ' + Math.floor(r * 0.18) + 'px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#fff';
  c.fillText('MMA', cx, cy + 2);
  c.globalAlpha = 1;

  // Spotlight reflection
  var spotG = c.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r * 0.8);
  spotG.addColorStop(0, 'rgba(255,255,250,0.08)');
  spotG.addColorStop(0.5, 'rgba(255,255,250,0.02)');
  spotG.addColorStop(1, 'transparent');
  c.fillStyle = spotG;
  c.beginPath();
  c.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2);
  c.fill();

  return oc.canvas;
}

function generateCageFence(w, h) {
  var oc = _createOffscreen(w, h);
  var c = oc.ctx;
  var cx = w / 2, cy = h * 0.55;
  var r = Math.min(w, h) * 0.45;
  var fenceH = r * 0.6;

  // Draw 8 fence panels
  for (var pi = 0; pi < 8; pi++) {
    var a1 = (pi / 8) * Math.PI * 2 - Math.PI / 2;
    var a2 = ((pi + 1) / 8) * Math.PI * 2 - Math.PI / 2;
    var x1 = cx + Math.cos(a1) * r;
    var y1 = cy + Math.sin(a1) * r * 0.5;
    var x2 = cx + Math.cos(a2) * r;
    var y2 = cy + Math.sin(a2) * r * 0.5;

    var isFront = (y1 + y2) / 2 > cy - r * 0.1;
    var alpha = isFront ? 0.55 : 0.2;
    var topY1 = y1 - fenceH * (isFront ? 1 : 0.6);
    var topY2 = y2 - fenceH * (isFront ? 1 : 0.6);

    // Dark mesh fill
    c.globalAlpha = alpha;
    c.fillStyle = 'rgba(15, 15, 20, 0.8)';
    c.beginPath();
    c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.lineTo(x2, topY2); c.lineTo(x1, topY1);
    c.closePath();
    c.fill();

    // Chain link pattern
    c.strokeStyle = 'rgba(100, 110, 120, ' + (alpha * 0.5) + ')';
    c.lineWidth = 0.6;
    var panelW = Math.hypot(x2 - x1, y2 - y1);
    var gridSize = 10;
    var hSteps = Math.floor(fenceH / gridSize);
    var wSteps = Math.floor(panelW / gridSize);

    // Horizontal wires
    for (var hi = 0; hi <= hSteps; hi++) {
      var frac = hi / hSteps;
      c.beginPath();
      c.moveTo(x1, y1 - (y1 - topY1) * frac);
      c.lineTo(x2, y2 - (y2 - topY2) * frac);
      c.stroke();
    }
    // Vertical wires
    for (var wi = 0; wi <= wSteps; wi++) {
      var wfrac = wi / wSteps;
      var bx = x1 + (x2 - x1) * wfrac;
      var by = y1 + (y2 - y1) * wfrac;
      var tx = x1 + (x2 - x1) * wfrac;
      var ty = topY1 + (topY2 - topY1) * wfrac;
      c.beginPath();
      c.moveTo(bx, by); c.lineTo(tx, ty);
      c.stroke();
    }

    // Diamond cross pattern
    c.strokeStyle = 'rgba(80, 90, 100, ' + (alpha * 0.25) + ')';
    c.lineWidth = 0.4;
    for (var dj = 0; dj < wSteps; dj++) {
      for (var dk = 0; dk < hSteps; dk++) {
        if ((dj + dk) % 2 === 0) {
          var f1x = x1 + (x2 - x1) * dj / wSteps;
          var f1y = y1 + (topY1 - y1) * dk / hSteps + (y2 - y1) * dj / wSteps;
          var f2x = x1 + (x2 - x1) * (dj + 1) / wSteps;
          var f2y = y1 + (topY1 - y1) * (dk + 1) / hSteps + (y2 - y1) * (dj + 1) / wSteps;
          c.beginPath(); c.moveTo(f1x, f1y); c.lineTo(f2x, f2y); c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
  }

  // Metal posts
  for (var i = 0; i < 8; i++) {
    var pa = (i / 8) * Math.PI * 2 - Math.PI / 2;
    var px = cx + Math.cos(pa) * r;
    var py = cy + Math.sin(pa) * r * 0.5;
    var isFP = py > cy - r * 0.1;
    var pH = fenceH * (isFP ? 1 : 0.6);
    var pW = isFP ? 7 : 5;

    // Post shadow
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fillRect(px - pW / 2 + 2, py - pH, pW, pH + 2);

    // Metallic post
    var pG = c.createLinearGradient(px - pW / 2, 0, px + pW / 2, 0);
    pG.addColorStop(0, '#444');
    pG.addColorStop(0.2, '#888');
    pG.addColorStop(0.4, '#aaa');
    pG.addColorStop(0.6, '#999');
    pG.addColorStop(0.8, '#777');
    pG.addColorStop(1, '#444');
    c.fillStyle = pG;
    c.fillRect(px - pW / 2, py - pH, pW, pH);

    // Top cap
    c.fillStyle = '#bbb';
    c.beginPath();
    c.ellipse(px, py - pH, pW * 0.7, 3, 0, 0, Math.PI * 2);
    c.fill();

    // Base plate
    c.fillStyle = '#666';
    c.fillRect(px - pW * 0.7, py - 2, pW * 1.4, 4);

    // Corner padding (blue/red)
    c.fillStyle = i < 4 ? 'rgba(30,80,200,0.5)' : 'rgba(200,30,30,0.5)';
    c.fillRect(px - pW / 2 - 1, py - pH, pW + 2, 10);

    // Specular
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(px - pW / 2 + 1, py - pH, 1.5, pH);
  }

  // Top rail
  c.strokeStyle = 'rgba(140,150,160,0.5)';
  c.lineWidth = 2.5;
  c.beginPath();
  for (var ri = 0; ri <= 8; ri++) {
    var ra = (ri % 8) / 8 * Math.PI * 2 - Math.PI / 2;
    var rpx = cx + Math.cos(ra) * r;
    var rpy = cy + Math.sin(ra) * r * 0.5;
    var isFR = rpy > cy - r * 0.1;
    var topRY = rpy - fenceH * (isFR ? 1 : 0.6);
    if (ri === 0) c.moveTo(rpx, topRY); else c.lineTo(rpx, topRY);
  }
  c.stroke();

  return oc.canvas;
}

function generateCrowdRow(w, h, rowScale, rowAlpha, shirtColors) {
  var oc = _createOffscreen(w, h);
  var c = oc.ctx;
  var count = Math.floor(w / (12 * rowScale));
  var baseY = h * 0.85;

  for (var i = 0; i < count; i++) {
    var px = (i / count) * w + (Math.random() - 0.5) * 8;
    var bodyW = 5 * rowScale + Math.random() * 3 * rowScale;
    var bodyH = 10 * rowScale + Math.random() * 4 * rowScale;
    var shirt = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    var skin = ['#d4a574','#c68642','#8d5524','#e0ac69','#f1c27d','#6b4423'][Math.floor(Math.random() * 6)];
    var headR = 4 * rowScale;

    c.globalAlpha = rowAlpha;

    // Torso
    c.fillStyle = shirt;
    var sY = baseY - bodyH;
    c.beginPath();
    c.moveTo(px - bodyW, sY + 2);
    c.quadraticCurveTo(px - bodyW - 1, sY + bodyH * 0.5, px - bodyW + 1, sY + bodyH);
    c.lineTo(px + bodyW - 1, sY + bodyH);
    c.quadraticCurveTo(px + bodyW + 1, sY + bodyH * 0.5, px + bodyW, sY + 2);
    c.quadraticCurveTo(px, sY, px - bodyW, sY + 2);
    c.closePath();
    c.fill();

    // Shirt shading
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.fillRect(px, sY, bodyW, bodyH);

    // Shoulders
    c.fillStyle = shirt;
    c.beginPath();
    c.ellipse(px, sY + rowScale, bodyW * 1.1, rowScale * 2, 0, 0, Math.PI * 2);
    c.fill();

    // Neck
    c.fillStyle = skin;
    c.fillRect(px - rowScale * 0.8, sY - rowScale * 1.5, rowScale * 1.6, rowScale * 2.5);

    // Head
    c.beginPath();
    c.arc(px, sY - headR - rowScale, headR, 0, Math.PI * 2);
    c.fillStyle = skin;
    c.fill();

    // Hair/cap
    if (Math.random() < 0.4) {
      c.fillStyle = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      c.beginPath();
      c.arc(px, sY - headR - rowScale - 1, headR * 0.95, Math.PI, 0);
      c.fill();
    } else {
      c.fillStyle = '#1a1008';
      c.beginPath();
      c.arc(px, sY - headR - rowScale - 1, headR * 0.8, Math.PI * 1.1, -Math.PI * 0.1);
      c.fill();
    }

    // Eyes
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.arc(px - headR * 0.25, sY - headR - rowScale - 1, rowScale * 0.4, 0, Math.PI * 2);
    c.arc(px + headR * 0.25, sY - headR - rowScale - 1, rowScale * 0.4, 0, Math.PI * 2);
    c.fill();

    // Random: foam finger
    if (Math.random() < 0.06) {
      var fColor = Math.random() < 0.5 ? '#22c55e' : '#ef4444';
      var fX = px - bodyW - rowScale * 2;
      var fY = sY - bodyH * 0.5;
      c.fillStyle = fColor;
      c.beginPath();
      c.moveTo(fX - rowScale, fY + rowScale * 3);
      c.lineTo(fX, fY - rowScale * 4);
      c.lineTo(fX + rowScale, fY + rowScale * 3);
      c.closePath();
      c.fill();
      c.fillStyle = '#fff';
      c.font = 'bold ' + Math.floor(rowScale * 2) + 'px sans-serif';
      c.textAlign = 'center';
      c.fillText('#1', fX, fY);
    }
  }
  c.globalAlpha = 1;
  return oc.canvas;
}

function generateBackground(w, h) {
  var oc = _createOffscreen(w, h);
  var c = oc.ctx;

  // Dark arena gradient
  var bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#060414');
  bg.addColorStop(0.15, '#0a0820');
  bg.addColorStop(0.4, '#0e0c28');
  bg.addColorStop(0.7, '#0a081e');
  bg.addColorStop(1, '#050310');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);

  // Ceiling structure
  c.fillStyle = 'rgba(3,2,8,0.85)';
  c.fillRect(0, 0, w, h * 0.1);
  var ceilG = c.createLinearGradient(0, 0, 0, h * 0.18);
  ceilG.addColorStop(0, 'rgba(3,2,8,0.9)');
  ceilG.addColorStop(1, 'transparent');
  c.fillStyle = ceilG;
  c.fillRect(0, 0, w, h * 0.18);

  // Arena lights
  var lightCount = Math.max(5, Math.floor(w / 120));
  for (var i = 0; i < lightCount; i++) {
    var lx = w * (0.08 + i * 0.84 / (lightCount - 1));
    var ly = h * 0.025;
    // Light body
    c.fillStyle = 'rgba(255,250,230,0.8)';
    c.beginPath(); c.arc(lx, ly, 5, 0, Math.PI * 2); c.fill();
    // Glow
    var glow = c.createRadialGradient(lx, ly, 0, lx, ly, 30);
    glow.addColorStop(0, 'rgba(255,250,230,0.15)');
    glow.addColorStop(1, 'transparent');
    c.fillStyle = glow;
    c.beginPath(); c.arc(lx, ly, 30, 0, Math.PI * 2); c.fill();
    // Light beam
    c.save();
    c.globalAlpha = 0.02;
    c.beginPath();
    c.moveTo(lx - 4, ly + 4);
    c.lineTo(lx - w * 0.035, h * 0.55);
    c.lineTo(lx + w * 0.035, h * 0.55);
    c.lineTo(lx + 4, ly + 4);
    c.closePath();
    var beamG = c.createLinearGradient(lx, ly, lx, h * 0.5);
    beamG.addColorStop(0, 'rgba(255,250,220,1)');
    beamG.addColorStop(1, 'rgba(255,250,220,0)');
    c.fillStyle = beamG;
    c.fill();
    c.restore();
  }

  // Blue spotlight cone (left)
  c.save(); c.globalAlpha = 0.06;
  c.beginPath();
  c.moveTo(w * 0.3, h * 0.02);
  c.lineTo(w * 0.1, h * 0.65);
  c.lineTo(w * 0.5, h * 0.65);
  c.closePath();
  var slB = c.createLinearGradient(w * 0.3, 0, w * 0.3, h * 0.6);
  slB.addColorStop(0, 'rgba(30,100,255,0.6)');
  slB.addColorStop(1, 'transparent');
  c.fillStyle = slB; c.fill();
  c.restore();

  // Red spotlight cone (right)
  c.save(); c.globalAlpha = 0.06;
  c.beginPath();
  c.moveTo(w * 0.7, h * 0.02);
  c.lineTo(w * 0.5, h * 0.65);
  c.lineTo(w * 0.9, h * 0.65);
  c.closePath();
  var slR = c.createLinearGradient(w * 0.7, 0, w * 0.7, h * 0.6);
  slR.addColorStop(0, 'rgba(255,40,40,0.6)');
  slR.addColorStop(1, 'transparent');
  c.fillStyle = slR; c.fill();
  c.restore();

  // Haze
  c.globalAlpha = 0.03;
  var haze = c.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, h * 0.6);
  haze.addColorStop(0, 'rgba(120,100,180,1)');
  haze.addColorStop(1, 'transparent');
  c.fillStyle = haze;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 1;

  return oc.canvas;
}

function generateFighter(w, h, isMasked) {
  var oc = _createOffscreen(w, h);
  var c = oc.ctx;
  var cx2 = w / 2, cy2 = h * 0.55;
  var sc = Math.min(w, h) / 100;

  var skinBase = isMasked ? '#c08060' : '#d4a574';
  var skinDark = isMasked ? '#905840' : '#b88858';
  var skinLight = isMasked ? '#d8a080' : '#e8bc90';
  var shortsCol = isMasked ? '#1a4a8a' : '#8a1a1a';
  var glovesCol = isMasked ? '#1844aa' : '#aa2222';
  var accent = isMasked ? '#4488ff' : '#ff4444';

  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath(); c.ellipse(cx2, cy2 + 38 * sc, 22 * sc, 5 * sc, 0, 0, Math.PI * 2); c.fill();

  // Feet
  c.fillStyle = '#1a1a1a';
  c.beginPath(); c.ellipse(cx2 - 8 * sc, cy2 + 35 * sc, 4 * sc, 2 * sc, 0.1, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(cx2 + 8 * sc, cy2 + 35 * sc, 4 * sc, 2 * sc, -0.1, 0, Math.PI * 2); c.fill();

  // Legs (thick)
  var legG = c.createLinearGradient(cx2 - 12 * sc, 0, cx2 + 12 * sc, 0);
  legG.addColorStop(0, skinDark); legG.addColorStop(0.4, skinBase);
  legG.addColorStop(0.6, skinBase); legG.addColorStop(1, skinDark);
  c.fillStyle = legG;
  // Left leg
  c.beginPath();
  c.moveTo(cx2 - 4 * sc, cy2 + 10 * sc);
  c.quadraticCurveTo(cx2 - 12 * sc, cy2 + 22 * sc, cx2 - 9 * sc, cy2 + 34 * sc);
  c.lineTo(cx2 - 3 * sc, cy2 + 34 * sc);
  c.quadraticCurveTo(cx2 - 6 * sc, cy2 + 22 * sc, cx2, cy2 + 10 * sc);
  c.fill();
  // Right leg
  c.beginPath();
  c.moveTo(cx2 + 4 * sc, cy2 + 10 * sc);
  c.quadraticCurveTo(cx2 + 12 * sc, cy2 + 22 * sc, cx2 + 9 * sc, cy2 + 34 * sc);
  c.lineTo(cx2 + 3 * sc, cy2 + 34 * sc);
  c.quadraticCurveTo(cx2 + 6 * sc, cy2 + 22 * sc, cx2, cy2 + 10 * sc);
  c.fill();

  // Shorts
  var sG = c.createLinearGradient(0, cy2 + 2 * sc, 0, cy2 + 14 * sc);
  sG.addColorStop(0, shortsCol); sG.addColorStop(1, _darkenHex(shortsCol, 30));
  c.fillStyle = sG;
  c.beginPath();
  c.moveTo(cx2 - 10 * sc, cy2 + 2 * sc);
  c.lineTo(cx2 - 11 * sc, cy2 + 14 * sc);
  c.quadraticCurveTo(cx2, cy2 + 15 * sc, cx2 + 11 * sc, cy2 + 14 * sc);
  c.lineTo(cx2 + 10 * sc, cy2 + 2 * sc);
  c.closePath();
  c.fill();
  // White stripes
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.fillRect(cx2 - 10.5 * sc, cy2 + 3 * sc, 1.5 * sc, 10 * sc);
  c.fillRect(cx2 + 9 * sc, cy2 + 3 * sc, 1.5 * sc, 10 * sc);
  // Waistband
  c.fillStyle = 'rgba(255,255,255,0.2)';
  c.fillRect(cx2 - 10 * sc, cy2 + 1 * sc, 20 * sc, 2 * sc);

  // Torso (V-taper)
  var tG = c.createLinearGradient(cx2 - 12 * sc, 0, cx2 + 12 * sc, 0);
  tG.addColorStop(0, skinDark); tG.addColorStop(0.3, skinLight);
  tG.addColorStop(0.5, skinBase); tG.addColorStop(0.7, skinBase); tG.addColorStop(1, skinDark);
  c.fillStyle = tG;
  c.beginPath();
  c.moveTo(cx2 - 12 * sc, cy2 - 12 * sc);
  c.quadraticCurveTo(cx2 - 13 * sc, cy2 - 2 * sc, cx2 - 10 * sc, cy2 + 4 * sc);
  c.lineTo(cx2 + 10 * sc, cy2 + 4 * sc);
  c.quadraticCurveTo(cx2 + 13 * sc, cy2 - 2 * sc, cx2 + 12 * sc, cy2 - 12 * sc);
  c.quadraticCurveTo(cx2, cy2 - 15 * sc, cx2 - 12 * sc, cy2 - 12 * sc);
  c.fill();

  // Abs
  c.strokeStyle = skinDark; c.globalAlpha = 0.12; c.lineWidth = 0.5 * sc;
  c.beginPath(); c.moveTo(cx2, cy2 - 8 * sc); c.lineTo(cx2, cy2 + 3 * sc); c.stroke();
  for (var ai = 0; ai < 3; ai++) {
    c.beginPath(); c.moveTo(cx2 - 5 * sc, cy2 - 5 * sc + ai * 3.5 * sc); c.lineTo(cx2 + 5 * sc, cy2 - 5 * sc + ai * 3.5 * sc); c.stroke();
  }
  c.globalAlpha = 1;

  // Pecs
  c.fillStyle = skinDark; c.globalAlpha = 0.08;
  c.beginPath(); c.ellipse(cx2 - 5 * sc, cy2 - 9 * sc, 5 * sc, 3 * sc, -0.1, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(cx2 + 5 * sc, cy2 - 9 * sc, 5 * sc, 3 * sc, 0.1, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;

  // Deltoids
  c.fillStyle = skinBase;
  c.beginPath(); c.ellipse(cx2 - 13 * sc, cy2 - 11 * sc, 5 * sc, 4 * sc, -0.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(cx2 + 13 * sc, cy2 - 11 * sc, 5 * sc, 4 * sc, 0.2, 0, Math.PI * 2); c.fill();

  // Arms (guard position)
  c.strokeStyle = skinBase; c.lineWidth = 6 * sc; c.lineCap = 'round';
  // Left arm
  c.beginPath(); c.moveTo(cx2 - 13 * sc, cy2 - 10 * sc);
  c.quadraticCurveTo(cx2 - 16 * sc, cy2 - 4 * sc, cx2 - 10 * sc, cy2 - 16 * sc); c.stroke();
  // Right arm
  c.beginPath(); c.moveTo(cx2 + 13 * sc, cy2 - 10 * sc);
  c.quadraticCurveTo(cx2 + 16 * sc, cy2 - 4 * sc, cx2 + 10 * sc, cy2 - 16 * sc); c.stroke();

  // Gloves
  var gG1 = c.createRadialGradient(cx2 - 10 * sc, cy2 - 16 * sc, 0, cx2 - 10 * sc, cy2 - 16 * sc, 6 * sc);
  gG1.addColorStop(0, glovesCol); gG1.addColorStop(1, _darkenHex(glovesCol, 40));
  c.fillStyle = gG1;
  c.beginPath(); c.arc(cx2 - 10 * sc, cy2 - 16 * sc, 6 * sc, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.15)';
  c.beginPath(); c.ellipse(cx2 - 10 * sc + sc, cy2 - 17 * sc, 3 * sc, 2 * sc, 0, 0, Math.PI * 2); c.fill();

  var gG2 = c.createRadialGradient(cx2 + 10 * sc, cy2 - 16 * sc, 0, cx2 + 10 * sc, cy2 - 16 * sc, 6 * sc);
  gG2.addColorStop(0, glovesCol); gG2.addColorStop(1, _darkenHex(glovesCol, 40));
  c.fillStyle = gG2;
  c.beginPath(); c.arc(cx2 + 10 * sc, cy2 - 16 * sc, 6 * sc, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.15)';
  c.beginPath(); c.ellipse(cx2 + 10 * sc + sc, cy2 - 17 * sc, 3 * sc, 2 * sc, 0, 0, Math.PI * 2); c.fill();

  // Neck
  c.fillStyle = skinBase;
  c.fillRect(cx2 - 3.5 * sc, cy2 - 18 * sc, 7 * sc, 6 * sc);

  // Head
  var headR = 9 * sc;
  var headY = cy2 - 26 * sc;
  var hG = c.createRadialGradient(cx2 - 2 * sc, headY - 2 * sc, headR * 0.2, cx2, headY, headR);
  hG.addColorStop(0, skinLight); hG.addColorStop(0.5, skinBase); hG.addColorStop(1, skinDark);
  c.fillStyle = hG;
  c.beginPath(); c.ellipse(cx2, headY, headR * 0.9, headR, 0, 0, Math.PI * 2); c.fill();

  if (isMasked) {
    // Mask
    var mG = c.createRadialGradient(cx2, headY, headR * 0.3, cx2, headY, headR);
    mG.addColorStop(0, '#1a1a3a'); mG.addColorStop(1, '#08081a');
    c.fillStyle = mG;
    c.beginPath(); c.ellipse(cx2, headY - 1 * sc, headR * 0.9, headR * 0.6, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.ellipse(cx2, headY + 1 * sc, headR * 0.9, headR * 0.4, 0, 0, Math.PI); c.fill();
    // Eye slits
    c.fillStyle = '#000';
    c.beginPath();
    c.moveTo(cx2 - 7 * sc, headY - 2 * sc); c.lineTo(cx2 - 2 * sc, headY - 3 * sc);
    c.lineTo(cx2 - 1 * sc, headY); c.lineTo(cx2 - 7.5 * sc, headY + 0.5 * sc); c.fill();
    c.beginPath();
    c.moveTo(cx2 + 1 * sc, headY - 3 * sc); c.lineTo(cx2 + 6 * sc, headY - 2 * sc);
    c.lineTo(cx2 + 6.5 * sc, headY + 0.5 * sc); c.lineTo(cx2 + 0.5 * sc, headY); c.fill();
    // Glowing eyes
    c.shadowColor = accent; c.shadowBlur = 8;
    c.fillStyle = accent;
    c.beginPath(); c.ellipse(cx2 - 4 * sc, headY - 1.5 * sc, 2 * sc, 1.2 * sc, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx2 + 3.5 * sc, headY - 1.5 * sc, 2 * sc, 1.2 * sc, 0, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    // Chin
    c.fillStyle = skinBase;
    c.beginPath(); c.ellipse(cx2, headY + headR * 0.55, headR * 0.5, headR * 0.35, 0, 0, Math.PI); c.fill();
    // Mouth
    c.strokeStyle = skinDark; c.lineWidth = sc * 0.8;
    c.beginPath(); c.moveTo(cx2 - 3 * sc, headY + 5 * sc); c.lineTo(cx2 + 3 * sc, headY + 5 * sc); c.stroke();
  } else {
    // Hair
    c.fillStyle = '#1a1008';
    c.beginPath(); c.arc(cx2, headY - 2 * sc, headR * 0.82, Math.PI * 1.05, -Math.PI * 0.05); c.fill();
    // Eyes
    c.fillStyle = '#f0f0f0';
    c.beginPath(); c.ellipse(cx2 - 3.5 * sc, headY - 1.5 * sc, 3 * sc, 2 * sc, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx2 + 3.5 * sc, headY - 1.5 * sc, 3 * sc, 2 * sc, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a2a1a';
    c.beginPath(); c.arc(cx2 - 3 * sc, headY - 1.5 * sc, 1.5 * sc, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx2 + 4 * sc, headY - 1.5 * sc, 1.5 * sc, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(cx2 - 3 * sc, headY - 1.5 * sc, 0.8 * sc, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx2 + 4 * sc, headY - 1.5 * sc, 0.8 * sc, 0, Math.PI * 2); c.fill();
    // Eyebrows
    c.strokeStyle = '#1a1008'; c.lineWidth = 1.2 * sc; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx2 - 6 * sc, headY - 4 * sc); c.quadraticCurveTo(cx2 - 3 * sc, headY - 4.5 * sc, cx2 - 1 * sc, headY - 3.5 * sc); c.stroke();
    c.beginPath(); c.moveTo(cx2 + 1 * sc, headY - 3.5 * sc); c.quadraticCurveTo(cx2 + 3 * sc, headY - 4.5 * sc, cx2 + 6 * sc, headY - 4 * sc); c.stroke();
    // Nose
    c.strokeStyle = skinDark; c.lineWidth = 0.8 * sc;
    c.beginPath(); c.moveTo(cx2, headY); c.quadraticCurveTo(cx2 + sc, headY + 2.5 * sc, cx2, headY + 3 * sc); c.stroke();
    // Mouth
    c.strokeStyle = skinDark; c.lineWidth = 0.8 * sc;
    c.beginPath(); c.moveTo(cx2 - 2.5 * sc, headY + 5 * sc); c.quadraticCurveTo(cx2, headY + 5.5 * sc, cx2 + 2.5 * sc, headY + 5 * sc); c.stroke();
    // Ears
    c.fillStyle = skinBase;
    c.beginPath(); c.ellipse(cx2 - headR * 0.88, headY, 2.5 * sc, 3.5 * sc, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx2 + headR * 0.88, headY, 2.5 * sc, 3.5 * sc, 0, 0, Math.PI * 2); c.fill();
  }

  return oc.canvas;
}

function _darkenHex(hex, amount) {
  hex = hex.replace('#', '');
  var r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
  var g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
  var b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ======================== INIT SCENE ========================
function initScene() {
  var W = cv.width || window.innerWidth;
  var H = cv.height || window.innerHeight;

  var shirts = ['#c62828','#d32f2f','#e53935','#1565c0','#1976d2','#1e88e5','#2e7d32','#f57f17','#4a148c','#37474f','#fff','#e0e0e0'];

  SCENE.images.bg = generateBackground(W, H);
  SCENE.images.floor = generateArenaFloor(W, H);
  SCENE.images.cage = generateCageFence(W, H);
  SCENE.images.crowdBack = generateCrowdRow(W, Math.floor(H * 0.3), 1.2, 0.35, shirts);
  SCENE.images.crowdMid = generateCrowdRow(W, Math.floor(H * 0.35), 1.8, 0.5, shirts);
  SCENE.images.crowdFront = generateCrowdRow(W, Math.floor(H * 0.25), 2.5, 0.65, shirts);
  SCENE.images.fighter1 = generateFighter(200, 300, true);
  SCENE.images.fighter2 = generateFighter(200, 300, false);
  SCENE.ready = true;
}

// ======================== IMAGE-BASED RENDER ========================
function render() {
  try {
  if (!cv || !cx) return;
  var W = cv.width, H = cv.height;
  if (!W || !H) return;

  // Generate scene images on first frame or resize
  if (!SCENE.ready || SCENE._lastW !== W || SCENE._lastH !== H) {
    initScene();
    SCENE._lastW = W;
    SCENE._lastH = H;
  }

  cx.clearRect(0, 0, W, H);
  cx.save();

  var cam = G.camera || {};
  if ((cam.shake || 0) > 0.1) {
    cx.translate((Math.random() - 0.5) * cam.shake, (Math.random() - 0.5) * cam.shake);
  }
  var z = cam.zoom || 1;
  if (z !== 1) {
    var zx = cam.zoomX || W * 0.5, zy = cam.zoomY || H * 0.45;
    cx.translate(zx, zy); cx.scale(z, z); cx.translate(-zx, -zy);
  }

  // Safety init
  if (!G.f1 || !G.f2) { try { initFighterState(); } catch(e) {} }
  if (!G.crowd || G.crowd.length === 0) { try { initCrowd(); } catch(e) {} }

  G.tension = getTension(G.mult || 1);
  var t = G.tension;
  var acx = W * 0.5, acy = H * 0.55;

  // ─── LAYER 1: Background ───
  cx.drawImage(SCENE.images.bg, 0, 0);

  // ─── LAYER 2: Back crowd row ───
  var crowdBounce = Math.sin(G.time * 1.5) * (2 + (G.crowdRoarSmooth || 0) * 6);
  cx.drawImage(SCENE.images.crowdBack, 0, H * 0.12 + crowdBounce * 0.3);

  // ─── LAYER 3: Mid crowd row ───
  cx.drawImage(SCENE.images.crowdMid, 0, H * 0.22 + crowdBounce * 0.5);

  // ─── LAYER 4: Arena floor ───
  cx.drawImage(SCENE.images.floor, 0, 0);

  // Dynamic spotlight pool (tension-reactive)
  var spotPool = cx.createRadialGradient(acx, acy, 20, acx, acy, W * 0.35);
  spotPool.addColorStop(0, 'rgba(255,255,240,' + (0.04 + t * 0.06) + ')');
  spotPool.addColorStop(0.5, 'rgba(200,200,180,' + (0.02 + t * 0.03) + ')');
  spotPool.addColorStop(1, 'transparent');
  cx.fillStyle = spotPool;
  cx.fillRect(0, 0, W, H);

  // Blood stains (dynamic, based on tension)
  if (t > 0.5 && G.fightStarted) {
    cx.globalAlpha = (t - 0.5) * 0.2;
    var spots = Math.floor(t * 6);
    for (var bi = 0; bi < spots; bi++) {
      var bx = acx + Math.sin(bi * 7.13) * W * 0.12;
      var by = acy + Math.cos(bi * 4.27) * H * 0.04;
      cx.fillStyle = 'rgba(140,20,20,0.7)';
      cx.beginPath(); cx.ellipse(bx, by, 3 + bi * 2, 1.5 + bi, Math.sin(bi) * 0.5, 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1;
  }

  // ─── LAYER 5: Fighters (images positioned dynamically) ───
  var f1 = G.f1, f2 = G.f2;
  if (f1 && f2) {
    var fScale = Math.min(W, H) / 400;
    if (fScale < 0.5) fScale = 0.5;
    if (fScale > 2) fScale = 2;
    var fW = 200 * fScale, fH = 300 * fScale;

    // Fighter 2 (red, behind)
    cx.save();
    var f2lean = f2.leanAngle || 0;
    cx.translate(f2.x, f2.y);
    if (f2lean) cx.rotate(f2lean);
    cx.scale(-1, 1); // flip to face left
    // Hit flash
    if (f2.hitFlash > 0) { cx.globalAlpha = 1 - f2.hitFlash * 0.3; }
    cx.drawImage(SCENE.images.fighter2, -fW / 2, -fH * 0.55, fW, fH);
    if (f2.hitFlash > 0) { cx.globalAlpha = f2.hitFlash * 0.5; cx.fillStyle = '#fff'; cx.fillRect(-fW / 2, -fH * 0.55, fW, fH); }
    cx.globalAlpha = 1;
    cx.restore();

    // Fighter 1 (blue, in front)
    cx.save();
    var f1lean = f1.leanAngle || 0;
    cx.translate(f1.x, f1.y);
    if (f1lean) cx.rotate(f1lean);
    if (f1.hitFlash > 0) { cx.globalAlpha = 1 - f1.hitFlash * 0.3; }
    cx.drawImage(SCENE.images.fighter1, -fW / 2, -fH * 0.55, fW, fH);
    if (f1.hitFlash > 0) { cx.globalAlpha = f1.hitFlash * 0.5; cx.fillStyle = '#fff'; cx.fillRect(-fW / 2, -fH * 0.55, fW, fH); }
    cx.globalAlpha = 1;
    cx.restore();

    // ── Impact particles ──
    if (f1.punchPhase === 'hold' || f1.punchPhase === 'extend') {
      var impX = f2.x + (f2.staggerX || 0) * 0.5;
      var impY = f2.y - fH * 0.3;
      cx.save();
      cx.globalAlpha = 0.5;
      var impG = cx.createRadialGradient(impX, impY, 0, impX, impY, 25 * fScale);
      impG.addColorStop(0, 'rgba(255,255,255,0.8)');
      impG.addColorStop(0.4, 'rgba(255,240,150,0.3)');
      impG.addColorStop(1, 'transparent');
      cx.fillStyle = impG;
      cx.beginPath(); cx.arc(impX, impY, 25 * fScale, 0, Math.PI * 2); cx.fill();
      // Impact lines
      cx.strokeStyle = 'rgba(255,230,100,0.6)';
      cx.lineWidth = 1.5;
      for (var il = 0; il < 6; il++) {
        var ia = il / 6 * Math.PI * 2 + G.time * 12;
        cx.beginPath();
        cx.moveTo(impX + Math.cos(ia) * 8 * fScale, impY + Math.sin(ia) * 8 * fScale);
        cx.lineTo(impX + Math.cos(ia) * 18 * fScale, impY + Math.sin(ia) * 18 * fScale);
        cx.stroke();
      }
      cx.restore();
    }
  }

  // ─── LAYER 6: Cage fence (in front of fighters) ───
  cx.drawImage(SCENE.images.cage, 0, 0);

  // ─── LAYER 7: Front crowd row ───
  cx.drawImage(SCENE.images.crowdFront, 0, H * 0.78 + crowdBounce * 0.7);

  // ─── LAYER 8: Health bars ───
  if (f1 && f2 && G.phase !== 'BETTING' && G.phase !== 'WAITING' && G.phase !== 'INIT') {
    var barW = Math.min(180, W * 0.18), barH = 10, barY = H * 0.08;
    // F1 (blue)
    var f1bx = acx - barW - 25;
    cx.fillStyle = 'rgba(0,0,0,0.6)'; cx.fillRect(f1bx - 1, barY - 1, barW + 2, barH + 2);
    var hp1 = Math.max(0, Math.min(1, f1.health));
    var hg1 = cx.createLinearGradient(f1bx, 0, f1bx + barW * hp1, 0);
    hg1.addColorStop(0, '#2266cc'); hg1.addColorStop(1, '#44aaff');
    cx.fillStyle = hg1; cx.fillRect(f1bx, barY, barW * hp1, barH);
    cx.fillStyle = '#4488ff'; cx.font = 'bold 11px sans-serif'; cx.textAlign = 'right';
    cx.fillText('MASKED', f1bx + barW, barY - 4);

    // F2 (red)
    var f2bx = acx + 25;
    cx.fillStyle = 'rgba(0,0,0,0.6)'; cx.fillRect(f2bx - 1, barY - 1, barW + 2, barH + 2);
    var hp2 = Math.max(0, Math.min(1, f2.health));
    var hg2 = cx.createLinearGradient(f2bx, 0, f2bx + barW * hp2, 0);
    hg2.addColorStop(0, '#cc2222'); hg2.addColorStop(1, '#ff4444');
    cx.fillStyle = hg2; cx.fillRect(f2bx, barY, barW * hp2, barH);
    cx.fillStyle = '#ff4444'; cx.textAlign = 'left';
    cx.fillText('FIGHTER', f2bx, barY - 4);
  }

  // ─── LAYER 9: Particles ───
  G.particles = (G.particles || []).filter(function(p) {
    p.x += p.vx * (G.dt || 0.016) * 60;
    p.y += p.vy * (G.dt || 0.016) * 60;
    p.vy += (G.dt || 0.016) * 7;
    p.life -= (G.dt || 0.016) * 1.2;
    if (p.life <= 0) return false;
    var a = p.life * p.life;
    cx.beginPath();
    cx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, Math.PI * 2);
    cx.fillStyle = 'hsla(' + (p.hue || 20) + ',' + (p.sat || 100) + '%,' + (p.lit || 55) + '%,' + a + ')';
    cx.fill();
    return true;
  });

  // ─── LAYER 10: KO overlay ───
  if (G.phase === 'CRASH') {
    var koT = G.koTimer || 0;
    if ((G.koFlash || 0) > 0) {
      cx.globalAlpha = G.koFlash * 0.4;
      cx.fillStyle = '#ff0000';
      cx.fillRect(0, 0, W, H);
      cx.globalAlpha = 1;
    }
    if (koT > 0.3) {
      var tProg = Math.min(1, (koT - 0.3) / 0.4);
      var tScale = 0.5 + tProg * 0.5;
      cx.save();
      cx.translate(acx, acy - H * 0.15);
      cx.scale(tScale, tScale);
      cx.globalAlpha = tProg;
      cx.shadowColor = '#ff2222'; cx.shadowBlur = 30;
      cx.font = 'bold 72px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillStyle = '#ff2222'; cx.fillText('K.O.', 0, 0);
      cx.strokeStyle = 'rgba(255,255,255,0.3)'; cx.lineWidth = 2; cx.strokeText('K.O.', 0, 0);
      cx.shadowBlur = 0;
      if (koT > 1) {
        cx.globalAlpha = Math.min(1, (koT - 1) / 0.5);
        cx.font = 'bold 24px sans-serif';
        cx.fillStyle = 'rgba(255,255,255,0.8)';
        cx.fillText((G.mult || 1).toFixed(2) + 'x', 0, 45);
      }
      cx.restore();
    }
  }

  // ─── LAYER 11: Bell flash ───
  if ((G.bellRing || 0) > 0) {
    cx.globalAlpha = G.bellRing * 0.15;
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, W, H);
    cx.globalAlpha = 1;
  }

  // ─── LAYER 12: Vignette ───
  var vigStr = 0.3 + t * 0.3;
  var vig = cx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(0.6, 'rgba(0,0,0,' + (vigStr * 0.3) + ')');
  vig.addColorStop(1, 'rgba(0,0,0,' + vigStr + ')');
  cx.fillStyle = vig;
  cx.fillRect(0, 0, W, H);

  cx.restore();
  } catch(e) { console.error('MMA Render error:', e); try { cx.restore(); } catch(e2) {} }
}
