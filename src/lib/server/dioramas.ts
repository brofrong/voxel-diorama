import { type Diorama, slugFromDioramaPath, toSceneConfig } from '#sdk';
import type { CardData, ViewerPayload } from '../types.ts';
import { thumbUrl } from './thumbs.ts';

const modules = import.meta.glob<{ default: Diorama }>('../../dioramas/*/index.ts', {
	eager: true,
});

/** Все диорамы, новые сверху. */
export const dioramas: Array<{ slug: string; diorama: Diorama }> = Object.entries(modules)
	.flatMap(([path, mod]) => {
		const slug = slugFromDioramaPath(path);
		return slug ? [{ slug, diorama: mod.default }] : [];
	})
	.sort(
		(a, b) =>
			b.diorama.meta.createdAt.localeCompare(a.diorama.meta.createdAt) ||
			a.diorama.meta.title.localeCompare(b.diorama.meta.title, 'ru'),
	);

function toCard(slug: string, d: Diorama): CardData {
	return {
		slug,
		title: d.meta.title,
		createdAt: d.meta.createdAt,
		description: d.meta.description,
		tags: d.meta.tags,
		thumb: thumbUrl(slug),
	};
}

export function listCards(): CardData[] {
	return dioramas.map(({ slug, diorama }) => toCard(slug, diorama));
}

export function getViewerPayload(slug: string): ViewerPayload | null {
	const entry = dioramas.find((e) => e.slug === slug);
	return entry
		? { card: toCard(entry.slug, entry.diorama), scene: toSceneConfig(entry.diorama) }
		: null;
}
