import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { SLUG_RE } from '../src/sdk/slug.ts';

export const THUMB_MAX_BYTES = 8 * 1024 * 1024;

/** `/<slug>[/]` → slug (после среза префикса /__dev/thumb). */
export function parseThumbPath(url: string): string | null {
	const match = /^\/([^/?]+)\/?(?:\?.*)?$/.exec(url);
	const slug = match?.[1];
	return slug && SLUG_RE.test(slug) ? slug : null;
}

export function isWebp(bytes: Uint8Array): boolean {
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
	return bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
}

/** Требуем кастомный заголовок, чтобы cross-site simple POST (без preflight) не прошёл. */
export function hasThumbHeader(value: string | string[] | undefined): boolean {
	return value === '1' || (Array.isArray(value) && value.includes('1'));
}

/** Dev: принимает скриншот диорамы и кладёт его в static/thumbs/<slug>.webp. */
export function thumbnailDev(): Plugin {
	return {
		name: 'thumbnail-dev',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__dev/thumb', async (req, res, next) => {
				if (req.method !== 'POST') return next();
				const reply = (status: number, body: object) => {
					res.statusCode = status;
					res.setHeader('Content-Type', 'application/json; charset=utf-8');
					res.end(JSON.stringify(body));
				};
				if (!hasThumbHeader(req.headers['x-diorama-thumb'])) {
					return reply(403, { ok: false, error: 'нужен заголовок X-Diorama-Thumb' });
				}
				const slug = parseThumbPath(req.url ?? '');
				if (!slug) return reply(400, { ok: false, error: 'некорректный slug' });
				const root = server.config.root;
				if (!existsSync(join(root, 'src/dioramas', slug, 'index.ts'))) {
					return reply(404, { ok: false, error: `диорама "${slug}" не найдена` });
				}
				const chunks: Buffer[] = [];
				let size = 0;
				for await (const chunk of req) {
					const buffer = Buffer.from(chunk as Uint8Array);
					size += buffer.length;
					if (size > THUMB_MAX_BYTES)
						return reply(413, { ok: false, error: 'слишком большой файл' });
					chunks.push(buffer);
				}
				const bytes = new Uint8Array(Buffer.concat(chunks));
				if (!isWebp(bytes)) return reply(415, { ok: false, error: 'ожидается image/webp' });
				const dir = join(root, 'static/thumbs');
				await mkdir(dir, { recursive: true });
				await writeFile(join(dir, `${slug}.webp`), bytes);
				reply(200, { ok: true, path: `static/thumbs/${slug}.webp`, bytes: bytes.length });
			});
		},
	};
}
