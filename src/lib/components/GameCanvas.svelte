<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { game, gameView } from '$lib/stores/game.js';
	import { loadImages, renderSceneImages, initFighterState, updateFighters } from '$lib/canvas/scene-images.js';
	import { loadSideAssets, renderSideView, updateSideView } from '$lib/canvas/scene-side.js';

	let canvas: HTMLCanvasElement;
	let animId: number;

	function resize() {
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function render() {
		if (!canvas) return;
		const g = $game;

		if ($gameView === 'side') {
			updateSideView(g);
			renderSideView(canvas, g);
		} else {
			updateFighters(g);
			renderSceneImages(canvas, g);
		}

		animId = requestAnimationFrame(render);
	}

	onMount(() => {
		loadImages();
		loadSideAssets();
		resize();
		window.addEventListener('resize', resize);
		// Init fighter state
		game.update((g) => {
			initFighterState(g);
			return g;
		});
		animId = requestAnimationFrame(render);
	});

	onDestroy(() => {
		if (animId) cancelAnimationFrame(animId);
		if (typeof window !== 'undefined') window.removeEventListener('resize', resize);
	});
</script>

<canvas bind:this={canvas} id="c" aria-label="Game visualization"></canvas>

<style>
	canvas {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1;
	}
</style>
