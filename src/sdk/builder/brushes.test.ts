import { describe, expect, test } from 'bun:test';
import type { Vec3 } from '../../engine/types.ts';
import { normalizeMaterial } from '../materials.ts';
import { model } from './model.ts';
import { WorldBuilder } from './world-builder.ts';

const palette = {
	grass: normalizeMaterial('#6aa84f'),
	grass2: normalizeMaterial('#7cbf5a'),
	grass3: normalizeMaterial('#5a9640'),
	dirt: normalizeMaterial('#7a5a3a'),
	stone: normalizeMaterial('#888888'),
	moss: normalizeMaterial('#4f7a3a'),
	leaf: normalizeMaterial('#3f8a3a'),
	vine: normalizeMaterial('#2f6a2a'),
	rose: normalizeMaterial('#e05a7a'),
};

const world = (size: Vec3 = [32, 24, 32], seed = 1) => new WorldBuilder(size, palette, seed);

const count = (w: WorldBuilder, material: string): number => {
	let n = 0;
	for (let z = 0; z < w.size[2]; z++)
		for (let y = 0; y < w.size[1]; y++)
			for (let x = 0; x < w.size[0]; x++) if (w.get([x, y, z]) === material) n++;
	return n;
};

/** Слепок мира для сравнения детерминизма. */
const dump = (w: WorldBuilder): string => {
	const out: string[] = [];
	for (let z = 0; z < w.size[2]; z++)
		for (let y = 0; y < w.size[1]; y++)
			for (let x = 0; x < w.size[0]; x++) out.push(w.get([x, y, z]) ?? '.');
	return out.join(',');
};

describe('кисти холста', () => {
	test('ellipsoid: полуоси соблюдаются', () => {
		const w = world();
		w.ellipsoid([16, 12, 16], [8, 3, 5], 'stone');
		expect(w.get([16, 12, 16])).toBe('stone');
		expect(w.get([23, 12, 16])).toBe('stone');
		expect(w.get([16, 16, 16])).toBeNull();
		expect(w.get([16, 12, 22])).toBeNull();
	});

	test('blob: неровнее эллипсоида, но держится около радиуса и детерминирован', () => {
		const smooth = world();
		smooth.ellipsoid([16, 12, 16], [6, 6, 6], 'leaf');
		const rough = world();
		rough.blob([16, 12, 16], 6, 'leaf', { roughness: 0.4 });
		const a = count(smooth, 'leaf');
		const b = count(rough, 'leaf');
		expect(b).not.toBe(a);
		expect(b).toBeGreaterThan(a * 0.5);
		expect(b).toBeLessThan(a * 1.6);
		const again = world();
		again.blob([16, 12, 16], 6, 'leaf', { roughness: 0.4 });
		expect(dump(again)).toBe(dump(rough));
	});

	test('cone: широкий низ, узкий верх; top делает усечённый', () => {
		const w = world();
		w.cone([16, 0, 16], 6, 8, 'stone');
		expect(w.get([21, 0, 16])).toBe('stone');
		expect(w.get([18, 7, 16])).toBeNull();
		expect(w.get([16, 7, 16])).toBe('stone');
		const flat = world();
		flat.cone([16, 0, 16], 6, 8, 'stone', { top: 3 });
		expect(flat.get([18, 7, 16])).toBe('stone');
	});

	test('curve: непрерывная линия проходит через все точки, трубка толще', () => {
		const w = world();
		const points: Vec3[] = [
			[2, 2, 2],
			[10, 8, 6],
			[20, 4, 14],
		];
		w.curve(points, 'vine');
		for (const p of points) expect(w.get(p)).toBe('vine');
		const thin = count(w, 'vine');
		expect(thin).toBeGreaterThan(18);
		const tube = world();
		tube.curve(points, 'vine', { radius: 1.5 });
		expect(count(tube, 'vine')).toBeGreaterThan(thin * 4);
		expect(() => w.curve([[0, 0, 0]], 'vine')).toThrow('2 точки');
	});

	test('shade: перекрашивает только нарисованное (и only), использует все оттенки', () => {
		const w = world([32, 8, 32]);
		w.box([0, 0, 0], [31, 2, 31], 'grass');
		w.box([0, 3, 0], [3, 3, 3], 'stone');
		w.shade([0, 0, 0], [31, 7, 31], ['grass', 'grass2', 'grass3'], { only: 'grass' });
		expect(w.get([0, 3, 0])).toBe('stone');
		expect(w.get([10, 5, 10])).toBeNull();
		for (const m of ['grass', 'grass2', 'grass3']) expect(count(w, m)).toBeGreaterThan(200);
	});

	test('кисти работают и в модели', () => {
		const m = model({ size: [9, 9, 9], palette: { leaf: '#3f8a3a', bark: '#6b4a2b' } }, (b) => {
			b.blob([4.5, 4.5, 4.5], 3, 'leaf');
			b.shade([0, 0, 0], [8, 8, 8], ['bark', 'leaf'], { speckle: 1 });
		});
		const used = new Set([...m.data].filter((v) => v !== 0));
		expect(used).toEqual(new Set([1, 2]));
	});
});

