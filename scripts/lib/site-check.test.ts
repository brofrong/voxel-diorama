import { expect, test } from 'bun:test';
import {
	checkOgImages,
	expectedFiles,
	fetchWithRetry,
	findRootPaths,
	imageSources,
} from './site-check.ts';

test('findRootPaths: корневые пути без base — нарушения, относительные и с base — нет', () => {
	const html =
		'<a href="/d/x">a</a><a href="./d/y">b</a><img src="/voxel-diorama/thumbs/x.webp"><link href="//cdn.io/a">';
	expect(findRootPaths(html, '/voxel-diorama')).toEqual(['/d/x']);
	expect(findRootPaths(html, '')).toEqual([]);
});

test('checkOgImages: og:image должен быть абсолютным с адресом сайта', () => {
	const ok =
		'<meta property="og:image" content="https://brofrong.github.io/voxel-diorama/thumbs/a.webp?v=1">';
	const bad = '<meta property="og:image" content="/thumbs/a.webp">';
	expect(checkOgImages(ok, 'https://brofrong.github.io/voxel-diorama/')).toEqual([]);
	expect(checkOgImages(bad, 'https://brofrong.github.io/voxel-diorama/')).toEqual([
		'/thumbs/a.webp',
	]);
});

test('expectedFiles: главная, страница и мир каждой диорамы', () => {
	expect(expectedFiles(['a', 'b'])).toEqual([
		'index.html',
		'd/a.html',
		'baked/a.vxb',
		'd/b.html',
		'baked/b.vxb',
	]);
});

test('imageSources: src картинок', () => {
	expect(imageSources('<img src="./thumbs/a.webp?v=1" alt=""><img alt="" src="x.png">')).toEqual([
		'./thumbs/a.webp?v=1',
		'x.png',
	]);
});

test('fetchWithRetry: повторяет до 200, затем отдаёт ответ', async () => {
	let calls = 0;
	const fake = async () => new Response('', { status: ++calls < 3 ? 404 : 200 });
	const res = await fetchWithRetry('https://x.io', { fetchFn: fake, delayMs: 1, attempts: 5 });
	expect(res.status).toBe(200);
	expect(calls).toBe(3);
});

test('fetchWithRetry: после всех попыток — ошибка с URL и статусом', async () => {
	const fake = async () => new Response('', { status: 404 });
	await expect(
		fetchWithRetry('https://x.io/a', { fetchFn: fake, delayMs: 1, attempts: 2 }),
	).rejects.toThrow('https://x.io/a → 404');
});
