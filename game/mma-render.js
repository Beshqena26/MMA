// =====================================================================
// MMA OCTAGON RENDER — Replaces SkyDrop rocket/pilot visuals
// Drop-in replacement: provides render(), updateFighters(), initCrowd()
// Expects globals: cv, cx, G, w2s, spawnParticles
// =====================================================================

// ======================== FIGHTER STATE ========================
// Add to G object (call once at init)
function initFighterState() {
  G.f1 = {x:0, y:0, health:1, stance:0, stanceTimer:0, punchTimer:0, hitFlash:0, kickTimer:0, combo:0, blockTimer:0, dodgeX:0, walkCycle:0};
  G.f2 = {x:0, y:0, health:1, stance:0, stanceTimer:0, punchTimer:0, hitFlash:0, kickTimer:0, combo:0, blockTimer:0, dodgeX:0, walkCycle:0};
  G.crowd = [];
  G.tension = 0;
  G.koTimer = 0;
  G.koFlash = 0;
  G.bellRing = 0;
  G.arenaShake = 0;
  G.crowdRoar = 0;
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
  var W = cv.width, H = cv.height;

  // Arena center and radius
  var acx = W * 0.5, acy = H * 0.55;
  var arenaR = Math.min(W, H) * 0.28;

  // Walk cycles
  f1.walkCycle += dt * (1.5 + t * 3);
  f2.walkCycle += dt * (1.5 + t * 2.5);

  if (G.phase === 'BETTING') {
    // Circle each other
    var circleSpeed = 0.4;
    f1.stance += dt * circleSpeed;
    f2.stance = f1.stance + Math.PI;
    var circR = arenaR * 0.35;
    f1.x = acx + Math.cos(f1.stance) * circR;
    f1.y = acy + Math.sin(f1.stance) * circR * 0.4;
    f2.x = acx + Math.cos(f2.stance) * circR;
    f2.y = acy + Math.sin(f2.stance) * circR * 0.4;
    f1.health = 1; f2.health = 1;
    f1.punchTimer = 0; f2.punchTimer = 0;
    f1.kickTimer = 0; f2.kickTimer = 0;
    f1.hitFlash = 0; f2.hitFlash = 0;
    G.koTimer = 0;
  }
  else if (G.phase === 'EXPLODE') {
    // Walkout — approach each other
    var prog = Math.min(1, G.phaseTimer / (1.8));
    var sep = arenaR * 0.6 * (1 - prog * 0.6);
    f1.x = acx - sep;
    f2.x = acx + sep;
    f1.y = acy;
    f2.y = acy;
    G.bellRing = Math.max(0, (G.bellRing || 0) - dt);
    if (G.phaseTimer > 1.2 && G.bellRing <= 0) {
      G.bellRing = 0.5;
    }
  }
  else if (G.phase === 'FREEFALL') {
    // FIGHT phase
    G.fightStarted = true;
    var sep2 = arenaR * (0.22 - t * 0.08);
    var sway = Math.sin(G.time * 2 + t * 4) * sep2 * 0.15;

    // Fighters bob and weave
    f1.x = acx - sep2 + sway + Math.sin(G.time * 3.5) * 4 * t;
    f2.x = acx + sep2 - sway * 0.5 + Math.sin(G.time * 2.8 + 1) * 3 * t;
    f1.y = acy + Math.sin(G.time * 2) * 3;
    f2.y = acy + Math.sin(G.time * 2.3 + 0.5) * 3;

    // F2 dodge back when hit
    if (f2.hitFlash > 0) {
      f2.dodgeX = 8 * f2.hitFlash;
    } else {
      f2.dodgeX *= 0.9;
    }
    f2.x += f2.dodgeX;

    // Stance timers — dt-based punch/kick scheduling
    f1.stanceTimer -= dt;
    f2.stanceTimer -= dt;

    // Punch frequency increases with tension
    var punchInterval = Math.max(0.15, 0.8 - t * 0.6);
    var kickInterval = Math.max(0.4, 2.0 - t * 1.5);

    // F1 (masked/blue) attacks — frequency based on tension
    if (f1.stanceTimer <= 0) {
      var roll = Math.random();
      if (t > 0.3 && roll < 0.25) {
        // Kick
        f1.kickTimer = 0.4;
        f1.stanceTimer = kickInterval * (0.8 + Math.random() * 0.4);
        // Hit f2
        f2.hitFlash = 0.3;
        f2.health = Math.max(0, f2.health - (0.01 + t * 0.02));
        G.arenaShake = Math.max(G.arenaShake, 2 + t * 4);
        G.crowdRoar = Math.min(1, G.crowdRoar + 0.2);
        // Spawn hit particles at f2 position
        spawnParticles(f2.x, f2.y - 30, 'fire', Math.floor(3 + t * 8));
      } else if (roll < 0.7) {
        // Punch
        f1.punchTimer = 0.2;
        f1.stanceTimer = punchInterval * (0.7 + Math.random() * 0.6);
        f1.combo = Math.min(5, f1.combo + 1);
        // Hit f2
        f2.hitFlash = 0.2;
        f2.health = Math.max(0, f2.health - (0.005 + t * 0.015));
        G.arenaShake = Math.max(G.arenaShake, 1 + t * 2);
        G.crowdRoar = Math.min(1, G.crowdRoar + 0.1);
        spawnParticles(f2.x - 10, f2.y - 35, 'fire', Math.floor(2 + t * 5));
      } else {
        // Idle/reset combo
        f1.stanceTimer = punchInterval * (1 + Math.random());
        f1.combo = 0;
      }
    }

    // F2 (unmasked/red) counter-attacks — less frequent, decreases with tension
    if (f2.stanceTimer <= 0) {
      var counterChance = Math.max(0.1, 0.5 - t * 0.35);
      if (Math.random() < counterChance) {
        f2.punchTimer = 0.2;
        f2.stanceTimer = punchInterval * (1.2 + Math.random() * 0.8);
        f1.hitFlash = 0.15;
        G.arenaShake = Math.max(G.arenaShake, 1);
        spawnParticles(f1.x + 10, f1.y - 35, 'fire', 2);
      } else {
        f2.stanceTimer = punchInterval * (1.5 + Math.random());
        f2.blockTimer = 0.3;
      }
    }

    // Decay timers
    f1.punchTimer = Math.max(0, f1.punchTimer - dt);
    f2.punchTimer = Math.max(0, f2.punchTimer - dt);
    f1.kickTimer = Math.max(0, f1.kickTimer - dt);
    f2.kickTimer = Math.max(0, f2.kickTimer - dt);
    f1.hitFlash = Math.max(0, f1.hitFlash - dt * 3);
    f2.hitFlash = Math.max(0, f2.hitFlash - dt * 3);
    f1.blockTimer = Math.max(0, f1.blockTimer - dt);
    f2.blockTimer = Math.max(0, f2.blockTimer - dt);

    // Health degrades more at extreme tension
    if (t > 0.75) {
      f2.health = Math.max(0, f2.health - dt * 0.03 * (t - 0.5));
    }
  }
  else if (G.phase === 'CRASH') {
    // KO sequence
    G.koTimer += dt;
    if (G.koTimer < 0.1) {
      G.koFlash = 1;
      G.arenaShake = 12;
      G.crowdRoar = 1;
    }
    G.koFlash = Math.max(0, G.koFlash - dt * 2);

    // F1 delivers final blow
    f1.punchTimer = Math.max(0, 0.5 - G.koTimer);

    // F2 falls
    var fallProg = Math.min(1, G.koTimer / 0.6);
    f2.y = acy + fallProg * 35;
    f2.health = 0;
    // F2 leans/rotates as falling (handled in draw)
  }

  // Global arena shake decay
  G.arenaShake = Math.max(0, G.arenaShake - dt * 15);
  G.crowdRoar = Math.max(0, G.crowdRoar - dt * 0.5);

  // Camera shake from arena
  if (G.arenaShake > 0.5) {
    G.camera.shake = Math.max(G.camera.shake, G.arenaShake * 0.5);
  }
}

// ======================== DRAW HELPERS ========================

function _drawOctagon(cx2, acx, acy, radius, close) {
  cx2.beginPath();
  for (var i = 0; i <= 8; i++) {
    var v = OCT_VERTS[i % 8];
    var px = acx + v.x * radius;
    var py = acy + v.y * radius * 0.45; // perspective squash
    if (i === 0) cx2.moveTo(px, py);
    else cx2.lineTo(px, py);
  }
  if (close !== false) cx2.closePath();
}

