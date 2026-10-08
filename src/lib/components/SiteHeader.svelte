<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchStars } from '#lib/client/stars.ts';
	import { formatStars, GITHUB_URL } from '#lib/github.ts';
	import { resolve } from '$app/paths';

	let stars = $state<number | null>(null);

	onMount(() => {
		void fetchStars().then((count) => {
			stars = count;
		});
	});
</script>

<header class="site">
	<a class="brand" href={resolve('/')}>
		<span class="logo" aria-hidden="true"></span>
		Voxel Dioramas
	</a>
	<a class="github" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
		<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
			<path
				fill="currentColor"
				d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
			/>
		</svg>
		<span>GitHub</span>
		{#if stars !== null}
			<span class="stars"><span aria-hidden="true">★</span> {formatStars(stars)}<span class="sr-only"> stars</span></span>
		{/if}
	</a>
</header>

<style>
	.site {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 40px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		font-size: 17px;
		letter-spacing: -0.01em;
	}
	.logo {
		width: 22px;
		height: 22px;
		border-radius: 5px;
		background:
			linear-gradient(135deg, transparent 50%, rgb(0 0 0 / 0.25) 50%),
			var(--accent);
		box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2);
	}
	.github {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 10px;
		background: var(--surface-2);
		font-size: 14px;
		transition: background 0.15s ease;
	}
	.github:hover {
		background: #2a2e39;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.stars {
		padding-left: 8px;
		border-left: 1px solid rgb(255 255 255 / 0.12);
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
</style>
