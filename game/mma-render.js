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
// Kings Move inspired 3D cartoon fighter renderer
// Replace from line 949 to line 1616 in mma-render.js

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

// Helper: lighten a hex color
function _lighten(hex, amount) {
  if (hex.charAt(0) === '#') hex = hex.substr(1);
  var r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
  var g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
  var b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Helper: draw a thick muscular limb segment with gradient shading
function _drawMuscleSegment(startX, startY, endX, endY, widthStart, widthEnd, baseColor, highlightColor, shadowColor, bulge) {
  var dx = endX - startX, dy = endY - startY;
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / len, ny = dx / len; // normal perpendicular
  var mx = (startX + endX) / 2, my = (startY + endY) / 2;
  var bulgeFactor = bulge || 0;

  // Outer shape with muscle bulge
  cx.beginPath();
  cx.moveTo(startX + nx * widthStart, startY + ny * widthStart);
  cx.quadraticCurveTo(
    mx + nx * (widthStart + widthEnd) / 2 * (1 + bulgeFactor),
    my + ny * (widthStart + widthEnd) / 2 * (1 + bulgeFactor),
    endX + nx * widthEnd, endY + ny * widthEnd
  );
  cx.lineTo(endX - nx * widthEnd, endY - ny * widthEnd);
  cx.quadraticCurveTo(
    mx - nx * (widthStart + widthEnd) / 2 * (1 + bulgeFactor * 0.3),
    my - ny * (widthStart + widthEnd) / 2 * (1 + bulgeFactor * 0.3),
    startX - nx * widthStart, startY - ny * widthStart
  );
  cx.closePath();

  // Gradient fill simulating 3D volume
  var grad = cx.createLinearGradient(
    mx + nx * widthStart * 1.2, my + ny * widthStart * 1.2,
    mx - nx * widthStart * 1.2, my - ny * widthStart * 1.2
  );
  grad.addColorStop(0, highlightColor);
  grad.addColorStop(0.4, baseColor);
  grad.addColorStop(1, shadowColor);
  cx.fillStyle = grad;
  cx.fill();

  // Specular highlight along top edge
  cx.save();
  cx.globalAlpha = 0.15;
  cx.beginPath();
  cx.moveTo(startX + nx * widthStart * 0.7, startY + ny * widthStart * 0.7);
  cx.quadraticCurveTo(
    mx + nx * (widthStart + widthEnd) / 2 * (0.8 + bulgeFactor * 0.5),
    my + ny * (widthStart + widthEnd) / 2 * (0.8 + bulgeFactor * 0.5),
    endX + nx * widthEnd * 0.5, endY + ny * widthEnd * 0.5
  );
  cx.lineWidth = widthStart * 0.5;
  cx.strokeStyle = '#fff';
  cx.stroke();
  cx.restore();
}

function _drawSingleFighter(f, isMasked, scale, t, time, corner) {
  var px = f.x, py = f.y;
  var facing = isMasked ? 1 : -1;
  var sc = scale * 3.5; // MUCH bigger fighters — Kings Move scale

  cx.save();
  cx.translate(px, py);
  cx.scale(sc, sc);

  // KO falling for unmasked fighter
  var fallAngle = 0;
  if (!isMasked && G.phase === 'CRASH') {
    var fallProg = Math.min(1, (G.koTimer || 0) / 0.6);
    fallAngle = fallProg * Math.PI * 0.4 * facing;
    cx.rotate(fallAngle);
  }

  // Walk cycle bob and breathing
  var bob = Math.sin(f.walkCycle) * 1.5;
  var breathe = Math.sin(time * 3) * 0.5;
  var sway = Math.sin(f.walkCycle * 0.7) * 0.8;

  // Color scheme — rich tones for gradient shading
  var skinBase, skinHi, skinMid, skinLo, skinDeep;
  var shortsCol, shortsHi, shortsLo, glovesCol, glovesHi, glovesLo, accentCol;

  if (isMasked) {
    skinBase = '#c8956c'; skinHi = '#e8c09a'; skinMid = '#c8956c'; skinLo = '#9a6d48'; skinDeep = '#704828';
    shortsCol = '#1a4a8a'; shortsHi = '#2a6abf'; shortsLo = '#0c2a55';
    glovesCol = '#1844aa'; glovesHi = '#3366dd'; glovesLo = '#0a2266';
    accentCol = '#4488ff';
  } else {
    skinBase = '#d4a574'; skinHi = '#f0cca0'; skinMid = '#d4a574'; skinLo = '#a87a50'; skinDeep = '#7a5530';
    shortsCol = '#8a1a1a'; shortsHi = '#bb3333'; shortsLo = '#551010';
    glovesCol = '#aa2222'; glovesHi = '#dd4444'; glovesLo = '#661111';
    accentCol = '#ff4444';
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

  // === GROUND SHADOW ===
  cx.save();
  cx.globalAlpha = 0.3;
  var shadowG = cx.createRadialGradient(0, 24 + bob, 0, 0, 24 + bob, 20);
  shadowG.addColorStop(0, 'rgba(0,0,0,0.5)');
  shadowG.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = shadowG;
  cx.beginPath();
  cx.ellipse(0, 24 + bob, 20, 5, 0, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // ═══════════════════════════════════════════════
  // LEGS — thick muscular thighs and calves
  // ═══════════════════════════════════════════════
  var hipY = 6 + bob;
  var kneeYBack = 16 + bob + legAngle;
  var footYBack = 24 + bob;
  var kneeYFront = 16 + bob - legAngle;
  var footYFront = 24 + bob;

  // --- BACK LEG ---
  // Back thigh
  var backThighStartX = -5 * facing;
  var backKneeX = -5 * facing - legAngle;
  _drawMuscleSegment(
    backThighStartX, hipY, backKneeX, kneeYBack,
    5.5, 4, skinMid, skinHi, skinLo, 0.3
  );
  // Quad highlight on back thigh
  cx.save();
  cx.globalAlpha = 0.12;
  var quadG = cx.createRadialGradient(
    (backThighStartX + backKneeX) / 2, (hipY + kneeYBack) / 2 - 1, 0,
    (backThighStartX + backKneeX) / 2, (hipY + kneeYBack) / 2, 5
  );
  quadG.addColorStop(0, skinHi);
  quadG.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = quadG;
  cx.beginPath();
  cx.ellipse((backThighStartX + backKneeX) / 2, (hipY + kneeYBack) / 2, 4, 5, 0, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // Back calf
  var backFootX = -5 * facing - legAngle * 0.5;
  _drawMuscleSegment(
    backKneeX, kneeYBack, backFootX, footYBack,
    4, 2.5, skinMid, skinHi, skinLo, 0.4
  );
  // Calf muscle bulge highlight
  cx.save();
  cx.globalAlpha = 0.15;
  cx.fillStyle = skinHi;
  cx.beginPath();
  cx.ellipse(backKneeX - 0.5 * facing, kneeYBack + 3, 3, 3, 0, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // --- FRONT LEG ---
  var frontKneeX = 5 * facing + (kickExtend > 0 ? kickExtend * 0.3 * facing : legAngle);
  var frontFootX = 5 * facing + (kickExtend > 0 ? kickExtend * facing : legAngle * 0.5);
  var frontFootY = kickExtend > 0 ? 12 + bob : footYFront;

  // Front thigh (slightly thicker — closer to camera)
  _drawMuscleSegment(
    5 * facing, hipY, frontKneeX, kneeYFront,
    6, 4.5, skinMid, skinHi, skinLo, 0.35
  );
  // Quad sweep highlight
  cx.save();
  cx.globalAlpha = 0.15;
  var quadG2 = cx.createRadialGradient(
    (5 * facing + frontKneeX) / 2 + 1 * facing, (hipY + kneeYFront) / 2 - 1, 0,
    (5 * facing + frontKneeX) / 2, (hipY + kneeYFront) / 2, 6
  );
  quadG2.addColorStop(0, skinHi);
  quadG2.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = quadG2;
  cx.beginPath();
  cx.ellipse((5 * facing + frontKneeX) / 2, (hipY + kneeYFront) / 2, 5, 5.5, 0, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // Front calf
  _drawMuscleSegment(
    frontKneeX, kneeYFront, frontFootX, frontFootY,
    4.5, 2.5, skinMid, skinHi, skinLo, 0.4
  );

  // --- FEET (MMA barefoot with ankle wrap) ---
  // Back foot
  cx.save();
  var footG1 = cx.createRadialGradient(backFootX, footYBack, 0, backFootX, footYBack, 4);
  footG1.addColorStop(0, '#333');
  footG1.addColorStop(1, '#111');
  cx.fillStyle = footG1;
  cx.beginPath();
  cx.ellipse(backFootX, footYBack, 4.5, 2, 0.1 * facing, 0, Math.PI * 2);
  cx.fill();
  cx.restore();
  // Front foot
  cx.save();
  var footG2 = cx.createRadialGradient(frontFootX, frontFootY, 0, frontFootX, frontFootY, 4);
  footG2.addColorStop(0, '#333');
  footG2.addColorStop(1, '#111');
  cx.fillStyle = footG2;
  cx.beginPath();
  cx.ellipse(frontFootX, frontFootY, 4.5, 2, -0.1 * facing, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // Ankle wraps
  cx.strokeStyle = 'rgba(255,255,255,0.15)';
  cx.lineWidth = 0.6;
  cx.beginPath(); cx.ellipse(backFootX, footYBack - 1.5, 3, 1.8, 0, 0, Math.PI * 2); cx.stroke();
  cx.beginPath(); cx.ellipse(frontFootX, frontFootY - 1.5, 3, 1.8, 0, 0, Math.PI * 2); cx.stroke();

  // ═══════════════════════════════════════════════
  // SHORTS — MMA fight shorts with gradient + stripe + logo
  // ═══════════════════════════════════════════════
  var shortsTop = 1 + bob;
  var shortsBot = 14 + bob;
  cx.save();
  var sG = cx.createLinearGradient(-9, shortsTop, 9, shortsBot);
  sG.addColorStop(0, shortsHi);
  sG.addColorStop(0.3, shortsCol);
  sG.addColorStop(1, shortsLo);
  cx.fillStyle = sG;
  cx.beginPath();
  cx.moveTo(-9, shortsTop);
  cx.quadraticCurveTo(-10.5, (shortsTop + shortsBot) / 2, -10, shortsBot);
  cx.quadraticCurveTo(0, shortsBot + 1.5, 10, shortsBot);
  cx.quadraticCurveTo(10.5, (shortsTop + shortsBot) / 2, 9, shortsTop);
  cx.closePath();
  cx.fill();

  // White side stripes
  cx.fillStyle = 'rgba(255,255,255,0.55)';
  cx.beginPath();
  cx.moveTo(-9.2, shortsTop + 1); cx.lineTo(-8, shortsTop + 1);
  cx.lineTo(-8.8, shortsBot - 1); cx.lineTo(-10, shortsBot - 1);
  cx.closePath(); cx.fill();
  cx.beginPath();
  cx.moveTo(8, shortsTop + 1); cx.lineTo(9.2, shortsTop + 1);
  cx.lineTo(10, shortsBot - 1); cx.lineTo(8.8, shortsBot - 1);
  cx.closePath(); cx.fill();

  // Waistband with elastic detail
  var wbG = cx.createLinearGradient(0, shortsTop - 1, 0, shortsTop + 2.5);
  wbG.addColorStop(0, 'rgba(255,255,255,0.3)');
  wbG.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  wbG.addColorStop(1, 'rgba(0,0,0,0.1)');
  cx.fillStyle = wbG;
  cx.fillRect(-9, shortsTop - 0.5, 18, 2.5);

  // Sponsor logo patch (subtle rectangle)
  cx.fillStyle = 'rgba(255,255,255,0.08)';
  cx.fillRect(-4, shortsTop + 5, 8, 4);
  // Tiny brand text hint
  cx.fillStyle = 'rgba(255,255,255,0.12)';
  cx.fillRect(-2.5, shortsTop + 6, 5, 1.5);

  // Shorts fabric fold shadow
  cx.globalAlpha = 0.08;
  cx.fillStyle = '#000';
  cx.beginPath();
  cx.moveTo(0, shortsTop + 2);
  cx.quadraticCurveTo(-1, shortsBot - 2, 0, shortsBot);
  cx.quadraticCurveTo(1, shortsBot - 2, 0, shortsTop + 2);
  cx.fill();
  cx.globalAlpha = 1;
  cx.restore();

  // ═══════════════════════════════════════════════
  // TORSO — wide V-taper, muscular with 3D gradient shading
  // ═══════════════════════════════════════════════
  var torsoTop = -14 + bob + breathe;
  var torsoBot = 2 + bob;
  var shoulderW = 11; // Very broad shoulders
  var waistW = 8;     // Narrow waist for V-taper

  cx.save();
  // Main torso shape
  cx.beginPath();
  cx.moveTo(-shoulderW, torsoTop + 2);
  cx.quadraticCurveTo(-shoulderW - 1, torsoTop + 7, -waistW, torsoBot);
  cx.lineTo(waistW, torsoBot);
  cx.quadraticCurveTo(shoulderW + 1, torsoTop + 7, shoulderW, torsoTop + 2);
  cx.quadraticCurveTo(shoulderW * 0.3, torsoTop - 1, -shoulderW, torsoTop + 2);
  cx.closePath();

  // Side-lit torso gradient (left side brighter)
  var torsoG = cx.createLinearGradient(-shoulderW - 2, torsoTop, shoulderW + 2, torsoBot);
  torsoG.addColorStop(0, skinHi);
  torsoG.addColorStop(0.35, skinMid);
  torsoG.addColorStop(0.7, skinLo);
  torsoG.addColorStop(1, skinDeep);
  cx.fillStyle = torsoG;
  cx.fill();

  // Pecs — two prominent muscle mounds with radial gradients
  // Left pec
  var pecCx1 = -4.5, pecCy = torsoTop + 5.5 + breathe * 0.3;
  cx.save();
  cx.globalAlpha = 0.35;
  var pecG1 = cx.createRadialGradient(pecCx1 - 1, pecCy - 1, 0, pecCx1, pecCy, 5);
  pecG1.addColorStop(0, skinHi);
  pecG1.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = pecG1;
  cx.beginPath();
  cx.ellipse(pecCx1, pecCy, 5.5, 3.5, -0.15, 0, Math.PI * 2);
  cx.fill();
  cx.restore();
  // Right pec
  var pecCx2 = 4.5;
  cx.save();
  cx.globalAlpha = 0.25;
  var pecG2 = cx.createRadialGradient(pecCx2 - 1, pecCy - 1, 0, pecCx2, pecCy, 5);
  pecG2.addColorStop(0, skinHi);
  pecG2.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = pecG2;
  cx.beginPath();
  cx.ellipse(pecCx2, pecCy, 5.5, 3.5, 0.15, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // Pec shadow underneath
  cx.save();
  cx.globalAlpha = 0.12;
  cx.fillStyle = skinDeep;
  cx.beginPath();
  cx.ellipse(-4.5, torsoTop + 7.5, 5, 1.5, -0.1, 0, Math.PI);
  cx.fill();
  cx.beginPath();
  cx.ellipse(4.5, torsoTop + 7.5, 5, 1.5, 0.1, 0, Math.PI);
  cx.fill();
  cx.restore();

  // Pec split line
  cx.save();
  cx.strokeStyle = skinDeep;
  cx.globalAlpha = 0.2;
  cx.lineWidth = 0.7;
  cx.beginPath();
  cx.moveTo(0, torsoTop + 3);
  cx.quadraticCurveTo(-0.3, torsoTop + 5, 0, torsoTop + 8);
  cx.stroke();
  cx.restore();

  // Abs — 6-pack with individual muscle bellies
  cx.save();
  cx.globalAlpha = 0.12;
  cx.fillStyle = skinDeep;
  // Center line (linea alba)
  cx.lineWidth = 0.5;
  cx.strokeStyle = skinDeep;
  cx.beginPath(); cx.moveTo(0, torsoTop + 8); cx.lineTo(0, torsoBot - 1); cx.stroke();
  // Individual ab segments with slight gradient
  for (var ai = 0; ai < 3; ai++) {
    var abY = torsoTop + 9 + ai * 2.8;
    // Left ab
    cx.beginPath();
    cx.ellipse(-2.5, abY + 0.5, 2.5, 1.2, 0, 0, Math.PI * 2);
    cx.fill();
    // Right ab
    cx.beginPath();
    cx.ellipse(2.5, abY + 0.5, 2.5, 1.2, 0, 0, Math.PI * 2);
    cx.fill();
    // Horizontal separation
    cx.beginPath();
    cx.moveTo(-4.5, abY);
    cx.quadraticCurveTo(0, abY + 0.4, 4.5, abY);
    cx.stroke();
  }
  cx.restore();

  // Oblique/serratus shadow on sides
  cx.save();
  cx.globalAlpha = 0.1;
  cx.fillStyle = skinDeep;
  // Left oblique (highlighted side — less shadow)
  cx.beginPath();
  cx.ellipse(-waistW - 0.5, torsoTop + 9, 2.5, 6, 0.2, 0, Math.PI * 2);
  cx.fill();
  // Right oblique (shadow side — deeper)
  cx.globalAlpha = 0.18;
  cx.beginPath();
  cx.ellipse(waistW + 0.5, torsoTop + 9, 2.5, 6, -0.2, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // Serratus anterior (rib muscles on sides)
  cx.save();
  cx.globalAlpha = 0.06;
  cx.strokeStyle = skinDeep;
  cx.lineWidth = 0.5;
  for (var si = 0; si < 3; si++) {
    var sy = torsoTop + 6 + si * 2;
    cx.beginPath();
    cx.moveTo(-shoulderW + 1, sy);
    cx.quadraticCurveTo(-waistW - 1, sy + 1, -waistW, sy + 2);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(shoulderW - 1, sy);
    cx.quadraticCurveTo(waistW + 1, sy + 1, waistW, sy + 2);
    cx.stroke();
  }
  cx.restore();

  // Side lighting rim highlight on left edge
  cx.save();
  cx.globalAlpha = 0.12;
  cx.strokeStyle = '#fff';
  cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(-shoulderW, torsoTop + 3);
  cx.quadraticCurveTo(-shoulderW - 0.5, torsoTop + 7, -waistW, torsoBot);
  cx.stroke();
  cx.restore();

  // Right side deep shadow
  cx.save();
  cx.globalAlpha = 0.1;
  cx.strokeStyle = skinDeep;
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.moveTo(shoulderW, torsoTop + 3);
  cx.quadraticCurveTo(shoulderW + 0.5, torsoTop + 7, waistW, torsoBot);
  cx.stroke();
  cx.restore();

  cx.restore(); // end torso save

  // ═══════════════════════════════════════════════
  // SHOULDER CAPS (deltoids) — large, rounded, 3D
  // ═══════════════════════════════════════════════
  var shoulderY = torsoTop + 3;
  // Left deltoid
  cx.save();
  var dG1 = cx.createRadialGradient(-shoulderW - 1, shoulderY - 1.5, 0, -shoulderW, shoulderY, 5);
  dG1.addColorStop(0, skinHi);
  dG1.addColorStop(0.5, skinMid);
  dG1.addColorStop(1, skinLo);
  cx.fillStyle = dG1;
  cx.beginPath();
  cx.ellipse(-shoulderW, shoulderY, 5, 4, -0.3, 0, Math.PI * 2);
  cx.fill();
  // Deltoid specular
  cx.globalAlpha = 0.2;
  cx.fillStyle = '#fff';
  cx.beginPath();
  cx.ellipse(-shoulderW - 1, shoulderY - 2, 2.5, 1.5, -0.3, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // Right deltoid (shadow side)
  cx.save();
  var dG2 = cx.createRadialGradient(shoulderW - 0.5, shoulderY - 1, 0, shoulderW, shoulderY, 5);
  dG2.addColorStop(0, skinMid);
  dG2.addColorStop(0.5, skinLo);
  dG2.addColorStop(1, skinDeep);
  cx.fillStyle = dG2;
  cx.beginPath();
  cx.ellipse(shoulderW, shoulderY, 5, 4, 0.3, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // ═══════════════════════════════════════════════
  // ARMS + GLOVES — thick biceps/forearms, gradient shaded
  // ═══════════════════════════════════════════════
  var guardY = -15 + bob;
  var guardX = 12 * facing;

  // --- BACK ARM ---
  var backArmX, backArmY;
  var backBicepBulge = 0.2;
  if (punchExt > 0 && punchArm === -1) {
    backArmX = -5 * facing + punchExt * facing;
    backArmY = -12 + bob;
    backBicepBulge = 0.6; // Bulging bicep during punch
  } else if (f.blockTimer > 0) {
    backArmX = -2 * facing;
    backArmY = -20 + bob;
    backBicepBulge = 0.4;
  } else {
    backArmX = -guardX * 0.6;
    backArmY = guardY + Math.sin(time * 5) * 1;
  }
  // Upper arm
  var backElbowX = (-shoulderW * facing + backArmX) / 2 + (backArmY - shoulderY) * 0.1;
  var backElbowY = (shoulderY + backArmY) / 2 + 3;
  _drawMuscleSegment(
    -shoulderW * facing, shoulderY, backElbowX, backElbowY,
    4.5, 3.5, skinMid, skinHi, skinLo, backBicepBulge
  );
  // Forearm
  _drawMuscleSegment(
    backElbowX, backElbowY, backArmX, backArmY,
    3.5, 3, skinMid, skinHi, skinLo, 0.15
  );

  // Back glove — radial gradient
  cx.save();
  var bgG = cx.createRadialGradient(backArmX - 1, backArmY - 1, 0, backArmX, backArmY, 6);
  bgG.addColorStop(0, glovesHi);
  bgG.addColorStop(0.5, glovesCol);
  bgG.addColorStop(1, glovesLo);
  cx.fillStyle = bgG;
  cx.beginPath();
  cx.arc(backArmX, backArmY, 5.5, 0, Math.PI * 2);
  cx.fill();
  // Glove wrapping seams
  cx.strokeStyle = 'rgba(255,255,255,0.15)';
  cx.lineWidth = 0.5;
  cx.beginPath(); cx.arc(backArmX, backArmY, 3.5, 0.2, 2.9); cx.stroke();
  cx.beginPath(); cx.arc(backArmX, backArmY, 4.5, 0.8, 2.3); cx.stroke();
  // Knuckle highlight
  cx.globalAlpha = 0.25;
  cx.fillStyle = '#fff';
  cx.beginPath();
  cx.ellipse(backArmX + 2 * facing, backArmY - 2, 2.5, 1.2, 0.2 * facing, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // --- FRONT ARM ---
  var frontArmX, frontArmY;
  var frontBicepBulge = 0.2;
  if (punchExt > 0 && punchArm === 1) {
    frontArmX = 5 * facing + punchExt * facing;
    frontArmY = -12 + bob;
    frontBicepBulge = 0.7; // Extra bulge during punch
  } else if (f.blockTimer > 0) {
    frontArmX = 3 * facing;
    frontArmY = -20 + bob;
    frontBicepBulge = 0.4;
  } else {
    frontArmX = guardX;
    frontArmY = guardY + Math.sin(time * 5 + 1) * 1;
  }
  // Upper arm
  var frontElbowX = (shoulderW * facing + frontArmX) / 2 + (frontArmY - shoulderY) * 0.1;
  var frontElbowY = (shoulderY + frontArmY) / 2 + 3;
  _drawMuscleSegment(
    shoulderW * facing, shoulderY, frontElbowX, frontElbowY,
    5, 4, skinMid, skinHi, skinLo, frontBicepBulge
  );
  // Forearm
  _drawMuscleSegment(
    frontElbowX, frontElbowY, frontArmX, frontArmY,
    4, 3.2, skinMid, skinHi, skinLo, 0.15
  );

  // Bicep peak highlight when punching
  if (punchExt > 5) {
    cx.save();
    cx.globalAlpha = 0.25;
    var bicepX = (shoulderW * facing + frontElbowX) / 2;
    var bicepY = (shoulderY + frontElbowY) / 2 - 2;
    var bpG = cx.createRadialGradient(bicepX, bicepY, 0, bicepX, bicepY, 4);
    bpG.addColorStop(0, skinHi);
    bpG.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = bpG;
    cx.beginPath();
    cx.ellipse(bicepX, bicepY, 4, 3, 0, 0, Math.PI * 2);
    cx.fill();
    cx.restore();
  }

  // Front glove — radial gradient
  cx.save();
  var fgG = cx.createRadialGradient(frontArmX - 1, frontArmY - 1, 0, frontArmX, frontArmY, 6);
  fgG.addColorStop(0, glovesHi);
  fgG.addColorStop(0.5, glovesCol);
  fgG.addColorStop(1, glovesLo);
  cx.fillStyle = fgG;
  cx.beginPath();
  cx.arc(frontArmX, frontArmY, 5.5, 0, Math.PI * 2);
  cx.fill();
  // Glove seams
  cx.strokeStyle = 'rgba(255,255,255,0.15)';
  cx.lineWidth = 0.5;
  cx.beginPath(); cx.arc(frontArmX, frontArmY, 3.5, 0.2, 2.9); cx.stroke();
  cx.beginPath(); cx.arc(frontArmX, frontArmY, 4.5, 0.8, 2.3); cx.stroke();
  // Knuckle highlight
  cx.globalAlpha = 0.25;
  cx.fillStyle = '#fff';
  cx.beginPath();
  cx.ellipse(frontArmX + 2 * facing, frontArmY - 2, 2.5, 1.2, 0.2 * facing, 0, Math.PI * 2);
  cx.fill();
  cx.restore();

  // ═══════════════════════════════════════════════
  // PUNCH IMPACT FLASH — large white flash + radial lines
  // ═══════════════════════════════════════════════
  if (punchExt > 10) {
    var impX = (punchArm === 1 ? frontArmX : backArmX);
    var impY = (punchArm === 1 ? frontArmY : backArmY);
    var impIntensity = punchExt / 22;

    cx.save();
    // Outer glow
    cx.globalAlpha = 0.3 * impIntensity;
    var impGlow = cx.createRadialGradient(
      impX + 6 * facing, impY, 0,
      impX + 6 * facing, impY, 14 + punchExt * 0.5
    );
    impGlow.addColorStop(0, 'rgba(255,255,255,0.8)');
    impGlow.addColorStop(0.4, 'rgba(255,240,150,0.4)');
    impGlow.addColorStop(1, 'rgba(255,200,50,0)');
    cx.fillStyle = impGlow;
    cx.beginPath();
    cx.arc(impX + 6 * facing, impY, 14 + punchExt * 0.5, 0, Math.PI * 2);
    cx.fill();

    // Core white flash
    cx.globalAlpha = 0.6 * impIntensity;
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.arc(impX + 5 * facing, impY, 7 + punchExt * 0.3, 0, Math.PI * 2);
    cx.fill();

    // Radial impact lines
    cx.strokeStyle = 'rgba(255, 230, 100, 0.8)';
    cx.lineWidth = 1.5;
    cx.globalAlpha = 0.6 * impIntensity;
    for (var li = 0; li < 8; li++) {
      var la = li / 8 * Math.PI * 2 + time * 15;
      var inner = 7, outer = 13 + punchExt * 0.35;
      cx.beginPath();
      cx.moveTo(impX + 5 * facing + Math.cos(la) * inner, impY + Math.sin(la) * inner);
      cx.lineTo(impX + 5 * facing + Math.cos(la) * outer, impY + Math.sin(la) * outer);
      cx.stroke();
    }

    // Screen shake spark particles
    cx.fillStyle = '#fff';
    cx.globalAlpha = 0.5 * impIntensity;
    for (var sp = 0; sp < 5; sp++) {
      var spAngle = sp / 5 * Math.PI * 2 + time * 20;
      var spDist = 8 + punchExt * 0.4 + Math.sin(time * 30 + sp * 7) * 3;
      cx.beginPath();
      cx.arc(
        impX + 5 * facing + Math.cos(spAngle) * spDist,
        impY + Math.sin(spAngle) * spDist,
        0.8 + Math.random() * 0.5, 0, Math.PI * 2
      );
      cx.fill();
    }
    cx.restore();
  }

  // ═══════════════════════════════════════════════
  // KICK IMPACT FLASH
  // ═══════════════════════════════════════════════
  if (kickExtend > 15) {
    cx.save();
    var kickImp = kickExtend / 24;
    cx.globalAlpha = 0.4 * kickImp;
    var kickGlow = cx.createRadialGradient(
      frontFootX + 4 * facing, frontFootY - 4, 0,
      frontFootX + 4 * facing, frontFootY - 4, 10 + kickExtend * 0.4
    );
    kickGlow.addColorStop(0, 'rgba(255,255,255,0.8)');
    kickGlow.addColorStop(0.5, 'rgba(255,240,150,0.3)');
    kickGlow.addColorStop(1, 'rgba(255,200,50,0)');
    cx.fillStyle = kickGlow;
    cx.beginPath();
    cx.arc(frontFootX + 4 * facing, frontFootY - 4, 10 + kickExtend * 0.4, 0, Math.PI * 2);
    cx.fill();
    // Core flash
    cx.globalAlpha = 0.5 * kickImp;
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.arc(frontFootX + 3 * facing, frontFootY - 4, 6 + kickExtend * 0.2, 0, Math.PI * 2);
    cx.fill();
    // Radial lines
    cx.strokeStyle = 'rgba(255,230,100,0.6)';
    cx.lineWidth = 1.2;
    for (var kl = 0; kl < 6; kl++) {
      var ka = kl / 6 * Math.PI * 2 + time * 12;
      cx.beginPath();
      cx.moveTo(frontFootX + 3 * facing + Math.cos(ka) * 5, frontFootY - 4 + Math.sin(ka) * 5);
      cx.lineTo(frontFootX + 3 * facing + Math.cos(ka) * (9 + kickExtend * 0.25), frontFootY - 4 + Math.sin(ka) * (9 + kickExtend * 0.25));
      cx.stroke();
    }
    cx.restore();
  }

  // ═══════════════════════════════════════════════
  // NECK — thick, muscular with trapezius
  // ═══════════════════════════════════════════════
  var neckW = 4.5;
  cx.save();
  var neckG = cx.createLinearGradient(-neckW, torsoTop - 2, neckW, torsoTop + 4);
  neckG.addColorStop(0, skinHi);
  neckG.addColorStop(0.5, skinMid);
  neckG.addColorStop(1, skinLo);
  cx.fillStyle = neckG;
  cx.beginPath();
  cx.moveTo(-neckW, torsoTop + 3);
  cx.quadraticCurveTo(-neckW - 0.5, torsoTop, -neckW + 1, torsoTop - 2);
  cx.lineTo(neckW - 1, torsoTop - 2);
  cx.quadraticCurveTo(neckW + 0.5, torsoTop, neckW, torsoTop + 3);
  cx.closePath();
  cx.fill();
  // Sternocleidomastoid muscle lines
  cx.globalAlpha = 0.1;
  cx.strokeStyle = skinDeep;
  cx.lineWidth = 0.6;
  cx.beginPath();
  cx.moveTo(-neckW + 1.5, torsoTop + 3);
  cx.quadraticCurveTo(-1, torsoTop, 0, torsoTop - 2);
  cx.stroke();
  cx.beginPath();
  cx.moveTo(neckW - 1.5, torsoTop + 3);
  cx.quadraticCurveTo(1, torsoTop, 0, torsoTop - 2);
  cx.stroke();
  cx.restore();

  // Trapezius muscles (connecting neck to shoulders)
  cx.save();
  cx.globalAlpha = 0.15;
  var trapG = cx.createLinearGradient(-shoulderW, shoulderY, shoulderW, shoulderY);
  trapG.addColorStop(0, skinHi);
  trapG.addColorStop(0.5, skinMid);
  trapG.addColorStop(1, skinLo);
  cx.fillStyle = trapG;
  cx.beginPath();
  cx.moveTo(-neckW, torsoTop - 1);
  cx.quadraticCurveTo(-shoulderW * 0.7, torsoTop + 1, -shoulderW, shoulderY);
  cx.lineTo(-shoulderW, shoulderY + 2);
  cx.quadraticCurveTo(-shoulderW * 0.5, torsoTop + 3, -neckW, torsoTop + 2);
  cx.closePath();
  cx.fill();
  cx.beginPath();
  cx.moveTo(neckW, torsoTop - 1);
  cx.quadraticCurveTo(shoulderW * 0.7, torsoTop + 1, shoulderW, shoulderY);
  cx.lineTo(shoulderW, shoulderY + 2);
  cx.quadraticCurveTo(shoulderW * 0.5, torsoTop + 3, neckW, torsoTop + 2);
  cx.closePath();
  cx.fill();
  cx.restore();

  // ═══════════════════════════════════════════════
  // HEAD — proportionally smaller (body:head ~4:1)
  // ═══════════════════════════════════════════════
  var headY = torsoTop - 8 + breathe;
  var headR = 6.5; // Smaller head for exaggerated body proportion

  // Head base shape — radial gradient for 3D sphere look
  var headG = cx.createRadialGradient(-1.5, headY - 2, headR * 0.2, 0, headY, headR * 1.1);
  headG.addColorStop(0, skinHi);
  headG.addColorStop(0.4, skinMid);
  headG.addColorStop(0.8, skinLo);
  headG.addColorStop(1, skinDeep);
  cx.fillStyle = headG;
  cx.beginPath();
  cx.ellipse(0, headY, headR * 0.92, headR, 0, 0, Math.PI * 2);
  cx.fill();

  // Jaw definition — heavier, stronger
  cx.save();
  cx.globalAlpha = 0.1;
  cx.fillStyle = skinDeep;
  cx.beginPath();
  cx.moveTo(-headR * 0.75, headY + 1);
  cx.quadraticCurveTo(-headR * 0.6, headY + headR * 0.85, 0, headY + headR * 1.05);
  cx.quadraticCurveTo(headR * 0.6, headY + headR * 0.85, headR * 0.75, headY + 1);
  cx.closePath();
  cx.fill();
  cx.restore();

  if (isMasked) {
    // ═══════════════════════════════════════════════
    // MASKED FIGHTER — dark blue/black full-face mask
    // ═══════════════════════════════════════════════

    // Full mask covering entire head
    cx.save();
    var maskG = cx.createRadialGradient(-1, headY - 2, 0, 0, headY, headR * 1.1);
    maskG.addColorStop(0, '#1a1a3a');
    maskG.addColorStop(0.5, '#10102a');
    maskG.addColorStop(1, '#08081a');
    cx.fillStyle = maskG;
    cx.beginPath();
    cx.ellipse(0, headY, headR * 0.93, headR * 1.01, 0, 0, Math.PI * 2);
    cx.fill();
    cx.restore();

    // Mask accent pattern — angular geometric lines
    cx.save();
    cx.strokeStyle = accentCol;
    cx.globalAlpha = 0.2;
    cx.lineWidth = 0.6;
    // Center vertical stripe
    cx.beginPath();
    cx.moveTo(0, headY - headR * 0.85);
    cx.lineTo(0, headY - headR * 0.3);
    cx.stroke();
    // V-pattern on forehead
    cx.beginPath();
    cx.moveTo(0, headY - headR * 0.7);
    cx.lineTo(-4, headY - headR * 0.25);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(0, headY - headR * 0.7);
    cx.lineTo(4, headY - headR * 0.25);
    cx.stroke();
    // Side accent arcs
    cx.lineWidth = 0.4;
    cx.globalAlpha = 0.12;
    for (var mi = -3; mi <= 3; mi++) {
      cx.beginPath();
      cx.moveTo(mi * 1.8, headY - headR * 0.6);
      cx.lineTo(mi * 2.2, headY + 1);
      cx.stroke();
    }
    // Cheek accent marks
    cx.globalAlpha = 0.15;
    cx.lineWidth = 0.5;
    cx.beginPath();
    cx.moveTo(-headR * 0.6, headY + 1);
    cx.lineTo(-headR * 0.4, headY + 3);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(headR * 0.6, headY + 1);
    cx.lineTo(headR * 0.4, headY + 3);
    cx.stroke();
    cx.restore();

    // Eye openings — angular aggressive slits
    cx.fillStyle = '#000';
    // Left eye slit
    cx.beginPath();
    cx.moveTo(-5.5 * facing, headY - 2.5);
    cx.lineTo(-1.5 * facing, headY - 3.2);
    cx.lineTo(-0.8 * facing, headY - 0.5);
    cx.lineTo(-5.8 * facing, headY + 0.2);
    cx.closePath();
    cx.fill();
    // Right eye slit
    cx.beginPath();
    cx.moveTo(0.8 * facing, headY - 3.2);
    cx.lineTo(5 * facing, headY - 2.5);
    cx.lineTo(5.3 * facing, headY + 0.2);
    cx.lineTo(0.3 * facing, headY - 0.5);
    cx.closePath();
    cx.fill();

    // Glowing blue eyes inside slits
    cx.save();
    cx.shadowColor = accentCol;
    cx.shadowBlur = 8;
    cx.fillStyle = accentCol;
    // Left eye glow
    cx.beginPath();
    cx.ellipse(-3.2 * facing, headY - 1.5, 1.8, 1.1, 0.1, 0, Math.PI * 2);
    cx.fill();
    // Right eye glow
    cx.beginPath();
    cx.ellipse(2.8 * facing, headY - 1.5, 1.8, 1.1, -0.1, 0, Math.PI * 2);
    cx.fill();
    // Bright pupil center
    cx.shadowBlur = 4;
    cx.fillStyle = '#aaddff';
    cx.beginPath();
    cx.arc(-3.2 * facing, headY - 1.5, 0.6, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.arc(2.8 * facing, headY - 1.5, 0.6, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;
    cx.restore();

    // Mask rim/edge highlight
    cx.save();
    cx.strokeStyle = accentCol;
    cx.globalAlpha = 0.3;
    cx.lineWidth = 0.8;
    cx.beginPath();
    cx.ellipse(0, headY, headR * 0.93, headR * 1.01, 0, Math.PI * 1.1, Math.PI * 1.95);
    cx.stroke();
    cx.restore();

    // Chin visible below mask — determined grimace
    cx.save();
    cx.fillStyle = skinMid;
    cx.beginPath();
    cx.ellipse(0, headY + headR * 0.55, headR * 0.5, headR * 0.35, 0, 0, Math.PI);
    cx.fill();
    // Chin shadow
    cx.globalAlpha = 0.15;
    cx.fillStyle = skinDeep;
    cx.beginPath();
    cx.ellipse(0, headY + headR * 0.65, headR * 0.4, headR * 0.2, 0, 0, Math.PI);
    cx.fill();
    cx.restore();
    // Mouth line
    cx.strokeStyle = skinDeep;
    cx.lineWidth = 0.7;
    cx.beginPath();
    cx.moveTo(-2.5, headY + 4.5);
    cx.quadraticCurveTo(0, headY + 5, 2.5, headY + 4.5);
    cx.stroke();

    // Ears peeking out
    cx.save();
    var earG = cx.createRadialGradient(-headR * 0.9, headY, 0, -headR * 0.9, headY, 3);
    earG.addColorStop(0, skinMid);
    earG.addColorStop(1, skinLo);
    cx.fillStyle = earG;
    cx.beginPath();
    cx.ellipse(-headR * 0.9, headY, 2.2, 3.2, 0, 0, Math.PI * 2);
    cx.fill();
    var earG2 = cx.createRadialGradient(headR * 0.9, headY, 0, headR * 0.9, headY, 3);
    earG2.addColorStop(0, skinMid);
    earG2.addColorStop(1, skinLo);
    cx.fillStyle = earG2;
    cx.beginPath();
    cx.ellipse(headR * 0.9, headY, 2.2, 3.2, 0, 0, Math.PI * 2);
    cx.fill();
    cx.restore();

  } else {
    // ═══════════════════════════════════════════════
    // UNMASKED FIGHTER — detailed face with expressions
    // ═══════════════════════════════════════════════

    // Short cropped hair with gradient
    cx.save();
    var hairG = cx.createRadialGradient(0, headY - 3, 0, 0, headY - 1, headR);
    hairG.addColorStop(0, '#2a1810');
    hairG.addColorStop(1, '#0e0a05');
    cx.fillStyle = hairG;
    cx.beginPath();
    cx.arc(0, headY - 1.5, headR * 0.85, Math.PI * 1.05, Math.PI * -0.05);
    cx.fill();
    // Hair fade sides
    cx.fillStyle = '#0e0a05';
    cx.beginPath();
    cx.ellipse(-headR * 0.6, headY - 2, headR * 0.32, headR * 0.52, 0.1, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(headR * 0.6, headY - 2, headR * 0.32, headR * 0.52, -0.1, 0, Math.PI * 2);
    cx.fill();
    // Hair highlight
    cx.globalAlpha = 0.08;
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.ellipse(-2, headY - headR * 0.7, 3, 1.5, -0.2, 0, Math.PI * 2);
    cx.fill();
    cx.restore();

    // Ears with inner detail
    cx.save();
    var eG1 = cx.createRadialGradient(-headR * 0.9, headY, 0, -headR * 0.9, headY, 3);
    eG1.addColorStop(0, skinHi);
    eG1.addColorStop(1, skinLo);
    cx.fillStyle = eG1;
    cx.beginPath(); cx.ellipse(-headR * 0.9, headY, 2.2, 3.2, 0, 0, Math.PI * 2); cx.fill();
    var eG2 = cx.createRadialGradient(headR * 0.9, headY, 0, headR * 0.9, headY, 3);
    eG2.addColorStop(0, skinHi);
    eG2.addColorStop(1, skinLo);
    cx.fillStyle = eG2;
    cx.beginPath(); cx.ellipse(headR * 0.9, headY, 2.2, 3.2, 0, 0, Math.PI * 2); cx.fill();
    // Cauliflower ear (fighter detail)
    cx.globalAlpha = 0.15;
    cx.fillStyle = skinDeep;
    cx.beginPath(); cx.ellipse(-headR * 0.9, headY - 0.5, 1.5, 2, 0, 0, Math.PI * 2); cx.fill();
    cx.restore();

    // Brow ridge — heavy, prominent
    cx.save();
    cx.fillStyle = skinLo;
    cx.globalAlpha = 0.15;
    cx.beginPath();
    cx.ellipse(0, headY - 3, headR * 0.75, 2.2, 0, 0, Math.PI);
    cx.fill();
    cx.restore();

    // Eyes — large, expressive with full detail
    var eyeW = 2.8, eyeH = 1.8;
    // Expression: squint more as health drops
    var squint = f.health < 0.3 ? 0.4 : (f.health < 0.6 ? 0.2 : 0);

    // Eye whites with subtle gradient
    cx.save();
    cx.fillStyle = '#f0ede8';
    cx.beginPath(); cx.ellipse(-3.2, headY - 1.5, eyeW, eyeH * (1 - squint), 0, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(3.2, headY - 1.5, eyeW, eyeH * (1 - squint), 0, 0, Math.PI * 2); cx.fill();
    cx.restore();

    // Iris with gradient
    var irisR = 1.4;
    cx.save();
    var iris1 = cx.createRadialGradient(-3.2 + 0.4 * facing, headY - 1.5, 0, -3.2 + 0.4 * facing, headY - 1.5, irisR);
    iris1.addColorStop(0, '#6a5030');
    iris1.addColorStop(0.6, '#4a3020');
    iris1.addColorStop(1, '#2a1810');
    cx.fillStyle = iris1;
    cx.beginPath(); cx.arc(-3.2 + 0.4 * facing, headY - 1.5, irisR, 0, Math.PI * 2); cx.fill();
    var iris2 = cx.createRadialGradient(3.2 + 0.4 * facing, headY - 1.5, 0, 3.2 + 0.4 * facing, headY - 1.5, irisR);
    iris2.addColorStop(0, '#6a5030');
    iris2.addColorStop(0.6, '#4a3020');
    iris2.addColorStop(1, '#2a1810');
    cx.fillStyle = iris2;
    cx.beginPath(); cx.arc(3.2 + 0.4 * facing, headY - 1.5, irisR, 0, Math.PI * 2); cx.fill();
    cx.restore();

    // Pupils
    cx.fillStyle = '#0a0a0a';
    cx.beginPath(); cx.arc(-3.2 + 0.4 * facing, headY - 1.5, 0.65, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(3.2 + 0.4 * facing, headY - 1.5, 0.65, 0, Math.PI * 2); cx.fill();

    // Eye highlight (catchlight)
    cx.fillStyle = 'rgba(255,255,255,0.5)';
    cx.beginPath(); cx.arc(-3.2 + 0.9 * facing, headY - 2.1, 0.45, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(3.2 + 0.9 * facing, headY - 2.1, 0.45, 0, Math.PI * 2); cx.fill();

    // Upper eyelids — heavier when tired
    cx.save();
    cx.strokeStyle = skinDeep;
    cx.lineWidth = 0.7 + squint * 0.5;
    cx.beginPath(); cx.ellipse(-3.2, headY - 1.5, eyeW, eyeH * (1 - squint), 0, Math.PI * 1.05, Math.PI * 1.95); cx.stroke();
    cx.beginPath(); cx.ellipse(3.2, headY - 1.5, eyeW, eyeH * (1 - squint), 0, Math.PI * 1.05, Math.PI * 1.95); cx.stroke();
    cx.restore();

    // Eyebrows — expression changes with health/tension
    var browAngle = t * 0.35;
    var browFurrow = f.health < 0.4 ? 0.5 : 0;
    cx.save();
    cx.strokeStyle = '#1a1008';
    cx.lineWidth = 1.4;
    cx.lineCap = 'round';
    // Left brow
    cx.beginPath();
    cx.moveTo(-5.8, headY - 4.2 - browAngle + browFurrow);
    cx.quadraticCurveTo(-3.2, headY - 3.8 + browAngle * 0.5, -0.6, headY - 3.8 + browFurrow * 0.3);
    cx.stroke();
    // Right brow
    cx.beginPath();
    cx.moveTo(0.6, headY - 3.8 + browFurrow * 0.3);
    cx.quadraticCurveTo(3.2, headY - 3.8 + browAngle * 0.5, 5.8, headY - 4.2 - browAngle + browFurrow);
    cx.stroke();
    cx.restore();

    // Nose — more defined with 3D shading
    cx.save();
    // Nose bridge highlight
    cx.globalAlpha = 0.1;
    cx.fillStyle = skinHi;
    cx.beginPath();
    cx.ellipse(-0.3, headY - 0.5, 0.8, 2, 0, 0, Math.PI * 2);
    cx.fill();
    cx.globalAlpha = 1;
    // Nose shape
    cx.strokeStyle = skinDeep;
    cx.lineWidth = 0.7;
    cx.beginPath();
    cx.moveTo(0, headY - 1);
    cx.quadraticCurveTo(1.2, headY + 1.5, 0.6, headY + 2.2);
    cx.lineTo(-0.6, headY + 2.2);
    cx.quadraticCurveTo(-1.2, headY + 1.5, 0, headY - 1);
    cx.stroke();
    // Nose shadow on right side
    cx.globalAlpha = 0.12;
    cx.fillStyle = skinDeep;
    cx.beginPath();
    cx.ellipse(1, headY + 1, 0.8, 1.5, 0.2, 0, Math.PI * 2);
    cx.fill();
    cx.globalAlpha = 1;
    // Nostrils
    cx.fillStyle = skinDeep;
    cx.globalAlpha = 0.25;
    cx.beginPath(); cx.arc(-1.1, headY + 2.2, 0.7, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(1.1, headY + 2.2, 0.7, 0, Math.PI * 2); cx.fill();
    cx.restore();

    // Mouth — changes expression based on health
    if (f.health < 0.3) {
      // Open mouth, pain/exhaustion
      cx.save();
      cx.fillStyle = '#2a0808';
      cx.beginPath();
      cx.ellipse(0, headY + 4.2, 2.8, 2.2, 0, 0, Math.PI * 2);
      cx.fill();
      // Teeth
      cx.fillStyle = 'rgba(255,255,240,0.5)';
      cx.fillRect(-1.8, headY + 3.2, 3.6, 1.2);
      // Lower teeth
      cx.fillStyle = 'rgba(255,255,240,0.3)';
      cx.fillRect(-1.5, headY + 4.8, 3, 0.8);
      // Mouthguard
      cx.fillStyle = 'rgba(255,100,100,0.25)';
      cx.beginPath();
      cx.ellipse(0, headY + 4.2, 2, 1, 0, 0, Math.PI);
      cx.fill();
      cx.restore();
    } else if (f.health < 0.6) {
      // Grimace/strain
      cx.save();
      cx.strokeStyle = skinDeep;
      cx.lineWidth = 0.9;
      cx.beginPath();
      cx.moveTo(-2.2, headY + 3.8);
      cx.quadraticCurveTo(-1, headY + 4.8, 0, headY + 4);
      cx.quadraticCurveTo(1, headY + 4.8, 2.2, headY + 3.8);
      cx.stroke();
      // Teeth showing through grimace
      cx.fillStyle = 'rgba(255,255,240,0.15)';
      cx.fillRect(-1.5, headY + 3.8, 3, 0.8);
      cx.restore();
    } else {
      // Neutral/determined
      cx.save();
      cx.strokeStyle = skinDeep;
      cx.lineWidth = 0.8;
      cx.beginPath();
      cx.moveTo(-2, headY + 3.8);
      cx.quadraticCurveTo(0, headY + 4.3, 2, headY + 3.8);
      cx.stroke();
      cx.restore();
    }

    // Stubble / 5 o'clock shadow
    cx.save();
    cx.fillStyle = skinDeep;
    cx.globalAlpha = 0.07;
    cx.beginPath();
    cx.ellipse(0, headY + 3.5, headR * 0.55, headR * 0.4, 0, 0, Math.PI);
    cx.fill();
    cx.restore();

    // ── PROGRESSIVE DAMAGE EFFECTS ──

    // Bruise under right eye (appears at moderate tension)
    if (t > 0.35 && G.fightStarted) {
      cx.save();
      cx.globalAlpha = Math.min(0.65, (t - 0.35) * 0.9);
      // Bruise base
      var bruiseG = cx.createRadialGradient(3.8, headY - 0.3, 0, 3.8, headY, 3);
      bruiseG.addColorStop(0, 'rgba(90, 15, 45, 0.7)');
      bruiseG.addColorStop(0.5, 'rgba(60, 10, 35, 0.4)');
      bruiseG.addColorStop(1, 'rgba(40, 5, 20, 0)');
      cx.fillStyle = bruiseG;
      cx.beginPath();
      cx.ellipse(3.8, headY - 0.3, 3, 2, 0.2, 0, Math.PI * 2);
      cx.fill();
      // Swelling bump
      if (t > 0.5) {
        cx.fillStyle = 'rgba(140, 50, 70, 0.3)';
        cx.beginPath();
        cx.ellipse(4.2, headY + 0.2, 2.2, 1.5, 0, 0, Math.PI * 2);
        cx.fill();
      }
      cx.restore();
    }

    // Cut above left eye (appears at high tension)
    if (t > 0.6 && G.fightStarted) {
      cx.save();
      cx.globalAlpha = Math.min(0.85, (t - 0.6) * 1.6);
      // Cut line
      cx.strokeStyle = '#b01515';
      cx.lineWidth = 0.8;
      cx.beginPath();
      cx.moveTo(1.2, headY - 3.8);
      cx.quadraticCurveTo(2.5, headY - 3.5, 4.2, headY - 3);
      cx.stroke();
      // Blood drip from cut
      cx.fillStyle = '#a01010';
      var drip = Math.sin(time * 2) * 2;
      cx.beginPath();
      cx.moveTo(3, headY - 3);
      cx.quadraticCurveTo(3.2, headY - 2 + drip * 0.5, 3, headY - 1 + drip);
      cx.quadraticCurveTo(2.5, headY - 2 + drip * 0.3, 3, headY - 3);
      cx.fill();
      // Second blood drip at high tension
      if (t > 0.8) {
        var drip2 = Math.sin(time * 1.5 + 1) * 2.5;
        cx.fillStyle = '#901010';
        cx.beginPath();
        cx.ellipse(2.5, headY - 1.5 + drip2, 0.5, 1.2 + drip2 * 0.2, 0.1, 0, Math.PI * 2);
        cx.fill();
      }
      cx.restore();
    }

    // Busted lip
    if (t > 0.5 && G.fightStarted) {
      cx.save();
      cx.fillStyle = 'rgba(180, 25, 25, ' + Math.min(0.6, (t - 0.5) * 0.6) + ')';
      cx.beginPath();
      cx.ellipse(0.5, headY + 4.3, 1.2, 0.7, 0, 0, Math.PI * 2);
      cx.fill();
      cx.restore();
    }

    // Sweat droplets (appear during exertion)
    if (t > 0.2) {
      cx.save();
      var sweatAlpha = Math.min(0.45, (t - 0.2) * 0.6);
      cx.fillStyle = 'rgba(200, 235, 255, ' + sweatAlpha + ')';
      // Forehead sweat
      var sw1Y = headY - headR + 1.5 + Math.sin(time * 2.5) * 2;
      cx.beginPath();
      cx.ellipse(-4, sw1Y, 0.8, 1.5, 0.2, 0, Math.PI * 2);
      cx.fill();
      // Temple sweat
      if (t > 0.4) {
        var sw2Y = headY - 2 + Math.sin(time * 3 + 1) * 1.5;
        cx.beginPath();
        cx.ellipse(5.2, sw2Y, 0.6, 1.2, -0.1, 0, Math.PI * 2);
        cx.fill();
      }
      // Neck sweat at high tension
      if (t > 0.6) {
        cx.beginPath();
        cx.ellipse(-2, torsoTop + 1 + Math.sin(time * 2.2) * 1, 0.5, 0.9, 0.15, 0, Math.PI * 2);
        cx.fill();
      }
      cx.restore();
    }
  }

  // ═══════════════════════════════════════════════
  // HIT FLASH — white overlay on entire body
  // ═══════════════════════════════════════════════
  if (f.hitFlash > 0) {
    cx.save();
    cx.globalAlpha = f.hitFlash * 0.7;
    // Large body flash
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.ellipse(0, -2 + bob, 14, 22, 0, 0, Math.PI * 2);
    cx.fill();
    // Brighter core flash on head
    cx.globalAlpha = f.hitFlash * 0.4;
    cx.beginPath();
    cx.arc(0, headY, headR + 2, 0, Math.PI * 2);
    cx.fill();
    cx.restore();
  }

  // ═══════════════════════════════════════════════
  // BLOOD SPLATTER during high tension hits (unmasked only)
  // ═══════════════════════════════════════════════
  if (f.hitFlash > 0.1 && t > 0.5 && !isMasked) {
    cx.save();
    cx.globalAlpha = f.hitFlash * 0.6;
    for (var bi = 0; bi < 5; bi++) {
      var bx = (Math.sin(time * 100 + bi * 33) * 12) * facing;
      var by2 = headY + Math.cos(time * 100 + bi * 17) * 10;
      var bSize = 0.8 + Math.sin(time * 50 + bi * 11) * 0.5;
      // Blood droplet with gradient
      var bloodG = cx.createRadialGradient(bx, by2, 0, bx, by2, bSize + 0.5);
      bloodG.addColorStop(0, 'rgba(200, 20, 20, 0.8)');
      bloodG.addColorStop(1, 'rgba(140, 10, 10, 0)');
      cx.fillStyle = bloodG;
      cx.beginPath();
      cx.arc(bx, by2, bSize + 0.5, 0, Math.PI * 2);
      cx.fill();
    }
    // Blood mist effect
    if (t > 0.7) {
      cx.globalAlpha = f.hitFlash * 0.15;
      var mistG = cx.createRadialGradient(4 * facing, headY, 0, 4 * facing, headY, 10);
      mistG.addColorStop(0, 'rgba(180, 20, 20, 0.5)');
      mistG.addColorStop(1, 'rgba(100, 10, 10, 0)');
      cx.fillStyle = mistG;
      cx.beginPath();
      cx.arc(4 * facing, headY, 10, 0, Math.PI * 2);
      cx.fill();
    }
    cx.restore();
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
