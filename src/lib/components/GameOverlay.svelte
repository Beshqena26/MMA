<script lang="ts">
	import { game, alertText, gameView } from '$lib/stores/game.js';
	import { config } from '$lib/stores/config.js';

	let isSide = $derived($gameView === 'side');

	let phase = $derived($game.phase);
	let mult = $derived($game.mult);
	let crashPt = $derived($game.crashPt);
	let phaseTimer = $derived($game.phaseTimer);
	let betTime = $derived($config.betTime);
	let pct = $derived(phase === 'BETTING' ? phaseTimer / betTime : 0);

	let cineClass = $derived((() => {
		if (phase === 'CRASH') return 'cine show crashed dng';
		if (phase === 'FREEFALL' || phase === 'EXPLODE') {
			if (mult >= 8) return 'cine show gold';
			if (mult >= 4) return 'cine show wrn';
			return 'cine show';
		}
		return 'cine';
	})());

	let cineText = $derived((() => {
		if (phase === 'CRASH') return crashPt.toFixed(2) + '×';
		if (phase === 'FREEFALL' || phase === 'EXPLODE') return mult.toFixed(2) + '×';
		return '1.00×';
	})());

	let cineSub = $derived(phase === 'CRASH' ? 'KNOCKOUT!' : 'MULTIPLIER');

	let crashWaitRemain = $derived(phase === 'CRASH' ? Math.max(0, Math.ceil($config.crashWait - phaseTimer)) : 0);
</script>

<div class="mid">
	<!-- Timer bar -->
	{#if phase === 'BETTING'}
		<div class="timer-bar" class:urgent={pct < 0.4} style="width:{pct * 100}%;display:block"></div>
	{/if}

	<!-- Round banner -->
	{#if phase === 'BETTING'}
		<div class="round-banner" style="display:block">
			<div class="rb-title">Next Round</div>
			<div class="rb-bar-wrap">
				<div class="rb-bar-fill" style="width:{pct * 100}%"></div>
				<div class="rb-bar-text">Starts in {Math.max(0, phaseTimer).toFixed(2)}s</div>
			</div>
		</div>
	{/if}

	<!-- Alert -->
	{#if $alertText}
		<div class="alrt show">{$alertText}</div>
	{/if}

	<!-- Multiplier display (hide during CRASH on side view — canvas shows K.O.) -->
	{#if (phase === 'FREEFALL' || phase === 'EXPLODE') || (phase === 'CRASH' && !isSide)}
		<div class={cineClass}>
			<div class="c1">{cineText}</div>
			<div class="c2">{cineSub}</div>
		</div>
	{/if}

	<!-- Crash message (only in POV view — side view has canvas K.O.) -->
	{#if phase === 'CRASH' && !isSide}
		<div class="bm cm show">
			<div class="bt">KNOCKOUT!</div>
			<div class="bb">{crashPt.toFixed(2)}×</div>
		</div>
	{/if}

	<!-- Cash out message -->
	{#if $game.bets.some(b => b.placed && b.out && b.win > 0) && (phase === 'FREEFALL' || phase === 'CRASH')}
		{@const wonBet = $game.bets.find(b => b.placed && b.out && b.win > 0)}
		{#if wonBet}
			<div class="bm wm show">
				<div class="bt">CASHED OUT</div>
				<div class="bb">+${wonBet.win.toFixed(2)}</div>
			</div>
		{/if}
	{/if}

	<!-- Next round countdown -->
	{#if phase === 'CRASH' && phaseTimer > 1.5}
		<div class="stl show s5" style="position:absolute;bottom:10%;left:50%;transform:translateX(-50%)">
			NEXT ROUND IN {crashWaitRemain}s
		</div>
	{/if}
</div>
