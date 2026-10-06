import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { SLUG_RE } from '../src/sdk/slug.ts';

type BakeModule = typeof import('../src/sdk/bake.ts');
type DioramaModule = { default: import('../src/sdk/schema.ts').Diorama };

/** `/<slug>.vxb[?…]` → slug (после того как middleware срезал префикс /baked). */
export function parseBakedPath(url: string): string | null {
	const match = /^\/([^/?]+)\.vxb(?:\?.*)?$/.exec(url);
	const slug = match?.[1];
	return slug && SLUG_RE.test(slug) ? slug : null;
}

/** Какую диораму затронуло изменение файла: slug, '*' (всё SDK) или null. */
export function slugFromChangedFile(root: string, file: string): string | null {
	const rel = relative(root, file).split(sep).join('/');
	const match = /^src\/dioramas\/([^/]+)\//.exec(rel);
	if (match?.[1]) return match[1];
	if (rel.startsWith('src/sdk/')) return '*';
	return null;
}

/** Затрагивает ли изменение файла результат запекания (SDK, движок или сама диорама). */
export function affectsBake(root: string, file: string): boolean {
	const rel = relative(root, file).split(sep).join('/');
	return (
		rel.startsWith('src/sdk/') || rel.startsWith('src/engine/') || rel.startsWith('src/dioramas/')
	);
}

/** Dev: запекание диорам на лету и HMR-событие `diorama:update`. */
export function dioramaDev(): Plugin {
	return {
		name: 'diorama-dev',
		apply: 'serve',
		configureServer(server) {
			const cache = new Map<string, { source: unknown; bytes: Uint8Array }>();

			server.middlewares.use('/baked', async (req, res, next) => {
				const slug = parseBakedPath(req.url ?? '');
				if (!slug) return next();
				const entry = `/src/dioramas/${slug}/index.ts`;
				if (!existsSync(join(server.config.root, entry))) {
					res.statusCode = 404;
					res.end(`диорама "${slug}" не найдена`);
					return;
				}
				try {
					const mod = (await server.ssrLoadModule(entry)) as DioramaModule;
					let hit = cache.get(slug);
					if (!hit || hit.source !== mod.default) {
						const { bakeToVxb } = (await server.ssrLoadModule('/src/sdk/bake.ts')) as BakeModule;
						const { bytes } = await bakeToVxb(mod.default);
						hit = { source: mod.default, bytes };
						cache.set(slug, hit);
					}
					res.setHeader('Content-Type', 'application/octet-stream');
					res.setHeader('Content-Length', String(hit.bytes.length));
					res.setHeader('Cache-Control', 'no-store');
					res.end(hit.bytes);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					server.config.logger.error(`[diorama-dev] ${slug}: ${message}`);
					res.statusCode = 500;
					res.setHeader('Content-Type', 'text/plain; charset=utf-8');
					res.end(message);
				}
			});

			// SDK/движок не входят в SSR-граф диорамы напрямую (она импортирует их лениво через
			// ssrLoadModule в обработчике /baked), поэтому Vite не инвалидирует их сам при HMR —
			// без этого правок кэш и ssrLoadModule продолжали бы отдавать старый код/байты.
			const invalidateBake = (file: string): void => {
				if (!affectsBake(server.config.root, file)) return;
				cache.clear();
				server.environments.ssr.moduleGraph.invalidateAll();
			};
			server.watcher.on('add', invalidateBake);
			server.watcher.on('unlink', invalidateBake);
			server.watcher.on('change', (file) => {
				invalidateBake(file);
				const slug = slugFromChangedFile(server.config.root, file);
				if (slug) server.ws.send({ type: 'custom', event: 'diorama:update', data: { slug } });
			});
		},
	};
}