// ======================== MAIN RENDER ========================
function render() {
  try {
  var W = cv.width, H = cv.height;
  cx.save();

  // Camera shake
  if (G.camera.shake > 0.1) {
    cx.translate((Math.random() - 0.5) * G.camera.shake, (Math.random() - 0.5) * G.camera.shake);
  }
  if (G.camera.zoom !== 1) {
    var z = G.camera.zoom;
    cx.translate(G.camera.zoomX, G.camera.zoomY);
    cx.scale(z, z);
    cx.translate(-G.camera.zoomX, -G.camera.zoomY);
  }

  // Update tension
  G.tension = getTension(G.mult || 1);
  var t = G.tension;

  // Arena layout
  var acx = W * 0.5, acy = H * 0.55;
  var arenaR = Math.min(W, H) * 0.28;
  var mob = W < 700;

  // =================== BACKGROUND ===================
  // Stadium arena gradient — deep dark blue like indoor arena
  var bg = cx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgb(8, 6, 20)');
  bg.addColorStop(0.2, 'rgb(12, 10, 28)');
  bg.addColorStop(0.5, 'rgb(15, 12, 30)');
  bg.addColorStop(0.8, 'rgb(10, 8, 22)');
  bg.addColorStop(1, 'rgb(6, 4, 14)');
  cx.fillStyle = bg;
  cx.fillRect(0, 0, W, H);

  // Stadium upper structure — dark rafters/ceiling
  cx.fillStyle = 'rgba(5, 3, 12, 0.8)';
  cx.fillRect(0, 0, W, H * 0.12);
  // Ceiling gradient fade
  var ceilG = cx.createLinearGradient(0, 0, 0, H * 0.2);
  ceilG.addColorStop(0, 'rgba(3, 2, 8, 0.9)');
  ceilG.addColorStop(1, 'transparent');
  cx.fillStyle = ceilG;
  cx.fillRect(0, 0, W, H * 0.2);

  // Arena overhead lights — bright spots on ceiling
  var lightCount = Math.max(4, Math.floor(W / 150));
  for (var li = 0; li < lightCount; li++) {
    var lx = W * (0.1 + li * 0.8 / (lightCount - 1));
    var ly = H * 0.03;
    var flicker = 0.8 + Math.sin(G.time * 3 + li * 2.7) * 0.15;
    // Light body
    cx.fillStyle = 'rgba(255, 250, 230, ' + (0.7 * flicker) + ')';
    cx.beginPath(); cx.arc(lx, ly, 4, 0, Math.PI * 2); cx.fill();
    // Light beam cone down
    var beamA = 0.015 + t * 0.01;
    cx.save();
    cx.globalAlpha = beamA * flicker;
    cx.beginPath();
    cx.moveTo(lx - 3, ly + 3);
    cx.lineTo(lx - W * 0.04, H * 0.5);
    cx.lineTo(lx + W * 0.04, H * 0.5);
    cx.lineTo(lx + 3, ly + 3);
    cx.closePath();
    var beamG = cx.createLinearGradient(lx, ly, lx, H * 0.5);
    beamG.addColorStop(0, 'rgba(255,250,220,0.3)');
    beamG.addColorStop(0.5, 'rgba(255,250,220,0.05)');
    beamG.addColorStop(1, 'transparent');
    cx.fillStyle = beamG;
    cx.fill();
    cx.restore();
  }

  // Atmospheric haze/smoke in arena
  cx.globalAlpha = 0.04 + t * 0.03;
  var haze = cx.createRadialGradient(acx, acy - H * 0.15, 0, acx, acy, H * 0.7);
  haze.addColorStop(0, 'rgba(120, 100, 160, 0.6)');
  haze.addColorStop(0.4, 'rgba(80, 60, 120, 0.3)');
  haze.addColorStop(1, 'transparent');
  cx.fillStyle = haze;
  cx.fillRect(0, 0, W, H);
  cx.globalAlpha = 1;

  // =================== SPOTLIGHTS ===================
  // Blue spotlight cone (left — masked fighter corner)
  cx.save();
  cx.globalAlpha = 0.08 + t * 0.06;
  cx.beginPath();
  cx.moveTo(acx - W * 0.15, H * 0.02);
  cx.lineTo(acx - arenaR * 1.2, acy + arenaR * 0.3);
  cx.lineTo(acx - arenaR * 0.1, acy + arenaR * 0.3);
  cx.lineTo(acx + W * 0.02, H * 0.02);
  cx.closePath();
  var slBG = cx.createLinearGradient(acx - W * 0.1, 0, acx - arenaR * 0.5, acy);
  slBG.addColorStop(0, 'rgba(30, 100, 255, 0.5)');
  slBG.addColorStop(0.6, 'rgba(20, 60, 200, 0.15)');
  slBG.addColorStop(1, 'transparent');
  cx.fillStyle = slBG;
  cx.fill();
  cx.restore();

  // Red spotlight cone (right — unmasked fighter corner)
  cx.save();
  cx.globalAlpha = 0.08 + t * 0.08;
  cx.beginPath();
  cx.moveTo(acx + W * 0.15, H * 0.02);
  cx.lineTo(acx + arenaR * 0.1, acy + arenaR * 0.3);
  cx.lineTo(acx + arenaR * 1.2, acy + arenaR * 0.3);
  cx.lineTo(acx - W * 0.02 + W * 0.3, H * 0.02);
  cx.closePath();
  var slRG = cx.createLinearGradient(acx + W * 0.1, 0, acx + arenaR * 0.5, acy);
  slRG.addColorStop(0, 'rgba(255, 40, 40, 0.5)');
  slRG.addColorStop(0.6, 'rgba(200, 20, 20, 0.15)');
  slRG.addColorStop(1, 'transparent');
  cx.fillStyle = slRG;
  cx.fill();
  cx.restore();

  // Center spotlight pool on the octagon
  var slCenter = cx.createRadialGradient(acx, acy, arenaR * 0.1, acx, acy, arenaR * 1.3);
  slCenter.addColorStop(0, 'rgba(255, 255, 240, ' + (0.06 + t * 0.08) + ')');
  slCenter.addColorStop(0.3, 'rgba(200, 200, 180, ' + (0.03 + t * 0.04) + ')');
  slCenter.addColorStop(1, 'transparent');
  cx.fillStyle = slCenter;
  cx.fillRect(0, 0, W, H);

  // =================== CROWD (back rows) ===================
  _drawCrowd(W, H, acx, acy, arenaR, t, 2); // back row
  _drawCrowd(W, H, acx, acy, arenaR, t, 1); // mid row

  // =================== ARENA / OCTAGON ===================
  _drawArena(W, H, acx, acy, arenaR, t);

  // =================== CROWD (front row) ===================
  _drawCrowd(W, H, acx, acy, arenaR, t, 0); // front row

  // =================== BLACK HOLES ===================
  if (G.phase === 'EXPLODE' || G.phase === 'FREEFALL' || G.phase === 'CRASH') {
    _drawBlackHoles(W, H);
  }

  // =================== TOKENS ===================
  if (G.phase === 'FREEFALL' || G.phase === 'CRASH') {
    _drawTokens(W, H);
  }

  // =================== FIGHTERS ===================
  _drawFighters(W, H, acx, acy, arenaR, t);

  // =================== HEALTH BARS ===================
  _drawHealthBars(W, H, acx, acy, arenaR, t);

  // =================== PARTICLES ===================
  G.particles = G.particles.filter(function(p) {
    p.x += p.vx * G.dt * 60;
    p.y += p.vy * G.dt * 60;
    p.vy += G.dt * 7;
    p.vx *= 0.998;
    p.life -= G.dt * 1.1;
    if (p.life <= 0) return false;
    var a = p.life * p.life;
    cx.beginPath();
    cx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, Math.PI * 2);
    cx.fillStyle = 'hsla(' + p.hue + ',' + p.sat + '%,' + p.lit + '%,' + a + ')';
    cx.fill();
    return true;
  });

  // =================== KO OVERLAY ===================
  if (G.phase === 'CRASH') {
    _drawKO(W, H, acx, acy);
  }

  // =================== BELL RING FLASH ===================
  if (G.bellRing > 0) {
    cx.globalAlpha = G.bellRing * 0.15;
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, W, H);
    cx.globalAlpha = 1;
  }

  // =================== VIGNETTE ===================
  var vigStr = 0.35 + t * 0.25;
  var vig = cx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(0.6, 'rgba(0, 0, 0, ' + (vigStr * 0.3) + ')');
  vig.addColorStop(1, 'rgba(0, 0, 0, ' + vigStr + ')');
  cx.fillStyle = vig;
  cx.fillRect(0, 0, W, H);

  // Film grain
  cx.globalAlpha = 0.012;
  for (var gi = 0; gi < 20; gi++) {
    cx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
    cx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  cx.globalAlpha = 1;

  cx.restore();
  } catch(e) { console.error('MMA Render error:', e); try { cx.restore(); } catch(e2) {} }
}

