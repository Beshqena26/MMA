// Side view canvas renderer — full port from scene-side.js

const SIDE: any = {
	ready: false, img: {} as Record<string, HTMLImageElement>, _loaded: 0,
	pro: { pose: 'idle', poseTimer: 0, punchArm: 0, _poseTime: 0, _atkTimer: 0, _combo: null as string[] | null, _comboIdx: 0, _hitQueued: false },
	am: { pose: 'idle', poseTimer: 0, _poseTime: 0, _atkTimer: 0, _combo: null as string[] | null, _comboIdx: 0, _hitQueued: false },
	_koTimer: 0
};

const PRO_ANIM: any = {
	loaded: false, _loadCount: 0, _totalFrames: 0,
	anims: {} as Record<string, HTMLImageElement[]>,
	current: 'idle', frame: 0, frameTimer: 0
};
const AM_ANIM: any = {
	current: 'idle', frame: 0, frameTimer: 0
};

export function loadSideAssets() {
	if (typeof window === 'undefined') return;
	const bg = new Image();
	bg.onload = () => { SIDE.img.bg = bg; };
	bg.src = '/assets/side/BG.png';

	const sets = [
		{ name: 'idle', path: '/assets/side/pro-frames/idle/', prefix: 'Idle_', start: 37, end: 67 },
		{ name: 'leftpunch', path: '/assets/side/pro-frames/leftpunch/', prefix: 'Left_Punch_', start: 0, end: 118 },
		{ name: 'rightpunch', path: '/assets/side/pro-frames/rightpunch/', prefix: 'Right_Punch_', start: 54, end: 106 },
		{ name: 'legkick', path: '/assets/side/pro-frames/legkick/', prefix: 'Leg_Kick_', start: 57, end: 134 },
		{ name: 'gettinghit', path: '/assets/side/pro-frames/gettinghit/', prefix: 'Getting_Hit_', start: 51, end: 111 },
		{ name: 'victory', path: '/assets/side/pro-frames/victory/', prefix: 'Victory_', start: 83, end: 157 },
		{ name: 'ko', path: '/assets/side/pro-frames/ko/', prefix: 'KOO_', start: 31, end: 120 }
	];
	sets.forEach((s) => {
		PRO_ANIM.anims[s.name] = [];
		for (let i = s.start; i <= s.end; i++) {
			PRO_ANIM._totalFrames++;
			const img = new Image();
			img.onload = () => { PRO_ANIM._loadCount++; if (PRO_ANIM._loadCount >= PRO_ANIM._totalFrames) PRO_ANIM.loaded = true; };
			img.onerror = () => { PRO_ANIM._loadCount++; };
			const num = ('00000' + i).slice(-5);
			img.src = s.path + s.prefix + num + '.png';
			PRO_ANIM.anims[s.name].push(img);
		}
	});
}

function setProAnim(name: string) {
	if (PRO_ANIM.current !== name) { PRO_ANIM.current = name; PRO_ANIM.frame = 0; PRO_ANIM.frameTimer = 0; }
}
function setAmAnim(name: string) {
	if (AM_ANIM.current !== name) { AM_ANIM.current = name; AM_ANIM.frame = 0; AM_ANIM.frameTimer = 0; }
}

function getProFrame(dt: number): HTMLImageElement | null {
	const anim = PRO_ANIM.anims[PRO_ANIM.current];
	if (!anim || !anim.length) return null;
	PRO_ANIM.frameTimer += dt;
	const frameDur = 1 / 30;
	while (PRO_ANIM.frameTimer >= frameDur) { PRO_ANIM.frameTimer -= frameDur; PRO_ANIM.frame++; }
	if (PRO_ANIM.current === 'idle' || PRO_ANIM.current === 'victory') {
		PRO_ANIM.frame = PRO_ANIM.frame % anim.length;
	} else {
		if (PRO_ANIM.frame >= anim.length) PRO_ANIM.frame = anim.length - 1;
	}
	const img = anim[PRO_ANIM.frame];
	return (img && img.complete && img.naturalWidth > 0) ? img : null;
}

