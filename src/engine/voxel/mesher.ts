import type { Vec3 } from '../types.ts';
import { CHUNK, KIND_SOLID, padIndex } from './constants.ts';
import type { PaletteLUT } from './palette.ts';

export interface MeshData {
	positions: Float32Array;
	normals: Float32Array;
	/** Линейный RGB. */
	colors: Float32Array;
	/** Яркость вершины 0..1 (ambient occlusion). */
	ao: Float32Array;
	emissive: Float32Array;
	indices: Uint32Array;
}

export interface ChunkMesh {
	opaque: MeshData | null;
	water: MeshData | null;
	glass: MeshData | null;
}

/** Яркость вершины по уровню AO (0 — сильнее всего закрыта соседями, 3 — открыта). */
export const AO_CURVE = [0.45, 0.65, 0.82, 1] as const;

class MeshBuilder {
	private readonly positions: number[] = [];
	private readonly normals: number[] = [];
	private readonly colors: number[] = [];
	private readonly ao: number[] = [];
	private readonly emissive: number[] = [];
	private readonly indices: number[] = [];
	private vertexCount = 0;

	pushQuad(corners: Vec3[], normal: Vec3, color: Vec3, emissive: number, ao: number[]): void {
		const base = this.vertexCount;
		for (let k = 0; k < 4; k++) {
			this.positions.push(corners[k][0], corners[k][1], corners[k][2]);
			this.normals.push(normal[0], normal[1], normal[2]);
			this.colors.push(color[0], color[1], color[2]);
			this.ao.push(ao[k]);
			this.emissive.push(emissive);
		}
		// Диагональ через более светлые вершины — иначе AO даёт заметную анизотропию.
		if (ao[0] + ao[2] < ao[1] + ao[3]) {
			this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
		} else {
			this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
		}
		this.vertexCount += 4;
	}

	build(): MeshData | null {
		if (this.vertexCount === 0) return null;
		return {
			positions: new Float32Array(this.positions),
			normals: new Float32Array(this.normals),
			colors: new Float32Array(this.colors),
			ao: new Float32Array(this.ao),
			emissive: new Float32Array(this.emissive),
			indices: new Uint32Array(this.indices),
		};
	}
}

const vertexAO = (side1: number, side2: number, corner: number): number =>
	side1 && side2 ? 0 : 3 - (side1 + side2 + corner);

/**
 * Greedy meshing чанка 32³ с рамкой 34³.
 * Для каждой оси d и направления dir строим маску видимых граней слоя,
 * затем жадно сливаем одинаковые (материал + AO) клетки в прямоугольники.
 */
export function meshChunk(padded: Uint8Array, lut: PaletteLUT, origin: Vec3): ChunkMesh {
	const kinds = lut.kinds;
	const builders: Record<number, MeshBuilder> = {
		1: new MeshBuilder(),
		2: new MeshBuilder(),
		3: new MeshBuilder(),
	};
	const mask = new Int32Array(CHUNK * CHUNK);
	const p: Vec3 = [0, 0, 0];
	const q: Vec3 = [0, 0, 0];
	const t: Vec3 = [0, 0, 0];

	const solidAt = (u: number, v: number, du: number, dv: number): number => {
		t[0] = q[0];
		t[1] = q[1];
		t[2] = q[2];
		t[u] += du;
		t[v] += dv;
		return kinds[padded[padIndex(t[0], t[1], t[2])]] === KIND_SOLID ? 1 : 0;
	};

	for (let d = 0; d < 3; d++) {
		const u = (d + 1) % 3;
		const v = (d + 2) % 3;
		for (const dir of [1, -1]) {
			for (let i = 0; i < CHUNK; i++) {
				// 1. Маска видимых граней слоя i.
				for (let b = 0; b < CHUNK; b++) {
					for (let a = 0; a < CHUNK; a++) {
						p[d] = i;
						p[u] = a;
						p[v] = b;
						const A = padded[padIndex(p[0], p[1], p[2])];
						let key = 0;
						if (A !== 0) {
							q[0] = p[0];
							q[1] = p[1];
							q[2] = p[2];
							q[d] += dir;
							const B = padded[padIndex(q[0], q[1], q[2])];
							const visible = B === 0 || (kinds[B] !== KIND_SOLID && B !== A);
							if (visible) {
								const su0 = solidAt(u, v, -1, 0);
								const su1 = solidAt(u, v, 1, 0);
								const sv0 = solidAt(u, v, 0, -1);
								const sv1 = solidAt(u, v, 0, 1);
								const c0 = vertexAO(su0, sv0, solidAt(u, v, -1, -1));
								const c1 = vertexAO(su1, sv0, solidAt(u, v, 1, -1));
								const c2 = vertexAO(su1, sv1, solidAt(u, v, 1, 1));
								const c3 = vertexAO(su0, sv1, solidAt(u, v, -1, 1));
								key = A | ((c0 | (c1 << 2) | (c2 << 4) | (c3 << 6)) << 8);
							}
						}
						mask[a + b * CHUNK] = key;
					}
				}

				// 2. Жадное слияние прямоугольников.
				for (let b = 0; b < CHUNK; b++) {
					for (let a = 0; a < CHUNK; ) {
						const key = mask[a + b * CHUNK];
						if (key === 0) {
							a++;
							continue;
						}
						let w = 1;
						while (a + w < CHUNK && mask[a + w + b * CHUNK] === key) w++;
						let h = 1;
						grow: while (b + h < CHUNK) {
							for (let x = 0; x < w; x++) {
								if (mask[a + x + (b + h) * CHUNK] !== key) break grow;
							}
							h++;
						}

						const material = key & 255;
						const ao = key >> 8;
						const plane = i + (dir > 0 ? 1 : 0);
						const uv: Array<[number, number]> = [
							[a, b],
							[a + w, b],
							[a + w, b + h],
							[a, b + h],
						];
						const order = dir > 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
						const corners: Vec3[] = [];
						const aoValues: number[] = [];
						for (const k of order) {
							const c: Vec3 = [origin[0], origin[1], origin[2]];
							c[d] += plane;
							c[u] += uv[k][0];
							c[v] += uv[k][1];
							corners.push(c);
							aoValues.push(AO_CURVE[(ao >> (2 * k)) & 3]);
						}
						const normal: Vec3 = [0, 0, 0];
						normal[d] = dir;
						const color: Vec3 = [
							lut.colors[material * 3],
							lut.colors[material * 3 + 1],
							lut.colors[material * 3 + 2],
						];
						builders[kinds[material]].pushQuad(
							corners,
							normal,
							color,
							lut.emissive[material],
							aoValues,
						);

						for (let y = 0; y < h; y++) {
							for (let x = 0; x < w; x++) mask[a + x + (b + y) * CHUNK] = 0;
						}
						a += w;
					}
				}
			}
		}
	}

	return { opaque: builders[1].build(), water: builders[2].build(), glass: builders[3].build() };
}

/** Буферы меша для передачи из воркера без копирования. */
export function meshTransferables(mesh: ChunkMesh): ArrayBuffer[] {
	const out: ArrayBuffer[] = [];
	for (const data of [mesh.opaque, mesh.water, mesh.glass]) {
		if (!data) continue;
		for (const arr of [
			data.positions,
			data.normals,
			data.colors,
			data.ao,
			data.emissive,
			data.indices,
		]) {
			out.push(arr.buffer as ArrayBuffer);
		}
	}
	return out;
}
