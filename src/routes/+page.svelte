<script lang="ts">
	import DioramaCard from '#lib/components/DioramaCard.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { GITHUB_URL } from '#lib/github.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="Voxel Dioramas — tiny 3D worlds built by AI"
	description="A gallery of voxel dioramas built by AI agents from short prompts. Explore cozy villages, neon cities and floating islands in 3D right in your browser — or make your own."
	image="/og.jpg"
	imageAlt="Voxel Dioramas — a collage of tiny voxel worlds"
	imageWidth={1200}
	imageHeight={630}
/>

<main>
	<SiteHeader />

	<section class="intro">
		<h1>Tiny worlds made of cubes</h1>
		<p>
			Every diorama here was built by an AI agent from a short prompt. Open one to explore it in 3D,
			or
			<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">make your own</a>
			and send a pull request.
		</p>
	</section>

	{#if data.cards.length === 0}
		<p class="empty">No dioramas yet.</p>
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
		padding: 20px 20px 80px;
	}
	h1 {
		font-size: clamp(28px, 5vw, 44px);
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}
	.intro p {
		max-width: 640px;
		color: var(--muted);
		margin: 0 0 36px;
		line-height: 1.5;
	}
	.intro a {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
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
