<!-- Bookmarklet gallery: discovers each bookmarklets/**/*.js from GitHub, previews it as a miniature of its in-page tool window, and offers a compiled drag-to-install button. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { generateBookmarklet } from '$lib/generator';

	interface Bookmarklet {
		path: string;
		platformLabel: string;
		title: string;
		desc: string;
		tabs: string[];
		href: string;
		loading: boolean;
	}

	const REPO = 'NotAlex-Tooling/bookmarklets';
	const BRANCH = 'main';
	const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/bookmarklets`;
	const API_TREE = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
	const SOURCE_URL = `https://github.com/${REPO}`;

	const PLATFORM_LABEL: Record<string, string> = {
		instagram: 'Instagram',
		facebook: 'Facebook',
		x: 'X',
		youtube: 'YouTube'
	};

	let bookmarklets = $state<Bookmarklet[]>([]);
	let search = $state('');
	let showModal = $state(false);
	let theme = $state<'light' | 'dark'>('light');

	// Extracts the // title: "..." value from a bookmarklet source file.
	function parseTitle(src: string): string {
		return src.match(/\/\/\s*title:\s*"([^"]+)"/)?.[1] || '';
	}

	// Extracts the // description: "..." value from a bookmarklet source file.
	function parseDesc(src: string): string {
		return src.match(/\/\/\s*description:\s*"([^"]+)"/)?.[1] || '';
	}

	// Extracts up to six tab labels from any label:'X' occurrences in the bookmarklet source.
	function parseTabs(src: string): string[] {
		const seen = new Set<string>();
		const out: string[] = [];
		const re = /label:\s*['"]([A-Z][A-Za-z ]{0,14})['"]/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(src)) !== null) {
			const t = m[1].trim();
			const k = t.toLowerCase();
			if (!seen.has(k)) {
				seen.add(k);
				out.push(t);
			}
			if (out.length >= 6) break;
		}
		return out;
	}

	// Returns a stable sort weight for a path so platforms appear in PLATFORM_LABEL order.
	function sortIndex(p: string): number {
		const folder = p.split('/')[0];
		const i = Object.keys(PLATFORM_LABEL).indexOf(folder);
		return i < 0 ? 999 : i;
	}

	// Fetches the GitHub tree manifest and validates it has the expected shape.
	async function fetchManifest(): Promise<{ tree: Array<{ path: string; type: string }> }> {
		const res = await fetch(API_TREE);
		if (!res.ok) throw new Error(`${API_TREE} → HTTP ${res.status}`);
		const json = await res.json();
		if (!json || !Array.isArray(json.tree)) throw new Error(`${API_TREE} → unexpected payload`);
		return json;
	}

	// Fetches the bookmarklet manifest, builds placeholder cards, then loads each source.
	async function discover() {
		const tree = await fetchManifest();
		const paths: string[] = [];
		for (const item of tree.tree) {
			if (item.type !== 'blob') continue;
			if (!item.path.startsWith('bookmarklets/')) continue;
			if (!item.path.endsWith('.js')) continue;
			const rel = item.path.replace('bookmarklets/', '');
			if (rel.startsWith('_')) continue;
			if (rel.split('/').length !== 2) continue;
			paths.push(rel);
		}
		paths.sort((a, b) => {
			const ia = sortIndex(a),
				ib = sortIndex(b);
			return ia !== ib ? ia - ib : a.localeCompare(b);
		});

		bookmarklets = paths.map((p) => ({
			path: p,
			platformLabel: PLATFORM_LABEL[p.split('/')[0]] || p.split('/')[0],
			title: '',
			desc: '',
			tabs: [],
			href: '#',
			loading: true
		}));

		await Promise.all(bookmarklets.map(loadOne));
	}

	// Fetches one bookmarklet's source, parses metadata, and compiles its javascript: URI.
	async function loadOne(b: Bookmarklet) {
		try {
			const res = await fetch(`${RAW_BASE}/${b.path}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const src = await res.text();
			b.title = parseTitle(src) || b.path;
			b.desc = parseDesc(src);
			b.tabs = parseTabs(src);
			b.href = await generateBookmarklet(src);
		} catch {
			b.title = b.path;
			b.desc = 'Failed to load.';
		}
		b.loading = false;
		bookmarklets = bookmarklets;
	}

	// True when the bookmarklet matches the current search query.
	function matchesSearch(b: Bookmarklet) {
		if (!search) return true;
		const q = search.toLowerCase();
		return `${b.title} ${b.desc} ${b.platformLabel}`.toLowerCase().includes(q);
	}

	// Applies a theme to the document, syncs local state, and persists the choice.
	function setTheme(next: 'light' | 'dark') {
		theme = next;
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem('theme', next);
		} catch {}
	}

	// Toggles between the light and dark themes.
	function toggleTheme() {
		setTheme(theme === 'dark' ? 'light' : 'dark');
	}

	// Closes the install modal when Escape is pressed.
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') showModal = false;
	}

	const filtered = $derived(bookmarklets.filter(matchesSearch));

	onMount(() => {
		theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		discover();
	});
</script>

<svelte:head>
	<title>OSINT Bookmarklets</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div class="page">
	<div class="wrap">
		<header>
			<div class="brand-row">
				<img class="logo" src="/logo.png" alt="" width="34" height="24" />
				<div class="title-stack">
					<div class="brand">
						<span class="dot"></span>
						<span class="brand-name">OSINT Bookmarklets</span>
					</div>
					<span class="byline">
						by <a href="https://notalex.sh/" target="_blank" rel="noopener">notalex.sh</a>
					</span>
				</div>
			</div>

			<div class="actions">
				<button class="btn" onclick={() => (showModal = true)}>How to install</button>
				<a class="btn" href="https://markletsmith.notalex.sh/" target="_blank" rel="noopener">
					Make your own
				</a>
				<button
					class="btn btn-icon"
					onclick={toggleTheme}
					aria-label="Switch to {theme === 'dark' ? 'light' : 'dark'} mode"
					title="Switch to {theme === 'dark' ? 'light' : 'dark'} mode"
				>
					{#if theme === 'dark'}
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<circle cx="12" cy="12" r="4" />
							<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
						</svg>
					{/if}
				</button>
			</div>
		</header>

		<div class="notice">
			<span class="marker">▸</span>
			<div>
				<div class="notice-head">Work in progress</div>
				<p class="notice-body">
					These bookmarklets are being revamped to simplify the work required for operators.
				</p>
			</div>
		</div>

		<input
			type="text"
			bind:value={search}
			placeholder="Search bookmarklets…"
			class="search"
			autocomplete="off"
			spellcheck="false"
		/>

		<main>
			{#each filtered as b, i (b.path)}
				<article class="win" class:loading={b.loading} style="--i: {Math.min(i, 14)}">
					<div class="win-bar">
						<span class="win-dot"></span>
						<div class="win-title-stack">
							<div class="win-title">{b.title || '…'}</div>
							<div class="win-ctx">{b.platformLabel.toLowerCase()}</div>
						</div>
						<span class="win-x">×</span>
					</div>

					{#if b.tabs.length}
						<div class="win-tabs">
							{#each b.tabs as t, ti}
								<span class="win-tab" class:active={ti === 0}>{t}</span>
							{/each}
						</div>
					{/if}

					<div class="win-body">
						<div class="win-section">
							<span class="marker">▸</span>
							<span class="win-section-label">About</span>
							<span class="win-rule"></span>
						</div>

						<p class="win-desc">{b.desc || ' '}</p>

						<div class="win-foot">
							{#if b.loading}
								<span class="drag drag-loading">compiling…</span>
							{:else if b.href === '#'}
								<span class="drag drag-err">unavailable</span>
							{:else}
								<a class="drag" href={b.href} draggable="true" title="Drag to your bookmarks bar">
									{b.title}
								</a>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</main>

		<footer class="site-foot">
			<a href="https://github.com/NotAlex-Tooling/" target="_blank" rel="noopener">Tooling by NotAlex</a>
			<span class="sep">·</span>
			<a href={SOURCE_URL} target="_blank" rel="noopener">source code</a>
		</footer>
	</div>
</div>

{#if showModal}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={(e) => {
			if (e.target === e.currentTarget) showModal = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') showModal = false;
		}}
	>
		<div class="modal">
			<div class="modal-head">
				<span class="modal-title">How to install</span>
				<button class="modal-close" onclick={() => (showModal = false)} aria-label="Close">×</button>
			</div>
			<ol class="modal-list">
				<li><span class="modal-step">1.</span> Show your bookmarks bar (<kbd>⌘⇧B</kbd> / <kbd>Ctrl+Shift+B</kbd>)</li>
				<li><span class="modal-step">2.</span> Drag any card's named button (e.g. <span class="hl">Instagram Profile OSINT</span>) onto the bar</li>
				<li><span class="modal-step">3.</span> Open the target site and click the bookmarklet</li>
			</ol>
			<p class="modal-note">If a bookmarklet returns outdated results, refresh and try again.</p>
			<button class="btn btn-block" onclick={() => (showModal = false)}>Got it</button>
		</div>
	</div>
{/if}

<style>
	:global(:root) {
		--bg: #f4f6f9;
		--bg-grad: radial-gradient(1200px 600px at 50% -12%, #eaeff5 0%, #f4f6f9 58%);
		--fg: #161a20;
		--fg-strong: #0b0d10;
		--fg-muted: #5a626d;
		--fg-dim: #8b93a0;
		--surface: #ffffff;
		--surface-2: #eef2f7;
		--border: #e2e7ee;
		--border-strong: #d3dae3;
		--accent: #0e9f6e;
		--accent-glow: rgba(16, 185, 129, 0.26);
		--accent-soft: rgba(16, 185, 129, 0.1);
		--ring: rgba(16, 185, 129, 0.32);
		--shadow-card: 0 1px 2px rgba(20, 28, 40, 0.05), 0 12px 32px rgba(20, 28, 40, 0.1);
		--shadow-hover: 0 2px 6px rgba(20, 28, 40, 0.08), 0 22px 54px rgba(20, 28, 40, 0.17);
		--glow-hover: 0 0 0 1px rgba(16, 185, 129, 0.22), 0 0 38px rgba(16, 185, 129, 0.16);
		--foot-border: #e2e7ee;
	}

	:global([data-theme='dark']) {
		--bg: #0a0a0c;
		--bg-grad: radial-gradient(1200px 700px at 50% -15%, rgba(52, 211, 153, 0.07), transparent 60%), #0a0a0c;
		--fg: #e8e8ec;
		--fg-strong: #ffffff;
		--fg-muted: #a0a0a7;
		--fg-dim: #6b7280;
		--surface: #131318;
		--surface-2: #1b1b22;
		--border: #232329;
		--border-strong: #30303a;
		--accent: #34d399;
		--accent-glow: rgba(52, 211, 153, 0.45);
		--accent-soft: rgba(52, 211, 153, 0.12);
		--ring: rgba(52, 211, 153, 0.3);
		--shadow-card: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 18px 50px rgba(0, 0, 0, 0.6);
		--shadow-hover: 0 0 0 1px rgba(0, 0, 0, 0.5), 0 26px 64px rgba(0, 0, 0, 0.72);
		--glow-hover: 0 0 0 1px rgba(52, 211, 153, 0.22), 0 0 46px rgba(52, 211, 153, 0.15);
		--foot-border: #1f1f25;
	}

	:global(html),
	:global(body) {
		background: var(--bg);
		margin: 0;
	}
	:global(body) {
		transition: background-color 0.45s ease, color 0.45s ease;
	}

	.page {
		min-height: 100vh;
		background: var(--bg-grad);
		color: var(--fg);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		font-size: 13px;
		-webkit-font-smoothing: antialiased;
		transition: background-color 0.45s ease, color 0.45s ease;
	}
	.wrap {
		max-width: 1120px;
		margin: 0 auto;
		padding: 56px 28px 40px;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 26px;
		animation: fadeDown 0.5s ease both;
	}
	.brand-row {
		display: flex;
		align-items: center;
		gap: 13px;
		min-width: 0;
	}
	.logo {
		height: 34px;
		width: auto;
		flex-shrink: 0;
		filter: drop-shadow(0 4px 12px var(--accent-glow));
	}
	.title-stack {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent-glow);
		animation: pulse 1.4s ease-in-out infinite alternate;
		flex-shrink: 0;
	}
	.brand-name {
		font-weight: 650;
		font-size: 19px;
		letter-spacing: -0.3px;
		color: var(--fg-strong);
		line-height: 1.1;
	}
	.byline {
		margin-top: 3px;
		color: var(--fg-muted);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11px;
	}
	.byline a {
		color: var(--accent);
		text-decoration: none;
	}
	.byline a:hover {
		text-decoration: underline;
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--fg);
		font-size: 12px;
		font-weight: 550;
		text-decoration: none;
		cursor: pointer;
		font-family: inherit;
		box-shadow: 0 1px 2px rgba(20, 28, 40, 0.04);
		transition: border-color 0.16s, color 0.16s, background 0.16s, box-shadow 0.16s, transform 0.16s;
	}
	.btn:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-soft);
		transform: translateY(-1px);
		box-shadow: 0 4px 14px var(--accent-glow);
	}
	.btn:active {
		transform: translateY(0);
	}
	.btn-icon {
		padding: 8px;
		width: 34px;
	}
	.btn-icon svg {
		transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.55, 1);
	}
	.btn-icon:hover svg {
		transform: rotate(35deg);
	}
	.btn-block {
		width: 100%;
		padding: 10px 14px;
	}

	.notice {
		display: flex;
		gap: 12px;
		padding: 15px 18px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		margin-bottom: 22px;
		position: relative;
		overflow: hidden;
		box-shadow: var(--shadow-card);
		animation: fadeUp 0.5s ease 0.05s both;
	}
	.notice::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: linear-gradient(to bottom, var(--accent), transparent);
	}
	.marker {
		color: var(--accent);
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-weight: 600;
		flex-shrink: 0;
	}
	.notice-head {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--fg-strong);
		margin-bottom: 5px;
	}
	.notice-body {
		color: var(--fg-muted);
		font-size: 12.5px;
		line-height: 1.6;
		max-width: 720px;
		margin: 0;
	}
	.hl {
		color: var(--fg-strong);
		font-weight: 600;
	}

	.search {
		width: 100%;
		box-sizing: border-box;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--fg);
		padding: 12px 16px;
		font-family: inherit;
		font-size: 13.5px;
		outline: none;
		margin-bottom: 22px;
		box-shadow: var(--shadow-card);
		transition: border-color 0.16s, box-shadow 0.16s;
		animation: fadeUp 0.5s ease 0.1s both;
	}
	.search::placeholder {
		color: var(--fg-dim);
	}
	.search:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 4px var(--ring), var(--shadow-card);
	}

	main {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
		gap: 16px;
	}

	.win {
		background: #0e0e12;
		border: 1px solid #20232b;
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-card);
		transition: transform 0.18s ease-out, box-shadow 0.18s;
		animation: cardIn 0.5s cubic-bezier(0.2, 0, 0, 1) both;
		animation-delay: calc(var(--i) * 45ms + 0.12s);
	}
	.win:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-hover), var(--glow-hover);
	}
	.win.loading {
		opacity: 0.65;
	}

	.win-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 13px;
		background: #08080b;
		border-bottom: 1px solid #1b1d24;
	}
	.win-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #34d399;
		box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
		animation: pulse 1.4s ease-in-out infinite alternate;
		flex-shrink: 0;
	}
	.win-title-stack {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.win-title {
		color: #ffffff;
		font-weight: 600;
		font-size: 12.5px;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.win-ctx {
		color: #34d399;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 9.5px;
		margin-top: 3px;
		letter-spacing: 0.3px;
	}
	.win-x {
		color: #5a5f68;
		font-size: 16px;
		line-height: 1;
		flex-shrink: 0;
	}

	.win-tabs {
		display: flex;
		padding: 0 6px;
		background: #08080b;
		border-bottom: 1px solid #1b1d24;
		overflow: hidden;
	}
	.win-tab {
		padding: 8px 9px;
		font-size: 10px;
		font-weight: 600;
		color: #5a5f68;
		letter-spacing: 0.3px;
		border-bottom: 2px solid transparent;
		white-space: nowrap;
	}
	.win-tab.active {
		color: #ffffff;
		border-bottom-color: #34d399;
	}

	.win-body {
		padding: 13px 15px 15px;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.win-section {
		display: flex;
		align-items: center;
		gap: 7px;
		padding-bottom: 7px;
		border-bottom: 1px solid #1b1d24;
		margin-bottom: 9px;
	}
	.win-section .marker {
		color: #34d399;
	}
	.win-section-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 1.1px;
		color: #e8e8ec;
	}
	.win-rule {
		flex: 1;
		height: 1px;
		background: linear-gradient(to right, #1b1d24, transparent);
	}
	.win-desc {
		color: #9aa0a8;
		font-size: 11.5px;
		line-height: 1.55;
		margin: 0 0 14px 0;
		flex: 1;
	}

	.win-foot {
		margin-top: auto;
	}
	.drag {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 7px 13px;
		background: #16161d;
		border: 1px solid #262630;
		border-radius: 7px;
		color: #e8e8ec;
		font-size: 11.5px;
		font-weight: 600;
		text-decoration: none;
		cursor: grab;
		transition: border-color 0.16s, background 0.16s, color 0.16s, box-shadow 0.16s;
		max-width: 100%;
	}
	.drag:hover {
		border-color: #34d399;
		color: #34d399;
		background: rgba(52, 211, 153, 0.1);
		box-shadow: 0 0 20px rgba(52, 211, 153, 0.22);
	}
	.drag-err {
		color: #ef4444;
		cursor: not-allowed;
	}
	.drag-loading {
		color: #5a5f68;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		cursor: progress;
	}

	.site-foot {
		margin-top: 48px;
		padding-top: 22px;
		border-top: 1px solid var(--foot-border);
		text-align: center;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 11.5px;
		color: var(--fg-dim);
	}
	.site-foot a {
		color: var(--fg-muted);
		text-decoration: none;
		transition: color 0.16s;
	}
	.site-foot a:hover {
		color: var(--accent);
	}
	.site-foot .sep {
		padding: 0 8px;
		color: var(--fg-dim);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(8, 10, 14, 0.55);
		backdrop-filter: blur(7px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 16px;
		animation: fadeIn 0.2s ease;
	}
	.modal {
		width: 100%;
		max-width: 460px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 24px;
		color: var(--fg);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
		animation: modalIn 0.26s cubic-bezier(0.34, 1.4, 0.55, 1);
	}
	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}
	.modal-title {
		font-size: 15px;
		font-weight: 650;
		color: var(--fg-strong);
	}
	.modal-close {
		background: none;
		border: none;
		color: var(--fg-muted);
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 6px;
	}
	.modal-close:hover {
		color: var(--fg-strong);
		background: var(--surface-2);
	}
	.modal-list {
		list-style: none;
		padding: 0;
		margin: 0 0 14px 0;
		font-size: 12.5px;
		line-height: 1.7;
		color: var(--fg-muted);
	}
	.modal-list li {
		padding: 4px 0;
	}
	.modal-step {
		color: var(--accent);
		font-weight: 700;
		margin-right: 6px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}
	.modal-list kbd {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--fg);
		padding: 1px 5px;
		border-radius: 4px;
		font-size: 10.5px;
	}
	.modal-note {
		color: var(--fg-dim);
		font-size: 11px;
		line-height: 1.55;
		margin: 0 0 16px 0;
	}

	@keyframes pulse {
		from {
			opacity: 1;
			transform: scale(1);
		}
		to {
			opacity: 0.5;
			transform: scale(0.78);
		}
	}
	@keyframes cardIn {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.99);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes fadeUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes fadeDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes modalIn {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		.win,
		.dot,
		.win-dot,
		header,
		.notice,
		.search {
			animation: none !important;
			transition: none !important;
		}
	}

	:global(::selection) {
		background: var(--accent-soft);
		color: var(--accent);
	}
</style>
