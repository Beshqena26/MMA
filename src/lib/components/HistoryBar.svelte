<script lang="ts">
	import { game, type HistoryEntry } from '$lib/stores/game.js';

	let { selectedRound = $bindable(null) }: { selectedRound?: HistoryEntry | null } = $props();

	function chipClass(v: number) {
		if (v >= 5) return 'hc g';
		if (v >= 1.5) return 'hc y';
		return 'hc r';
	}
</script>

<div class="hs">
	{#each $game.history.slice(0, 16) as entry}
		<div class={chipClass(entry.v)} onclick={() => selectedRound = entry} style="cursor:pointer">
			{entry.v.toFixed(2)}×
		</div>
	{/each}
</div>
