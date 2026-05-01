import { writable } from 'svelte/store';

export const soundOn = writable(true);
export const musicOn = writable(true);
export const gameSndOn = writable(true);

let sounds: Record<string, HTMLAudioElement> = {};
let bgMusic: HTMLAudioElement | null = null;
let bgPlaying = false;
let audioCtx: AudioContext | null = null;
let playing: Record<string, HTMLAudioElement> = {};

function getCtx() {
	if (!audioCtx) {
		try {
			audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
		} catch {}
	}
	return audioCtx;
}

export function initSound() {
	const load = (key: string, src: string) => {
		const a = new Audio(src);
		a.preload = 'auto';
		sounds[key] = a;
	};
	load('punch', '/assets/sounds/punch.mp3');
	load('victory', '/assets/sounds/crowd-victory.wav');
	load('fight', '/assets/sounds/fight-voice.mp3');
	load('cheer', '/assets/sounds/crowd-cheer.mp3');
	load('intro', '/assets/sounds/intro-music.mp3');
	bgMusic = new Audio('/assets/sounds/bg-music.mp3');
	bgMusic.loop = true;
	bgMusic.volume = 0.15;
}

export function playSound(key: string, vol = 0.5) {
	let on = true;
	soundOn.subscribe((v) => (on = v))();
	if (!on) return;
	const s = sounds[key];
	if (!s) return;
	try {
		const c = s.cloneNode() as HTMLAudioElement;
		c.volume = vol;
		c.play().catch(() => {});
		playing[key] = c;
	} catch {}
}

export function playTone(freq: number, dur: number, vol = 0.15, type: OscillatorType = 'sine') {
	let on = true;
	soundOn.subscribe((v) => (on = v))();
	if (!on) return;
	const c = getCtx();
	if (!c) return;
	try {
		const n = c.currentTime;
		const osc = c.createOscillator();
		const gain = c.createGain();
		osc.connect(gain);
		gain.connect(c.destination);
		osc.type = type;
		osc.frequency.setValueAtTime(freq, n);
		gain.gain.setValueAtTime(vol, n);
		gain.gain.exponentialRampToValueAtTime(0.001, n + dur);
		osc.start(n);
		osc.stop(n + dur);
	} catch {}
}

export function playBet() {
	playTone(400, 0.08, 0.2, 'sine');
	setTimeout(() => playTone(600, 0.06, 0.15, 'sine'), 50);
	setTimeout(() => playTone(800, 0.1, 0.12, 'sine'), 90);
}

export function playCashout() {
	playTone(523, 0.1, 0.2, 'sine');
	setTimeout(() => playTone(659, 0.1, 0.18, 'sine'), 80);
	setTimeout(() => playTone(784, 0.15, 0.2, 'sine'), 160);
	setTimeout(() => playTone(1047, 0.2, 0.15, 'sine'), 250);
}

export function playClick() {
	playTone(800, 0.04, 0.1, 'square');
}

export function stopSound(key: string) {
	const c = playing[key];
	if (!c) return;
	try {
		const fi = setInterval(() => {
			if (c.volume > 0.05) c.volume = Math.max(0, c.volume - 0.1);
			else {
				c.pause();
				c.currentTime = 0;
				clearInterval(fi);
			}
		}, 30);
		setTimeout(() => {
			try {
				c.pause();
				c.currentTime = 0;
				clearInterval(fi);
			} catch {}
		}, 300);
	} catch {}
	playing[key] = null as any;
}

export function startBG() {
	let on = true;
	musicOn.subscribe((v) => (on = v))();
	if (!on || bgPlaying || !bgMusic) return;
	try {
		bgMusic.play();
		bgPlaying = true;
	} catch {}
}

export function stopBG() {
	if (!bgMusic) return;
	try {
		bgMusic.pause();
		bgMusic.currentTime = 0;
		bgPlaying = false;
	} catch {}
}

export function toggleSound() {
	soundOn.update((v) => !v);
}

export function toggleMusic() {
	musicOn.update((v) => {
		if (!v) startBG();
		else stopBG();
		return !v;
	});
}

export function toggleGameSnd() {
	gameSndOn.update((v) => !v);
}

export function wakeAudio() {
	getCtx();
	startBG();
}
