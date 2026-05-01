import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
	getDatabase,
	ref,
	set,
	push,
	get,
	onValue,
	onChildAdded,
	remove,
	runTransaction,
	serverTimestamp,
	query,
	orderByChild,
	limitToLast,
	type Database
} from 'firebase/database';
import { writable, get as getStore } from 'svelte/store';

const FIREBASE_CONFIG = {
	apiKey: 'AIzaSyAPPjhU1xFqVYVu4nxvTkTKxgCtO9ltN4U',
	authDomain: 'skydrop-9b21b.firebaseapp.com',
	databaseURL: 'https://skydrop-9b21b-default-rtdb.firebaseio.com',
	projectId: 'skydrop-9b21b',
	storageBucket: 'skydrop-9b21b.firebasestorage.app',
	messagingSenderId: '665217333875',
	appId: '1:665217333875:web:109afc988eae507f80c806'
};

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;
let uid: string | null = null;
let serverOffset = 0;
let connected = false;

export const isOnline = writable(false);
export const isAdmin = writable(false);
export const isReady = writable(false);

export function getUid() {
	return uid;
}

export function serverNow() {
	return Date.now() + serverOffset;
}

export function isOffsetReady() {
	return serverOffset !== 0;
}

export async function init() {
	try {
		app = initializeApp(FIREBASE_CONFIG);
		db = getDatabase(app);
		auth = getAuth(app);

		const result = await signInAnonymously(auth);
		uid = result.user.uid;

		onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
			serverOffset = snap.val() || 0;
		});

		onValue(ref(db, '.info/connected'), (snap) => {
			connected = !!snap.val();
			isOnline.set(connected);
		});

		try {
			const adminSnap = await get(ref(db, 'admins/' + uid));
			isAdmin.set(!!adminSnap.val());
		} catch {
			isAdmin.set(false);
		}

		isReady.set(true);
		return true;
	} catch {
		isReady.set(true);
		return false;
	}
}

// Config
export function onConfigChange(cb: (cfg: any) => void) {
	if (!db) return;
	onValue(ref(db, 'config'), (snap) => {
		const val = snap.val();
		if (val) cb(val);
	});
}

export function saveConfig(data: any) {
	if (!db) {
		localStorage.setItem('mma_admin_config', JSON.stringify(data));
		return Promise.resolve();
	}
	return set(ref(db, 'config'), data).then(() => {
		localStorage.setItem('mma_admin_config', JSON.stringify(data));
	});
}

export function loadConfig() {
	if (!db) {
		try {
			const s = localStorage.getItem('mma_admin_config');
			return Promise.resolve(s ? JSON.parse(s) : null);
		} catch {
			return Promise.resolve(null);
		}
	}
	return get(ref(db, 'config')).then((snap) => snap.val());
}

// Chat
export function sendChatMsg(msg: { name: string; avatar: string; bg: string; text: string }) {
	if (!db || !uid) return;
	const text = (msg.text || '').trim();
	if (!text || text.length > 500) return;
	push(ref(db, 'chat'), {
		name: (msg.name || 'Player').slice(0, 30),
		avatar: msg.avatar || '🧑‍✈️',
		bg: msg.bg || 'rgba(76,175,80,.12)',
		text,
		time: serverTimestamp(),
		uid
	});
}

export function onChat(cb: (msg: any) => void) {
	if (!db) return;
	const q = query(ref(db, 'chat'), orderByChild('time'), limitToLast(80));
	onChildAdded(q, (snap) => {
		const val = snap.val();
		if (!val) return;
		val._key = snap.key;
		val.isMe = val.uid === uid;
		if (typeof val.time === 'number') {
			const d = new Date(val.time);
			val.timeStr =
				d.getHours().toString().padStart(2, '0') +
				':' +
				d.getMinutes().toString().padStart(2, '0');
		} else {
			val.timeStr = val.time || '';
		}
		cb(val);
	});
}

