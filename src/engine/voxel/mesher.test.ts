import { describe, expect, test } from 'bun:test';
import { CHUNK, PAD_VOLUME, padIndex } from './constants.ts';
import { type MeshData, meshChunk } from './mesher.ts';
import { buildPaletteLUT } from './palette.ts';

const lut = buildPaletteLUT([
	{ color: '#ff0000', emissive: 0, kind: 'solid' }, // 1
	{ color: '#00ff00', emissive: 0, kind: 'solid' }, // 2
	{ color: '#0000ff', emissive: 0, kind: 'water' }, // 3
	{ color: '#ffffff', emissive: 2, kind: 'solid' }, // 4
]);

function padded(voxels: Array<[number, number, number, number]>): Uint8Array {
	const out = new Uint8Array(PAD_VOLUME);
	for (const [x, y, z, m] of voxels) out[padIndex(x, y, z)] = m;
	return out;
}

const quads = (m: MeshData | null): number => (m ? m.indices.length / 6 : 0);

describe('meshChunk', () => {
	test('один воксель — 6 квадов, 24 вершины', () => {
		const mesh = meshChunk(padded([[0, 0, 0, 1]]), lut, [0, 0, 0]);
		expect(quads(mesh.opaque)).toBe(6);
		expect(mesh.opaque?.positions.length).toBe(24 * 3);
		expect(mesh.water).toBeNull();
		expect(mesh.glass).toBeNull();
	});

	test('ряд одинаковых вокселей сливается в 6 квадов', () => {
		const mesh = meshChunk(
			padded([
				[0, 0, 0, 1],
				[1, 0, 0, 1],
				[2, 0, 0, 1],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(6);
	});

	test('разные материалы не сливаются', () => {
		const mesh = meshChunk(
			padded([
				[0, 0, 0, 1],
				[1, 0, 0, 2],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(10);
	});

	test('сплошной чанк — 6 квадов', () => {
		const voxels: Array<[number, number, number, number]> = [];
		for (let x = 0; x < CHUNK; x++)
			for (let y = 0; y < CHUNK; y++) for (let z = 0; z < CHUNK; z++) voxels.push([x, y, z, 1]);
		const mesh = meshChunk(padded(voxels), lut, [0, 0, 0]);
		expect(quads(mesh.opaque)).toBe(6);
		expect(Math.max(...(mesh.opaque?.positions ?? []))).toBe(CHUNK);
	});

	test('сосед из рамки скрывает грань', () => {
		const mesh = meshChunk(
			padded([
				[CHUNK - 1, 0, 0, 1],
				[CHUNK, 0, 0, 1],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(5);
	});

	test('origin сдвигает позиции в мировые координаты', () => {
		const mesh = meshChunk(padded([[0, 0, 0, 1]]), lut, [32, 0, 64]);
		const p = mesh.opaque?.positions ?? new Float32Array();
		const xs: number[] = [];
		const zs: number[] = [];
		for (let i = 0; i < p.length; i += 3) {
			xs.push(p[i]);
			zs.push(p[i + 2]);
		}
		expect(Math.min(...xs)).toBe(32);
		expect(Math.min(...zs)).toBe(64);
	});

	test('треугольники смотрят наружу (обход против часовой)', () => {
		const m = meshChunk(padded([[0, 0, 0, 1]]), lut, [0, 0, 0]).opaque;
		if (!m) throw new Error('нет меша');
		const v = (i: number) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
		for (let t = 0; t < m.indices.length; t += 3) {
			const [a, b, c] = [v(m.indices[t]), v(m.indices[t + 1]), v(m.indices[t + 2])];
			const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
			const n = [
				e1[1] * e2[2] - e1[2] * e2[1],
				e1[2] * e2[0] - e1[0] * e2[2],
				e1[0] * e2[1] - e1[1] * e2[0],
			];
			const i0 = m.indices[t];
			const dot =
				n[0] * m.normals[i0 * 3] + n[1] * m.normals[i0 * 3 + 1] + n[2] * m.normals[i0 * 3 + 2];
			expect(dot).toBeGreaterThan(0);
		}
	});

	test('граница твёрдого и воды: твёрдая грань рисуется, водная — нет', () => {
		const mesh = meshChunk(
			padded([
				[0, 0, 0, 1],
				[1, 0, 0, 3],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(6);
		expect(quads(mesh.water)).toBe(5);
	});

	test('AO: верх куба на плите освещён полностью, плита у куба затенена', () => {
		const voxels: Array<[number, number, number, number]> = [[1, 1, 1, 1]];
		for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) voxels.push([x, 0, z, 1]);
		const m = meshChunk(padded(voxels), lut, [0, 0, 0]).opaque;
		if (!m) throw new Error('нет меша');
		const topOfCube: number[] = [];
		const topOfSlab: number[] = [];
		for (let i = 0; i < m.ao.length; i++) {
			if (m.normals[i * 3 + 1] !== 1) continue;
			const y = m.positions[i * 3 + 1];
			if (y === 2) topOfCube.push(m.ao[i]);
			if (y === 1) topOfSlab.push(m.ao[i]);
		}
		expect(topOfCube.length).toBeGreaterThan(0);
		expect(topOfCube.every((a) => a === 1)).toBe(true);
		expect(topOfSlab.some((a) => a < 1)).toBe(true);
	});

	test('emissive переносится в атрибут', () => {
		const m = meshChunk(padded([[0, 0, 0, 4]]), lut, [0, 0, 0]).opaque;
		expect(m?.emissive.every((e) => e === 2)).toBe(true);
	});
});
