<script lang="ts">
	import { game, topWins, prevRoundData } from '$lib/stores/game.js';

	let activeTab = 0;
</script>

<div class="sidebar">
	<div class="sb-tabs">
		<div class="sb-tab" class:active={activeTab === 0} onclick={() => activeTab = 0}>All Bets</div>
		<div class="sb-tab" class:active={activeTab === 1} onclick={() => activeTab = 1}>Previous</div>
		<div class="sb-tab" class:active={activeTab === 2} onclick={() => activeTab = 2}>Top</div>
	</div>

	{#if activeTab === 0}
		<div class="sb-content">
			<div class="sb-summary">
				<span class="sb-count">{$game.sidebarWonCount}/{$game.sidebarBetCount} Bets</span>
				<span class="sb-total">{$game.sidebarWinTotal.toFixed(2)}<br><small>Total win USD</small></span>
			</div>
			<div class="sb-hdr"><span>Player</span><span>Bet USD</span><span>X</span><span>Win USD</span></div>
			<div class="sb-list">
				{#each $game.sidebarBets as row}
					<div class="sb-row" class:won={row.won}>
						<span class="sb-name">
							<span class="sb-av" style="background:{row.bg}">{row.avatar}</span>
							{row.isMe ? '⭐ You' : row.name}
						</span>
						<span class="sb-bet">{row.bet}</span>
						<span class="sb-x">{row.x}</span>
						<span class="sb-win">{row.win}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else if activeTab === 1}
		<div class="sb-content">
			<div class="sb-summary">
				{#if $game.history.length > 0}
					{@const prev = $game.history[0]}
					<span class="sb-count" style="font-family:'JetBrains Mono',monospace;font-weight:700;color:{prev.v < 2 ? 'var(--dng)' : prev.v >= 5 ? 'var(--acc)' : 'var(--wrn)'}">
						Crashed @ {prev.v.toFixed(2)}×
					</span>
				{:else}
					<span class="sb-count">—</span>
				{/if}
				<span class="sb-total">0.00<br><small>Total win USD</small></span>
			</div>
			<div class="sb-hdr"><span>Player</span><span>Bet USD</span><span>X</span><span>Win USD</span></div>
			<div class="sb-list">
				{#each $prevRoundData as row}
					<div class="sb-row" class:won={row.won}>
						<span class="sb-name">{row.name}</span>
						<span class="sb-bet">{row.bet}</span>
						<span class="sb-x">{row.x}</span>
						<span class="sb-win">{row.win}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="sb-content">
			<div class="sb-summary">
				<span class="sb-count" style="font-size:11px;color:var(--gld)">🏆 Biggest Wins</span>
				<span class="sb-total">
					{$topWins.reduce((s, w) => s + (parseFloat(w.win) || 0), 0).toFixed(2)}<br><small>Top wins USD</small>
				</span>
			</div>
			<div class="sb-hdr"><span>Player</span><span>Bet USD</span><span>X</span><span>Win USD</span></div>
			<div class="sb-list">
				{#each $topWins as row}
					<div class="sb-row won">
						<span class="sb-name">{row.name}</span>
						<span class="sb-bet">{row.bet}</span>
						<span class="sb-x" style="color:var(--gld)">{row.mult}</span>
						<span class="sb-win" style="color:var(--gld)">{row.win}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="sb-footer">MMA</div>
</div>