// Rounds
export function pushRound(data: any) {
	if (!db) return;
	const entry: any = {
		v: data.v,
		round: data.round,
		players: data.players,
		totalBet: data.totalBet,
		result: data.result,
		time: data.time,
		ts: serverTimestamp()
	};
	if (data.bets?.length) entry.bets = data.bets;
	push(ref(db, 'rounds'), entry);

	get(query(ref(db, 'rounds'), orderByChild('ts'))).then((snap) => {
		const count = snap.size;
		if (count > 500) {
			let toRemove = count - 500;
			snap.forEach((child) => {
				if (toRemove <= 0) return true;
				remove(child.ref);
				toRemove--;
			});
		}
	}).catch(() => {});
}

export function loadRounds() {
	if (!db) {
		try {
			const h = localStorage.getItem('mma_history');
			return Promise.resolve(h ? JSON.parse(h) : []);
		} catch {
			return Promise.resolve([]);
		}
	}
	return get(query(ref(db, 'rounds'), orderByChild('ts'), limitToLast(500))).then((snap) => {
		const arr: any[] = [];
		snap.forEach((child) => arr.unshift(child.val()));
		return arr;
	});
}

export function onNewRound(cb: (val: any) => void) {
	if (!db) return;
	onChildAdded(query(ref(db, 'rounds'), orderByChild('ts'), limitToLast(1)), (snap) => {
		const val = snap.val();
		if (val) cb(val);
	});
}

// Game sync
export function onGameRound(cb: (val: any) => void) {
	if (!db) return;
	onValue(ref(db, 'game'), (snap) => {
		const val = snap.val();
		if (val) cb(val);
	});
}

export function getGameState() {
	if (!db) return Promise.resolve(null);
	return get(ref(db, 'game')).then((snap) => snap.val());
}

export async function claimNextRound(nextRound: number, data: any) {
	if (!db) return false;
	try {
		const gameRef = ref(db, 'game');
		const result = await runTransaction(gameRef, (current) => {
			if (!current || !current.round || current.round < nextRound) {
				data.round = nextRound;
				data.leader = uid;
				data.ts = Date.now() + serverOffset;
				return data;
			}
		});
		if (result.committed) {
			set(ref(db, 'game/serverTs'), serverTimestamp());
		}
		return result.committed;
	} catch {
		return false;
	}
}

export function writeBet(roundNum: number, betData: any) {
	if (!db || !uid) return;
	betData.uid = uid;
	const slot = betData.slot || 1;
	set(ref(db, 'liveBets/' + roundNum + '/' + uid + '_' + slot), betData);
}

export function onLiveBets(roundNum: number, cb: (bets: any) => void) {
	if (!db) return;
	onValue(ref(db, 'liveBets/' + roundNum), (snap) => {
		cb(snap.val() || {});
	});
}

export function offLiveBets(_roundNum: number) {
	// In modular Firebase, listeners are cleaned up differently
	// For now this is a no-op; proper cleanup would use `off()`
}

export function cleanOldBets(currentRound: number) {
	if (!db || currentRound <= 5) return;
	const cutoff = currentRound - 5;
	get(ref(db, 'liveBets')).then((snap) => {
		snap.forEach((child) => {
			const roundNum = parseInt(child.key!, 10);
			if (!isNaN(roundNum) && roundNum <= cutoff) remove(child.ref);
		});
	});
}

export function makeAdmin() {
	if (!db || !uid) return;
	set(ref(db, 'admins/' + uid), true).then(() => {
		isAdmin.set(true);
	});
}

export function factoryReset() {
	if (!db) return Promise.resolve();
	return Promise.all([
		remove(ref(db, 'config')),
		remove(ref(db, 'chat')),
		remove(ref(db, 'rounds')),
		remove(ref(db, 'liveBets')),
		remove(ref(db, 'game'))
	]);
}
