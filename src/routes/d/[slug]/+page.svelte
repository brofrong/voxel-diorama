<script lang="ts">
	import Viewer from '#lib/components/Viewer.svelte';
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ogImage = $derived(data.card.thumb ? new URL(data.card.thumb, page.url.origin).href : null);
</script>

<svelte:head>
	<title>{data.card.title} — Воксельные диорамы</title>
	<meta name="description" content={data.card.description || data.card.title} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={data.card.title} />
	<meta property="og:description" content={data.card.description || data.card.title} />
	<meta property="og:url" content={page.url.href} />
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
</svelte:head>

{#key data.card.slug}
	<Viewer card={data.card} scene={data.scene} />
{/key}
