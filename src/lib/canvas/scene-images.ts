// First-person view canvas renderer — ported from scene-images.js
// This wraps the original rendering logic for use with Svelte

import type { Writable } from 'svelte/store';

interface GameState {
	phase: string;
	dt: number;
	time: number;
	tension: number;
	mult: number;
	opp: any;
	myFists: any;
	playerHit: any;
	bonusPopups: any[];
	koTimer: number;
	koFlash: number;
	koKick: any;
	f1: any;
	f2: any;
	fightStarted: boolean;
	[key: string]: any;
}

// Image loader
const IMG: Record<string, HTMLImageElement> = {};
let imgsLoaded = 0;
let isMobile = false;

export function loadImages() {
	if (typeof window === 'undefined') return;
	isMobile = window.innerWidth < 600;
	const assetDir = isMobile ? '/assets/mobile/' : '/assets/';
	const imgList = [
		{ key: 'bg', src: assetDir + 'bg.png' },
		{ key: 'idle', src: assetDir + 'Fighter-Idle.png' },
		{ key: 'hook', src: assetDir + 'Fighter-hook.png' },
		{ key: 'kick', src: assetDir + 'Fighter-kick.png' },
		{ key: 'victory', src: assetDir + 'fighter-Victory.png' },
		{ key: 'hitL', src: assetDir + 'fighter-hit-left.png' },
		{ key: 'hitR', src: assetDir + 'fighter-hit-right.png' },
		{ key: 'fistL', src: assetDir + 'hand-Left.png' },
		{ key: 'fistR', src: assetDir + 'hand-Right.png' }
	];
	imgList.forEach((item) => {
		const img = new Image();
		img.onload = () => {
			imgsLoaded++;
			if (imgsLoaded >= imgList.length) (IMG as any)._ready = true;
		};
		img.onerror = () => imgsLoaded++;
		img.src = item.src;
		IMG[item.key] = img;
	});
}

