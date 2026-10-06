export class LoadError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = 'LoadError';
	}
}

type Fetcher = (url: string) => Promise<Response>;

/** Скачивает файл целиком, сообщая прогресс 0..1 (если сервер прислал content-length). */
export async function fetchBytes(
	url: string,
	onProgress?: (progress: number) => void,
	fetchImpl: Fetcher = (u) => fetch(u),
): Promise<Uint8Array> {
	let response: Response;
	try {
		response = await fetchImpl(url);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new LoadError(`сеть недоступна: ${reason}`);
	}
	if (!response.ok) {
		throw new LoadError(`не удалось загрузить ${url}: HTTP ${response.status}`, response.status);
	}
	const total = Number(response.headers.get('content-length')) || 0;
	if (!response.body) {
		const bytes = new Uint8Array(await response.arrayBuffer());
		onProgress?.(1);
		return bytes;
	}
	const reader = response.body.getReader();
	const parts: Uint8Array[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		received += value.length;
		if (total > 0) onProgress?.(Math.min(1, received / total));
	}
	const out = new Uint8Array(received);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	onProgress?.(1);
	return out;
}
