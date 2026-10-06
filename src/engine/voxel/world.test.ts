import { describe, expect, test } from 'bun:test';
import { CHUNK, padIndex } from './constants.ts';
import { VoxelWorld } from './world.ts';

describe('VoxelWorld', () => {
	test('set/get и ленивое создание чанков', () => {
		const w = new VoxelWorld([64, 64, 64]);
		expect(w.chunks.size).toBe(0);
		expect(w.set(1, 2, 3, 7)).toBe(true);
		expect(w.get(1, 2, 3)).toBe(7);
		expect(w.get(0, 0, 0)).toBe(0);
		expect(w.chunks.size).toBe(1);
		w.set(40, 0, 0, 1);
		expect(w.chunks.size).toBe(2);
	});

	test('запись вне границ возвращает false, чтение даёт 0', () => {
		const w = new VoxelWorld([10, 10, 10]);
		expect(w.set(10, 0, 0, 1)).toBe(false);
		expect(w.set(-1, 0, 0, 1)).toBe(false);
		expect(w.get(10, 0, 0)).toBe(0);
		expect(w.get(-1, 5, 5)).toBe(0);
	});

	test('запись нуля в отсутствующий чанк не создаёт его', () => {
		const w = new VoxelWorld([64, 64, 64]);
		w.set(5, 5, 5, 0);
		expect(w.chunks.size).toBe(0);
	});

	test('extractPadded захватывает соседей по границе чанка', () => {
		const w = new VoxelWorld([96, 64, 64]);
		w.set(0, 0, 0, 1);
		w.set(CHUNK, 0, 0, 2); // первый воксель соседнего чанка по +x
		const padded = w.extractPadded(0, 0, 0);
		expect(padded[padIndex(0, 0, 0)]).toBe(1);
		expect(padded[padIndex(CHUNK, 0, 0)]).toBe(2);
		expect(padded[padIndex(-1, 0, 0)]).toBe(0);
	});

	test('countVoxels, usedMaterials, pruneEmpty', () => {
		const w = new VoxelWorld([64, 64, 64]);
		w.set(0, 0, 0, 3);
		w.set(1, 0, 0, 3);
		w.set(40, 40, 40, 5);
		expect(w.countVoxels()).toBe(3);
		expect([...w.usedMaterials()].sort()).toEqual([3, 5]);
		w.set(40, 40, 40, 0);
		w.pruneEmpty();
		expect(w.chunks.size).toBe(1);
	});
});
