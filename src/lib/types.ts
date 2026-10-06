import type { SceneConfig } from '#engine';

export interface CardData {
	slug: string;
	title: string;
	createdAt: string;
	description: string;
	tags: string[];
	/** URL скриншота или null, если его ещё нет. */
	thumb: string | null;
}

export interface ViewerPayload {
	card: CardData;
	scene: SceneConfig;
}
