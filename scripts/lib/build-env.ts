const ORIGIN_RE = /^https?:\/\/[^/\s]+$/;
const BASE_RE = /^(\/[A-Za-z0-9._~-]+)+$/;

/** Проверяет переменные продакшен-сборки до запекания. Бросает понятную ошибку. */
export function checkBuildEnv(env: Record<string, string | undefined>): {
	origin: string;
	base: string;
} {
	const origin = env.SITE_ORIGIN;
	if (!origin) {
		throw new Error(
			'SITE_ORIGIN не задан — нужен для абсолютных og:image. Пример: SITE_ORIGIN=https://brofrong.github.io (локально: bun run build:local)',
		);
	}
	if (!ORIGIN_RE.test(origin)) {
		throw new Error(`SITE_ORIGIN="${origin}": ожидается http(s)://хост без пути и без / в конце`);
	}
	const base = env.BASE_PATH ?? '';
	if (base !== '' && !BASE_RE.test(base)) {
		throw new Error(
			`BASE_PATH="${base}": ожидается пусто или /сегмент без / в конце (например /voxel-diorama)`,
		);
	}
	return { origin, base };
}
