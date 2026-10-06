/** slug диорамы = имя папки = часть URL `/d/<slug>`. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `…/dioramas/<slug>/index.ts` → `<slug>`; для остальных путей — null. */
export function slugFromDioramaPath(path: string): string | null {
	const match = /\/dioramas\/([^/]+)\/index\.ts$/.exec(path);
	return match?.[1] ?? null;
}
