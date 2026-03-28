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
function initCrowd() {
  G.crowd = [];
  var count = Math.min(120, Math.floor(cv.width / 8));
  for (var i = 0; i < count; i++) {
    G.crowd.push({
      x: Math.random(),
      row: Math.floor(Math.random() * 3),
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2,
      height: 0.6 + Math.random() * 0.5,
      hue: Math.random() * 360,
      armUp: false,
      armPhase: Math.random() * Math.PI * 2
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
  // Dark arena gradient
  var bg = cx.createRadialGradient(acx, acy * 0.7, 0, acx, acy, H * 1.2);
  bg.addColorStop(0, 'rgb(18, 14, 24)');
  bg.addColorStop(0.3, 'rgb(12, 10, 18)');
  bg.addColorStop(0.6, 'rgb(8, 6, 14)');
  bg.addColorStop(1, 'rgb(4, 3, 8)');
  cx.fillStyle = bg;
  cx.fillRect(0, 0, W, H);

  // Subtle smoke/haze
  cx.globalAlpha = 0.03 + t * 0.02;
  var haze = cx.createRadialGradient(acx, acy - H * 0.1, 0, acx, acy, H * 0.6);
  haze.addColorStop(0, 'rgba(100, 80, 120, 1)');
  haze.addColorStop(0.5, 'rgba(60, 50, 80, 0.5)');
  haze.addColorStop(1, 'transparent');
  cx.fillStyle = haze;
  cx.fillRect(0, 0, W, H);
  cx.globalAlpha = 1;

  // Stars (arena ceiling lights / distant)
  if (G.stars) {
    for (var si = 0; si < G.stars.length; si++) {
      var s = G.stars[si];
      var tw = Math.sin(performance.now() * s.sp + s.ph) * 0.4 + 0.6;
      var sx = s.x % W;
      var sy = (s.y * 0.3) % (H * 0.35);
      cx.fillStyle = 'rgba(200, 210, 240, ' + (tw * 0.15) + ')';
      cx.beginPath();
      cx.arc(sx, sy, s.r * 0.6, 0, Math.PI * 2);
      cx.fill();
    }
  }

  // =================== SPOTLIGHTS ===================
  // Blue spotlight (left — f1 corner)
  var slBlue = cx.createRadialGradient(acx - arenaR * 0.8, acy - H * 0.5, 0, acx - arenaR * 0.5, acy, arenaR * 1.5);
  slBlue.addColorStop(0, 'rgba(30, 100, 255, ' + (0.06 + t * 0.04) + ')');
  slBlue.addColorStop(0.3, 'rgba(20, 60, 200, ' + (0.03 + t * 0.02) + ')');
  slBlue.addColorStop(1, 'transparent');
  cx.fillStyle = slBlue;
  cx.fillRect(0, 0, W, H);

  // Red spotlight (right — f2 corner)
  var slRed = cx.createRadialGradient(acx + arenaR * 0.8, acy - H * 0.5, 0, acx + arenaR * 0.5, acy, arenaR * 1.5);
  slRed.addColorStop(0, 'rgba(255, 40, 40, ' + (0.06 + t * 0.06) + ')');
  slRed.addColorStop(0.3, 'rgba(200, 20, 20, ' + (0.03 + t * 0.03) + ')');
  slRed.addColorStop(1, 'transparent');
  cx.fillStyle = slRed;
  cx.fillRect(0, 0, W, H);

  // Center spotlight (white, intensifies with tension)
  var slCenter = cx.createRadialGradient(acx, acy - H * 0.4, 10, acx, acy, arenaR * 1.2);
  slCenter.addColorStop(0, 'rgba(255, 255, 240, ' + (0.04 + t * 0.06) + ')');
  slCenter.addColorStop(0.4, 'rgba(200, 200, 180, ' + (0.02 + t * 0.03) + ')');
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
function _drawCrowd(W, H, acx, acy, arenaR, t, rowIdx) {
  if (!G.crowd || G.crowd.length === 0) return;
  var rowY, rowScale, rowAlpha;
  // Row 2 = back (farthest), Row 0 = front (closest to cage)
  if (rowIdx === 2) {
    rowY = acy - arenaR * 0.55;
    rowScale = 0.5;
    rowAlpha = 0.15;
  } else if (rowIdx === 1) {
    rowY = acy - arenaR * 0.3;
    rowScale = 0.65;
    rowAlpha = 0.2;
  } else {
    rowY = acy + arenaR * 0.55;
    rowScale = 0.85;
    rowAlpha = 0.25;
  }

  var excitement = G.crowdRoar || 0;
  var time = G.time || 0;

  for (var i = 0; i < G.crowd.length; i++) {
    var c = G.crowd[i];
    if (c.row !== rowIdx) continue;

    var px = c.x * W;
    var py = rowY;
    var h = 12 * rowScale * c.height;
    var bounce = Math.sin(time * c.speed + c.phase) * (1 + excitement * 4) * rowScale;

    // Determine if arms are up based on excitement
    var armsUp = excitement > 0.4 && Math.sin(time * 2 + c.phase) > 0.3;

    cx.globalAlpha = rowAlpha + excitement * 0.1;

    // Head
    var headR = 3 * rowScale;
    var headY = py - h - headR + bounce;
    cx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    cx.beginPath();
    cx.arc(px, headY, headR, 0, Math.PI * 2);
    cx.fill();

    // Body
    cx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    cx.lineWidth = 2 * rowScale;
    cx.beginPath();
    cx.moveTo(px, headY + headR);
    cx.lineTo(px, py + bounce);
    cx.stroke();

    // Arms
    if (armsUp) {
      var armW = 6 * rowScale;
      var armAngle = Math.sin(time * 4 + c.phase) * 0.3;
      cx.beginPath();
      cx.moveTo(px, headY + headR + 3 * rowScale);
      cx.lineTo(px - armW, headY - 2 * rowScale + Math.sin(time * 5 + c.phase) * 2);
      cx.stroke();
      cx.beginPath();
      cx.moveTo(px, headY + headR + 3 * rowScale);
      cx.lineTo(px + armW, headY - 2 * rowScale + Math.cos(time * 5 + c.phase + 1) * 2);
      cx.stroke();
    }

    // Colored shirt hint
    cx.fillStyle = 'hsla(' + c.hue + ', 40%, 25%, ' + (rowAlpha * 0.5) + ')';
    cx.fillRect(px - 2 * rowScale, headY + headR + 1, 4 * rowScale, h * 0.4);
  }
  cx.globalAlpha = 1;
}

// =================== DRAW ARENA ===================
function _drawArena(W, H, acx, acy, arenaR, t) {
  var time = G.time || 0;

  // Mat / floor — dark gray octagon
  cx.save();
  var matG = cx.createRadialGradient(acx, acy, 0, acx, acy, arenaR * 1.1);
  matG.addColorStop(0, 'rgba(40, 35, 45, 0.9)');
  matG.addColorStop(0.7, 'rgba(25, 22, 30, 0.85)');
  matG.addColorStop(1, 'rgba(15, 12, 20, 0.7)');
  cx.fillStyle = matG;
  _drawOctagon(cx, acx, acy, arenaR * 1.05);
  cx.fill();

  // Mat center circle
  cx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.ellipse(acx, acy, arenaR * 0.25, arenaR * 0.25 * 0.45, 0, 0, Math.PI * 2);
  cx.stroke();

  // Center logo hint
  cx.globalAlpha = 0.04;
  cx.font = 'bold ' + Math.floor(arenaR * 0.2) + 'px Oxanium';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = '#fff';
  cx.fillText('MMA', acx, acy + 2);
  cx.globalAlpha = 1;

  // Blue corner marking (left)
  cx.fillStyle = 'rgba(30, 100, 255, 0.08)';
  cx.beginPath();
  cx.ellipse(acx - arenaR * 0.7, acy, arenaR * 0.15, arenaR * 0.06, 0, 0, Math.PI * 2);
  cx.fill();

  // Red corner marking (right)
  cx.fillStyle = 'rgba(255, 40, 40, 0.08)';
  cx.beginPath();
  cx.ellipse(acx + arenaR * 0.7, acy, arenaR * 0.15, arenaR * 0.06, 0, 0, Math.PI * 2);
  cx.fill();

  // Blood stains during high tension
  if (t > 0.5 && G.fightStarted) {
    cx.globalAlpha = (t - 0.5) * 0.15;
    var bloodSpots = Math.floor(t * 5);
    for (var bi = 0; bi < bloodSpots; bi++) {
      // Deterministic positions from seed
      var bx = acx + Math.sin(bi * 7.13 + 0.5) * arenaR * 0.3;
      var by = acy + Math.cos(bi * 4.27 + 1.2) * arenaR * 0.1;
      cx.fillStyle = 'rgba(120, 15, 15, 0.6)';
      cx.beginPath();
      cx.ellipse(bx, by, 4 + bi * 2, 2 + bi, Math.sin(bi) * 0.5, 0, Math.PI * 2);
      cx.fill();
    }
    cx.globalAlpha = 1;
  }

  // Cage fence posts (8 posts at octagon vertices)
  var tensionCol = getTensionColor(t);
  for (var i = 0; i < 8; i++) {
    var v = OCT_VERTS[i];
    var px = acx + v.x * arenaR * 1.05;
    var py = acy + v.y * arenaR * 1.05 * 0.45;
    var postH = 35 + (i % 2) * 5;

    // Post shadow
    cx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    cx.fillRect(px - 2, py - 2, 5, postH + 4);

    // Post body — metallic
    var postG = cx.createLinearGradient(px - 2, 0, px + 3, 0);
    postG.addColorStop(0, '#888');
    postG.addColorStop(0.3, '#bbb');
    postG.addColorStop(0.7, '#aaa');
    postG.addColorStop(1, '#777');
    cx.fillStyle = postG;
    cx.fillRect(px - 1.5, py - postH, 3, postH);

    // Post cap
    cx.fillStyle = '#ddd';
    cx.beginPath();
    cx.arc(px, py - postH, 3, 0, Math.PI * 2);
    cx.fill();
  }

  // Cage ropes/wires (3 horizontal levels)
  for (var lvl = 0; lvl < 3; lvl++) {
    var ropeY = -10 - lvl * 10;
    var ropeAlpha = 0.2 + t * 0.15;
    // Rope color shifts with tension
    var rr = Math.floor(150 + t * 100);
    var rg = Math.floor(150 - t * 100);
    var rb = Math.floor(150 + (1 - t) * 50);

    cx.strokeStyle = 'rgba(' + rr + ',' + rg + ',' + rb + ',' + ropeAlpha + ')';
    cx.lineWidth = 1.2 + lvl * 0.3;
    cx.beginPath();
    for (var ri = 0; ri <= 8; ri++) {
      var rv = OCT_VERTS[ri % 8];
      var rpx = acx + rv.x * arenaR * 1.05;
      var rpy = acy + rv.y * arenaR * 1.05 * 0.45 + ropeY;
      // Add slight sag
      var sag = (ri > 0 && ri < 8) ? Math.sin(ri / 8 * Math.PI) * 2 : 0;
      if (ri === 0) cx.moveTo(rpx, rpy + sag);
      else cx.lineTo(rpx, rpy + sag);
    }
    cx.stroke();

    // Rope glow at high tension
    if (t > 0.5) {
      cx.strokeStyle = 'rgba(255, 100, 50, ' + ((t - 0.5) * 0.1) + ')';
      cx.lineWidth = 3;
      cx.stroke();
    }
  }

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
  var sc = scale * 1.6;

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
  cx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  cx.beginPath();
  cx.ellipse(0, 18 + bob, 12, 3, 0, 0, Math.PI * 2);
  cx.fill();

  // Color scheme
  var skinTone, shortsCol, glovesCol, accentCol;
  if (isMasked) {
    skinTone = '#c8956c';
    shortsCol = '#1a4a8a';
    glovesCol = '#1844aa';
    accentCol = '#4488ff';
  } else {
    skinTone = '#d4a574';
    shortsCol = '#8a1a1a';
    glovesCol = '#aa2222';
    accentCol = '#ff4444';
  }

  // === LEGS ===
  var legSpread = 6;
  var legAngle = Math.sin(f.walkCycle) * 3;
  var kickExtend = 0;
  if (f.kickTimer > 0) {
    var kp = f.kickTimer / 0.4;
    kickExtend = Math.sin(kp * Math.PI) * 20;
  }

  cx.strokeStyle = skinTone;
  cx.lineWidth = 4;
  cx.lineCap = 'round';

  // Left leg (back)
  cx.beginPath();
  cx.moveTo(-legSpread * facing, 8 + bob);
  cx.lineTo(-legSpread * facing - legAngle * 0.5, 18 + bob);
  cx.stroke();

  // Right leg (front) — kick leg
  cx.beginPath();
  cx.moveTo(legSpread * facing, 8 + bob);
  if (kickExtend > 0) {
    cx.lineTo(legSpread * facing + kickExtend * facing, 10 + bob);
  } else {
    cx.lineTo(legSpread * facing + legAngle * 0.5, 18 + bob);
  }
  cx.stroke();

  // Shin guards
  cx.strokeStyle = accentCol;
  cx.lineWidth = 2;
  cx.globalAlpha = 0.4;
  cx.beginPath();
  cx.moveTo(-legSpread * facing, 13 + bob);
  cx.lineTo(-legSpread * facing - legAngle * 0.3, 17 + bob);
  cx.stroke();
  cx.beginPath();
  if (kickExtend <= 0) {
    cx.moveTo(legSpread * facing, 13 + bob);
    cx.lineTo(legSpread * facing + legAngle * 0.3, 17 + bob);
    cx.stroke();
  }
  cx.globalAlpha = 1;

  // Feet
  cx.fillStyle = '#222';
  cx.beginPath();
  cx.ellipse(-legSpread * facing - legAngle * 0.5, 18 + bob, 3, 1.5, 0, 0, Math.PI * 2);
  cx.fill();
  if (kickExtend > 0) {
    cx.beginPath();
    cx.ellipse(legSpread * facing + kickExtend * facing, 10 + bob, 3, 1.5, 0, 0, Math.PI * 2);
    cx.fill();
  } else {
    cx.beginPath();
    cx.ellipse(legSpread * facing + legAngle * 0.5, 18 + bob, 3, 1.5, 0, 0, Math.PI * 2);
    cx.fill();
  }

  // === SHORTS ===
  cx.fillStyle = shortsCol;
  cx.beginPath();
  cx.moveTo(-6, 3 + bob);
  cx.lineTo(-7, 10 + bob);
  cx.lineTo(7, 10 + bob);
  cx.lineTo(6, 3 + bob);
  cx.closePath();
  cx.fill();

  // Shorts stripe
  cx.fillStyle = accentCol;
  cx.globalAlpha = 0.4;
  cx.fillRect(-1, 3 + bob, 2, 7);
  cx.globalAlpha = 1;

  // Waistband
  cx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  cx.fillRect(-6, 2.5 + bob, 12, 1.5);

  // === TORSO ===
  var torsoG = cx.createLinearGradient(0, -8, 0, 4);
  torsoG.addColorStop(0, skinTone);
  torsoG.addColorStop(1, _darken(skinTone, 20));
  cx.fillStyle = torsoG;
  cx.beginPath();
  cx.moveTo(-5, -8 + bob + breathe);
  cx.lineTo(-6, 4 + bob);
  cx.lineTo(6, 4 + bob);
  cx.lineTo(5, -8 + bob + breathe);
  cx.closePath();
  cx.fill();

  // Abs definition
  cx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  cx.lineWidth = 0.5;
  for (var ai = 0; ai < 3; ai++) {
    cx.beginPath();
    cx.moveTo(-3, -4 + ai * 3.5 + bob);
    cx.lineTo(3, -4 + ai * 3.5 + bob);
    cx.stroke();
  }
  cx.beginPath();
  cx.moveTo(0, -6 + bob);
  cx.lineTo(0, 4 + bob);
  cx.stroke();

  // Pecs
  cx.fillStyle = 'rgba(0, 0, 0, 0.03)';
  cx.beginPath();
  cx.ellipse(-2.5, -6 + bob, 3, 2, 0, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.ellipse(2.5, -6 + bob, 3, 2, 0, 0, Math.PI * 2);
  cx.fill();

  // === ARMS + GLOVES ===
  var punchExt = 0;
  var punchArm = 1; // which arm is punching: 1=lead, -1=rear
  if (f.punchTimer > 0) {
    var pp = f.punchTimer / 0.2;
    punchExt = Math.sin(pp * Math.PI) * 18;
    punchArm = (f.combo || 0) % 2 === 0 ? 1 : -1;
  }

  var guardY = -10 + bob;
  var guardX = 8 * facing;

  // Back arm (guard position or punching)
  var backArmX, backArmY;
  if (punchExt > 0 && punchArm === -1) {
    backArmX = -4 * facing + punchExt * facing;
    backArmY = -8 + bob;
  } else {
    backArmX = -guardX * 0.6;
    backArmY = guardY + Math.sin(time * 5) * 1;
  }
  cx.strokeStyle = skinTone;
  cx.lineWidth = 3.5;
  cx.lineCap = 'round';
  cx.beginPath();
  cx.moveTo(-4 * facing, -6 + bob);
  cx.lineTo(backArmX, backArmY);
  cx.stroke();
  // Back glove
  cx.fillStyle = glovesCol;
  cx.beginPath();
  cx.arc(backArmX, backArmY, 3.5, 0, Math.PI * 2);
  cx.fill();
  // Glove highlight
  cx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  cx.beginPath();
  cx.arc(backArmX - 0.5, backArmY - 1, 1.5, 0, Math.PI * 2);
  cx.fill();

  // Front arm
  var frontArmX, frontArmY;
  if (punchExt > 0 && punchArm === 1) {
    frontArmX = 4 * facing + punchExt * facing;
    frontArmY = -8 + bob;
  } else if (f.blockTimer > 0) {
    frontArmX = 2 * facing;
    frontArmY = -14 + bob;
  } else {
    frontArmX = guardX;
    frontArmY = guardY + Math.sin(time * 5 + 1) * 1;
  }
  cx.strokeStyle = skinTone;
  cx.lineWidth = 3.5;
  cx.beginPath();
  cx.moveTo(4 * facing, -6 + bob);
  cx.lineTo(frontArmX, frontArmY);
  cx.stroke();
  // Front glove
  cx.fillStyle = glovesCol;
  cx.beginPath();
  cx.arc(frontArmX, frontArmY, 3.5, 0, Math.PI * 2);
  cx.fill();
  cx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  cx.beginPath();
  cx.arc(frontArmX - 0.5, frontArmY - 1, 1.5, 0, Math.PI * 2);
  cx.fill();

  // Punch impact flash
  if (punchExt > 10) {
    var impX = (punchArm === 1 ? frontArmX : backArmX);
    var impY = (punchArm === 1 ? frontArmY : backArmY);
    cx.globalAlpha = 0.4 * (punchExt / 18);
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.arc(impX + 4 * facing, impY, 5 + punchExt * 0.3, 0, Math.PI * 2);
    cx.fill();
    // Impact lines
    cx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
    cx.lineWidth = 1;
    for (var li = 0; li < 4; li++) {
      var la = li / 4 * Math.PI * 2 + time * 10;
      cx.beginPath();
      cx.moveTo(impX + 4 * facing + Math.cos(la) * 5, impY + Math.sin(la) * 5);
      cx.lineTo(impX + 4 * facing + Math.cos(la) * (8 + punchExt * 0.2), impY + Math.sin(la) * (8 + punchExt * 0.2));
      cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  // === HEAD ===
  var headY = -14 + bob + breathe;
  var headR = 6;

  // Neck
  cx.fillStyle = skinTone;
  cx.fillRect(-1.5, -9 + bob, 3, 3);

  // Head circle
  cx.fillStyle = skinTone;
  cx.beginPath();
  cx.arc(0, headY, headR, 0, Math.PI * 2);
  cx.fill();

  // Head outline
  cx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  cx.lineWidth = 0.5;
  cx.beginPath();
  cx.arc(0, headY, headR, 0, Math.PI * 2);
  cx.stroke();

  if (isMasked) {
    // === MASKED FIGHTER (blue) ===
    // Mask band across eyes — dark, intimidating
    cx.fillStyle = '#1a1a2a';
    cx.beginPath();
    cx.ellipse(0, headY - 1, headR * 0.95, headR * 0.35, 0, 0, Math.PI * 2);
    cx.fill();

    // Mask eye holes — glowing
    cx.fillStyle = accentCol;
    cx.shadowColor = accentCol;
    cx.shadowBlur = 4;
    cx.beginPath();
    cx.ellipse(-2.5 * facing, headY - 1.5, 1.8, 1.2, 0, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(2 * facing, headY - 1.5, 1.8, 1.2, 0, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;

    // Mask edge detail
    cx.strokeStyle = accentCol;
    cx.globalAlpha = 0.3;
    cx.lineWidth = 0.5;
    cx.beginPath();
    cx.ellipse(0, headY - 1, headR * 0.95, headR * 0.35, 0, 0, Math.PI * 2);
    cx.stroke();
    cx.globalAlpha = 1;

    // Short hair/top
    cx.fillStyle = '#1a1a1a';
    cx.beginPath();
    cx.arc(0, headY - 2, headR * 0.7, Math.PI, 0);
    cx.fill();

    // Mouth — determined grimace
    cx.strokeStyle = '#3a2020';
    cx.lineWidth = 0.8;
    cx.beginPath();
    cx.moveTo(-2, headY + 3);
    cx.lineTo(2, headY + 3);
    cx.stroke();

    // Ear
    cx.fillStyle = skinTone;
    cx.beginPath();
    cx.ellipse(-headR * 0.85 * facing, headY, 1.5, 2.5, 0, 0, Math.PI * 2);
    cx.fill();
  } else {
    // === UNMASKED FIGHTER (red) ===
    // Hair
    cx.fillStyle = '#2a1a0a';
    cx.beginPath();
    cx.arc(0, headY - 2, headR * 0.75, Math.PI * 1.1, Math.PI * -0.1);
    cx.fill();

    // Eyes
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.ellipse(-2.5 * facing, headY - 1.5, 2, 1.3, 0, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(2 * facing, headY - 1.5, 2, 1.3, 0, 0, Math.PI * 2);
    cx.fill();
    // Pupils
    cx.fillStyle = '#1a1a1a';
    cx.beginPath();
    cx.arc(-2.5 * facing + 0.3 * facing, headY - 1.5, 0.8, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.arc(2 * facing + 0.3 * facing, headY - 1.5, 0.8, 0, Math.PI * 2);
    cx.fill();

    // Eyebrows — worried expression increases with tension
    var browRaise = t * 2;
    cx.strokeStyle = '#2a1a0a';
    cx.lineWidth = 0.8;
    cx.beginPath();
    cx.moveTo(-4 * facing, headY - 3.5 - browRaise);
    cx.lineTo(-1.5 * facing, headY - 3);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(0.5 * facing, headY - 3);
    cx.lineTo(3.5 * facing, headY - 3.5 - browRaise);
    cx.stroke();

    // Nose
    cx.strokeStyle = _darken(skinTone, 30);
    cx.lineWidth = 0.6;
    cx.beginPath();
    cx.moveTo(0, headY - 0.5);
    cx.lineTo(0.5 * facing, headY + 1);
    cx.lineTo(-0.5 * facing, headY + 1.5);
    cx.stroke();

    // Mouth — changes with damage
    if (f.health < 0.3) {
      // Mouth open, in pain
      cx.fillStyle = '#3a1010';
      cx.beginPath();
      cx.ellipse(0, headY + 3, 2, 1.5, 0, 0, Math.PI * 2);
      cx.fill();
    } else {
      cx.strokeStyle = '#5a3020';
      cx.lineWidth = 0.7;
      cx.beginPath();
      cx.moveTo(-1.5, headY + 3);
      cx.quadraticCurveTo(0, headY + 3.5 + t, 1.5, headY + 3);
      cx.stroke();
    }

    // Ear
    cx.fillStyle = skinTone;
    cx.beginPath();
    cx.ellipse(headR * 0.85 * facing, headY, 1.5, 2.5, 0, 0, Math.PI * 2);
    cx.fill();

    // Bruise marks at high tension
    if (t > 0.4 && G.fightStarted) {
      cx.globalAlpha = (t - 0.4) * 0.6;
      cx.fillStyle = 'rgba(100, 20, 40, 0.5)';
      cx.beginPath();
      cx.ellipse(3 * facing, headY - 0.5, 2, 1.5, 0.3, 0, Math.PI * 2);
      cx.fill();
      if (t > 0.7) {
        // Cut above eye
        cx.strokeStyle = 'rgba(180, 20, 20, 0.7)';
        cx.lineWidth = 0.5;
        cx.beginPath();
        cx.moveTo(1 * facing, headY - 3);
        cx.lineTo(3 * facing, headY - 2.5);
        cx.stroke();
      }
      cx.globalAlpha = 1;
    }

    // Sweat drops at high tension
    if (t > 0.3) {
      cx.fillStyle = 'rgba(180, 220, 255, ' + ((t - 0.3) * 0.4) + ')';
      var sweatY = headY - 4 + Math.sin(time * 3) * 2;
      cx.beginPath();
      cx.ellipse(-3 * facing, sweatY, 0.8, 1.2, 0, 0, Math.PI * 2);
      cx.fill();
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
