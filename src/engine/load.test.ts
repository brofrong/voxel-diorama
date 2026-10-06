import { describe, expect, test } from 'bun:test';
import { fetchBytes, LoadError } from './load.ts';

describe('fetchBytes', () => {
	test('возвращает байты и доводит прогресс до 1', async () => {
		const payload = new Uint8Array(10_000).map((_, i) => i % 251);
		const progress: number[] = [];
		const bytes = await fetchBytes(
			'/baked/x.vxb',
			(p) => progress.push(p),
			async () => new Response(payload, { headers: { 'content-length': String(payload.length) } }),
		);
		expect(bytes).toEqual(payload);
		expect(progress.at(-1)).toBe(1);
		expect(progress.every((p, i) => i === 0 || p >= progress[i - 1])).toBe(true);
	});

	test('HTTP-ошибка → LoadError со статусом', async () => {
		const run = fetchBytes(
			'/baked/missing.vxb',
			undefined,
			async () => new Response('nope', { status: 404 }),
		);
		await expect(run).rejects.toBeInstanceOf(LoadError);
		await expect(run).rejects.toThrow('HTTP 404');
	});

	test('сетевая ошибка → LoadError', async () => {
		const run = fetchBytes('/baked/x.vxb', undefined, async () => {
			throw new TypeError('Failed to fetch');
		});
		await expect(run).rejects.toThrow('сеть');
	});
});
