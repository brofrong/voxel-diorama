<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import Viewer from '#lib/components/Viewer.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const card = $derived(data.card);
	const description = $derived(
		`${card.description ? card.description.replace(/\.?\s*$/, '.') : `${card.title}, a voxel diorama built by ${card.author}.`} Explore it in 3D right in your browser.`,
	);
</script>

<!-- Без своего скриншота — общая картинка сайта. -->
<Seo
	title="{card.title} — Voxel Dioramas"
	{description}
	image={card.thumb ?? '/og.jpg'}
	imageAlt={card.thumb ? `${card.title} — voxel diorama` : 'Voxel Dioramas'}
	imageWidth={1200}
	imageHeight={card.thumb ? 800 : 630}
/>

{#key card.slug}
	<Viewer {card} scene={data.scene} />
{/key}
