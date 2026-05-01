<script lang="ts">
	import { game, adjustBet, setAmount, betAction, toggleAuto, setAutoCashVal, panel2Visible } from '$lib/stores/game.js';
	import { playClick } from '$lib/stores/sound.js';

	function btnClass(slot: number): string {
		const g = $game;
		const b = g.bets[slot - 1];
		if (g.phase === 'BETTING') {
			return b.placed ? 'bp-betbtn cancel' : 'bp-betbtn';
		} else if (g.phase === 'FREEFALL' || (g.phase === 'EXPLODE')) {
			if (b.placed && !b.out) return 'bp-betbtn cashout';
			if (b.placed && b.out) return 'bp-betbtn won';
			return 'bp-betbtn waiting';
		}
		if (b.placed && b.out) return 'bp-betbtn won';
		return 'bp-betbtn waiting';
	}

	function btnLabel(slot: number): string {
		const g = $game;
		const b = g.bets[slot - 1];
		if (g.phase === 'BETTING') return b.placed ? 'Cancel' : 'Bet';
		if (g.phase === 'FREEFALL' || g.phase === 'EXPLODE') {
			if (b.placed && !b.out) return 'Cash Out';
			if (b.placed && b.out) return 'Won!';
			return 'Waiting';
		}
		if (b.placed && b.out) return 'Won!';
		return 'Next round';
	}

	function btnAmount(slot: number): string {
		const g = $game;
		const b = g.bets[slot - 1];
		if (g.phase === 'BETTING') return b.amount.toFixed(2) + ' USD';
		if (g.phase === 'FREEFALL' || g.phase === 'EXPLODE') {
			if (b.placed && !b.out) return (b.amount * g.mult).toFixed(2) + ' USD';
			if (b.placed && b.out) return '+' + (b.amount * b.cashMult).toFixed(2) + ' USD';
			return '';
		}
		if (b.placed && b.out) return '+' + (b.amount * b.cashMult).toFixed(2) + ' USD';
		return '';
	}
</script>

<div class="bp">
	<!-- Panel 1 -->
	<div class="bet-panel">
		<div class="bp-body">
			<div class="bp-left">
				<div class="bp-amtrow">
					<button class="bp-btn" onclick={() => { playClick(); adjustBet(1, -1); }}>−</button>
					<div class="bp-amt">{$game.bets[0].amount.toFixed(2)}</div>
					<button class="bp-btn" onclick={() => { playClick(); adjustBet(1, 1); }}>+</button>
				</div>
				<div class="bp-quicks">
					<button class="bp-q" onclick={() => { playClick(); setAmount(1, 1); }}>1</button>
					<button class="bp-q" onclick={() => { playClick(); setAmount(1, 2); }}>2</button>
					<button class="bp-q" onclick={() => { playClick(); setAmount(1, 5); }}>5</button>
					<button class="bp-q" onclick={() => { playClick(); setAmount(1, 10); }}>10</button>
				</div>
			</div>
			<div class="bp-right">
				<button class={btnClass(1)} onclick={() => betAction(1)}>
					<span class="bb-label">{btnLabel(1)}</span>
					<span class="bb-amount">{btnAmount(1)}</span>
				</button>
			</div>
		</div>
		<div class="bp-auto-row">
			<span>Auto Bet</span>
			<button class="bp-auto-toggle" class:on={$game.autoBet[0]} onclick={() => toggleAuto(1, 'bet')}>
				<div class="dot"></div>
			</button>
			<span style="margin-left:auto">Cash Out</span>
			<button class="bp-auto-toggle" class:on={$game.autoCash[0]} onclick={() => toggleAuto(1, 'cash')}>
				<div class="dot"></div>
			</button>
			<input class="bp-auto-input" placeholder="2.00" value={$game.autoCashVal[0] || ''}
				oninput={(e) => setAutoCashVal(1, parseFloat((e.target as HTMLInputElement).value) || 0)}
				inputmode="decimal">
			<span class="bp-auto-x">×</span>
			{#if !$panel2Visible}
				<button class="bp-add-btn" onclick={() => panel2Visible.set(true)}>＋</button>
			{/if}
		</div>
	</div>

	<!-- Panel 2 -->
	{#if $panel2Visible}
		<div class="bet-panel">
			<div class="bp-body">
				<div class="bp-left">
					<div class="bp-amtrow">
						<button class="bp-btn" onclick={() => { playClick(); adjustBet(2, -1); }}>−</button>
						<div class="bp-amt">{$game.bets[1].amount.toFixed(2)}</div>
						<button class="bp-btn" onclick={() => { playClick(); adjustBet(2, 1); }}>+</button>
					</div>
					<div class="bp-quicks">
						<button class="bp-q" onclick={() => { playClick(); setAmount(2, 1); }}>1</button>
						<button class="bp-q" onclick={() => { playClick(); setAmount(2, 2); }}>2</button>
						<button class="bp-q" onclick={() => { playClick(); setAmount(2, 5); }}>5</button>
						<button class="bp-q" onclick={() => { playClick(); setAmount(2, 10); }}>10</button>
					</div>
				</div>
				<div class="bp-right">
					<button class={btnClass(2)} onclick={() => betAction(2)}>
						<span class="bb-label">{btnLabel(2)}</span>
						<span class="bb-amount">{btnAmount(2)}</span>
					</button>
				</div>
			</div>
			<div class="bp-auto-row">
				<span>Auto Bet</span>
				<button class="bp-auto-toggle" class:on={$game.autoBet[1]} onclick={() => toggleAuto(2, 'bet')}>
					<div class="dot"></div>
				</button>
				<span style="margin-left:auto">Cash Out</span>
				<button class="bp-auto-toggle" class:on={$game.autoCash[1]} onclick={() => toggleAuto(2, 'cash')}>
					<div class="dot"></div>
				</button>
				<input class="bp-auto-input" placeholder="2.00" value={$game.autoCashVal[1] || ''}
					oninput={(e) => setAutoCashVal(2, parseFloat((e.target as HTMLInputElement).value) || 0)}
					inputmode="decimal">
				<span class="bp-auto-x">×</span>
				<button class="bp-remove-btn" onclick={() => panel2Visible.set(false)}>✕</button>
			</div>
		</div>
	{/if}
</div>
