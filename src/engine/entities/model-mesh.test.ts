import { expect, test } from 'bun:test';
import type { VoxelModelData } from '../types.ts';
import { meshModel } from './model-mesh.ts';

const solid = [{ color: '#ffffff', emissive: 0, kind: 'solid' as const, vary: 0 }];

const quads = (meshes: ReturnType<typeof meshModel>): number =>
	meshes.reduce((n, m) => n + (m.opaque ? m.opaque.indices.length / 6 : 0), 0);

test('один воксель — 6 квадов', () => {
	const model: VoxelModelData = {
		size: [1, 1, 1],
		data: new Uint8Array([1]),
		materials: solid,
		scale: 0.25,
		pivot: [0.5, 0, 0.5],
	};
	expect(quads(meshModel(model))).toBe(6);
});

test('модель длиннее чанка мешится по частям без внутренних граней', () => {
	const model: VoxelModelData = {
		size: [40, 1, 1],
		data: new Uint8Array(40).fill(1),
		materials: solid,
		scale: 1,
		pivot: [20, 0, 0.5],
	};
	const meshes = meshModel(model);
	expect(meshes).toHaveLength(2);
	expect(quads(meshes)).toBe(10);
});
