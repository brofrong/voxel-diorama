import type { Diorama } from '#sdk';

const loaders = import.meta.glob<{ default: Diorama }>('../../dioramas/*/index.ts');

// Правка файла диорамы не должна перемонтировать Viewer через Svelte HMR: обновление
// останавливается здесь, а мир и сущности перезагружает сам Viewer по событию diorama:update.
if (import.meta.hot) import.meta.hot.accept();

/** Лениво грузит модуль диорамы (отдельный чанк). В dev `fresh` обходит кэш модулей. */
export async function loadDioramaModule(slug: string, fresh = false): Promise<Diorama> {
	if (fresh && import.meta.env.DEV) {
		const url = `/src/dioramas/${slug}/index.ts?t=${Date.now()}`;
		const mod = (await import(/* @vite-ignore */ url)) as { default: Diorama };
		return mod.default;
	}
	const load = loaders[`../../dioramas/${slug}/index.ts`];
	if (!load) throw new Error(`диорама "${slug}" не найдена`);
	return (await load()).default;
}
