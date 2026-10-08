import { describe, expect, test } from 'bun:test';
import { decodeVxb } from '../engine/voxel/vxb.ts';
import { bakeDiorama, bakeToVxb, bakeWarnings } from './bake.ts';
import { type DioramaInput, defineDiorama } from './schema.ts';

const valley = (build: DioramaInput['build']) =>
	defineDiorama({
		meta: {
			title: 'Долина',
			createdAt: '2026-10-06',
			author: { model: 'Тест' },
			launchedBy: { name: 'Тест', url: 'https://example.com' },
		},
		seed: 3,
		size: [40, 24, 40],
		palette: { grass: '#6aa84f', dirt: '#7a5a3a', gold: '#ffd700' },
		build,
	});

describe('bake', () => {
	test('запекание детерминировано', async () => {
		const d = valley((w) => w.terrain({ noise: 'hills', top: 'grass', fill: 'dirt' }));
		const a = await bakeToVxb(d);
		const b = await bakeToVxb(d);
		expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
	});

	test('статистика и неиспользуемые материалы', () => {
		const { stats } = bakeDiorama(valley((w) => w.box([0, 0, 0], [1, 0, 0], 'grass')));
		expect(stats.voxels).toBe(2);
		expect(stats.chunks).toBe(1);
		expect(stats.materials).toBe(1);
		expect(stats.unusedPalette).toEqual(['dirt', 'gold']);
	});

	test('пустой мир запекается и даёт предупреждение', async () => {
		const { bytes, stats } = await bakeToVxb(valley(() => {}));
		expect(stats.voxels).toBe(0);
		expect(bakeWarnings(stats).join('\n')).toContain('мир пустой');
		const decoded = await decodeVxb(bytes);
		expect(decoded.world.chunks.size).toBe(0);
	});

	test('выход за границы — предупреждение, не ошибка', async () => {
		const { stats } = await bakeToVxb(valley((w) => w.sphere([0, 0, 0], 3, 'grass')));
		expect(stats.outOfBounds).toBeGreaterThan(0);
		expect(bakeWarnings(stats).join('\n')).toContain('за границами');
	});

	test('ошибка в build оборачивается с названием диорамы', () => {
		const d = valley(() => {
			throw new Error('бум');
		});
		expect(() => bakeDiorama(d)).toThrow('ошибка в build() диорамы «Долина»: бум');
	});

	test('материалы префабов попадают в .vxb', async () => {
		const { bytes } = await bakeToVxb(
			valley((w) => {
				w.terrain({ noise: 'flat', base: 2, top: 'grass', fill: 'dirt' });
				w.water({ level: 4 });
			}),
		);
		const { materials } = await decodeVxb(bytes);
		expect(materials.map((m) => m.kind)).toEqual(['solid', 'solid', 'solid', 'water']);
	});

	test('якоря мира запекаются и считаются в статистике', async () => {
		const { bytes, stats, result } = await bakeToVxb(
			valley((w) => {
				w.box([0, 0, 0], [1, 0, 0], 'grass');
				w.anchor('well', [1, 2, 3]);
			}),
		);
		expect(stats.anchors).toBe(1);
		expect(result.anchors).toEqual({ well: [1, 2, 3] });
		expect((await decodeVxb(bytes)).anchors).toEqual({ well: [1, 2, 3] });
	});
});