function getAmFrame(dt: number): HTMLImageElement | null {
	const anim = PRO_ANIM.anims[AM_ANIM.current]; // reuse pro images
	if (!anim || !anim.length) return null;
	AM_ANIM.frameTimer += dt;
	const frameDur = 1 / 30;
	while (AM_ANIM.frameTimer >= frameDur) { AM_ANIM.frameTimer -= frameDur; AM_ANIM.frame++; }
	if (AM_ANIM.current === 'idle' || AM_ANIM.current === 'victory') {
		AM_ANIM.frame = AM_ANIM.frame % anim.length;
	} else {
		if (AM_ANIM.frame >= anim.length) AM_ANIM.frame = anim.length - 1;
	}
	const img = anim[AM_ANIM.frame];
	return (img && img.complete && img.naturalWidth > 0) ? img : null;
}

const PRO_COMBOS = [
	{ name: 'jab', moves: ['punchL'] },
	{ name: 'cross', moves: ['punchR'] },
	{ name: 'jabCross', moves: ['punchL', 'punchR'] },
	{ name: 'dblJabCross', moves: ['punchL', 'punchL', 'punchR'] },
	{ name: 'crossJab', moves: ['punchR', 'punchL'] }
];
const AM_COMBOS = [
	{ name: 'jab', moves: ['punchL'] },
	{ name: 'cross', moves: ['punchR'] },
	{ name: 'doubleJab', moves: ['punchL', 'punchL'] },
	{ name: 'jabCross', moves: ['punchL', 'punchR'] }
];

function runCombo(atk: any, def: any, atkSide: string, G: any) {
	const moveDur = 1.0;
	const hitDelay = 0.1;

	if (atk._combo && atk._combo.length > 0) {
		const moveTime = atk._poseTime;

		if (atk._hitQueued && moveTime >= hitDelay) {
			atk._hitQueued = false;
			def.pose = 'hit'; def._poseTime = 0;
			if (def === SIDE.am) { AM_ANIM.frame = 0; AM_ANIM.frameTimer = 0; }
			else { PRO_ANIM.frame = 0; PRO_ANIM.frameTimer = 0; }
			G.arenaShake = Math.max(G.arenaShake || 0, 1.5);
			G.crowdRoar = Math.min(1, (G.crowdRoar || 0) + 0.1);
		}

		if (moveTime >= moveDur) {
			const moveIdx = (atk._comboIdx || 0) + 1;
			if (moveIdx < atk._combo.length) {
				atk._comboIdx = moveIdx;
				const nextMove = atk._combo[moveIdx];
				if (atk.pose !== nextMove) atk.pose = nextMove;
				atk._poseTime = 0;
				atk._hitQueued = true;
			} else {
				atk._combo = null; atk._comboIdx = 0;
				atk.pose = 'idle'; atk._poseTime = 0;
				def.pose = 'idle'; def._poseTime = 0;
			}
		}
	}
}

