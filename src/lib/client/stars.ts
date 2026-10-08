import { GITHUB_REPO } from '../github.ts';

const CACHE_KEY = 'voxel-diorama:stars';
/** Без токена GitHub API даёт 60 запросов в час — кешируем на время сессии. */
const CACHE_MS = 10 * 60 * 1000;

/** Число звёзд репозитория; null — если API недоступен (лимит, офлайн). */
export async function fetchStars(): Promise<number | null> {
	try {
		const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null') as {
			count: number;
			at: number;
		} | null;
		if (cached && Date.now() - cached.at < CACHE_MS) return cached.count;
	} catch {
		// Нет доступа к хранилищу или мусор в нём — просто спросим API.
	}
	try {
		const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
			headers: { Accept: 'application/vnd.github+json' },
		});
		if (!response.ok) return null;
		const { stargazers_count: count } = (await response.json()) as { stargazers_count?: unknown };
		if (typeof count !== 'number') return null;
		try {
			sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, at: Date.now() }));
		} catch {
			// Кеш не сохранится — не страшно.
		}
		return count;
	} catch {
		return null;
	}
}
