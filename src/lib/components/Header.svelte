<script lang="ts">
	import { game, toggleGameView, gameView } from '$lib/stores/game.js';
	import { toggleChat } from '$lib/stores/chat.js';
	import { playClick } from '$lib/stores/sound.js';

	let { menuOpen = $bindable(false) }: { menuOpen?: boolean } = $props();
</script>

<div class="hd">
	<div style="display:flex;align-items:center;gap:8px">
		<div class="logo"><em>MMA</em></div>
		<div class="live-tag"><span class="live-dot"></span>LIVE</div>
	</div>
	<div class="hdr">
		<div class="bbox">
			<div class="bicon">$</div>
			<div class="bval">{$game.balance.toFixed(2)}</div>
		</div>
		<button class="ibtn view-switch" onclick={() => { playClick(); toggleGameView(); }} title="Switch View">
			{$gameView === 'pov' ? '👁' : '🥊'}
		</button>
		<button class="ibtn chat-hdr-btn" onclick={() => { playClick(); toggleChat(); }}>💬</button>
		<button class="ibtn" onclick={() => { playClick(); menuOpen = true; }} aria-label="Open menu">☰</button>
	</div>
</div>
