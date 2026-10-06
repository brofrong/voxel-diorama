<script lang="ts">
	import DioramaCard from '#lib/components/DioramaCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Воксельные диорамы</title>
	<meta name="description" content="Галерея воксельных диорам — открой любую и покрути в 3D" />
</svelte:head>

<main>
	<header>
		<h1>Воксельные диорамы</h1>
		<p>Маленькие миры из кубиков — открой любой и покрути в 3D.</p>
	</header>

	{#if data.cards.length === 0}
		<p class="empty">Пока ни одной диорамы.</p>
	{:else}
		<ul class="grid">
			{#each data.cards as card (card.slug)}
				<li><DioramaCard {card} /></li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 48px 20px 80px;
	}
	h1 {
		font-size: clamp(28px, 5vw, 44px);
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}
	header p {
		color: var(--muted);
		margin: 0 0 36px;
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 20px;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}
	.empty {
		color: var(--muted);
	}
</style>
