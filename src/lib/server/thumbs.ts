import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** URL скриншота с версией по mtime (чтобы браузер не держал старую картинку) или null. */
export function thumbUrl(slug: string, staticDir = 'static'): string | null {
	const file = join(staticDir, 'thumbs', `${slug}.webp`);
	if (!existsSync(file)) return null;
	return `/thumbs/${slug}.webp?v=${Math.round(statSync(file).mtimeMs)}`;
}
