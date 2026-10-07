import { join } from 'node:path';
import { contentVersion } from './version.ts';

/** Путь скриншота (без base) с версией по содержимому или null. */
export function thumbUrl(slug: string, staticDir = 'static'): string | null {
	const v = contentVersion(join(staticDir, 'thumbs', `${slug}.webp`));
	return v ? `/thumbs/${slug}.webp?v=${v}` : null;
}

/** Путь запечённого мира (без base): при сборке — с версией, в dev — без (печётся на лету). */
export function worldPath(slug: string, staticDir = 'static'): string {
	const v = contentVersion(join(staticDir, 'baked', `${slug}.vxb`));
	return v ? `/baked/${slug}.vxb?v=${v}` : `/baked/${slug}.vxb`;
}
