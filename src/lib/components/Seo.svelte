<script lang="ts">
	import { withBase } from '#lib/paths.ts';
	import { page } from '$app/state';

	interface Props {
		title: string;
		description: string;
		/** Путь картинки из static/ (без base) — для превью ссылки в соцсетях и мессенджерах. */
		image: string;
		imageAlt: string;
		imageWidth: number;
		imageHeight: number;
	}

	let p: Props = $props();

	const SITE_NAME = 'Voxel Dioramas';
	// База — page.url, а не origin: при prerender base относительный.
	const absolute = (path: string): string => new URL(path, page.url.href).href;
	const url = $derived(absolute(page.url.pathname));
	const image = $derived(absolute(withBase(p.image)));
</script>

<svelte:head>
	<title>{p.title}</title>
	<meta name="description" content={p.description} />
	<link rel="canonical" href={url} />
	<meta name="theme-color" content="#0e0f13" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:title" content={p.title} />
	<meta property="og:description" content={p.description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:alt" content={p.imageAlt} />
	<meta property="og:image:width" content={String(p.imageWidth)} />
	<meta property="og:image:height" content={String(p.imageHeight)} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={p.title} />
	<meta name="twitter:description" content={p.description} />
	<meta name="twitter:image" content={image} />
	<meta name="twitter:image:alt" content={p.imageAlt} />
</svelte:head>