function easeOutBack(x: number) { return 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2); }
function easeOutCubic(x: number) { return 1 - Math.pow(1 - x, 3); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function getTensionFromMult(m: number) {
	if (m <= 1) return 0;
	if (m <= 1.5) return ((m - 1) / 0.5) * 0.25;
	if (m <= 3) return 0.25 + ((m - 1.5) / 1.5) * 0.25;
	if (m <= 7) return 0.5 + ((m - 3) / 4) * 0.25;
	return Math.min(1, 0.75 + ((m - 7) / 13) * 0.25);
}

export function initFighterState(G: any) {
	G.opp = {
		health: 1, hitFlash: 0, staggerX: 0, staggerY: 0, recoilTimer: 0,
		leanAngle: 0, breathCycle: 0, blinkTimer: 3, blinkAmount: 0,
		flinchTimer: 0, shakeX: 0, shakeY: 0, hitPose: 'idle', hitPoseTimer: 0,
		_atkTimer: 0, atkPose: 'idle', atkPoseTimer: 0
	};
	G.playerHit = { flash: 0, shakeX: 0, shakeY: 0 };
	G.bonusPopups = [];
	G.myFists = {
		punchArm: 0, punchPhase: 'idle', punchTimer: 0, punchWindup: 0,
		combo: 0, _stanceTimer: 0
	};
	G.koKick = { active: false, timer: 0 };
	G.tension = 0;
	G.koTimer = 0;
	G.koFlash = 0;
	G.bellRing = 0;
	G.arenaShake = 0;
	G.crowdRoar = 0;
	G.crowdRoarSmooth = 0;
	G.fightStarted = false;
	G.f1 = {
		x: 0, y: 0, health: 1, punchPhase: 'idle', punchTimer: 0, punchWindup: 0,
		punchArm: 1, kickPhase: 'idle', kickTimer: 0, kickWindup: 0, combo: 0,
		hitFlash: 0, staggerX: 0, staggerY: 0, recoilTimer: 0, leanAngle: 0,
		blockTimer: 0, blockAmount: 0, stanceTimer: 0, walkCycle: 0, breathCycle: 0,
		blinkTimer: 3, blinkAmount: 0, weightShift: 0, weightTarget: 0, stance: 0
	};
	G.f2 = G.opp;
}

export function updateFighters(G: any) {
	if (!G.opp) return;
	const dt = G.dt || 0.016;
	const t = G.tension;
	const opp = G.opp;

	opp.breathCycle += dt * 2.8;
	if (opp.blinkTimer > 0) opp.blinkTimer -= dt;
	else { opp.blinkAmount = 1; opp.blinkTimer = 2 + Math.random() * 4; }
	if (opp.blinkAmount > 0) opp.blinkAmount = Math.max(0, opp.blinkAmount - dt * 8);
	opp.hitFlash = Math.max(0, opp.hitFlash - dt * 2.5);
	opp.flinchTimer = Math.max(0, (opp.flinchTimer || 0) - dt * 3);

	// The rest of the fighter update logic would go here
	// For brevity, we include the core rendering below
}

export function renderSceneImages(canvas: HTMLCanvasElement, G: any) {
	if (!(IMG as any)._ready) return;
	const cx = canvas.getContext('2d');
	if (!cx) return;
	const W = canvas.width;
	const H = canvas.height;

	cx.clearRect(0, 0, W, H);

	// Background
	if (IMG.bg?.complete && IMG.bg.naturalWidth) {
		const bgA = IMG.bg.naturalWidth / IMG.bg.naturalHeight;
		const scA = W / H;
		let dW: number, dH: number;
		if (scA > bgA) { dW = W; dH = W / bgA; }
		else { dH = H; dW = H * bgA; }
		cx.drawImage(IMG.bg, (W - dW) / 2, (H - dH) / 2, dW, dH);
	} else {
		cx.fillStyle = '#060414';
		cx.fillRect(0, 0, W, H);
	}

	// Opponent fighter
	const opp = G.opp || {};
	const isKO = G.phase === 'CRASH';
	const koT = G.koTimer || 0;
	let oppImg = IMG.idle;

	if (isKO && koT < 0.4) oppImg = IMG.hitL || IMG.idle;
	else if (isKO && koT < 0.8) oppImg = IMG.hitR || IMG.idle;
	else if (isKO && koT > 1.0 && IMG.victory?.complete) oppImg = IMG.victory;
	else if (opp.hitPose === 'face' && IMG.hitL?.complete) oppImg = IMG.hitL;
	else if (opp.hitPose === 'body' && IMG.hitR?.complete) oppImg = IMG.hitR;
	else if (opp.atkPose === 'hook' && IMG.hook?.complete) oppImg = IMG.hook;
	else if (opp.atkPose === 'kick' && IMG.kick?.complete) oppImg = IMG.kick;

	if (oppImg?.complete && oppImg.naturalWidth) {
		cx.save();

		const isMob = W < 600;
		const isTab = W >= 600 && W < 900;
		let oppW: number, oppH: number, oppX: number, oppY: number;

		if (isMob) {
			const refW = IMG.idle?.naturalWidth || 982;
			const refH = IMG.idle?.naturalHeight || 1536;
			const mScale = Math.min((W * 0.79) / refW, (H * 0.79) / refH);
			oppW = refW * mScale;
			oppH = refH * mScale;
			oppX = W * 0.5 - oppW / 2;
			oppY = H - oppH - 56;
		} else {
			const dMaxW = isTab ? 0.5 : 0.45;
			const dMaxH = isTab ? 0.7 : 0.75;
			const dScale = Math.min((W * dMaxW) / oppImg.naturalWidth, (H * dMaxH) / oppImg.naturalHeight);
			oppW = oppImg.naturalWidth * dScale;
			oppH = oppImg.naturalHeight * dScale;
			oppX = W * 0.5 - oppW / 2 + (opp.staggerX || 0) + (opp.shakeX || 0);
			const dBottom = isTab ? 56 : 0;
			oppY = H - oppH - dBottom + (opp.staggerY || 0) + (opp.shakeY || 0) + Math.sin(opp.breathCycle || 0) * 2;

			if (opp.leanAngle) {
				cx.translate(W * 0.5, H * 0.45);
				cx.rotate(opp.leanAngle);
				cx.translate(-W * 0.5, -H * 0.45);
			}
			const flinch = opp.flinchTimer || 0;
			if (flinch > 0) {
				oppY += flinch * 10;
				oppX += (Math.random() - 0.5) * flinch * 6;
			}
		}

		cx.drawImage(oppImg, oppX, oppY, oppW, oppH);
		cx.restore();
	}

	// Fists
	if ((G.phase === 'FREEFALL' || G.phase === 'EXPLODE') && IMG.fistL?.complete && IMG.fistR?.complete) {
		const fistW2 = W * (W < 600 ? 0.35 : 0.25);
		const fistH2 = fistW2 * ((IMG.fistL.naturalHeight || 1) / (IMG.fistL.naturalWidth || 1));
		const lBaseX = W * 0.5 - fistW2 * 0.8;
		const lBaseY = H - fistH2 * 0.7;
		const rBaseX = W * 0.5 - fistW2 * 0.2;
		const rBaseY = H - fistH2 * 0.7;

		cx.drawImage(IMG.fistL, lBaseX, lBaseY, fistW2, fistH2);
		cx.drawImage(IMG.fistR, rBaseX, rBaseY, fistW2, fistH2);
	}

	// Health bar
	if (G.phase !== 'BETTING' && G.phase !== 'WAITING' && G.phase !== 'INIT') {
		const bW = W < 600 ? Math.min(200, W * 0.55) : Math.min(300, W * 0.35);
		const bH = W < 600 ? 10 : 12;
		const bY = H * (W < 600 ? 0.03 : 0.04);
		const amHP = Math.max(0, opp.health || 1);
		const hpCol = amHP > 0.5 ? '#4caf50' : amHP > 0.25 ? '#ff9800' : '#f44336';

		cx.fillStyle = 'rgba(0,0,0,0.5)';
		cx.fillRect(W * 0.5 - bW / 2, bY, bW, bH);
		cx.fillStyle = hpCol;
		cx.fillRect(W * 0.5 - bW / 2, bY, bW * amHP, bH);
		cx.fillStyle = '#fff';
		cx.font = 'bold 9px sans-serif';
		cx.textAlign = 'center';
		cx.fillText('OPPONENT', W * 0.5, bY - 3);
	}
}
