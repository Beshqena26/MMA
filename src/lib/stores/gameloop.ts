import { get } from 'svelte/store';
import { config } from './config.js';
import { game, genCrash, computeMultFromTime, getTension, syncState, showAlert, betAction, prevRoundData, topWins, rndSeed, rndHex, randomAvatar, fakeBetAmt, playerName, playerAvatar, type GamePhase, type HistoryEntry } from './game.js';
import { playSound, stopSound } from './sound.js';
import * as FB from '$lib/firebase/index.js';

function save(key: string, val: any) {
	try { localStorage.setItem('mma_' + key, JSON.stringify(val)); } catch {}
}
function esc(s: string) {
	if (!s) return '';
	return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let _lastBettingRound = 0;
let animId: number | null = null;

export function startBettingPhase() {
	const cfg = get(config);
	const sync = get(syncState);

	game.update((g) => {
		g.phase = 'BETTING';
		g.phaseTimer = cfg.betTime;

		if (sync.enabled && sync.lastRound > 0) {
			g.roundNum = sync.lastRound;
		} else {
			g.roundNum++;
		}

		if (_lastBettingRound === g.roundNum) return g;
		_lastBettingRound = g.roundNum;

		g.mult = 1;
		g.speed = 0;
		g.lastMultFloor = 0;
		g.camera = { y: 0, cx: 0, shake: 0, zoom: 1, zoomTarget: 1, zoomX: 0, zoomY: 0 };
		g.particles = [];

		g.bets[0] = { ...g.bets[0], placed: false, out: false, cashMult: 0, win: 0 };
		g.bets[1] = { ...g.bets[1], placed: false, out: false, cashMult: 0, win: 0 };
		g.crashPt = genCrash();

		// Auto bet
		for (let i = 0; i < 2; i++) {
			if (g.autoBet[i] && g.bets[i].amount >= (cfg.betMin || 0.1) && g.bets[i].amount <= (cfg.betMax || 100) && g.bets[i].amount <= g.balance) {
				g.balance -= g.bets[i].amount;
				g.bets[i].placed = true;
				g.bets[i].out = false;
				g.bets[i].cashMult = 0;
				g.bets[i].win = 0;
				save('balance', g.balance);
				if (sync.enabled) {
					FB.writeBet(g.roundNum, {
						name: get(playerName),
						avatar: get(playerAvatar),
						bet: g.bets[i].amount,
						slot: i + 1,
						cashMult: 0
					});
				}
			}
		}

		// Populate fake sidebar
		g.sidebarBets = [];
		g.sidebarBetCount = 0;
		g.sidebarWonCount = 0;
		g.sidebarWinTotal = 0;
		if (!sync.enabled || !get(syncState)._hasRealPlayers) {
			for (let i = 0; i < 12 + Math.floor(Math.random() * 12); i++) {
				const av = randomAvatar();
				const id = Math.floor(Math.random() * 9) + '***' + Math.floor(Math.random() * 9);
				g.sidebarBets.push({
					name: id, avatar: av.emoji, bg: av.bg,
					bet: fakeBetAmt(), x: '', win: '', won: false, isMe: false
				});
				g.sidebarBetCount++;
			}
		}

		return g;
	});

	playSound('fight', 0.3);
}

export function startExplodePhase() {
	game.update((g) => {
		g.phase = 'EXPLODE';
		g.phaseTimer = 0;
		g.camera.zoomTarget = 1.6;
		return g;
	});
	playSound('fight', 0.6);
}

export function startFreefallPhase() {
	game.update((g) => {
		g.phase = 'FREEFALL';
		g.phaseTimer = 0;
		if (!g.mult || g.mult < 1) {
			g.mult = 1.0;
			const cfg = get(config);
			g.speed = cfg.multSpeed || 0.002;
		}
		g.lastMultFloor = Math.floor(g.mult);
		g.camera.zoomTarget = 0.95;
		return g;
	});
}

export function startCrashPhase() {
	const cfg = get(config);
	const sync = get(syncState);

	game.update((g) => {
		if (g.phase !== 'CRASH') {
			g.phase = 'CRASH';
			g.phaseTimer = 0;
		}
		g.camera.shake = 2;
		g.camera.zoomTarget = 1.05;

		// Record losses
		for (let i = 0; i < 2; i++) {
			if (g.bets[i].placed && !g.bets[i].out) {
				g.totP -= g.bets[i].amount;
				g.betHistory.unshift({ round: g.roundNum, bet: g.bets[i].amount, mult: g.crashPt, win: 0, time: new Date() });
				if (g.betHistory.length > 200) g.betHistory.pop();
			}
		}
		g.totR++;
		if (g.crashPt > g.hiCr) g.hiCr = g.crashPt;

		// Add to history
		const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
		let myResult = '—', myResultColor = 'var(--dim)';
		for (let i = 0; i < 2; i++) {
			if (g.bets[i].placed) {
				if (g.bets[i].out && g.bets[i].win > 0) {
					myResult = '+$' + g.bets[i].win.toFixed(2);
					myResultColor = 'var(--acc)';
				} else {
					myResult = '-$' + g.bets[i].amount.toFixed(2);
					myResultColor = 'var(--dng)';
				}
			}
		}

		let pCount = 1, tBet = 0;
		const pNames: string[] = ['You'];
		for (let i = 0; i < 2; i++) {
			if (g.bets[i].placed) tBet += g.bets[i].amount;
		}

		g.history.unshift({
			v: g.crashPt,
			round: g.roundNum,
			players: pCount,
			totalBet: tBet,
			result: myResult,
			resultColor: myResultColor,
			time: timeStr,
			ts: Date.now(),
			serverSeed: rndSeed() + 'VabC10zYMe2Z6DZ5rSaEqnwEd',
			hash: rndHex(128),
			playerNames: pNames
		});
		if (g.history.length > 200) g.history.pop();
		save('history', g.history);
		save('totR', g.totR);
		save('totW', g.totW);
		save('totP', g.totP);
		save('bestC', g.bestC);
		save('hiCr', g.hiCr);
		save('betHistory', g.betHistory);

		// Save prev round data
		prevRoundData.set([...g.sidebarBets]);
		save('prevRound', g.sidebarBets);

		return g;
	});
}

function updateMultAndUI() {
	const sync = get(syncState);
	const cfg = get(config);

	game.update((g) => {
		if (sync.enabled) {
			const sm = getSyncMult();
			if (sm !== null) g.mult = sm;
		} else {
			g.mult += g.speed * g.mult * g.dt * 30;
			g.speed += g.dt * (cfg.multAccel || 0.00036);
		}
		if (!isFinite(g.mult) || g.mult > 99999) g.mult = g.crashPt + 1;
		if (!isFinite(g.speed) || g.speed > 10) g.speed = 0.01;

		// Auto cashout
		for (let j = 0; j < 2; j++) {
			if (g.autoCash[j] && g.bets[j].placed && !g.bets[j].out) {
				const ac = g.autoCashVal[j];
				if (ac > 0 && g.mult >= ac) {
					// Will call betAction outside of update
					setTimeout(() => betAction(j + 1), 0);
				}
			}
		}

		g.tension = getTension(g.mult);
		return g;
	});
}

function getSyncMult(): number | null {
	const sync = get(syncState);
	if (!sync.enabled || !sync.roundData) return null;
	const now = FB.serverNow();
	const roundTs = sync.roundData.serverTs || sync.roundData.ts;
	const betEnd = sync.roundData.betTime || get(config).betTime;
	const flyStart = roundTs + betEnd * 1000 + 600;
	const flyElapsed = (now - flyStart) / 1000;
	if (flyElapsed < 0) return 1;
	return computeMultFromTime(flyElapsed);
}

// Main update loop
export function update(ts: number) {
	const cfg = get(config);
	const g = get(game);

	let dt = g.lastFrame ? Math.min((ts - g.lastFrame) / 1000, 0.05) : 0.016;
	if (!isFinite(dt)) dt = 0.016;

	game.update((g) => {
		g.dt = dt;
		g.lastFrame = ts;
		g.time += dt;
		g.camera.cx = 0;
		g.camera.y = 0;
		return g;
	});

	// Phase logic
	const phase = get(game).phase;

	if (phase === 'BETTING') {
		game.update((g) => {
			g.phaseTimer -= dt;
			g.camera.zoomTarget = 1;
			if (g.phaseTimer <= 0) {
				// Transition handled after
			}
			return g;
		});
		if (get(game).phaseTimer <= 0) startExplodePhase();
	} else if (phase === 'EXPLODE') {
		game.update((g) => {
			g.phaseTimer += dt;
			g.camera.zoomTarget = 1.05;
			if (g.phaseTimer >= 0.6 && g.mult < 1.01) {
				g.mult = 1.0;
				g.speed = cfg.multSpeed || 0.002;
				g.lastMultFloor = 0;
			}
			return g;
		});
		if (get(game).phaseTimer >= 0.6) {
			updateMultAndUI();
			if (get(game).mult >= get(game).crashPt) {
				game.update((g) => { g.phase = 'CRASH'; g.phaseTimer = 0; return g; });
				startCrashPhase();
			}
		}
		if (get(game).phaseTimer >= cfg.explodeTime && get(game).phase === 'EXPLODE') {
			startFreefallPhase();
		}
	} else if (phase === 'FREEFALL') {
		game.update((g) => {
			g.phaseTimer += dt;
			g.camera.zoomTarget = 1;
			return g;
		});
		updateMultAndUI();
		// Random alerts
		if (Math.random() < dt * 0.12) {
			const alerts = ['BODY SHOT!', 'UPPERCUT!', 'SPINNING KICK!', 'LIVER SHOT!', 'HEAD KICK!', 'JAB-CROSS!'];
			showAlert(alerts[Math.floor(Math.random() * alerts.length)]);
		}
		// Fake feed
		if (Math.random() < 0.02) {
			addFakeFeed(get(game).mult * (0.5 + Math.random() * 0.6), true);
		}
		if (get(game).mult >= get(game).crashPt) {
			game.update((g) => { g.phase = 'CRASH'; g.phaseTimer = 0; return g; });
			startCrashPhase();
		}
	} else if (phase === 'CRASH') {
		game.update((g) => {
			g.phaseTimer += dt;
			g.camera.zoomTarget = 1.1;
			return g;
		});
		const g2 = get(game);
		if (g2.phaseTimer >= cfg.crashWait) {
			const sync = get(syncState);
			if (sync.enabled) {
				onCrashWaitEnd();
				game.update((g) => { g.phase = 'WAITING'; g.phaseTimer = 0; return g; });
			} else {
				startBettingPhase();
			}
		}
	} else if (phase === 'WAITING') {
		game.update((g) => {
			g.phaseTimer += dt;
			return g;
		});
		if (get(game).phaseTimer > 5) {
			game.update((g) => { g.phaseTimer = 0; return g; });
			onCrashWaitEnd();
		}
	}

	// Camera zoom
	game.update((g) => {
		g.camera.zoom += (g.camera.zoomTarget - g.camera.zoom) * dt * 2.5;
		g.camera.shake *= 0.94;
		return g;
	});

	animId = requestAnimationFrame(update);
}

function addFakeFeed(mult: number, won: boolean) {
	const sync = get(syncState);
	if (sync.enabled && sync._hasRealPlayers) return;
	const av = randomAvatar();
	const id = Math.floor(Math.random() * 9) + '***' + Math.floor(Math.random() * 9);
	const bet = fakeBetAmt();
	const fakeWin = won ? Math.min(10000, parseFloat(bet) * mult).toFixed(2) : '';

	game.update((g) => {
		g.sidebarBets.unshift({
			name: id, avatar: av.emoji, bg: av.bg,
			bet, x: won ? mult.toFixed(2) + 'x' : '', win: fakeWin, won, isMe: false
		});
		if (g.sidebarBets.length > 40) g.sidebarBets = g.sidebarBets.slice(0, 40);
		g.sidebarBetCount++;
		if (won) {
			g.sidebarWonCount++;
			g.sidebarWinTotal += parseFloat(fakeWin) || 0;
		}
		return g;
	});
}

function onCrashWaitEnd() {
	const sync = get(syncState);
	if (!sync.enabled) return;
	const next = sync.lastRound + 1;
	if (next <= sync._claimedRound) return;
	syncState.update((s) => { s._claimedRound = next; return s; });
	const cp = genCrash();
	const cfg = get(config);
	FB.claimNextRound(next, {
		crashPoint: cp,
		betTime: cfg.betTime,
		explodeTime: cfg.explodeTime,
		crashWait: cfg.crashWait,
		multSpeed: cfg.multSpeed || 0.002,
		multAccel: cfg.multAccel || 0.00036
	});
	FB.cleanOldBets(next);
}

// Init sync
export function initSync() {
	FB.init().then((online) => {
		if (!online) return;
		syncState.update((s) => { s.enabled = true; return s; });

		FB.onGameRound((gameData) => {
			if (!gameData || !gameData.round) return;
			const sync = get(syncState);
			const roundTs = gameData.serverTs || gameData.ts;
			if (gameData.round > sync.lastRound || (gameData.round === sync.lastRound && gameData.serverTs && !sync._hasServerTs)) {
				syncState.update((s) => {
					s.lastRound = gameData.round;
					s.roundData = gameData;
					s._hasServerTs = !!gameData.serverTs;
					s.isLeader = gameData.leader === FB.getUid();
					s.flyStartTime = roundTs + (gameData.betTime || get(config).betTime) * 1000 + 600;
					return s;
				});
				joinRound(gameData);
			}
		});

		setTimeout(() => {
			if (get(syncState).lastRound === 0) {
				const cp = genCrash();
				const cfg = get(config);
				FB.claimNextRound(1, {
					crashPoint: cp,
					betTime: cfg.betTime,
					explodeTime: cfg.explodeTime,
					crashWait: cfg.crashWait,
					multSpeed: cfg.multSpeed,
					multAccel: cfg.multAccel
				});
			}
		}, 3000);

		document.addEventListener('visibilitychange', () => {
			if (!document.hidden && get(syncState).enabled) {
				resync();
			}
		});
	});
}

function joinRound(gameData: any) {
	const now = FB.serverNow();
	const roundTs = gameData.serverTs || gameData.ts;
	let elapsed = (now - roundTs) / 1000;
	const betEnd = gameData.betTime || get(config).betTime;
	const explEnd = betEnd + (gameData.explodeTime || get(config).explodeTime);
	const ejectSec = betEnd + 0.6;

	game.update((g) => { g.crashPt = gameData.crashPoint; return g; });

	if (elapsed < -1) elapsed = 0;

	const g = get(game);
	const needSync = g.roundNum !== gameData.round;

	if (elapsed < betEnd) {
		if (needSync) {
			startBettingPhase();
			game.update((g) => { g.crashPt = gameData.crashPoint; return g; });
		}
		game.update((g) => { g.phaseTimer = betEnd - elapsed; return g; });
	} else if (elapsed < explEnd) {
		if (needSync) {
			startBettingPhase();
			game.update((g) => { g.crashPt = gameData.crashPoint; g.phaseTimer = 0; return g; });
			startExplodePhase();
		}
	} else {
		const flyElapsed = elapsed - ejectSec;
		const mult = computeMultFromTime(Math.max(0, flyElapsed));
		if (mult >= gameData.crashPoint) {
			if (g.phase !== 'CRASH' || needSync) {
				game.update((g) => {
					g.roundNum = gameData.round;
					g.crashPt = gameData.crashPoint;
					g.mult = gameData.crashPoint;
					g.phase = 'CRASH';
					g.phaseTimer = 0;
					return g;
				});
				startCrashPhase();
			}
		} else {
			if (needSync) {
				startBettingPhase();
				game.update((g) => { g.crashPt = gameData.crashPoint; return g; });
				startExplodePhase();
				startFreefallPhase();
			}
			game.update((g) => { g.mult = mult; return g; });
		}
	}
}

function resync() {
	FB.getGameState().then((gameData) => {
		if (!gameData || !gameData.round) return;
		const roundTs = gameData.serverTs || gameData.ts;
		syncState.update((s) => {
			s.lastRound = gameData.round;
			s.roundData = gameData;
			s._hasServerTs = !!gameData.serverTs;
			s.isLeader = gameData.leader === FB.getUid();
			s.flyStartTime = roundTs + (gameData.betTime || get(config).betTime) * 1000 + 600;
			return s;
		});
		joinRound(gameData);
	});
}

export function startGameLoop() {
	// Seed history if empty
	const g = get(game);
	if (g.history.length === 0) {
		[1.45, 3.22, 1.00, 7.88, 2.11, 1.67, 12.55, 1.00, 4.33, 2.89].forEach((v) => {
			game.update((g) => {
				g.history.unshift({
					v, round: 0, players: 0, totalBet: 0,
					result: '—', resultColor: 'var(--dim)',
					time: '', ts: 0,
					serverSeed: rndSeed(), hash: rndHex(128),
					playerNames: []
				});
				return g;
			});
		});
	}

	// Seed top wins
	const tw = get(topWins);
	if (tw.length === 0) {
		const wins: any[] = [];
		for (let i = 0; i < 8; i++) {
			const av = randomAvatar();
			const id = Math.floor(Math.random() * 9) + '***' + Math.floor(Math.random() * 9);
			const bt = fakeBetAmt();
			const ml = (2 + Math.random() * 30).toFixed(2);
			let wn = (parseFloat(bt) * parseFloat(ml)).toFixed(2);
			if (parseFloat(wn) > 10000) wn = '10000.00';
			wins.push({ name: av.emoji + ' ' + id, bet: bt, mult: ml + 'x', win: wn });
		}
		wins.sort((a, b) => parseFloat(b.win) - parseFloat(a.win));
		topWins.set(wins);
	}

	startBettingPhase();
	initSync();
	animId = requestAnimationFrame(update);
}

export function stopGameLoop() {
	if (animId) cancelAnimationFrame(animId);
}