// =================== DRAW CROWD ===================
// Stadium-style crowd with large colorful people, foam fingers, banners
function _drawCrowd(W, H, acx, acy, arenaR, t, rowIdx) {
  if (!G.crowd || G.crowd.length === 0) return;

  // Row layout: back rows = smaller/darker, front = bigger/brighter
  var rowY, rowScale, rowAlpha, rowSpacing;
  if (rowIdx === 2) {
    // Back row: top of screen, small, dim (stadium upper deck)
    rowY = acy - arenaR * 0.85;
    rowScale = 1.4;
    rowAlpha = 0.45;
    rowSpacing = 0;
  } else if (rowIdx === 1) {
    // Mid row
    rowY = acy - arenaR * 0.5;
    rowScale = 2.0;
    rowAlpha = 0.6;
    rowSpacing = 0;
  } else {
    // Front row: bottom, large, bright (closest to cage)
    rowY = acy + arenaR * 0.7;
    rowScale = 3.0;
    rowAlpha = 0.75;
    rowSpacing = 0;
  }

  var excitement = Math.max(G.crowdRoar || 0, G.phase === 'FREEFALL' ? t * 0.6 : G.phase === 'CRASH' ? 0.9 : G.phase === 'BETTING' ? 0.15 : 0.1);
  var time = G.time || 0;

  // Stadium tier background (colored seating behind this row)
  if (rowIdx === 2) {
    cx.fillStyle = 'rgba(20, 15, 35, 0.7)';
    cx.fillRect(0, rowY - 30 * rowScale, W, 40 * rowScale);
  } else if (rowIdx === 1) {
    cx.fillStyle = 'rgba(15, 12, 28, 0.5)';
    cx.fillRect(0, rowY - 20 * rowScale, W, 30 * rowScale);
  }

  for (var i = 0; i < G.crowd.length; i++) {
    var c = G.crowd[i];
    if (c.row !== rowIdx) continue;

    var px = c.x * W;
    var py = rowY;
    var sc = rowScale;
    var bodyW = 6 * sc * c.bodyWidth;
    var bodyH = 10 * sc * c.height;
    var bounce = Math.sin(time * c.speed * (0.8 + excitement) + c.phase) * (2 + excitement * 6) * (sc * 0.3);

    // Arms up when excited
    var armsUp = excitement > 0.25 && Math.sin(time * 1.8 + c.phase * 2) > (0.5 - excitement * 0.6);
    var bothArmsUp = excitement > 0.6 && Math.sin(time * 2.5 + c.phase) > 0.2;

    cx.globalAlpha = rowAlpha;

    // ── TORSO (shirt) ──
    var shirtTop = py - bodyH + bounce;
    // Rounded rectangle for torso
    var sW = bodyW * 2;
    var sH = bodyH * 0.65;
    var sX = px - bodyW;
    var sY = shirtTop + bodyH * 0.25;

    cx.fillStyle = c.shirt;
    cx.beginPath();
    var rad = sc * 1.5;
    cx.moveTo(sX + rad, sY);
    cx.lineTo(sX + sW - rad, sY);
    cx.quadraticCurveTo(sX + sW, sY, sX + sW, sY + rad);
    cx.lineTo(sX + sW, sY + sH - rad);
    cx.quadraticCurveTo(sX + sW, sY + sH, sX + sW - rad, sY + sH);
    cx.lineTo(sX + rad, sY + sH);
    cx.quadraticCurveTo(sX, sY + sH, sX, sY + sH - rad);
    cx.lineTo(sX, sY + rad);
    cx.quadraticCurveTo(sX, sY, sX + rad, sY);
    cx.closePath();
    cx.fill();

    // Shirt shading
    cx.fillStyle = 'rgba(0,0,0,0.15)';
    cx.fillRect(sX + sW * 0.6, sY, sW * 0.4, sH);

    // ── SHOULDERS ──
    cx.fillStyle = c.shirt;
    cx.beginPath();
    cx.ellipse(px, sY + sc, bodyW * 1.1, sc * 2.5, 0, 0, Math.PI * 2);
    cx.fill();

    // ── HEAD ──
    var headR = 4.5 * sc;
    var headY = shirtTop + bodyH * 0.15 + bounce;

    // Neck
    cx.fillStyle = c.skinTone;
    cx.fillRect(px - sc * 1.2, headY + headR - sc, sc * 2.4, sc * 3);

    // Head circle
    cx.beginPath();
    cx.arc(px, headY, headR, 0, Math.PI * 2);
    cx.fillStyle = c.skinTone;
    cx.fill();

    // Hair or cap
    if (c.hairType === 2) {
      // Baseball cap
      cx.fillStyle = c.capColor;
      cx.beginPath();
      cx.arc(px, headY - headR * 0.15, headR * 1.05, Math.PI, 0);
      cx.fill();
      // Cap brim
      cx.fillStyle = c.capColor;
      cx.beginPath();
      cx.ellipse(px + headR * 0.3, headY - headR * 0.1, headR * 0.9, headR * 0.25, 0.15, -Math.PI * 0.1, Math.PI * 0.5);
      cx.fill();
    } else if (c.hairType === 0) {
      // Short dark hair
      cx.fillStyle = 'rgba(30,20,10,0.7)';
      cx.beginPath();
      cx.arc(px, headY - headR * 0.2, headR * 1.02, Math.PI * 1.15, Math.PI * 1.85);
      cx.fill();
    }

    // Simple face features
    cx.fillStyle = 'rgba(0,0,0,0.3)';
    // Eyes
    cx.beginPath();
    cx.arc(px - headR * 0.25, headY - headR * 0.1, sc * 0.5, 0, Math.PI * 2);
    cx.arc(px + headR * 0.25, headY - headR * 0.1, sc * 0.5, 0, Math.PI * 2);
    cx.fill();
    // Mouth (open if excited)
    if (excitement > 0.3 && armsUp) {
      cx.fillStyle = 'rgba(40,10,10,0.5)';
      cx.beginPath();
      cx.ellipse(px, headY + headR * 0.35, sc * 1.2, sc * 0.8, 0, 0, Math.PI * 2);
      cx.fill();
    }

    // ── ARMS ──
    cx.strokeStyle = c.skinTone;
    cx.lineWidth = sc * 2;
    cx.lineCap = 'round';
    var shoulderY = sY + sc * 2;

    if (armsUp || bothArmsUp) {
      // Left arm up
      var lArmAngle = -Math.PI * 0.65 + Math.sin(time * 3.5 + c.phase) * 0.25;
      var lArmLen = bodyW * 1.4;
      cx.beginPath();
      cx.moveTo(px - bodyW, shoulderY);
      cx.lineTo(px - bodyW + Math.cos(lArmAngle) * lArmLen, shoulderY + Math.sin(lArmAngle) * lArmLen);
      cx.stroke();

      // Foam finger on left hand
      if (c.hasFoamFinger) {
        var fgX = px - bodyW + Math.cos(lArmAngle) * lArmLen;
        var fgY = shoulderY + Math.sin(lArmAngle) * lArmLen;
        cx.fillStyle = c.foamColor;
        // Finger pointing up
        cx.beginPath();
        cx.moveTo(fgX - sc * 1.5, fgY);
        cx.lineTo(fgX, fgY - sc * 6);
        cx.lineTo(fgX + sc * 1.5, fgY);
        cx.closePath();
        cx.fill();
        // "#1" text
        cx.fillStyle = '#fff';
        cx.font = 'bold ' + Math.floor(sc * 2.5) + 'px sans-serif';
        cx.textAlign = 'center';
        cx.fillText('#1', fgX, fgY - sc * 2);
      }

      // Right arm
      if (bothArmsUp) {
        var rArmAngle = -Math.PI * 0.35 + Math.cos(time * 3.5 + c.phase + 1) * 0.25;
        cx.strokeStyle = c.skinTone;
        cx.beginPath();
        cx.moveTo(px + bodyW, shoulderY);
        cx.lineTo(px + bodyW + Math.cos(rArmAngle) * lArmLen, shoulderY + Math.sin(rArmAngle) * lArmLen);
        cx.stroke();
      } else {
        // Right arm down/resting
        cx.strokeStyle = c.skinTone;
        cx.beginPath();
        cx.moveTo(px + bodyW, shoulderY);
        cx.lineTo(px + bodyW + sc * 2, shoulderY + bodyH * 0.4);
        cx.stroke();
      }

      // Banner above head
      if (c.hasBanner && armsUp) {
        var banW = sc * 14;
        var banH = sc * 5;
        var banY = headY - headR - sc * 8 + Math.sin(time * 2 + c.phase) * 2;
        cx.fillStyle = c.bannerColor;
        cx.globalAlpha = rowAlpha * 0.8;
        cx.fillRect(px - banW / 2, banY, banW, banH);
        // Banner text
        cx.fillStyle = '#fff';
        cx.font = 'bold ' + Math.floor(sc * 2.5) + 'px sans-serif';
        cx.textAlign = 'center';
        cx.fillText('MMA', px, banY + banH * 0.7);
        cx.globalAlpha = rowAlpha;
        // Banner poles
        cx.strokeStyle = '#888';
        cx.lineWidth = sc * 0.5;
        cx.beginPath();
        cx.moveTo(px - banW / 2, banY + banH);
        cx.lineTo(px - banW / 2, banY + banH + sc * 5);
        cx.moveTo(px + banW / 2, banY + banH);
        cx.lineTo(px + banW / 2, banY + banH + sc * 5);
        cx.stroke();
      }
    } else {
      // Both arms down — casual pose
      cx.strokeStyle = c.skinTone;
      cx.beginPath();
      cx.moveTo(px - bodyW, shoulderY);
      cx.lineTo(px - bodyW - sc * 1.5, shoulderY + bodyH * 0.35 + Math.sin(time * 0.8 + c.phase) * sc);
      cx.stroke();
      cx.beginPath();
      cx.moveTo(px + bodyW, shoulderY);
      cx.lineTo(px + bodyW + sc * 1.5, shoulderY + bodyH * 0.35 + Math.cos(time * 0.8 + c.phase + 1) * sc);
      cx.stroke();
    }
  }
  cx.globalAlpha = 1;
}

