/// <reference types="vite/client" />
// See https://svelte.dev/docs/kit/types#app.d.ts
import type { QualitySetting, SkyKind, TimeOfDay } from '#engine';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		/** Только в dev: хуки агента для скриншотов и проверки сцены. */
		__diorama?: {
			slug: string;
			setTime(time: TimeOfDay): void;
			setHour(hour: number): void;
			setSky(kind: SkyKind): void;
			setQuality(quality: QualitySetting): void;
			saveThumbnail(): Promise<{ ok: boolean; path?: string; bytes?: number; error?: string }>;
		};
	}
}
