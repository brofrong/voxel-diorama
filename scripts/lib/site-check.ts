const ATTR_RE = /\b(?:href|src)="([^"]*)"/g;
const OG_IMAGE_RE = /<meta property="og:image" content="([^"]*)"/g;
const IMG_RE = /<img\b[^>]*\bsrc="([^"]*)"/g;

/** Пути от корня сайта (`/…`, не `//…`), не начинающиеся с base. */
export function findRootPaths(html: string, base: string): string[] {
	const out: string[] = [];
	for (const [, value] of html.matchAll(ATTR_RE)) {
		if (!value.startsWith('/') || value.startsWith('//')) continue;
		if (base && (value === base || value.startsWith(`${base}/`))) continue;
		if (!base) continue;
		out.push(value);
	}
	return out;
}

/** og:image, не начинающиеся с абсолютного адреса сайта `prefix` (origin + base + '/'). */
export function checkOgImages(html: string, prefix: string): string[] {
	return [...html.matchAll(OG_IMAGE_RE)].map((m) => m[1]).filter((v) => !v.startsWith(prefix));
}

export function expectedFiles(slugs: string[]): string[] {
	return ['index.html', ...slugs.flatMap((s) => [`d/${s}.html`, `baked/${s}.vxb`])];
}

export function imageSources(html: string): string[] {
	return [...html.matchAll(IMG_RE)].map((m) => m[1]);
}

export interface RetryOptions {
	attempts?: number;
	delayMs?: number;
	fetchFn?: (url: string) => Promise<Response>;
}

/** GET с повторами: Pages раскатывает деплой не мгновенно. */
export async function fetchWithRetry(url: string, opts: RetryOptions = {}): Promise<Response> {
	const { attempts = 12, delayMs = 5000, fetchFn = (u) => fetch(u) } = opts;
	let status = 0;
	for (let i = 0; i < attempts; i++) {
		try {
			const res = await fetchFn(url);
			if (res.ok) return res;
			status = res.status;
		} catch {
			status = 0;
		}
		if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
	}
	throw new Error(`${url} → ${status || 'нет ответа'} после ${attempts} попыток`);
}
