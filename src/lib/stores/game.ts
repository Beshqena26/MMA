import { writable, derived, get } from 'svelte/store';
import { config, type GameConfig } from './config.js';
import { playBet, playCashout, playClick, playSound, stopSound } from './sound.js';
import * as FB from '$lib/firebase/index.js';

// Helpers
function loadSaved<T>(key: string, fallback: T): T {
	try {
		const v = localStorage.getItem('mma_' + key);
		return v !== null ? JSON.parse(v) : fallback;
	} catch {
		return fallback;
	}
}
function save(key: string, val: any) {
	try {
		localStorage.setItem('mma_' + key, JSON.stringify(val));
	} catch {}
}
function esc(s: string) {
	if (!s) return '';
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export type GamePhase = 'INIT' | 'BETTING' | 'EXPLODE' | 'FREEFALL' | 'CRASH' | 'WAITING';

export interface Bet {
	amount: number;
	placed: boolean;
	out: boolean;
	cashMult: number;
	win: number;
}

export interface HistoryEntry {
	v: number;
	round: number;
	players: number;
	totalBet: number;
	result: string;
	resultColor: string;
	time: string;
	ts: number;
	serverSeed: string;
	hash: string;
	playerNames: string[];
}

export interface BetHistoryEntry {
	round: number;
	bet: number;
	mult: number;
	win: number;
	time: any;
}

export interface SidebarRow {
	name: string;
	avatar: string;
	bg: string;
	bet: string;
	x: string;
	win: string;
	won: boolean;
	isMe: boolean;
}

// Game state store
function createGameStore() {
	const cfg = get(config);

	const initial = {
		balance: loadSaved('balance', cfg.startBal || 1000),
		bets: [
			{ amount: 1, placed: false, out: false, cashMult: 0, win: 0 },
			{ amount: 1, placed: false, out: false, cashMult: 0, win: 0 }
		] as Bet[],
		phase: 'INIT' as GamePhase,
		phaseTimer: 0,
		mult: 1.0,
		crashPt: 2.0,
		speed: 0,
		roundNum: 0,
		history: loadSaved<HistoryEntry[]>('history', []),
		totR: loadSaved('totR', 0),
		totW: loadSaved('totW', 0),
		totP: loadSaved('totP', 0),
		bestC: loadSaved('bestC', 0),
		hiCr: loadSaved('hiCr', 0),
		betHistory: loadSaved<BetHistoryEntry[]>('betHistory', []),
		time: 0,
		dt: 0,
		lastFrame: 0,
		lastMultFloor: 0,
		autoBet: [false, false],
		autoCash: [false, false],
		autoCashVal: [2.0, 2.0],
		tension: 0,
		// Fighter state
		f1: null as any,
		f2: null as any,
		opp: null as any,
		myFists: null as any,
		playerHit: null as any,
		bonusPopups: [] as any[],
		koTimer: 0,
		koFlash: 0,
		bellRing: 0,
		arenaShake: 0,
		crowdRoar: 0,
		crowdRoarSmooth: 0,
		fightStarted: false,
		koKick: { active: false, timer: 0 },
		// Camera
		camera: { y: 0, cx: 0, shake: 0, zoom: 1, zoomTarget: 1, zoomX: 0, zoomY: 0 },
		particles: [] as any[],
		crowd: [] as any[],
		// Sidebar
		sidebarBets: [] as SidebarRow[],
		sidebarBetCount: 0,
		sidebarWonCount: 0,
		sidebarWinTotal: 0,
		// Pilot (kept for compat)
		pilot: {
			x: 0, y: 0, vx: 0, vy: 0, chuteOpen: false, ejected: false,
			spin: 0, ejectTime: 0, seatFlame: 0, _phase: '', _seatY: 0,
			_bodyAngle: 0, _drogueOpen: false, _canopyBlown: false
		},
		rocket: { x: -60, y: -80, vx: 35, vy: 8, angle: 0, curvePath: [] as any[], targetAlt: 300 }
	};

	return writable(initial);
}

export const game = createGameStore();

// View mode
export const gameView = writable<'pov' | 'side'>(
	(typeof localStorage !== 'undefined' ? localStorage.getItem('mma_view') : 'pov') as 'pov' | 'side' || 'pov'
);

export function toggleGameView() {
	gameView.update((v) => {
		const next = v === 'pov' ? 'side' : 'pov';
		localStorage.setItem('mma_view', next);
		return next;
	});
}

// Crash point generation
export function genCrash(): number {
	const cfg = get(config);
	if (cfg.crashMode === 'usual') {
		const h = 0.04;
		const r = Math.random();
		return Math.max(1.01, Math.floor(((1 / (1 - r)) * (1 - h)) * 100) / 100);
	}
	const min = (cfg.crashMin || 8) + Math.random() * (cfg.crashRange || 20);
	const bc = (cfg.crashBonusChance || 40) / 100;
	const bonus = Math.random() < bc ? Math.random() * (cfg.crashBonusMax || 50) : 0;
	return Math.floor((min + bonus) * 100) / 100;
}

// Multiplier from time
export function computeMultFromTime(t: number): number {
	if (t <= 0) return 1;
	const cfg = get(config);
	const s0 = cfg.multSpeed || 0.002;
	const a = cfg.multAccel || 0.00036;
	return Math.exp(30 * (s0 * t + (a * t * t) / 2));
}

export function timeForMult(target: number): number {
	if (target <= 1) return 0;
	const cfg = get(config);
	const s0 = cfg.multSpeed || 0.002;
	const a = cfg.multAccel || 0.00036;
	const rhs = Math.log(target) / 30;
	const disc = s0 * s0 + 2 * a * rhs;
	if (disc < 0) return 0;
	return (-s0 + Math.sqrt(disc)) / a;
}

// Tension from multiplier
export function getTension(m: number): number {
	if (m <= 1) return 0;
	if (m <= 1.5) return ((m - 1) / 0.5) * 0.25;
	if (m <= 3) return 0.25 + ((m - 1.5) / 1.5) * 0.25;
	if (m <= 7) return 0.5 + ((m - 3) / 4) * 0.25;
	return Math.min(1, 0.75 + ((m - 7) / 13) * 0.25);
}

// Fake players
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 25, 50, 100];
const AVATARS = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪', '🟤', '💀', '🎯', '🔥', '💎', '🎮', '👾', '🛡️', '⚡'];
const AVATAR_BGS = [
	'#8b2233', '#6b4422', '#887722', '#226633', '#223388', '#552277',
	'#555', '#553322', '#333', '#883322', '#993311', '#336688',
	'#445566', '#443366', '#226655', '#886622'
];

