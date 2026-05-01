<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import GameCanvas from '$lib/components/GameCanvas.svelte';
	import Header from '$lib/components/Header.svelte';
	import HistoryBar from '$lib/components/HistoryBar.svelte';
	import BetPanel from '$lib/components/BetPanel.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import GameOverlay from '$lib/components/GameOverlay.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import BurgerMenu from '$lib/components/BurgerMenu.svelte';
	import Modals from '$lib/components/Modals.svelte';
	import { game, betAction, type HistoryEntry } from '$lib/stores/game.js';
	import { chatOpen, mobileChatOpen, initChat, toggleChat } from '$lib/stores/chat.js';
	import { startGameLoop, stopGameLoop } from '$lib/stores/gameloop.js';
	import { initSound, wakeAudio } from '$lib/stores/sound.js';

	let menuOpen = $state(false);
	let activeModal: string | null = $state(null);
	let selectedRound: HistoryEntry | null = $state(null);

	function openModal(id: string) {
		activeModal = id;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.code === 'Space' || e.code === 'Enter') {
			if (activeModal || selectedRound) return;
			e.preventDefault();
			const g = $game;
			if (g.phase === 'FREEFALL' || g.phase === 'EXPLODE' || g.phase === 'BETTING') {
				betAction(1);
			}
		}
	}

	function handleFirstInteraction() {
		wakeAudio();
		document.removeEventListener('click', handleFirstInteraction);
		document.removeEventListener('touchstart', handleFirstInteraction);
	}

	onMount(() => {
		initSound();
		initChat();
		startGameLoop();

		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('click', handleFirstInteraction);
		document.addEventListener('touchstart', handleFirstInteraction);

		async function requestWakeLock() {
			try {
				if ('wakeLock' in navigator) {
					await (navigator as any).wakeLock.request('screen');
				}
			} catch {}
		}
		requestWakeLock();
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') requestWakeLock();
		});
	});

	onDestroy(() => {
		stopGameLoop();
		if (typeof document !== 'undefined') {
			document.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<svelte:head>
	<title>MMA — LIVE</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</svelte:head>

<GameCanvas />

<div class="ov">
	<Header bind:menuOpen />
	<HistoryBar bind:selectedRound />

	<div class="main-row">
		<Sidebar />

		<div class="game-area">
			<GameOverlay />
			<BetPanel />
		</div>

		<div class="chat-panel" class:open={$chatOpen}>
			<ChatPanel desktop={true} />
		</div>
	</div>
</div>

{#if $mobileChatOpen}
	<div class="mobile-chat-overlay open" onclick={(e) => { if (e.target === e.currentTarget) toggleChat(); }}>
		<div class="mobile-chat-panel">
			<div class="mobile-chat-head">
				<span>💬 CHAT</span>
				<button class="mc" onclick={() => toggleChat()} style="position:static;padding:6px">✕</button>
			</div>
			<ChatPanel />
		</div>
	</div>
{/if}

<BurgerMenu bind:open={menuOpen} onOpenModal={openModal} />
<Modals bind:activeModal bind:selectedRound />
