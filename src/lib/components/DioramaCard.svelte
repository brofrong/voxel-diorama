<script lang="ts">
	import { formatDate } from '#lib/format.ts';
	import type { CardData } from '#lib/types.ts';

	let { card }: { card: CardData } = $props();
</script>

<a class="card" href="/d/{card.slug}">
	<div class="thumb">
		{#if card.thumb}
			<img src={card.thumb} alt={card.title} loading="lazy" width="1200" height="800" />
		{:else}
			<div class="placeholder" aria-hidden="true"></div>
		{/if}
	</div>
	<div class="body">
		<h2>{card.title}</h2>
		<time datetime={card.createdAt}>{formatDate(card.createdAt)}</time>
		{#if card.tags.length > 0}
			<ul class="tags">
				{#each card.tags as tag (tag)}
					<li>{tag}</li>
				{/each}
			</ul>
		{/if}
	</div>
</a>

<style>
	.card {
		display: block;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}
	.card:hover {
		transform: translateY(-3px);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.35);
	}
	.thumb {
		aspect-ratio: 3 / 2;
		background: var(--surface-2);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.placeholder {
		width: 100%;
		height: 100%;
		background:
			linear-gradient(135deg, transparent 45%, rgb(242 184 75 / 0.25) 45% 55%, transparent 55%),
			var(--surface-2);
	}
	.body {
		padding: 14px 16px 16px;
	}
	h2 {
		font-size: 17px;
		margin: 0 0 4px;
	}
	time {
		color: var(--muted);
		font-size: 13px;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		list-style: none;
		padding: 0;
		margin: 10px 0 0;
	}
	.tags li {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
	}
</style>