export function updateSideView(G: any) {
	const dt = G.dt || 0.016;
	const t = G.tension || 0;
	const pro = SIDE.pro;
	const am = SIDE.am;

	pro._poseTime = (pro._poseTime || 0) + dt;
	am._poseTime = (am._poseTime || 0) + dt;

	if (G.phase === 'BETTING') {
		pro.pose = 'idle'; pro._poseTime = 0; pro._combo = null;
		am.pose = 'idle'; am._poseTime = 0; am._combo = null;
		SIDE._koTimer = 0;
	} else if (G.phase === 'FREEFALL') {
		runCombo(pro, am, 'pro', G);
		runCombo(am, pro, 'am', G);

		// Pro starts combo
		pro._atkTimer = (pro._atkTimer || 0) - dt;
		const myInterval = Math.max(0.8, 2.2 - t * 0.9);
		if (pro._atkTimer <= 0 && pro.pose === 'idle' && am.pose === 'idle' && !pro._combo) {
			if (Math.random() < Math.max(0.25, 0.5 - t * 0.2)) {
				pro._atkTimer = myInterval * (1 + Math.random() * 0.8);
				const combo = PRO_COMBOS[Math.floor(Math.random() * PRO_COMBOS.length)];
				pro._combo = combo.moves.slice();
				pro._comboIdx = 0;
				pro.pose = combo.moves[0];
				pro._poseTime = 0;
				pro._hitQueued = true;
			} else {
				pro._atkTimer = myInterval * (0.5 + Math.random());
			}
		}

		// Amateur starts combo
		am._atkTimer = (am._atkTimer || 0) - dt;
		const oppInterval = Math.max(0.4, 1.4 - t * 0.7);
		if (am._atkTimer <= 0 && am.pose === 'idle' && pro.pose === 'idle' && !am._combo) {
			if (Math.random() < Math.max(0.5, 0.75 - t * 0.15)) {
				am._atkTimer = oppInterval * (0.5 + Math.random() * 0.6);
				const aCombo = AM_COMBOS[Math.floor(Math.random() * AM_COMBOS.length)];
				am._combo = aCombo.moves.slice();
				am._comboIdx = 0;
				am.pose = aCombo.moves[0];
				am._poseTime = 0;
				am._hitQueued = true;
			} else {
				am._atkTimer = oppInterval * (0.5 + Math.random());
			}
		}
	} else if (G.phase === 'CRASH') {
		SIDE._koTimer = (SIDE._koTimer || 0) + dt;
		const ct = G.phaseTimer || 0;
		if (pro.pose !== 'leg' && pro.pose !== 'victory') {
			pro.pose = 'leg'; pro._poseTime = 0;
			am.pose = 'hit'; am._poseTime = 0;
			G.arenaShake = Math.max(G.arenaShake || 0, 12);
			G.crowdRoar = 1;
		}
		if (ct > 1.0 && am.pose === 'hit') {
			am.pose = 'ko'; am._poseTime = 0;
		}
		if (ct > 2.0 && pro.pose !== 'victory') {
			pro.pose = 'victory'; pro._poseTime = 0;
		}
	}

	// Sync pro pose → animation
	if (pro.pose === 'idle') setProAnim('idle');
	else if (pro.pose === 'punchL') setProAnim('leftpunch');
	else if (pro.pose === 'punchR') setProAnim('rightpunch');
	else if (pro.pose === 'hit') setProAnim('gettinghit');
	else if (pro.pose === 'leg') setProAnim('legkick');
	else if (pro.pose === 'victory') setProAnim('victory');

	// Sync amateur pose → animation
	if (am.pose === 'idle') setAmAnim('idle');
	else if (am.pose === 'punchL') setAmAnim('leftpunch');
	else if (am.pose === 'punchR') setAmAnim('rightpunch');
	else if (am.pose === 'hit') setAmAnim('gettinghit');
	else if (am.pose === 'ko') setAmAnim('ko');
	else if (am.pose === 'victory') setAmAnim('victory');
}

