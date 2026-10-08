import { describe, expect, test } from 'bun:test';
import type { Material, Vec3 } from '../types.ts';
import { CHUNK, CHUNK_VOLUME } from './constants.ts';
import { decodeVxb, encodeVxb, VXB_VERSION, VxbError } from './vxb.ts';
import { VoxelWorld } from './world.ts';

const materials: Material[] = [
	{ color: '#6aa84f', emissive: 0, kind: 'solid', vary: 0 },
	{ color: '#3a7bd5', emissive: 0, kind: 'water', vary: 0 },
	{ color: '#ffd27a', emissive: 1.5, kind: 'glass', vary: 0.125 },
];

describe('vxb', () => {
	test('кодирование и декодирование туда-обратно', async () => {
		const world = new VoxelWorld([70, 40, 33]);
		world.set(0, 0, 0, 1);
		world.set(69, 39, 32, 2);
		world.set(CHUNK + 1, 5, 7, 3);
		const decoded = await decodeVxb(await encodeVxb({ world, materials }));
		expect(decoded.world.size).toEqual([70, 40, 33]);
		expect(decoded.materials).toEqual(materials);
		expect(decoded.world.get(0, 0, 0)).toBe(1);
		expect(decoded.world.get(69, 39, 32)).toBe(2);
		expect(decoded.world.get(CHUNK + 1, 5, 7)).toBe(3);
		expect(decoded.world.countVoxels()).toBe(3);
	});

	test('пустые чанки не попадают в файл', async () => {
		const world = new VoxelWorld([64, 64, 64]);
		world.set(1, 1, 1, 1);
		world.set(40, 40, 40, 1);
		world.set(40, 40, 40, 0);
		const decoded = await decodeVxb(await encodeVxb({ world, materials }));
		expect(decoded.world.chunks.size).toBe(1);
	});

	test('мир без вокселей кодируется и декодируется', async () => {
		const world = new VoxelWorld([16, 16, 16]);
		const decoded = await decodeVxb(await encodeVxb({ world, materials: [] }));
		expect(decoded.world.chunks.size).toBe(0);
		expect(decoded.materials).toEqual([]);
	});

	test('сплошной чанк сжимается до десятков байт', async () => {
		const world = new VoxelWorld([32, 32, 32]);
		for (let x = 0; x < 32; x++)
			for (let y = 0; y < 32; y++) for (let z = 0; z < 32; z++) world.set(x, y, z, 1);
		const bytes = await encodeVxb({ world, materials });
		expect(bytes.length).toBeLessThan(100);
	});

	test('чужой файл → VxbError', async () => {
		const junk = new TextEncoder().encode('<!doctype html><html>');
		await expect(decodeVxb(junk)).rejects.toBeInstanceOf(VxbError);
	});

	test('другая версия → VxbError с номером версии', async () => {
		const bytes = await encodeVxb({ world: new VoxelWorld([8, 8, 8]), materials });
		bytes[3] = VXB_VERSION + 1;
		await expect(decodeVxb(bytes)).rejects.toThrow(`версия .vxb: ${VXB_VERSION + 1}`);
	});

	test('обрезанный файл → VxbError', async () => {
		const world = new VoxelWorld([64, 64, 64]);
		world.set(3, 3, 3, 1);
		const bytes = await encodeVxb({ world, materials });
		await expect(decodeVxb(bytes.subarray(0, bytes.length - 6))).rejects.toBeInstanceOf(VxbError);
	});

	test('значение вокселя вне диапазона материалов → VxbError', async () => {
		const world = new VoxelWorld([8, 8, 8]);
		world.set(0, 0, 0, materials.length + 1);
		const bytes = await encodeVxb({ world, materials });
		await expect(decodeVxb(bytes)).rejects.toBeInstanceOf(VxbError);
	});

	test('координаты чанка вне мира → VxbError', async () => {
		const world = new VoxelWorld([32, 32, 32]);
		world.setChunk([5, 0, 0], new Uint8Array(CHUNK_VOLUME).fill(1));
		const bytes = await encodeVxb({ world, materials });
		await expect(decodeVxb(bytes)).rejects.toBeInstanceOf(VxbError);
	});

	test('якоря проходят туда-обратно', async () => {
		const world = new VoxelWorld([16, 16, 16]);
		world.set(1, 1, 1, 1);
		const anchors = { 'mill.hub': [4.5, 12.5, -0.5] as Vec3, well: [1, 2, 3] as Vec3 };
		const decoded = await decodeVxb(await encodeVxb({ world, materials, anchors }));
		expect(decoded.anchors).toEqual(anchors);
	});

	test('без якорей — пустой словарь', async () => {
		const decoded = await decodeVxb(
			await encodeVxb({ world: new VoxelWorld([8, 8, 8]), materials }),
		);
		expect(decoded.anchors).toEqual({});
	});

	test('файл версии 1 → VxbError с советом перезапечь', async () => {
		const bytes = await encodeVxb({ world: new VoxelWorld([8, 8, 8]), materials });
		bytes[3] = 1;
		await expect(decodeVxb(bytes)).rejects.toThrow('перезапеките');
	});
});
