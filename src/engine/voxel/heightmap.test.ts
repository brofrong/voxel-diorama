import { expect, test } from 'bun:test';
import type { Material } from '../types.ts';
import { buildHeightmap } from './heightmap.ts';
import { VoxelWorld } from './world.ts';

const materials: Material[] = [
	{ color: '#6aa84f', emissive: 0, kind: 'solid', vary: 0 },
	{ color: '#3a7bd5', emissive: 0, kind: 'water', vary: 0 },
];

test('земля — над верхним твёрдым вокселем, вода не в счёт', () => {
	const world = new VoxelWorld([4, 8, 4]);
	for (let y = 0; y <= 2; y++) world.set(1, y, 1, 1);
	for (let y = 0; y <= 5; y++) world.set(2, y, 2, 2);
	const { groundAt } = buildHeightmap(world, materials);
	expect(groundAt(1.5, 1.5)).toBe(3);
	expect(groundAt(2.5, 2.5)).toBe(0);
	expect(groundAt(-1, 1)).toBe(0);
	expect(groundAt(1.5, 9)).toBe(0);
});

test('колонки из разных чанков по высоте', () => {
	const world = new VoxelWorld([2, 80, 2]);
	world.set(0, 70, 0, 1);
	world.set(0, 3, 0, 1);
	expect(buildHeightmap(world, materials).groundAt(0.5, 0.5)).toBe(71);
});

test('билинейно между центрами колонок', () => {
	const world = new VoxelWorld([2, 4, 1]);
	world.set(1, 0, 0, 1);
	world.set(1, 1, 0, 1);
	const { groundAt } = buildHeightmap(world, materials);
	expect(groundAt(0.5, 0.5)).toBe(0);
	expect(groundAt(1.5, 0.5)).toBe(2);
	expect(groundAt(1, 0.5)).toBeCloseTo(1, 6);
});

test('колонки доступны для текстуры высот', () => {
	const world = new VoxelWorld([3, 8, 2]);
	world.set(2, 4, 1, 1);
	const hm = buildHeightmap(world, materials);
	expect(hm.width).toBe(3);
	expect(hm.depth).toBe(2);
	expect(hm.columns[2 + 1 * 3]).toBe(5);
	expect(hm.columns[0]).toBe(0);
});

test('поверхность для частиц учитывает воду и стекло, земля для ходоков — нет', () => {
	const glassy: Material[] = [
		...materials,
		{ color: '#bfe3f5', emissive: 0, kind: 'glass', vary: 0 },
	];
	const world = new VoxelWorld([3, 8, 1]);
	world.set(0, 2, 0, 1); // твёрдое
	world.set(1, 2, 0, 1);
	for (let y = 3; y <= 5; y++) world.set(1, y, 0, 2); // вода над дном
	world.set(2, 1, 0, 1);
	world.set(2, 2, 0, 3); // лёд
	const hm = buildHeightmap(world, glassy);
	expect(Array.from(hm.columns)).toEqual([3, 3, 2]);
	expect(Array.from(hm.surface)).toEqual([3, 6, 3]);
});
