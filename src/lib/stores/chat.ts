import { writable, get } from 'svelte/store';
import * as FB from '$lib/firebase/index.js';
import { playerName, playerAvatar, randomAvatar } from './game.js';

export interface ChatMessage {
	name: string;
	avatar: string;
	bg: string;
	text: string;
	time: string;
	isMe: boolean;
}

export const chatMessages = writable<ChatMessage[]>([]);
export const chatOpen = writable(false);
export const mobileChatOpen = writable(false);

const CHAT_MSGS = [
	'gl everyone 🍀', 'lets gooo 🚀', 'ez win', 'cashout at 2x trust me',
	'who else lost last round 😭', 'this game is rigged lol', 'nah its fair check the hash',
	'just hit 10x 🔥🔥', 'playing safe today', 'all in', 'anyone here from turkey?',
	'gg', 'bruh i was 0.01 away', 'hold hold hold', 'i love this game',
	'3x and out', 'im up $200 today', 'dont be greedy', 'rip my balance',
	'nice one!', 'how do you guys cashout so fast', 'autobet is the way',
	'im scared to bet high', 'just vibes', '1x gang 😂', 'mma best game',
	'send it 🚀', 'bruh', 'lmaooo', 'chill round', 'that was close', 'im out gg',
	'any tips?', 'bet small win big', 'patience is key', 'wow that crash was brutal',
	'my heart cant take this', 'imagine hitting 100x', 'one more round then i sleep',
	'ok last round for real this time', 'nope still playing 😅', 'addicted ngl'
];

export const GIF_STICKERS = [
	{ emoji: '🚀💨', label: 'Launch' },
	{ emoji: '💰🤑💰', label: 'Money' },
	{ emoji: '🔥🔥🔥', label: 'Fire' },
	{ emoji: '💎👐💎', label: 'Diamond Hands' },
	{ emoji: '🎉🥳🎊', label: 'Party' },
	{ emoji: '😭💔😭', label: 'Cry' },
	{ emoji: '🤯💥🤯', label: 'Mind Blown' },
	{ emoji: '👑✨👑', label: 'King' },
	{ emoji: '🪂⬇️💀', label: 'Crash' },
	{ emoji: '📈🟢📈', label: 'Moon' },
	{ emoji: '📉🔴📉', label: 'Dump' },
	{ emoji: '🍀🤞🍀', label: 'Lucky' },
	{ emoji: '💪😤💪', label: 'Strong' },
	{ emoji: '🐋💰🐋', label: 'Whale' },
	{ emoji: '⏰💣⏰', label: 'Ticking' },
	{ emoji: '🎰🎰🎰', label: 'Jackpot' },
	{ emoji: '👀👀👀', label: 'Watching' },
	{ emoji: '🫡🫡🫡', label: 'Salute' }
];

export const EMOJI_DATA: Record<string, string[]> = {
	Smileys: ['😀', '😂', '🤣', '😊', '😎', '🥳', '😍', '🤑', '😭', '😱', '🤯', '🥺', '😤', '🫣', '😏', '🤡', '💀', '👻', '😈', '🤝'],
	Gestures: ['👍', '👎', '👏', '🙌', '🤞', '✌️', '🤟', '💪', '👊', '🫰', '🫶', '🙏', '👋', '🤙', '💅', '🖕'],
	Objects: ['🔥', '💎', '💰', '💵', '🎰', '🎲', '🃏', '🏆', '🎯', '⚡', '💣', '🚀', '🪂', '✈️', '💸', '🎉', '🎊', '🍀'],
	Animals: ['🦅', '🐺', '🦁', '🐉', '🦈', '🦊', '🐻', '🦇', '🐍', '🦂', '🐊', '🦍'],
	Hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❤️‍🔥', '💝', '💗']
};

export const GIPHY_KEY = '21pOlJ0A6HPx3V3aoQ1rmyYIhLZSw6Wd';

function chatTime() {
	const d = new Date();
	return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

let fbChatActive = false;

export function addChatMsg(name: string, avatar: string, bg: string, text: string, isMe: boolean) {
	chatMessages.update((msgs) => {
		msgs.push({ name, avatar, bg, text, time: chatTime(), isMe });
		if (msgs.length > 80) msgs.shift();
		return msgs;
	});
}

export function sendChat(text: string) {
	if (!text.trim()) return;
	const name = get(playerName);
	const avatar = get(playerAvatar);
	if (fbChatActive) {
		FB.sendChatMsg({ name, avatar, bg: 'rgba(76,175,80,.12)', text });
	} else {
		addChatMsg(name, avatar, 'rgba(76,175,80,.12)', text, true);
	}
}

export function sendGif(gifData: string) {
	sendChat('__GIF__' + gifData);
}

export function initChat() {
	// Seed messages
	for (let i = 0; i < 5; i++) {
		const av = randomAvatar();
		const id = Math.floor(Math.random() * 9) + '***' + Math.floor(Math.random() * 9);
		addChatMsg(id, av.emoji, av.bg, CHAT_MSGS[Math.floor(Math.random() * CHAT_MSGS.length)], false);
	}

	// Firebase chat
	FB.init().then((online) => {
		if (!online) return;
		fbChatActive = true;
		chatMessages.set([]);
		FB.onChat((msg) => {
			addChatMsg(
				msg.name, msg.avatar, msg.bg || 'rgba(76,175,80,.12)',
				msg.text, msg.isMe
			);
		});
	});

	// Bot messages
	setInterval(() => {
		if (Math.random() > 0.4) return;
		const av = randomAvatar();
		const id = Math.floor(Math.random() * 9) + '***' + Math.floor(Math.random() * 9);
		let msg: string;
		if (Math.random() < 0.15) {
			const g = GIF_STICKERS[Math.floor(Math.random() * GIF_STICKERS.length)];
			msg = '__GIF__' + g.emoji;
		} else {
			msg = CHAT_MSGS[Math.floor(Math.random() * CHAT_MSGS.length)];
		}
		addChatMsg(id, av.emoji, av.bg, msg, false);
	}, 4000 + Math.random() * 3000);
}

export function toggleChat() {
	if (typeof window !== 'undefined' && window.innerWidth >= 900) {
		chatOpen.update((v) => !v);
	} else {
		mobileChatOpen.update((v) => !v);
	}
}