export function renderSideView(canvas: HTMLCanvasElement, G: any) {
	const cx = canvas.getContext('2d');
	if (!cx) return;
	const W = canvas.width;
	const H = canvas.height;
	const dt = G.dt || 0.016;
	const t = G.tension || 0;

	cx.clearRect(0, 0, W, H);
	cx.save();

	// Background
	if (SIDE.img.bg?.complete && SIDE.img.bg.naturalWidth) {
		const bgA = SIDE.img.bg.naturalWidth / SIDE.img.bg.naturalHeight;
		const scA = W / H;
		let dW: number, dH: number;
		if (scA > bgA) { dW = W; dH = W / bgA; } else { dH = H; dW = H * bgA; }
		cx.drawImage(SIDE.img.bg, (W - dW) / 2, (H - dH) / 2, dW, dH);
	} else {
		cx.fillStyle = '#060414';
		cx.fillRect(0, 0, W, H);
	}

	// Fighters
	const isMob = W < 600;
	const baseH = Math.round(H * (isMob ? 0.55 : 0.62));
	const baseAspect = 1936 / 1072;
	const baseW = Math.round(baseH * baseAspect);
	const floorY = H * 0.82;

	const isTab = W >= 600 && W <= 1024;
	const overlap = isMob ? Math.round(baseW * 0.35) : isTab ? Math.round(baseW * 0.35) : Math.round(baseW * 0.35);
	const proBoxX = W * 0.5 - baseW + overlap;
	const proBoxY = floorY - baseH;
	const amBoxX = W * 0.5 - overlap;
	const amBoxY = floorY - baseH;

	// Pro
	const proFrame = getProFrame(dt);
	if (proFrame) {
		const pAspect = proFrame.naturalWidth / proFrame.naturalHeight;
		const drawW = Math.round(baseH * pAspect);
		const drawH = baseH;
		const drawX = proBoxX + Math.round((baseW - drawW) * 0.5);
		cx.drawImage(proFrame, drawX, proBoxY, drawW, drawH);
	}

	// Amateur (flipped)
	const amFrame = getAmFrame(dt);
	if (amFrame) {
		const aAspect = amFrame.naturalWidth / amFrame.naturalHeight;
		const aDrawW = Math.round(baseH * aAspect);
		const aDrawH = baseH;
		let aDrawY = amBoxY;
		if (SIDE.am.pose === 'ko') aDrawY += Math.round(baseH * 0.15);

		cx.save();
		cx.translate(amBoxX + baseW * 0.5, aDrawY);
		cx.scale(-1, 1);
		cx.drawImage(amFrame, -aDrawW * 0.5, 0, aDrawW, aDrawH);
		cx.restore();
	}

	// Health bars
	if (G.phase !== 'BETTING' && G.phase !== 'WAITING' && G.phase !== 'INIT') {
		const bW = Math.min(150, W * 0.2);
		const bH = 8;
		const bY = H * 0.04;
		cx.fillStyle = 'rgba(0,0,0,0.5)';
		cx.fillRect(W * 0.1, bY, bW, bH);
		cx.fillStyle = '#4caf50';
		cx.fillRect(W * 0.1, bY, bW, bH);
		cx.fillStyle = '#fff';
		cx.font = 'bold 9px sans-serif';
		cx.textAlign = 'center';
		cx.fillText('PRO', W * 0.1 + bW / 2, bY - 3);

		const amHP = Math.max(0, G.opp?.health ?? 1);
		cx.fillStyle = 'rgba(0,0,0,0.5)';
		cx.fillRect(W * 0.9 - bW, bY, bW, bH);
		const hpCol = amHP > 0.5 ? '#ef5350' : amHP > 0.25 ? '#ff9800' : '#f44336';
		cx.fillStyle = hpCol;
		cx.fillRect(W * 0.9 - bW, bY, bW * amHP, bH);
		cx.fillStyle = '#fff';
		cx.textAlign = 'center';
		cx.fillText('AMATEUR', W * 0.9 - bW / 2, bY - 3);
	}

	// Bonus popups
	if (G.bonusPopups && G.bonusPopups.length > 0) {
		for (let bi = 0; bi < G.bonusPopups.length; bi++) {
			const bp = G.bonusPopups[bi];
			const bpAlpha = Math.min(1, bp.life * 2);
			cx.save();
			cx.globalAlpha = bpAlpha;
			cx.shadowColor = '#ffd700'; cx.shadowBlur = 12;
			cx.font = 'bold 22px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
			cx.fillStyle = '#ffd700';
			cx.fillText('+' + bp.val.toFixed(2) + 'x', bp.x, bp.y);
			cx.shadowBlur = 0;
			cx.restore();
		}
	}

	// Particles
	G.particles = (G.particles || []).filter((p: any) => {
		p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
		p.vy += dt * 7; p.life -= dt * 1.2;
		if (p.life <= 0) return false;
		const a = p.life * p.life;
		cx.beginPath(); cx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, Math.PI * 2);
		cx.fillStyle = `hsla(${p.hue || 20},${p.sat || 100}%,${p.lit || 55}%,${a})`;
		cx.fill(); return true;
	});

	// KO text
	if (G.phase === 'CRASH' && SIDE._koTimer > 0.5) {
		const koT = SIDE._koTimer;
		const tp = Math.min(1, (koT - 0.5) / 0.4);
		const ts = 0.5 + tp * 0.5;
		cx.save(); cx.translate(W / 2, H * 0.3); cx.scale(ts, ts); cx.globalAlpha = tp;
		cx.shadowColor = '#ff2222'; cx.shadowBlur = 30;
		cx.font = 'bold 72px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
		cx.fillStyle = '#ff2222'; cx.fillText('K.O.', 0, 0);
		cx.strokeStyle = 'rgba(255,255,255,0.3)'; cx.lineWidth = 2; cx.strokeText('K.O.', 0, 0);
		cx.shadowBlur = 0;
		if (koT > 1.2) {
			cx.globalAlpha = Math.min(1, (koT - 1.2) / 0.5);
			cx.font = 'bold 28px sans-serif'; cx.fillStyle = 'rgba(255,255,255,0.8)';
			cx.fillText((G.mult || 1).toFixed(2) + 'x', 0, 50);
		}
		cx.restore();
	}

	// Vignette
	const vS = 0.2 + t * 0.3;
	const vG = cx.createRadialGradient(W / 2, H * 0.4, H * 0.2, W / 2, H / 2, H * 0.85);
	vG.addColorStop(0, 'transparent');
	vG.addColorStop(0.5, `rgba(0,0,0,${vS * 0.15})`);
	vG.addColorStop(1, `rgba(0,0,0,${vS})`);
	cx.fillStyle = vG; cx.fillRect(0, 0, W, H);

	cx.restore();
}
