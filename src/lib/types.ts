import type { SceneConfig } from '#engine';

export interface CardData {
	slug: string;
	title: string;
	createdAt: string;
	/** Какая ИИ сделала диораму, одной строкой. */
	author: string;
	/** Кто запускал модель: имя и ссылка на профиль. */
	launchedBy: { name: string; url: string };
	description: string;
	tags: string[];
	/** URL скриншота или null, если его ещё нет. */
	thumb: string | null;
	/** Путь запечённого мира (без base), с версией по содержимому после bake-all. */
	world: string;
}

export interface ViewerPayload {
	card: CardData;
	scene: SceneConfig;
}
