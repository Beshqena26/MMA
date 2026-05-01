<script lang="ts">
	import { game, type HistoryEntry, rndSeed } from '$lib/stores/game.js';
	import { config } from '$lib/stores/config.js';

	let { activeModal = $bindable(null), selectedRound = $bindable(null) }: { activeModal?: string | null; selectedRound?: HistoryEntry | null } = $props();

	function close() { activeModal = null; selectedRound = null; }
	function maskName(n: string) { if (!n || n.length < 3) return '***'; return n[0] + '***' + n[n.length - 1]; }
</script>

<!-- How to Play -->
{#if activeModal === 'howToPlay'}
<div class="mo open" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
	<div class="mx" style="max-width:560px">
		<button class="mc" onclick={close}>✕</button>
		<div class="mt2">HOW TO PLAY</div>
		<div class="ms" style="margin-top:14px">
			<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
				<span style="background:linear-gradient(135deg,#4caf50,#66bb6a);color:#fff;font-weight:800;font-size:13px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center">1</span>
				<span style="font-weight:700;font-size:14px;color:var(--txt)">PLACE YOUR BET</span>
			</div>
			<p style="color:var(--dim);font-size:12px;line-height:1.6;margin:0">Two fighters enter the octagon. You have <b style="color:var(--acc)">{$config.betTime} seconds</b> to place your bet before the fight begins.</p>
		</div>
		<div class="ms" style="margin-top:10px">
			<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
				<span style="background:linear-gradient(135deg,#ff9800,#ffb74d);color:#fff;font-weight:800;font-size:13px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center">2</span>
				<span style="font-weight:700;font-size:14px;color:var(--txt)">FIGHT BEGINS</span>
			</div>
			<p style="color:var(--dim);font-size:12px;line-height:1.6;margin:0">The <b style="color:var(--txt)">multiplier starts at 1.00x</b> and increases as the fight intensifies.</p>
		</div>
		<div class="ms" style="margin-top:10px">
			<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
				<span style="background:linear-gradient(135deg,#ffd700,#ffeb3b);color:#1a1a1a;font-weight:800;font-size:13px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center">3</span>
				<span style="font-weight:700;font-size:14px;color:var(--txt)">CASH OUT TO WIN</span>
			</div>
			<p style="color:var(--dim);font-size:12px;line-height:1.6;margin:0">Hit <b style="color:var(--gld)">Cash Out</b> anytime. Your payout = bet x current multiplier.</p>
		</div>
		<div class="ms" style="margin-top:10px">
			<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
				<span style="background:linear-gradient(135deg,#f44336,#ef5350);color:#fff;font-weight:800;font-size:13px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center">4</span>
				<span style="font-weight:700;font-size:14px;color:var(--txt)">KNOCKOUT = ROUND OVER</span>
			</div>
			<p style="color:var(--dim);font-size:12px;line-height:1.6;margin:0">A <b style="color:var(--dng)">knockout blow</b> ends the round. If you haven't cashed out — <b style="color:var(--dng)">you lose your bet</b>.</p>
		</div>
	</div>
</div>
{/if}

<!-- Rules -->
{#if activeModal === 'rules'}
<div class="mo open" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
	<div class="mx" style="max-width:520px">
		<button class="mc" onclick={close}>✕</button>
		<div class="mt2">GAME RULES</div>
		<div class="ms" style="margin-top:12px">
			<p style="color:var(--dim);font-size:12px;line-height:1.8;margin:0">
				<b style="color:var(--txt)">1.</b> Each round, two fighters enter. Players have {$config.betTime}s to place bets.<br>
				<b style="color:var(--txt)">2.</b> After bets close, the fight begins and multiplier starts at 1.00x.<br>
				<b style="color:var(--txt)">3.</b> Cash out anytime to win bet x multiplier.<br>
				<b style="color:var(--txt)">4.</b> Knockout happens randomly — uncashed bets are lost.<br>
				<b style="color:var(--txt)">5.</b> Crash point is random each round. No pattern.<br>
				<b style="color:var(--txt)">6.</b> House edge applies to all bets.
			</p>
		</div>
	</div>
</div>
{/if}

<!-- Limits -->
{#if activeModal === 'limits'}
<div class="mo open" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
	<div class="mx" style="max-width:520px">
		<button class="mc" onclick={close}>✕</button>
		<div class="mt2">GAME LIMITS</div>
		<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
			<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
				<div style="font-size:9px;color:var(--dim);letter-spacing:1px;margin-bottom:4px">MIN BET</div>
				<div style="font-family:'Oxanium',sans-serif;font-size:20px;font-weight:800;color:var(--acc)">${$config.betMin}</div>
			</div>
			<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
				<div style="font-size:9px;color:var(--dim);letter-spacing:1px;margin-bottom:4px">MAX BET</div>
				<div style="font-family:'Oxanium',sans-serif;font-size:20px;font-weight:800;color:var(--wrn)">${$config.betMax}</div>
			</div>
			<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
				<div style="font-size:9px;color:var(--dim);letter-spacing:1px;margin-bottom:4px">MAX WIN</div>
				<div style="font-family:'Oxanium',sans-serif;font-size:20px;font-weight:800;color:var(--gld)">${$config.winCap.toLocaleString()}</div>
			</div>
			<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
				<div style="font-size:9px;color:var(--dim);letter-spacing:1px;margin-bottom:4px">BET SLOTS</div>
				<div style="font-family:'Oxanium',sans-serif;font-size:20px;font-weight:800;color:#00ccff">2</div>
			</div>
		</div>
	</div>
</div>
{/if}

<!-- Bet History -->
{#if activeModal === 'history'}
<div class="mo open" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
	<div class="mx" style="max-width:560px">
		<button class="mc" onclick={close}>✕</button>
		<div class="mt2">MY BET HISTORY</div>
		{#if $game.betHistory.length === 0}
			<div style="text-align:center;padding:30px 0;color:var(--dim);font-size:12px">No bets yet. Place your first bet!</div>
		{:else}
			{@const wins = $game.betHistory.filter(h => h.win > 0).length}
			{@const losses = $game.betHistory.filter(h => h.win === 0).length}
			<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 8px">
				<div style="display:flex;gap:12px">
					<div style="text-align:center"><div style="font-size:16px;font-weight:800;color:var(--acc)">{wins}</div><div style="font-size:8px;color:var(--dim)">WINS</div></div>
					<div style="text-align:center"><div style="font-size:16px;font-weight:800;color:var(--dng)">{losses}</div><div style="font-size:8px;color:var(--dim)">LOSSES</div></div>
				</div>
				<div style="text-align:right">
					<div style="font-size:16px;font-weight:800;color:{$game.totP >= 0 ? 'var(--acc)' : 'var(--dng)'}">{$game.totP >= 0 ? '+' : ''}${$game.totP.toFixed(2)}</div>
					<div style="font-size:8px;color:var(--dim)">TOTAL PROFIT</div>
				</div>
			</div>
			<div style="max-height:45dvh;overflow-y:auto">
				{#each $game.betHistory as h}
					{@const won = h.win > 0}
					<div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:11px;align-items:center">
						<span style="color:var(--dim);font-size:10px">#{h.round}</span>
						<span style="font-weight:600">${h.bet.toFixed(2)}</span>
						<span style="font-weight:700;color:{h.mult < 2 ? 'var(--dng)' : h.mult < 5 ? 'var(--wrn)' : 'var(--acc)'}">{h.mult.toFixed(2)}x</span>
						<span style="text-align:right;font-weight:700;color:{won ? 'var(--acc)' : 'var(--dng)'}">{won ? '+$' + h.win.toFixed(2) : '-$' + h.bet.toFixed(2)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
{/if}

<!-- Terms -->
{#if activeModal === 'terms'}
<div class="mo open" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
	<div class="mx" style="max-width:560px">
		<button class="mc" onclick={close}>✕</button>
		<div class="mt2">TERMS & CONDITIONS</div>
		<div class="ms"><h4>1. GENERAL</h4><p>MMA is a multiplayer crash-style entertainment game.</p></div>
		<div class="ms"><h4>2. ELIGIBILITY</h4><p>You must be at least 18 years of age to participate.</p></div>
		<div class="ms"><h4>3. GAME MECHANICS</h4><p>Each round, a fight begins with a rising multiplier. The knockout is determined by a provably fair algorithm.</p></div>
		<div class="ms"><h4>4. BETTING LIMITS</h4><p>Min: ${$config.betMin} | Max: ${$config.betMax} | Win cap: ${$config.winCap.toLocaleString()}</p></div>
		<div class="ms"><h4>5. RESPONSIBLE GAMING</h4><p>Never bet more than you can afford to lose.</p></div>
	</div>
</div>
{/if}

<!-- Round Info -->
{#if selectedRound}
<div class="mo open" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
	<div class="mx" style="max-width:480px">
		<button class="mc" onclick={close}>✕</button>
		<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
			<div style="font-family:'Oxanium',sans-serif;font-size:16px;font-weight:800;color:var(--txt)">ROUND {selectedRound.round}</div>
			<div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;padding:3px 10px;border-radius:5px;background:{selectedRound.v >= 5 ? 'rgba(76,175,80,.15)' : selectedRound.v >= 1.5 ? 'rgba(255,170,0,.12)' : 'rgba(255,34,85,.12)'};color:{selectedRound.v >= 5 ? 'var(--acc)' : selectedRound.v >= 1.5 ? 'var(--wrn)' : 'var(--dng)'}">
				{selectedRound.v.toFixed(2)}x
			</div>
			<div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dim)">{selectedRound.time}</div>
		</div>
		<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
			<div style="font-size:12px;font-weight:700;color:var(--txt)">Server Seed:</div>
			<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--acc);background:rgba(0,0,0,.3);padding:10px;border-radius:6px;word-break:break-all;margin-top:6px">{selectedRound.serverSeed}</div>
		</div>
		<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
			<div style="font-size:12px;font-weight:700;color:var(--txt)">SHA512 Hash:</div>
			<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--wrn);background:rgba(0,0,0,.3);padding:10px;border-radius:6px;word-break:break-all;margin-top:6px">{selectedRound.hash}</div>
		</div>
		<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
			<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
				<div style="font-size:8px;color:var(--dim)">HEX</div>
				<div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700">{selectedRound.hash.substring(0, 12)}</div>
			</div>
			<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
				<div style="font-size:8px;color:var(--dim)">DECIMAL</div>
				<div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700">{parseInt(selectedRound.hash.substring(0, 12), 16)}</div>
			</div>
			<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
				<div style="font-size:8px;color:var(--dim)">RESULT</div>
				<div style="font-family:'Oxanium',sans-serif;font-size:14px;font-weight:800;color:{selectedRound.v >= 5 ? 'var(--acc)' : selectedRound.v >= 1.5 ? 'var(--wrn)' : 'var(--dng)'}">{selectedRound.v.toFixed(2)}</div>
			</div>
		</div>
	</div>
</div>
{/if}
