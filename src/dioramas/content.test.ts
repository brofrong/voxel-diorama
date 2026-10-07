import { expect, test } from 'bun:test';
import {
	bakeToVxb,
	checkAtmosphere,
	checkEntities,
	SIZE_LIMIT_BYTES,
	SLUG_RE,
	toSceneConfig,
} from '#sdk';
import { listDioramaDirs, listSlugs, loadDiorama } from '../../scripts/lib/dioramas.ts';

test('папки диорам названы в kebab-case', () => {
	for (const dir of listDioramaDirs()) expect(dir).toMatch(SLUG_RE);
});

test('в каждой папке диорамы есть index.ts', () => {
	expect(listSlugs()).toEqual(listDioramaDirs());
});

for (const slug of listSlugs()) {
	test(`${slug}: валидна, запекается детерминированно и укладывается в бюджет`, async () => {
		const diorama = await loadDiorama(slug);
		const a = await bakeToVxb(diorama);
		const b = await bakeToVxb(diorama);
		expect(a.stats.voxels).toBeGreaterThan(0);
		expect(a.stats.bytes).toBeLessThan(SIZE_LIMIT_BYTES);
		expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
		expect(() => checkEntities(diorama, a.result)).not.toThrow();
		expect(() => checkAtmosphere(diorama, a.result)).not.toThrow();
	}, 30_000);
}

test('quiet-valley: старое time.fixed = закат, время стоит, небо градиент', async () => {
	const scene = toSceneConfig(await loadDiorama('quiet-valley'));
	expect(scene.time).toEqual({ start: 18.5, speed: 0, cycle: 120 });
	expect(scene.sky).toEqual({ kind: 'gradient' });
});