// =================== DRAW ARENA ===================
function _drawArena(W, H, acx, acy, arenaR, t) {
  var time = G.time || 0;
  var perspY = 0.45; // perspective squash for Y
  var cageR = arenaR * 1.1; // cage slightly larger than mat
  var fenceH = arenaR * 0.55; // tall chain-link fence

  cx.save();

  // ── CONCRETE MAT FLOOR ──
  // Light gray concrete-like floor
  var matG = cx.createRadialGradient(acx, acy + arenaR * 0.1, arenaR * 0.15, acx, acy, arenaR * 1.15);
  matG.addColorStop(0, 'rgba(160, 155, 150, 0.95)');
  matG.addColorStop(0.3, 'rgba(140, 135, 130, 0.9)');
  matG.addColorStop(0.6, 'rgba(120, 115, 110, 0.85)');
  matG.addColorStop(0.85, 'rgba(100, 95, 90, 0.8)');
  matG.addColorStop(1, 'rgba(70, 65, 60, 0.6)');
  cx.fillStyle = matG;
  _drawOctagon(cx, acx, acy, cageR);
  cx.fill();

  // Floor texture — subtle noise spots
  cx.globalAlpha = 0.04;
  for (var fi = 0; fi < 40; fi++) {
    var fx = acx + Math.sin(fi * 7.3) * arenaR * 0.8;
    var fy = acy + Math.cos(fi * 4.1) * arenaR * 0.3;
    cx.fillStyle = fi % 2 === 0 ? '#fff' : '#000';
    cx.beginPath();
    cx.arc(fx, fy, 1 + (fi % 3), 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 1;

  // Spotlight reflection on mat
  var matLight = cx.createRadialGradient(acx, acy - arenaR * 0.15, 0, acx, acy, arenaR * 0.8);
  matLight.addColorStop(0, 'rgba(255, 255, 250, 0.08)');
  matLight.addColorStop(0.5, 'rgba(255, 255, 250, 0.02)');
  matLight.addColorStop(1, 'transparent');
  cx.fillStyle = matLight;
  _drawOctagon(cx, acx, acy, cageR);
  cx.fill();

  // ── RED OCTAGON BORDER LINE ──
  cx.strokeStyle = 'rgba(200, 30, 30, 0.9)';
  cx.lineWidth = 3;
  _drawOctagon(cx, acx, acy, arenaR * 0.95);
  cx.stroke();
  // Inner red line (thinner)
  cx.strokeStyle = 'rgba(200, 30, 30, 0.4)';
  cx.lineWidth = 1.5;
  _drawOctagon(cx, acx, acy, arenaR * 0.9);
  cx.stroke();

  // ── CENTER CIRCLE ──
  cx.strokeStyle = 'rgba(200, 30, 30, 0.3)';
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.ellipse(acx, acy, arenaR * 0.18, arenaR * 0.18 * perspY, 0, 0, Math.PI * 2);
  cx.stroke();

  // Center logo
  cx.globalAlpha = 0.06;
  cx.font = 'bold ' + Math.floor(arenaR * 0.15) + 'px sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = '#fff';
  cx.fillText('MMA', acx, acy + 2);
  cx.globalAlpha = 1;

  // ── BLOOD STAINS ──
  if (t > 0.5 && G.fightStarted) {
    cx.globalAlpha = (t - 0.5) * 0.2;
    var bloodSpots = Math.floor(t * 6);
    for (var bi = 0; bi < bloodSpots; bi++) {
      var bx = acx + Math.sin(bi * 7.13 + 0.5) * arenaR * 0.35;
      var by = acy + Math.cos(bi * 4.27 + 1.2) * arenaR * 0.12;
      cx.fillStyle = 'rgba(140, 20, 20, 0.7)';
      cx.beginPath();
      cx.ellipse(bx, by, 3 + bi * 2.5, 1.5 + bi * 0.8, Math.sin(bi) * 0.5, 0, Math.PI * 2);
      cx.fill();
    }
    cx.globalAlpha = 1;
  }

  // ── CHAIN-LINK FENCE PANELS ──
  // Draw fence between each pair of posts (8 panels)
  for (var pi = 0; pi < 8; pi++) {
    var v1 = OCT_VERTS[pi];
    var v2 = OCT_VERTS[(pi + 1) % 8];
    var x1 = acx + v1.x * cageR;
    var y1 = acy + v1.y * cageR * perspY;
    var x2 = acx + v2.x * cageR;
    var y2 = acy + v2.y * cageR * perspY;

    // Only draw panels that face the viewer (front half of octagon)
    var midY = (y1 + y2) / 2;
    // All panels are visible but back ones are dimmer
    var isFront = midY > acy - arenaR * 0.1;
    var panelAlpha = isFront ? 0.5 : 0.25;

    // Fence panel fill — dark with transparency (chain link look)
    cx.save();
    cx.globalAlpha = panelAlpha;

    // Panel quad (bottom edge on mat, top edge is fenceH above)
    var topY1 = y1 - fenceH * (isFront ? 1 : 0.7);
    var topY2 = y2 - fenceH * (isFront ? 1 : 0.7);

    // Dark mesh fill
    cx.fillStyle = 'rgba(20, 20, 25, 0.7)';
    cx.beginPath();
    cx.moveTo(x1, y1);
    cx.lineTo(x2, y2);
    cx.lineTo(x2, topY2);
    cx.lineTo(x1, topY1);
    cx.closePath();
    cx.fill();

    // Chain-link diamond pattern
    cx.strokeStyle = 'rgba(120, 130, 140, ' + (panelAlpha * 0.6) + ')';
    cx.lineWidth = 0.5;
    var panelW = Math.hypot(x2 - x1, y2 - y1);
    var diamondSize = 8;
    var steps = Math.floor(panelW / diamondSize);
    var hSteps = Math.floor(fenceH / diamondSize);

    for (var di = 0; di <= steps; di++) {
      var frac = di / steps;
      var bx = x1 + (x2 - x1) * frac;
      var by = y1 + (y2 - y1) * frac;
      var tx = bx;
      var ty = (isFront ? y1 : y1) - fenceH * (isFront ? 1 : 0.7) + (topY1 - (y1 - fenceH * (isFront ? 1 : 0.7))) * frac;
      // Vertical wire
      cx.beginPath();
      cx.moveTo(bx, by);
      cx.lineTo(tx + (x2 - x1) / steps * 0, ty + (topY2 - topY1) / steps * 0);
      cx.stroke();
    }
    // Horizontal wires
    for (var hi = 0; hi <= hSteps; hi++) {
      var hFrac = hi / hSteps;
      cx.beginPath();
      var hy1 = y1 - (y1 - topY1) * hFrac;
      var hy2 = y2 - (y2 - topY2) * hFrac;
      cx.moveTo(x1, hy1);
      cx.lineTo(x2, hy2);
      cx.stroke();
    }

    // Diamond cross-wires for chain link effect
    cx.strokeStyle = 'rgba(100, 110, 120, ' + (panelAlpha * 0.3) + ')';
    cx.lineWidth = 0.4;
    for (var dj = 0; dj < steps; dj++) {
      for (var dk = 0; dk < hSteps; dk++) {
        var f1x = x1 + (x2 - x1) * dj / steps;
        var f1y = y1 + (topY1 - y1) * dk / hSteps;
        var f2x = x1 + (x2 - x1) * (dj + 1) / steps;
        var f2y = y1 + (topY1 - y1) * (dk + 1) / hSteps;
        // Diagonal lines forming diamonds
        if ((dj + dk) % 2 === 0) {
          cx.beginPath();
          cx.moveTo(f1x, f1y + (y2 - y1) * dj / steps);
          cx.lineTo(f2x, f2y + (y2 - y1) * (dj + 1) / steps);
          cx.stroke();
        }
      }
    }

    // Panel edge highlight (sparkle from arena lights)
    var sparkle = Math.sin(time * 2 + pi * 1.3) * 0.5 + 0.5;
    cx.strokeStyle = 'rgba(180, 200, 220, ' + (sparkle * panelAlpha * 0.15) + ')';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(x1, topY1);
    cx.lineTo(x2, topY2);
    cx.stroke();

    cx.restore();
  }

  // ── THICK METAL POSTS ──
  for (var i = 0; i < 8; i++) {
    var v = OCT_VERTS[i];
    var px = acx + v.x * cageR;
    var py = acy + v.y * cageR * perspY;
    var isFrontPost = py > acy - arenaR * 0.1;
    var postH2 = fenceH * (isFrontPost ? 1 : 0.7);
    var postW = isFrontPost ? 6 : 4;

    // Post shadow
    cx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    cx.fillRect(px - postW / 2 + 2, py - postH2, postW, postH2 + 3);

    // Post body — thick metallic
    var postG = cx.createLinearGradient(px - postW / 2, 0, px + postW / 2, 0);
    postG.addColorStop(0, '#555');
    postG.addColorStop(0.2, '#999');
    postG.addColorStop(0.4, '#bbb');
    postG.addColorStop(0.6, '#aaa');
    postG.addColorStop(0.8, '#888');
    postG.addColorStop(1, '#555');
    cx.fillStyle = postG;
    cx.fillRect(px - postW / 2, py - postH2, postW, postH2);

    // Post base plate
    cx.fillStyle = '#777';
    cx.fillRect(px - postW * 0.7, py - 2, postW * 1.4, 4);

    // Post top cap
    cx.fillStyle = '#ccc';
    cx.beginPath();
    cx.ellipse(px, py - postH2, postW * 0.7, 2.5, 0, 0, Math.PI * 2);
    cx.fill();

    // Post specular highlight
    var specAlpha = 0.1 + Math.sin(time * 1.5 + i * 0.8) * 0.05;
    cx.fillStyle = 'rgba(255, 255, 255, ' + specAlpha + ')';
    cx.fillRect(px - postW / 2 + 1, py - postH2, 1.5, postH2);

    // Blue/red padding at top of post (like real UFC)
    if (i < 4) {
      cx.fillStyle = 'rgba(30, 80, 200, 0.4)';
    } else {
      cx.fillStyle = 'rgba(200, 30, 30, 0.4)';
    }
    cx.fillRect(px - postW / 2 - 1, py - postH2, postW + 2, 8);
  }

  // ── TOP RAIL ──
  // Horizontal bar across top of fence
  cx.strokeStyle = 'rgba(150, 160, 170, 0.5)';
  cx.lineWidth = 2.5;
  cx.beginPath();
  for (var ri = 0; ri <= 8; ri++) {
    var rv = OCT_VERTS[ri % 8];
    var rpx = acx + rv.x * cageR;
    var rpy = acy + rv.y * cageR * perspY;
    var isFrontR = rpy > acy - arenaR * 0.1;
    var topRY = rpy - fenceH * (isFrontR ? 1 : 0.7);
    if (ri === 0) cx.moveTo(rpx, topRY);
    else cx.lineTo(rpx, topRY);
  }
  cx.stroke();

  // Bottom rail
  cx.strokeStyle = 'rgba(130, 140, 150, 0.4)';
  cx.lineWidth = 2;
  _drawOctagon(cx, acx, acy, cageR);
  cx.stroke();

  cx.restore();
}

// =================== DRAW FIGHTERS ===================
function _drawFighters(W, H, acx, acy, arenaR, t) {
  var f1 = G.f1, f2 = G.f2;
  if (!f1 || !f2) return;

  var time = G.time || 0;
  var scale = Math.min(W, H) / 600;
  if (scale < 0.6) scale = 0.6;
  if (scale > 1.8) scale = 1.8;

  // Draw F2 first (red/unmasked — behind if overlapping)
  _drawSingleFighter(f2, false, scale, t, time, 'red');
  // Draw F1 on top (blue/masked — aggressor)
  _drawSingleFighter(f1, true, scale, t, time, 'blue');
}

function _drawSingleFighter(f, isMasked, scale, t, time, corner) {
  var px = f.x, py = f.y;
  var facing = isMasked ? 1 : -1; // F1 faces right, F2 faces left
  var sc = scale * 2.2; // bigger fighters

  cx.save();
  cx.translate(px, py);
  cx.scale(sc, sc);

  // Hit flash overlay
  if (f.hitFlash > 0) {
    cx.globalAlpha = 1;
  }

  // KO falling for F2
  var fallAngle = 0;
  if (!isMasked && G.phase === 'CRASH') {
    var fallProg = Math.min(1, (G.koTimer || 0) / 0.6);
    fallAngle = fallProg * Math.PI * 0.4 * facing;
    cx.rotate(fallAngle);
  }

  // Walk cycle bob
  var bob = Math.sin(f.walkCycle) * 1.5;
  var breathe = Math.sin(time * 3) * 0.5;

  // === SHADOW on ground ===
  cx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  cx.beginPath();
  cx.ellipse(0, 22 + bob, 16, 4, 0, 0, Math.PI * 2);
  cx.fill();

  // Color scheme
  var skinTone, skinDark, skinLight, shortsCol, glovesCol, accentCol;
  if (isMasked) {
    skinTone = '#c8956c'; skinDark = '#a07050'; skinLight = '#daa882';
    shortsCol = '#1a4a8a'; glovesCol = '#1844aa'; accentCol = '#4488ff';
  } else {
    skinTone = '#d4a574'; skinDark = '#b88858'; skinLight = '#e8bc90';
    shortsCol = '#8a1a1a'; glovesCol = '#aa2222'; accentCol = '#ff4444';
  }

  // Punch/kick state
  var punchExt = 0, punchArm = 1, kickExtend = 0;
  if (f.punchTimer > 0) {
    var pp = f.punchTimer / 0.2;
    punchExt = Math.sin(pp * Math.PI) * 22;
    punchArm = (f.combo || 0) % 2 === 0 ? 1 : -1;
  }
  if (f.kickTimer > 0) {
    kickExtend = Math.sin(f.kickTimer / 0.4 * Math.PI) * 24;
  }
  var legAngle = Math.sin(f.walkCycle) * 2.5;

  // ═══ LEGS (thick, muscular with knee joints) ═══
  var hipY = 5 + bob;
  var kneeYBack = 14 + bob + legAngle;
  var footYBack = 22 + bob;
  var kneeYFront = 14 + bob - legAngle;
  var footYFront = 22 + bob;

  // Back leg — thigh
  cx.save();
  var thighW = 4.5;
  cx.fillStyle = skinTone;
  cx.beginPath();
  cx.moveTo(-5 * facing - thighW, hipY);
  cx.quadraticCurveTo(-6 * facing - thighW * 1.2, (hipY + kneeYBack) / 2, -5 * facing - legAngle - thighW * 0.8, kneeYBack);
  cx.lineTo(-5 * facing - legAngle + thighW * 0.8, kneeYBack);
  cx.quadraticCurveTo(-6 * facing + thighW * 0.8, (hipY + kneeYBack) / 2, -5 * facing + thighW, hipY);
  cx.closePath();
  cx.fill();
  // Thigh muscle highlight
  cx.fillStyle = skinLight;
  cx.globalAlpha = 0.2;
  cx.beginPath();
  cx.ellipse(-5.5 * facing - legAngle * 0.3, (hipY + kneeYBack) / 2, thighW * 0.5, 4, 0, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;

  // Back leg — calf
  cx.fillStyle = skinTone;
  cx.beginPath();
  cx.moveTo(-5 * facing - legAngle - 3, kneeYBack);
  cx.quadraticCurveTo(-5 * facing - legAngle * 0.8 - 3.5, (kneeYBack + footYBack) / 2, -5 * facing - legAngle * 0.5 - 2, footYBack);
  cx.lineTo(-5 * facing - legAngle * 0.5 + 2, footYBack);
  cx.quadraticCurveTo(-5 * facing - legAngle * 0.8 + 3.5, (kneeYBack + footYBack) / 2, -5 * facing - legAngle + 3, kneeYBack);
  cx.closePath();
  cx.fill();
  // Calf muscle bulge
  cx.fillStyle = skinDark;
  cx.globalAlpha = 0.12;
  cx.beginPath();
  cx.ellipse(-5 * facing - legAngle * 0.7, kneeYBack + 3, 3, 3.5, 0, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;

  // Front leg — thigh
  var frontKneeX = 5 * facing + (kickExtend > 0 ? kickExtend * 0.3 * facing : legAngle);
  var frontFootX = 5 * facing + (kickExtend > 0 ? kickExtend * facing : legAngle * 0.5);
  var frontFootY = kickExtend > 0 ? 12 + bob : footYFront;
  cx.fillStyle = skinTone;
  cx.beginPath();
  cx.moveTo(5 * facing - thighW, hipY);
  cx.quadraticCurveTo(frontKneeX - thighW * 1.1, (hipY + kneeYFront) / 2, frontKneeX - thighW * 0.7, kneeYFront);
  cx.lineTo(frontKneeX + thighW * 0.7, kneeYFront);
  cx.quadraticCurveTo(frontKneeX + thighW * 0.8, (hipY + kneeYFront) / 2, 5 * facing + thighW, hipY);
  cx.closePath();
  cx.fill();

  // Front leg — calf
  cx.fillStyle = skinTone;
  cx.beginPath();
  cx.moveTo(frontKneeX - 3, kneeYFront);
  cx.quadraticCurveTo(frontFootX - 3, (kneeYFront + frontFootY) / 2, frontFootX - 2, frontFootY);
  cx.lineTo(frontFootX + 2, frontFootY);
  cx.quadraticCurveTo(frontFootX + 3, (kneeYFront + frontFootY) / 2, frontKneeX + 3, kneeYFront);
  cx.closePath();
  cx.fill();
  cx.restore();

  // Feet
  cx.fillStyle = '#222';
  cx.beginPath();
  cx.ellipse(-5 * facing - legAngle * 0.5, footYBack, 3.5, 1.8, 0.1 * facing, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.ellipse(frontFootX, frontFootY, 3.5, 1.8, -0.1 * facing, 0, Math.PI * 2);
  cx.fill();

  // ═══ SHORTS (MMA fight shorts with waistband + stripe) ═══
  var shortsG = cx.createLinearGradient(0, 1 + bob, 0, 12 + bob);
  shortsG.addColorStop(0, shortsCol);
  shortsG.addColorStop(1, _darken(shortsCol, 25));
  cx.fillStyle = shortsG;
  cx.beginPath();
  cx.moveTo(-7.5, 1 + bob);
  cx.lineTo(-8.5, 12 + bob);
  cx.quadraticCurveTo(0, 13 + bob, 8.5, 12 + bob);
  cx.lineTo(7.5, 1 + bob);
  cx.closePath();
  cx.fill();
  // Side stripes
  cx.fillStyle = accentCol;
  cx.globalAlpha = 0.5;
  cx.fillRect(-8, 2 + bob, 1.5, 9);
  cx.fillRect(6.5, 2 + bob, 1.5, 9);
  cx.globalAlpha = 1;
  // Waistband
  cx.fillStyle = 'rgba(255,255,255,0.2)';
  cx.fillRect(-7.5, 0.5 + bob, 15, 2);
  // Sponsor patch hint
  cx.fillStyle = 'rgba(255,255,255,0.06)';
  cx.fillRect(-3, 5 + bob, 6, 3);

  // ═══ TORSO (muscular with shading) ═══
  var torsoTop = -12 + bob + breathe;
  var torsoBot = 2 + bob;
  // Main torso shape — V-taper
  var torsoG = cx.createLinearGradient(-7, torsoTop, 7, torsoBot);
  torsoG.addColorStop(0, skinLight);
  torsoG.addColorStop(0.5, skinTone);
  torsoG.addColorStop(1, skinDark);
  cx.fillStyle = torsoG;
  cx.beginPath();
  cx.moveTo(-7, torsoTop + 2); // left shoulder
  cx.quadraticCurveTo(-8, torsoTop + 6, -7, torsoBot); // left side
  cx.lineTo(7, torsoBot); // bottom
  cx.quadraticCurveTo(8, torsoTop + 6, 7, torsoTop + 2); // right side
  cx.quadraticCurveTo(0, torsoTop, -7, torsoTop + 2); // top (chest)
  cx.closePath();
  cx.fill();

  // Pecs — two muscle mounds
  cx.fillStyle = skinDark;
  cx.globalAlpha = 0.1;
  cx.beginPath();
  cx.ellipse(-3.5, torsoTop + 5, 4, 2.5, -0.15, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.ellipse(3.5, torsoTop + 5, 4, 2.5, 0.15, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;

  // Pec split line
  cx.strokeStyle = skinDark;
  cx.globalAlpha = 0.15;
  cx.lineWidth = 0.5;
  cx.beginPath();
  cx.moveTo(0, torsoTop + 2.5);
  cx.lineTo(0, torsoTop + 7);
  cx.stroke();
  cx.globalAlpha = 1;

  // Abs — 6-pack with shading
  cx.strokeStyle = skinDark;
  cx.globalAlpha = 0.12;
  cx.lineWidth = 0.4;
  // Center line
  cx.beginPath(); cx.moveTo(0, torsoTop + 7); cx.lineTo(0, torsoBot - 1); cx.stroke();
  // Horizontal lines
  for (var ai = 0; ai < 3; ai++) {
    var abY = torsoTop + 8 + ai * 2.8;
    cx.beginPath();
    cx.moveTo(-3.5, abY);
    cx.quadraticCurveTo(0, abY + 0.3, 3.5, abY);
    cx.stroke();
  }
  cx.globalAlpha = 1;

  // Oblique side shadow
  cx.fillStyle = skinDark;
  cx.globalAlpha = 0.08;
  cx.beginPath();
  cx.ellipse(-6.5, torsoTop + 8, 2, 5, 0.2, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.ellipse(6.5, torsoTop + 8, 2, 5, -0.2, 0, Math.PI * 2);
  cx.fill();
  cx.globalAlpha = 1;

  // Shoulder caps (deltoids)
  cx.fillStyle = skinTone;
  cx.beginPath();
  cx.ellipse(-8, torsoTop + 3, 3.5, 3, -0.3, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.ellipse(8, torsoTop + 3, 3.5, 3, 0.3, 0, Math.PI * 2);
  cx.fill();
  // Deltoid highlight
  cx.fillStyle = skinLight;
  cx.globalAlpha = 0.2;
  cx.beginPath(); cx.ellipse(-8, torsoTop + 2, 2, 1.5, 0, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.ellipse(8, torsoTop + 2, 2, 1.5, 0, 0, Math.PI * 2); cx.fill();
  cx.globalAlpha = 1;

  // ═══ ARMS + GLOVES (with bicep/forearm thickness) ═══
  var guardY = -13 + bob;
  var guardX = 10 * facing;
  var shoulderY = torsoTop + 3;

  // Arm helper function
  function _drawArm(sx, sy, ex, ey, isFist) {
    // Upper arm (thicker)
    var mx = (sx + ex) / 2 + (ey - sy) * 0.12;
    var my = (sy + ey) / 2 + (sx - ex) * 0.05;
    cx.strokeStyle = skinTone; cx.lineWidth = 5; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(sx, sy); cx.quadraticCurveTo(mx, my, ex, ey); cx.stroke();
    // Forearm shading
    cx.strokeStyle = skinDark; cx.lineWidth = 4.5; cx.globalAlpha = 0.15;
    cx.beginPath(); cx.moveTo(mx, my); cx.lineTo(ex, ey); cx.stroke();
    cx.globalAlpha = 1;
    // Bicep bulge (visible when punching)
    if (isFist && punchExt > 5) {
      cx.fillStyle = skinLight; cx.globalAlpha = 0.2;
      cx.beginPath(); cx.ellipse(mx, my - 1, 3, 2, 0, 0, Math.PI * 2); cx.fill();
      cx.globalAlpha = 1;
    }
  }

  // Back arm
  var backArmX, backArmY;
  if (punchExt > 0 && punchArm === -1) {
    backArmX = -5 * facing + punchExt * facing;
    backArmY = -10 + bob;
  } else {
    backArmX = -guardX * 0.6;
    backArmY = guardY + Math.sin(time * 5) * 1;
  }
  _drawArm(-8 * facing, shoulderY, backArmX, backArmY, punchArm === -1);

  // Back glove
  var gG = cx.createRadialGradient(backArmX, backArmY, 0, backArmX, backArmY, 4.5);
  gG.addColorStop(0, glovesCol); gG.addColorStop(0.7, _darken(glovesCol, 20)); gG.addColorStop(1, _darken(glovesCol, 40));
  cx.fillStyle = gG;
  cx.beginPath(); cx.arc(backArmX, backArmY, 4.5, 0, Math.PI * 2); cx.fill();
  // Glove wrapping lines
  cx.strokeStyle = 'rgba(255,255,255,0.12)'; cx.lineWidth = 0.4;
  cx.beginPath(); cx.arc(backArmX, backArmY, 3, 0.3, 2.8); cx.stroke();
  cx.beginPath(); cx.arc(backArmX, backArmY, 4, 1, 2.2); cx.stroke();
  // Knuckle highlight
  cx.fillStyle = 'rgba(255,255,255,0.2)';
  cx.beginPath(); cx.ellipse(backArmX + 1.5 * facing, backArmY - 1.5, 2, 1, 0, 0, Math.PI * 2); cx.fill();

  // Front arm
  var frontArmX, frontArmY;
  if (punchExt > 0 && punchArm === 1) {
    frontArmX = 5 * facing + punchExt * facing;
    frontArmY = -10 + bob;
  } else if (f.blockTimer > 0) {
    frontArmX = 3 * facing;
    frontArmY = -18 + bob;
  } else {
    frontArmX = guardX;
    frontArmY = guardY + Math.sin(time * 5 + 1) * 1;
  }
  _drawArm(8 * facing, shoulderY, frontArmX, frontArmY, punchArm === 1);

  // Front glove
  var gG2 = cx.createRadialGradient(frontArmX, frontArmY, 0, frontArmX, frontArmY, 4.5);
  gG2.addColorStop(0, glovesCol); gG2.addColorStop(0.7, _darken(glovesCol, 20)); gG2.addColorStop(1, _darken(glovesCol, 40));
  cx.fillStyle = gG2;
  cx.beginPath(); cx.arc(frontArmX, frontArmY, 4.5, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,0.12)'; cx.lineWidth = 0.4;
  cx.beginPath(); cx.arc(frontArmX, frontArmY, 3, 0.3, 2.8); cx.stroke();
  cx.fillStyle = 'rgba(255,255,255,0.2)';
  cx.beginPath(); cx.ellipse(frontArmX + 1.5 * facing, frontArmY - 1.5, 2, 1, 0, 0, Math.PI * 2); cx.fill();

  // ═══ PUNCH IMPACT FLASH ═══
  if (punchExt > 10) {
    var impX = (punchArm === 1 ? frontArmX : backArmX);
    var impY = (punchArm === 1 ? frontArmY : backArmY);
    cx.globalAlpha = 0.5 * (punchExt / 22);
    // White flash
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.arc(impX + 5 * facing, impY, 6 + punchExt * 0.3, 0, Math.PI * 2);
    cx.fill();
    // Radial impact lines
    cx.strokeStyle = 'rgba(255, 220, 80, 0.7)';
    cx.lineWidth = 1.2;
    for (var li = 0; li < 6; li++) {
      var la = li / 6 * Math.PI * 2 + time * 12;
      var inner = 6, outer = 10 + punchExt * 0.25;
      cx.beginPath();
      cx.moveTo(impX + 5 * facing + Math.cos(la) * inner, impY + Math.sin(la) * inner);
      cx.lineTo(impX + 5 * facing + Math.cos(la) * outer, impY + Math.sin(la) * outer);
      cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  // ═══ KICK IMPACT ═══
  if (kickExtend > 15) {
    cx.globalAlpha = 0.4 * (kickExtend / 24);
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.arc(frontFootX + 3 * facing, frontFootY - 4, 5 + kickExtend * 0.2, 0, Math.PI * 2);
    cx.fill();
    cx.globalAlpha = 1;
  }

  // ═══ NECK (thick, muscular) ═══
  var neckW = 3.5;
  cx.fillStyle = skinTone;
  cx.fillRect(-neckW, torsoTop - 1, neckW * 2, 5);
  // Neck muscle (sternocleidomastoid)
  cx.fillStyle = skinDark; cx.globalAlpha = 0.08;
  cx.beginPath(); cx.moveTo(-neckW + 0.5, torsoTop + 3); cx.lineTo(-1, torsoTop - 1); cx.lineTo(1, torsoTop - 1); cx.lineTo(neckW - 0.5, torsoTop + 3); cx.stroke();
  cx.globalAlpha = 1;

  // ═══ HEAD (larger, more detailed) ═══
  var headY = torsoTop - 7 + breathe;
  var headR = 7.5;

  // Head shape — slightly oval, jaw heavier
  var headG = cx.createRadialGradient(0, headY - 1, headR * 0.3, 0, headY, headR);
  headG.addColorStop(0, skinLight);
  headG.addColorStop(0.6, skinTone);
  headG.addColorStop(1, skinDark);
  cx.fillStyle = headG;
  cx.beginPath();
  cx.ellipse(0, headY, headR * 0.9, headR, 0, 0, Math.PI * 2);
  cx.fill();

  // Jaw definition
  cx.fillStyle = skinDark; cx.globalAlpha = 0.06;
  cx.beginPath();
  cx.moveTo(-headR * 0.7, headY + 1);
  cx.quadraticCurveTo(-headR * 0.5, headY + headR * 0.8, 0, headY + headR);
  cx.quadraticCurveTo(headR * 0.5, headY + headR * 0.8, headR * 0.7, headY + 1);
  cx.fill();
  cx.globalAlpha = 1;

  if (isMasked) {
    // ═══ MASKED FIGHTER (blue) — full face mask ═══
    // Full mask covering top half of face
    cx.fillStyle = '#12122a';
    cx.beginPath();
    cx.ellipse(0, headY - 1, headR * 0.92, headR * 0.55, 0, Math.PI, Math.PI * 2);
    cx.fill();
    // Mask lower edge
    cx.fillStyle = '#1a1a30';
    cx.beginPath();
    cx.ellipse(0, headY, headR * 0.92, headR * 0.35, 0, 0, Math.PI);
    cx.fill();
    // Mask texture lines
    cx.strokeStyle = 'rgba(68,136,255,0.12)'; cx.lineWidth = 0.3;
    for (var mi = -3; mi <= 3; mi++) {
      cx.beginPath();
      cx.moveTo(mi * 2, headY - headR * 0.5);
      cx.lineTo(mi * 2.2, headY + 1);
      cx.stroke();
    }

    // Eye openings — angular, aggressive shape
    cx.fillStyle = '#000';
    // Left eye opening
    cx.beginPath();
    cx.moveTo(-5 * facing, headY - 2.5);
    cx.lineTo(-1.5 * facing, headY - 3);
    cx.lineTo(-1 * facing, headY - 0.5);
    cx.lineTo(-5.5 * facing, headY);
    cx.closePath();
    cx.fill();
    // Right eye opening
    cx.beginPath();
    cx.moveTo(1 * facing, headY - 3);
    cx.lineTo(4.5 * facing, headY - 2.5);
    cx.lineTo(5 * facing, headY);
    cx.lineTo(0.5 * facing, headY - 0.5);
    cx.closePath();
    cx.fill();

    // Glowing eyes inside openings
    cx.fillStyle = accentCol;
    cx.shadowColor = accentCol;
    cx.shadowBlur = 6;
    cx.beginPath();
    cx.ellipse(-3 * facing, headY - 1.5, 1.5, 1, 0.1, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(2.5 * facing, headY - 1.5, 1.5, 1, -0.1, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;

    // Mask edge trim — accent color
    cx.strokeStyle = accentCol; cx.globalAlpha = 0.4; cx.lineWidth = 0.6;
    cx.beginPath();
    cx.ellipse(0, headY - 1, headR * 0.92, headR * 0.55, 0, Math.PI, Math.PI * 2);
    cx.stroke();
    cx.globalAlpha = 1;

    // Mask forehead design (tribal/geometric)
    cx.strokeStyle = accentCol; cx.globalAlpha = 0.2; cx.lineWidth = 0.5;
    cx.beginPath();
    cx.moveTo(0, headY - headR * 0.6);
    cx.lineTo(-3, headY - headR * 0.3);
    cx.moveTo(0, headY - headR * 0.6);
    cx.lineTo(3, headY - headR * 0.3);
    cx.moveTo(0, headY - headR * 0.7);
    cx.lineTo(0, headY - headR * 0.4);
    cx.stroke();
    cx.globalAlpha = 1;

    // Chin / mouth — visible below mask, determined grimace
    cx.fillStyle = skinTone;
    cx.beginPath();
    cx.ellipse(0, headY + headR * 0.5, headR * 0.55, headR * 0.35, 0, 0, Math.PI);
    cx.fill();
    cx.strokeStyle = skinDark; cx.lineWidth = 0.7;
    cx.beginPath();
    cx.moveTo(-2.5, headY + 4);
    cx.lineTo(2.5, headY + 4);
    cx.stroke();

    // Ears
    cx.fillStyle = skinTone;
    cx.beginPath();
    cx.ellipse(-headR * 0.88, headY, 2, 3, 0, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(headR * 0.88, headY, 2, 3, 0, 0, Math.PI * 2);
    cx.fill();
  } else {
    // ═══ UNMASKED FIGHTER (red) — full face ═══
    // Short cropped hair
    cx.fillStyle = '#1a1008';
    cx.beginPath();
    cx.arc(0, headY - 1.5, headR * 0.82, Math.PI * 1.05, Math.PI * -0.05);
    cx.fill();
    // Hair fade sides
    cx.fillStyle = '#0e0a05';
    cx.beginPath();
    cx.ellipse(-headR * 0.6, headY - 2, headR * 0.3, headR * 0.5, 0.1, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(headR * 0.6, headY - 2, headR * 0.3, headR * 0.5, -0.1, 0, Math.PI * 2);
    cx.fill();

    // Ears
    cx.fillStyle = skinTone;
    cx.beginPath(); cx.ellipse(-headR * 0.88, headY, 2, 3, 0, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(headR * 0.88, headY, 2, 3, 0, 0, Math.PI * 2); cx.fill();
    // Cauliflower ear (fighter detail)
    cx.fillStyle = skinDark; cx.globalAlpha = 0.15;
    cx.beginPath(); cx.ellipse(-headR * 0.88, headY - 0.5, 1.5, 2, 0, 0, Math.PI * 2); cx.fill();
    cx.globalAlpha = 1;

    // Brow ridge
    cx.fillStyle = skinDark; cx.globalAlpha = 0.1;
    cx.beginPath();
    cx.ellipse(0, headY - 3, headR * 0.7, 2, 0, 0, Math.PI);
    cx.fill();
    cx.globalAlpha = 1;

    // Eyes — larger, more expressive
    var eyeW = 2.5, eyeH = 1.6;
    // Whites
    cx.fillStyle = '#f0f0f0';
    cx.beginPath(); cx.ellipse(-3, headY - 1.5, eyeW, eyeH, 0, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(3, headY - 1.5, eyeW, eyeH, 0, 0, Math.PI * 2); cx.fill();
    // Iris
    cx.fillStyle = '#4a3020';
    cx.beginPath(); cx.arc(-3 + 0.4 * facing, headY - 1.5, 1.2, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(3 + 0.4 * facing, headY - 1.5, 1.2, 0, Math.PI * 2); cx.fill();
    // Pupils
    cx.fillStyle = '#0a0a0a';
    cx.beginPath(); cx.arc(-3 + 0.4 * facing, headY - 1.5, 0.6, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(3 + 0.4 * facing, headY - 1.5, 0.6, 0, Math.PI * 2); cx.fill();
    // Eye highlight
    cx.fillStyle = 'rgba(255,255,255,0.4)';
    cx.beginPath(); cx.arc(-3 + 0.8 * facing, headY - 2, 0.4, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(3 + 0.8 * facing, headY - 2, 0.4, 0, Math.PI * 2); cx.fill();
    // Upper eyelids
    cx.strokeStyle = skinDark; cx.lineWidth = 0.6;
    cx.beginPath(); cx.ellipse(-3, headY - 1.5, eyeW, eyeH, 0, Math.PI * 1.1, Math.PI * 1.9); cx.stroke();
    cx.beginPath(); cx.ellipse(3, headY - 1.5, eyeW, eyeH, 0, Math.PI * 1.1, Math.PI * 1.9); cx.stroke();

    // Eyebrows — worried at high tension, angry at low
    var browAngle = t * 0.3;
    cx.strokeStyle = '#1a1008'; cx.lineWidth = 1.2; cx.lineCap = 'round';
    cx.beginPath();
    cx.moveTo(-5.5, headY - 4 - browAngle);
    cx.quadraticCurveTo(-3, headY - 3.5 + browAngle * 0.5, -0.5, headY - 3.5);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(0.5, headY - 3.5);
    cx.quadraticCurveTo(3, headY - 3.5 + browAngle * 0.5, 5.5, headY - 4 - browAngle);
    cx.stroke();

    // Nose — more defined
    cx.strokeStyle = skinDark; cx.lineWidth = 0.7;
    cx.beginPath();
    cx.moveTo(0, headY - 0.5);
    cx.quadraticCurveTo(1, headY + 1.5, 0.5, headY + 2);
    cx.lineTo(-0.5, headY + 2);
    cx.quadraticCurveTo(-1, headY + 1.5, 0, headY - 0.5);
    cx.stroke();
    // Nostrils
    cx.fillStyle = skinDark; cx.globalAlpha = 0.2;
    cx.beginPath(); cx.arc(-1, headY + 2, 0.6, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(1, headY + 2, 0.6, 0, Math.PI * 2); cx.fill();
    cx.globalAlpha = 1;

    // Mouth — changes with damage
    if (f.health < 0.3) {
      // Open mouth, pain/exhaustion
      cx.fillStyle = '#2a0808';
      cx.beginPath();
      cx.ellipse(0, headY + 4, 2.5, 2, 0, 0, Math.PI * 2);
      cx.fill();
      // Teeth hint
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.fillRect(-1.5, headY + 3, 3, 1);
      // Mouthguard
      cx.fillStyle = 'rgba(255,100,100,0.3)';
      cx.fillRect(-1.5, headY + 3.8, 3, 0.8);
    } else if (f.health < 0.6) {
      // Grimace
      cx.strokeStyle = skinDark; cx.lineWidth = 0.8;
      cx.beginPath();
      cx.moveTo(-2, headY + 3.5);
      cx.quadraticCurveTo(-1, headY + 4.5, 0, headY + 3.8);
      cx.quadraticCurveTo(1, headY + 4.5, 2, headY + 3.5);
      cx.stroke();
    } else {
      // Neutral/determined
      cx.strokeStyle = skinDark; cx.lineWidth = 0.7;
      cx.beginPath();
      cx.moveTo(-2, headY + 3.5);
      cx.quadraticCurveTo(0, headY + 4, 2, headY + 3.5);
      cx.stroke();
    }

    // Stubble/beard shadow
    cx.fillStyle = skinDark; cx.globalAlpha = 0.06;
    cx.beginPath();
    cx.ellipse(0, headY + 3, headR * 0.5, headR * 0.35, 0, 0, Math.PI);
    cx.fill();
    cx.globalAlpha = 1;

    // ── DAMAGE EFFECTS ──
    // Bruise under eye
    if (t > 0.35 && G.fightStarted) {
      cx.globalAlpha = Math.min(0.6, (t - 0.35) * 0.8);
      cx.fillStyle = 'rgba(80, 15, 40, 0.6)';
      cx.beginPath();
      cx.ellipse(3.5, headY - 0.5, 2.5, 1.8, 0.2, 0, Math.PI * 2);
      cx.fill();
      // Swelling
      cx.fillStyle = 'rgba(120, 40, 60, 0.3)';
      cx.beginPath();
      cx.ellipse(4, headY, 2, 1.5, 0, 0, Math.PI * 2);
      cx.fill();
      cx.globalAlpha = 1;
    }
    // Cut above eye
    if (t > 0.6 && G.fightStarted) {
      cx.globalAlpha = Math.min(0.8, (t - 0.6) * 1.5);
      cx.strokeStyle = '#a01010'; cx.lineWidth = 0.7;
      cx.beginPath(); cx.moveTo(1.5, headY - 3.5); cx.lineTo(4, headY - 3); cx.stroke();
      // Blood drip
      cx.fillStyle = '#a01010';
      var drip = Math.sin(time * 2) * 1.5;
      cx.beginPath(); cx.ellipse(3, headY - 2 + drip, 0.5, 1 + drip * 0.3, 0, 0, Math.PI * 2); cx.fill();
      cx.globalAlpha = 1;
    }
    // Lip busted
    if (t > 0.5 && G.fightStarted) {
      cx.fillStyle = 'rgba(160, 20, 20, ' + ((t - 0.5) * 0.5) + ')';
      cx.beginPath(); cx.ellipse(0.5, headY + 4, 1, 0.6, 0, 0, Math.PI * 2); cx.fill();
    }

    // Sweat
    if (t > 0.2) {
      cx.fillStyle = 'rgba(200, 230, 255, ' + Math.min(0.4, (t - 0.2) * 0.5) + ')';
      var sw1 = headY - headR + 1 + Math.sin(time * 2.5) * 2;
      cx.beginPath(); cx.ellipse(-4, sw1, 0.7, 1.3, 0.2, 0, Math.PI * 2); cx.fill();
      if (t > 0.5) {
        var sw2 = headY - 2 + Math.sin(time * 3 + 1) * 1.5;
        cx.beginPath(); cx.ellipse(5, sw2, 0.6, 1, -0.1, 0, Math.PI * 2); cx.fill();
      }
    }
  }

  // === HIT FLASH (white overlay on body) ===
  if (f.hitFlash > 0) {
    cx.globalAlpha = f.hitFlash;
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.ellipse(0, -2 + bob, 10, 18, 0, 0, Math.PI * 2);
    cx.fill();
    cx.globalAlpha = 1;
  }

  // === BLOOD SPLATTER during hits (high tension) ===
  if (f.hitFlash > 0.1 && t > 0.5 && !isMasked) {
    cx.globalAlpha = f.hitFlash * 0.5;
    for (var bi = 0; bi < 3; bi++) {
      var bx = (Math.sin(time * 100 + bi * 33) * 10) * facing;
      var by2 = headY + Math.cos(time * 100 + bi * 17) * 8;
      cx.fillStyle = 'rgba(180, 20, 20, 0.6)';
      cx.beginPath();
      cx.arc(bx, by2, 1 + Math.random(), 0, Math.PI * 2);
      cx.fill();
    }
    cx.globalAlpha = 1;
  }

  cx.restore();
}

// =================== HEALTH BARS ===================
function _drawHealthBars(W, H, acx, acy, arenaR, t) {
  var f1 = G.f1, f2 = G.f2;
  if (!f1 || !f2) return;
  if (G.phase === 'BETTING' || G.phase === 'WAITING' || G.phase === 'INIT') return;

  var barW = Math.min(180, W * 0.18);
  var barH = 8;
  var barY = acy - arenaR * 0.7;

  // F1 health bar (blue — left)
  var f1bx = acx - barW - 20;
  // Background
  cx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  cx.fillRect(f1bx - 1, barY - 1, barW + 2, barH + 2);
  // Health fill
  var f1hp = Math.max(0, Math.min(1, f1.health));
  var f1g = cx.createLinearGradient(f1bx, 0, f1bx + barW * f1hp, 0);
  f1g.addColorStop(0, '#2266cc');
  f1g.addColorStop(1, '#44aaff');
  cx.fillStyle = f1g;
  cx.fillRect(f1bx, barY, barW * f1hp, barH);
  // Label
  cx.fillStyle = '#4488ff';
  cx.font = 'bold ' + (W < 700 ? 9 : 11) + 'px Oxanium';
  cx.textAlign = 'right';
  cx.textBaseline = 'bottom';
  cx.fillText('MASKED', f1bx + barW, barY - 3);
  // Corner label
  cx.fillStyle = 'rgba(68, 136, 255, 0.5)';
  cx.font = 'bold ' + (W < 700 ? 7 : 9) + 'px Oxanium';
  cx.fillText('BLUE CORNER', f1bx + barW, barY - 14);

  // F2 health bar (red — right)
  var f2bx = acx + 20;
  cx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  cx.fillRect(f2bx - 1, barY - 1, barW + 2, barH + 2);
  var f2hp = Math.max(0, Math.min(1, f2.health));
  var f2g = cx.createLinearGradient(f2bx + barW, 0, f2bx + barW * (1 - f2hp), 0);
  f2g.addColorStop(0, '#cc2222');
  f2g.addColorStop(1, '#ff4444');
  cx.fillStyle = f2g;
  // F2 bar fills from right
  cx.fillRect(f2bx + barW * (1 - f2hp), barY, barW * f2hp, barH);
  // Label
  cx.fillStyle = '#ff4444';
  cx.font = 'bold ' + (W < 700 ? 9 : 11) + 'px Oxanium';
  cx.textAlign = 'left';
  cx.fillText('CHALLENGER', f2bx, barY - 3);
  cx.fillStyle = 'rgba(255, 68, 68, 0.5)';
  cx.font = 'bold ' + (W < 700 ? 7 : 9) + 'px Oxanium';
  cx.fillText('RED CORNER', f2bx, barY - 14);

  // Health bar damage pulse
  if (f2.hitFlash > 0) {
    cx.fillStyle = 'rgba(255, 255, 255, ' + (f2.hitFlash * 0.3) + ')';
    cx.fillRect(f2bx + barW * (1 - f2hp), barY, barW * f2hp, barH);
  }

  // Low health warning glow
  if (f2hp < 0.3 && G.phase !== 'CRASH') {
    cx.globalAlpha = 0.3 + Math.sin(G.time * 8) * 0.15;
    cx.fillStyle = '#ff0000';
    cx.fillRect(f2bx - 2, barY - 2, barW + 4, barH + 4);
    cx.globalAlpha = 1;
  }

  // VS text
  cx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  cx.font = 'bold ' + (W < 700 ? 10 : 13) + 'px Oxanium';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('VS', acx, barY + barH * 0.5);
}

// =================== DRAW TOKENS ===================
function _drawTokens(W, H) {
  G.tokens.forEach(function(tk) {
    var ts = w2s(tk.x, tk.y);
    if (ts.y < -80 || ts.y > H + 80) return;
    var alpha = tk.collected ? tk.fadeOut : 1;
    var pulse = 1 + Math.sin(G.time * 4 + tk.pulse) * 0.12;
    var r = tk.size * pulse;

    // Outer glow
    cx.globalAlpha = alpha * 0.3;
    var grd = cx.createRadialGradient(ts.x, ts.y, 0, ts.x, ts.y, r * 3);
    grd.addColorStop(0, tk.color);
    grd.addColorStop(1, 'transparent');
    cx.fillStyle = grd;
    cx.beginPath();
    cx.arc(ts.x, ts.y, r * 3, 0, Math.PI * 2);
    cx.fill();

    // Token body
    cx.globalAlpha = alpha;
    cx.fillStyle = tk.color;
    cx.beginPath();
    cx.arc(ts.x, ts.y, r, 0, Math.PI * 2);
    cx.fill();

    // Highlight
    cx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    cx.beginPath();
    cx.arc(ts.x - r * 0.2, ts.y - r * 0.25, r * 0.4, 0, Math.PI * 2);
    cx.fill();

    // Orbit ring
    cx.strokeStyle = tk.color;
    cx.lineWidth = 1.5;
    cx.globalAlpha = alpha * 0.4;
    cx.beginPath();
    cx.arc(ts.x, ts.y, r * 1.6 * pulse, 0, Math.PI * 2);
    cx.stroke();

    // Label
    cx.globalAlpha = alpha;
    cx.fillStyle = '#fff';
    cx.font = '800 ' + (tk.size >= 16 ? 13 : 11) + 'px Oxanium';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('\u00d7' + tk.mult.toFixed(1), ts.x, ts.y);
    cx.globalAlpha = 1;
  });
}

// =================== DRAW BLACK HOLES ===================
function _drawBlackHoles(W, H) {
  G.blackHoles.forEach(function(bh) {
    var bs = w2s(bh.x, bh.y);
    if (bs.y < -150 || bs.y > H + 150) return;
    var time = G.time;
    var alpha = bh.active ? 1 : bh.hitAnim;
    var r = bh.r;
    var pulse = 1 + Math.sin(time * 3 + bh.phase) * 0.15;

    cx.save();

    // Big outer glow — purple/dark
    cx.globalAlpha = alpha * 0.25;
    var og = cx.createRadialGradient(bs.x, bs.y, r, bs.x, bs.y, r * 3.5 * pulse);
    og.addColorStop(0, 'rgba(160, 60, 255, 0.5)');
    og.addColorStop(0.4, 'rgba(120, 30, 200, 0.2)');
    og.addColorStop(1, 'transparent');
    cx.fillStyle = og;
    cx.beginPath();
    cx.arc(bs.x, bs.y, r * 3.5 * pulse, 0, Math.PI * 2);
    cx.fill();

    // Distortion rings
    cx.globalAlpha = alpha * 0.2;
    for (var ring = 3; ring >= 1; ring--) {
      var rr = r * (1.8 + ring * 0.6) + Math.sin(time * 2 + ring) * 3;
      var grd = cx.createRadialGradient(bs.x, bs.y, rr * 0.6, bs.x, bs.y, rr);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(0.5, 'rgba(100, 60, 180, 0.4)');
      grd.addColorStop(0.8, 'rgba(180, 80, 255, 0.2)');
      grd.addColorStop(1, 'transparent');
      cx.fillStyle = grd;
      cx.beginPath();
      cx.arc(bs.x, bs.y, rr, 0, Math.PI * 2);
      cx.fill();
    }

    // Accretion disk
    cx.globalAlpha = alpha * 0.7;
    cx.save();
    cx.translate(bs.x, bs.y);
    cx.rotate(time * 1.5 + bh.phase);
    for (var di = 0; di < 16; di++) {
      var da = di / 16 * Math.PI * 2;
      var dr = r * 1.4 + Math.sin(da * 3 + time * 4) * 5;
      var dsx = Math.cos(da) * dr;
      var dsy = Math.sin(da) * dr * 0.45;
      var dsz = 4 + Math.sin(da * 2 + time * 5) * 2;
      var dhue = 260 + Math.sin(da + time) * 40;
      cx.fillStyle = 'hsla(' + dhue + ', 80%, 60%, ' + (0.5 + Math.sin(da * 2 + time * 3) * 0.3) + ')';
      cx.beginPath();
      cx.arc(dsx, dsy, dsz, 0, Math.PI * 2);
      cx.fill();
    }
    cx.restore();

    // Event horizon
    cx.globalAlpha = alpha;
    var evg = cx.createRadialGradient(bs.x, bs.y, 0, bs.x, bs.y, r * 1.1);
    evg.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
    evg.addColorStop(0.6, 'rgba(0, 0, 0, 0.95)');
    evg.addColorStop(0.85, 'rgba(30, 0, 60, 0.7)');
    evg.addColorStop(1, 'transparent');
    cx.fillStyle = evg;
    cx.beginPath();
    cx.arc(bs.x, bs.y, r * 1.1, 0, Math.PI * 2);
    cx.fill();

    // Mult text
    var bhM = bh.mult || 20;
    var mCol = bhM >= 50 ? '#ffd700' : bhM >= 20 ? '#ff44aa' : bhM >= 10 ? '#ff6644' : bhM >= 5 ? '#44ccff' : '#e0a0ff';
    cx.globalAlpha = alpha;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = mCol;
    cx.font = '800 ' + Math.round(r * 0.85) + 'px Oxanium';
    cx.shadowColor = mCol;
    cx.shadowBlur = 14;
    cx.fillText(bhM + '\u00d7', bs.x, bs.y);
    cx.shadowBlur = 0;

    // Label
    cx.globalAlpha = alpha * 0.9;
    cx.fillStyle = mCol;
    cx.font = 'bold 11px Oxanium';
    cx.fillText('BLACK HOLE', bs.x, bs.y + r * 1.3 + 16);

    cx.globalAlpha = 1;
    cx.restore();
  });
}

// =================== KO SEQUENCE ===================
function _drawKO(W, H, acx, acy) {
  var koT = G.koTimer || 0;

  // Red flash
  if (G.koFlash > 0) {
    cx.globalAlpha = G.koFlash * 0.4;
    cx.fillStyle = '#ff0000';
    cx.fillRect(0, 0, W, H);
    cx.globalAlpha = 1;
  }

  // KO text appears after brief delay
  if (koT > 0.3) {
    var textProg = Math.min(1, (koT - 0.3) / 0.4);
    var textScale = 0.5 + textProg * 0.5 + Math.sin(koT * 4) * 0.03;

    cx.save();
    cx.translate(acx, acy - 60);
    cx.scale(textScale, textScale);

    // Text shadow
    cx.globalAlpha = 0.4;
    cx.fillStyle = '#000';
    cx.font = 'bold ' + Math.floor(W < 700 ? 60 : 90) + 'px Oxanium';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('K.O.', 3, 3);

    // Main text
    cx.globalAlpha = textProg;
    cx.fillStyle = '#ff2222';
    cx.shadowColor = '#ff0000';
    cx.shadowBlur = 30;
    cx.fillText('K.O.', 0, 0);
    cx.shadowBlur = 0;

    // White stroke
    cx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    cx.lineWidth = 2;
    cx.strokeText('K.O.', 0, 0);

    cx.restore();
  }

  // "CRASHED AT X.XX" after KO text
  if (koT > 1.0) {
    var subAlpha = Math.min(1, (koT - 1.0) / 0.5);
    cx.globalAlpha = subAlpha * 0.8;
    cx.fillStyle = '#ff6666';
    cx.font = 'bold ' + (W < 700 ? 14 : 18) + 'px Oxanium';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('CRASHED AT ' + (G.mult || 1).toFixed(2) + '\u00d7', acx, acy - 15);
    cx.globalAlpha = 1;
  }
}

// =================== UTILITY ===================
function _darken(hex, amount) {
  // Simple hex color darkener
  if (hex.charAt(0) === '#') hex = hex.substr(1);
  var r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
  var g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
  var b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
