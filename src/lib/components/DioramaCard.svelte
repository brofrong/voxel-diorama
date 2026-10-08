<script lang="ts">
	import { formatDate } from '#lib/format.ts';
	import { withBase } from '#lib/paths.ts';
	import type { CardData } from '#lib/types.ts';
	import { resolve } from '$app/paths';

	let { card }: { card: CardData } = $props();
</script>

<!-- Ссылка на диораму растянута на всю карточку через ::after; ссылка на профиль лежит поверх неё
     (вложенные <a> недопустимы). -->
<article class="card">
	<div class="thumb">
		{#if card.thumb}
			<img src={withBase(card.thumb)} alt={card.title} loading="lazy" width="1200" height="800" />
		{:else}
			<div class="placeholder" aria-hidden="true"></div>
		{/if}
	</div>
	<div class="body">
		<h2><a class="open" href={resolve('/d/[slug]', { slug: card.slug })}>{card.title}</a></h2>
		<time datetime={card.createdAt}>{formatDate(card.createdAt)}</time>
		<p class="author">Автор: {card.author}</p>
		<p class="author">
			Создал:
			<a class="profile" href={card.launchedBy.url} target="_blank" rel="noopener noreferrer"
				>{card.launchedBy.name}</a
			>
		</p>
		{#if card.tags.length > 0}
			<ul class="tags">
				{#each card.tags as tag (tag)}
					<li>{tag}</li>
				{/each}
			</ul>
		{/if}
	</div>
</article>

<style>
	.card {
		position: relative;
		display: block;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}
	.card:has(.open:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.open {
		color: inherit;
		text-decoration: none;
		outline: none;
	}
	.open::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.profile {
		position: relative;
		z-index: 1;
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.profile:hover {
		color: var(--accent);
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
	.author {
		margin: 4px 0 0;
		color: var(--muted);
		font-size: 12px;
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