export function randomAvatar() {
	const i = Math.floor(Math.random() * AVATARS.length);
	return { emoji: AVATARS[i], bg: AVATAR_BGS[i] };
}

export function fakeBetAmt() {
	return STEPS[Math.floor(Math.random() * STEPS.length)].toFixed(2);
}

export function rndHex(len: number) {
	let s = '';
	const c = '0123456789abcdef';
	for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * 16)];
	return s;
}

export function rndSeed() {
	let s = '';
	const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 20; i++) s += c[Math.floor(Math.random() * c.length)];
	return s;
}

// Multiplayer sync
export const syncState = writable({
	enabled: false,
	isLeader: false,
	lastRound: 0,
	roundData: null as any,
	flyStartTime: 0,
	_betListenerRound: 0,
	_hasServerTs: false,
	_liveBetsSnapshot: {} as Record<string, any>,
	_hasRealPlayers: false,
	_claimedRound: 0
});

// Selected player info
export const playerName = writable('Player');
export const playerAvatar = writable('🥊');

// Bet panel state
export const panel2Visible = writable(false);

// Active alert
export const alertText = writable('');
export const alertTimer = writable<ReturnType<typeof setTimeout> | null>(null);

export function showAlert(text: string) {
	alertText.set(text);
	const prev = get(alertTimer);
	if (prev) clearTimeout(prev);
	alertTimer.set(setTimeout(() => alertText.set(''), 2000));
}

// Top wins
export const topWins = writable<any[]>(loadSaved('topWins', []));

// Previous round data
export const prevRoundData = writable<any[]>(loadSaved('prevRound', []));

// Bet actions
export function adjustBet(slot: number, dir: number) {
	game.update((g) => {
		const b = g.bets[slot - 1];
		if (b.placed) return g;
		let i = STEPS.indexOf(b.amount);
		if (i === -1) {
			i = 0;
			for (let j = 0; j < STEPS.length; j++) {
				if (STEPS[j] >= b.amount) { i = j; break; }
			}
		}
		i = Math.max(0, Math.min(STEPS.length - 1, i + dir));
		b.amount = STEPS[i];
		return g;
	});
}

export function setAmount(slot: number, val: number) {
	game.update((g) => {
		const b = g.bets[slot - 1];
		if (b.placed) return g;
		val = Math.max(0.1, Math.min(100, val));
		b.amount = val;
		return g;
	});
}

export function betAction(slot: number) {
	const cfg = get(config);
	const sync = get(syncState);

	game.update((g) => {
		const b = g.bets[slot - 1];
		if (!b) return g;

		if (g.phase === 'BETTING') {
			if (b.placed) {
				g.balance += b.amount;
				b.placed = false;
			} else {
				if (b.amount > g.balance) {
					showAlert('💰 Insufficient balance');
					return g;
				}
				if (b.amount < (cfg.betMin || 0.1) || b.amount > (cfg.betMax || 100) || !isFinite(b.amount))
					return g;
				g.balance -= b.amount;
				b.placed = true;
				b.out = false;
				b.cashMult = 0;
				b.win = 0;
				save('balance', g.balance);
				playBet();
				if (sync.enabled) {
					FB.writeBet(g.roundNum, {
						name: get(playerName),
						avatar: get(playerAvatar),
						bet: b.amount,
						slot,
						cashMult: 0
					});
				}
			}
		} else if (g.phase === 'FREEFALL' || (g.phase === 'EXPLODE' && g.pilot.ejected)) {
			if (!b.placed || b.out) return g;
			b.out = true;
			b.cashMult = g.mult;
			const w = Math.min(cfg.winCap || 10000, Math.max(0, b.amount * g.mult));
			b.win = w;
			g.balance += w;
			g.totP += w - b.amount;
			g.totW++;
			if (g.mult > g.bestC) g.bestC = g.mult;
			g.betHistory.unshift({ round: g.roundNum, bet: b.amount, mult: g.mult, win: w, time: new Date() });
			if (g.betHistory.length > 200) g.betHistory.pop();
			save('balance', g.balance);
			playCashout();
			if (sync.enabled) {
				FB.writeBet(g.roundNum, {
					name: get(playerName),
					avatar: get(playerAvatar),
					bet: b.amount,
					slot,
					cashMult: g.mult,
					win: w
				});
			}
		}
		return g;
	});
}

export function toggleAuto(slot: number, type: 'bet' | 'cash') {
	game.update((g) => {
		if (type === 'bet') g.autoBet[slot - 1] = !g.autoBet[slot - 1];
		else g.autoCash[slot - 1] = !g.autoCash[slot - 1];
		return g;
	});
}

export function setAutoCashVal(slot: number, val: number) {
	game.update((g) => {
		g.autoCashVal[slot - 1] = val;
		return g;
	});
}