describe('растительность и детали поверхности', () => {
	const ground = (seed = 1) => {
		const w = world([32, 16, 32], seed);
		w.terrain({ noise: 'flat', base: 3, top: 'grass', fill: 'dirt' });
		return w;
	};

	test('grass: пучки над поверхностью нужного материала, плотность соблюдается', () => {
		const w = ground();
		const placed = w.grass(['grass2', 'grass3'], { on: 'grass', density: 0.3, height: [1, 2] });
		expect(placed).toBeGreaterThan(32 * 32 * 0.2);
		expect(placed).toBeLessThan(32 * 32 * 0.4);
		expect(count(w, 'grass2') + count(w, 'grass3')).toBeGreaterThanOrEqual(placed);
		expect(w.get([0, 6, 0])).toBeNull();
	});

	test('flowers: на стебле — головка на 2 выше поверхности', () => {
		const w = ground();
		w.flowers('rose', { on: 'grass', density: 1, stem: 'leaf', area: [0, 0, 0, 0] });
		expect(w.get([0, 4, 0])).toBe('leaf');
		expect(w.get([0, 5, 0])).toBe('rose');
	});

	test('moss: только открытые грани `on`, не больше доступного', () => {
		const w = ground();
		w.box([10, 4, 10], [14, 8, 14], 'stone');
		const changed = w.moss('moss', { on: 'stone', amount: 0.5 });
		expect(changed).toBeGreaterThan(0);
		// Сердцевина камня закрыта со всех сторон — мох туда не попадает.
		expect(w.get([12, 6, 12])).toBe('stone');
		expect(count(w, 'moss')).toBe(changed);
	});

	test('vines: свисают из-под нависания до земли, не глубже', () => {
		const w = ground();
		w.box([8, 10, 8], [16, 10, 16], 'leaf');
		const placed = w.vines('vine', { from: 'leaf', density: 1, length: [20, 20] });
		expect(placed).toBe(81);
		expect(w.get([8, 9, 8])).toBe('vine');
		expect(w.get([8, 4, 8])).toBe('vine');
		expect(w.get([8, 3, 8])).toBe('grass');
	});

	test('island: парит (под ним пусто), слои сверху вниз, якоря, детерминизм', () => {
		const make = () => {
			const w = world([64, 48, 64], 7);
			const info = w.island({
				center: [32, 32],
				radius: 20,
				top: 36,
				surface: 'grass',
				soil: 'dirt',
				rock: 'stone',
				name: 'isle',
			});
			return { w, info };
		};
		const { w, info } = make();
		expect(info.bottom).toBeGreaterThan(0);
		expect(info.bottom).toBeLessThan(info.top - 10);
		expect(w.get([32, info.top, 32])).toBe('grass');
		expect(w.get([32, info.top - 1, 32])).toBe('dirt');
		expect(w.get([32, info.top - 6, 32])).toBe('stone');
		expect(w.get([32, 0, 32])).toBeNull();
		// Угол мира — за контуром острова.
		expect(w.heightAt(0, 0)).toBe(-1);
		expect(w.anchors['isle.top']).toEqual([32, info.top + 1, 32]);
		expect(w.anchors['isle.bottom'][1]).toBe(info.bottom);
		expect(dump(make().w)).toBe(dump(w));
	});

	test('waterfall: струя до первого твёрдого, якоря для частиц', () => {
		const w = ground();
		const fall = w.waterfall({ at: [5, 12, 5], width: [2, 1], name: 'falls' });
		expect(w.get([5, 12, 5])).toBe('water');
		expect(w.get([6, 4, 5])).toBe('water');
		expect(w.get([5, 3, 5])).toBe('grass');
		expect(fall.bottom[1]).toBe(4);
		expect(w.anchors['falls.top']).toEqual([6, 13, 5.5]);
	});
});
