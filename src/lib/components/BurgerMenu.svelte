<script lang="ts">
	import { soundOn, musicOn, gameSndOn, toggleSound, toggleMusic, toggleGameSnd } from '$lib/stores/sound.js';

	let { open = $bindable(false), onOpenModal = (id: string) => {} }: { open?: boolean; onOpenModal?: (id: string) => void } = $props();

	function close() { open = false; }
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="menu-overlay open" onclick={close} role="button" tabindex="-1"></div>
{/if}
<div class="menu-panel" class:open>
	<div class="menu-head">
		<div class="menu-user">
			<div class="menu-user-name">MMA Fight</div>
			<div class="menu-user-id">Arena</div>
		</div>
		<button class="menu-close" onclick={close}>✕</button>
	</div>

	<div class="menu-section">
		<div class="menu-section-title">Sound</div>
		<div class="menu-item" onclick={toggleSound}>
			<span class="mi-icon">🔊</span>
			<span class="mi-label">SFX</span>
			<div class="menu-toggle" class:on={$soundOn}></div>
		</div>
		<div class="menu-item" onclick={toggleGameSnd}>
			<span class="mi-icon">🥊</span>
			<span class="mi-label">Fight</span>
			<div class="menu-toggle" class:on={$gameSndOn}></div>
		</div>
		<div class="menu-item" onclick={toggleMusic}>
			<span class="mi-icon">🎵</span>
			<span class="mi-label">Music</span>
			<div class="menu-toggle" class:on={$musicOn}></div>
		</div>
	</div>

	<div class="menu-divider"></div>

	<div class="menu-section">
		<div class="menu-section-title">Info</div>
		<div class="menu-item" onclick={() => { close(); onOpenModal('howToPlay'); }}>
			<span class="mi-icon">❓</span><span class="mi-label">How To Play</span>
		</div>
		<div class="menu-item" onclick={() => { close(); onOpenModal('rules'); }}>
			<span class="mi-icon">📋</span><span class="mi-label">Game Rules</span>
		</div>
		<div class="menu-item" onclick={() => { close(); onOpenModal('history'); }}>
			<span class="mi-icon">📊</span><span class="mi-label">Bet History</span>
		</div>
		<div class="menu-item" onclick={() => { close(); onOpenModal('limits'); }}>
			<span class="mi-icon">⚙️</span><span class="mi-label">Game Limits</span>
		</div>
		<div class="menu-item" onclick={() => { close(); onOpenModal('terms'); }}>
			<span class="mi-icon">📄</span><span class="mi-label">Terms</span>
		</div>
	</div>

	<div class="menu-footer">
		<div class="menu-footer-logo">MMA <span style="color:var(--dng)">Fight</span> Arena</div>
		<div class="menu-footer-ver">v2.0 Svelte</div>
	</div>
</div>
