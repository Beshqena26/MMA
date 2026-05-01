<script lang="ts">
	import { chatMessages, chatOpen, mobileChatOpen, sendChat, EMOJI_DATA, GIF_STICKERS, GIPHY_KEY, sendGif, type ChatMessage } from '$lib/stores/chat.js';

	let inputText = $state('');
	let pickerOpen = $state(false);
	let pickerMode: 'emoji' | 'gif' = $state('emoji');
	let searchFilter = $state('');
	let gifs: any[] = $state([]);
	let gifDebounce: ReturnType<typeof setTimeout>;
	let chatEl: HTMLDivElement;

	function handleSend() {
		if (!inputText.trim()) return;
		sendChat(inputText);
		inputText = '';
		pickerOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSend();
		}
	}

	function insertEmoji(emoji: string) {
		inputText += emoji;
	}

	function handleGifClick(gifData: string) {
		sendGif(gifData);
		pickerOpen = false;
	}

	function fetchGiphy(query: string) {
		const url = query
			? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=21&rating=g&lang=en`
			: `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=21&rating=g`;
		fetch(url).then(r => r.json()).then(res => {
			gifs = res.data || [];
		}).catch(() => { gifs = []; });
	}

	function handleSearchInput() {
		if (pickerMode === 'gif' && GIPHY_KEY) {
			clearTimeout(gifDebounce);
			gifDebounce = setTimeout(() => fetchGiphy(searchFilter), 400);
		}
	}

	function togglePicker(mode?: 'emoji' | 'gif') {
		if (mode) pickerMode = mode;
		pickerOpen = !pickerOpen;
		if (pickerOpen && pickerMode === 'gif' && GIPHY_KEY) {
			fetchGiphy('');
		}
	}

	function isGifMsg(text: string) { return text.startsWith('__GIF__'); }
	function getGifContent(text: string) { return text.slice(7); }

	$effect(() => {
		if (chatEl && $chatMessages) {
			setTimeout(() => {
				if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
			}, 50);
		}
	});

	let { desktop = false }: { desktop?: boolean } = $props();
</script>

<div class="chat-panel-head">💬 CHAT</div>
<div class="chat-messages" bind:this={chatEl}>
	{#each $chatMessages as msg}
		<div class="chat-msg">
			<div class="chat-av" style="background:{msg.bg}">{msg.avatar}</div>
			<div class="chat-body">
				<div class="chat-name" class:me={msg.isMe}>{msg.name}</div>
				{#if isGifMsg(msg.text)}
					{@const content = getGifContent(msg.text)}
					{#if content.startsWith('http')}
						<div class="chat-gif-msg"><img src={content} alt="GIF" loading="lazy"></div>
					{:else}
						<div class="chat-gif-msg">{content}</div>
					{/if}
				{:else}
					<div class="chat-text">{msg.text}</div>
				{/if}
				<div class="chat-time">{msg.time}</div>
			</div>
		</div>
	{/each}
</div>

{#if pickerOpen}
	<div class="chat-picker open">
		<div class="picker-tabs">
			<button class="picker-tab" class:active={pickerMode === 'emoji'} onclick={() => { pickerMode = 'emoji'; searchFilter = ''; }}>😀 Emoji</button>
			<button class="picker-tab" class:active={pickerMode === 'gif'} onclick={() => { pickerMode = 'gif'; searchFilter = ''; if (GIPHY_KEY) fetchGiphy(''); }}>GIF</button>
		</div>
		<div class="picker-search">
			<input type="text" class="picker-search-input" placeholder="Search..." bind:value={searchFilter} oninput={handleSearchInput} autocomplete="off">
		</div>
		<div class="picker-grid" class:gif-mode={pickerMode === 'gif'}>
			{#if pickerMode === 'emoji'}
				{#each Object.entries(EMOJI_DATA) as [cat, emojis]}
					{#if !searchFilter || cat.toLowerCase().includes(searchFilter.toLowerCase())}
						<div style="grid-column:1/-1;font-size:9px;color:var(--dim);font-weight:700;letter-spacing:1px;padding:4px 0 2px">{cat.toUpperCase()}</div>
						{#each emojis as em}
							<button class="picker-item" onclick={() => insertEmoji(em)}>{em}</button>
						{/each}
					{/if}
				{/each}
			{:else if GIPHY_KEY && gifs.length > 0}
				{#each gifs as gif}
					<button class="picker-gif-real" onclick={() => handleGifClick(gif.images.fixed_height.url)}>
						<img src={gif.images.fixed_width_small.url} alt={gif.title || ''} loading="lazy">
					</button>
				{/each}
			{:else}
				{#each GIF_STICKERS as g}
					{#if !searchFilter || g.label.toLowerCase().includes(searchFilter.toLowerCase())}
						<button class="picker-gif" onclick={() => handleGifClick(g.emoji)}>
							<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
								<span style="font-size:28px">{g.emoji}</span>
								<span style="font-size:8px;color:var(--dim);letter-spacing:.5px">{g.label}</span>
							</div>
						</button>
					{/if}
				{/each}
			{/if}
		</div>
	</div>
{/if}

<div class="chat-input-row">
	<button class="chat-icon-btn" onclick={() => togglePicker('emoji')} title="Emoji">😀</button>
	<button class="chat-icon-btn" onclick={() => togglePicker('gif')} title="GIF">GIF</button>
	<input type="text" class="chat-input" placeholder="Type a message..." maxlength="120" autocomplete="off"
		bind:value={inputText} onkeydown={handleKeydown}>
	<button class="chat-send-btn" onclick={handleSend}>➤</button>
</div>
