import type { Vec3 } from '../types.ts';
import {
	CHUNK,
	CHUNK_MASK,
	CHUNK_SHIFT,
	CHUNK_VOLUME,
	chunkIndex,
	PAD_VOLUME,
	padIndex,
} from './constants.ts';

export interface ChunkData {
	coord: Vec3;
	data: Uint8Array;
}

/** Разреженный воксельный мир: хранятся только чанки, в которые что-то писали. */
export class VoxelWorld {
	readonly size: Vec3;
	readonly chunks = new Map<string, ChunkData>();

	constructor(size: Vec3) {
		this.size = [size[0], size[1], size[2]];
	}

	static key(cx: number, cy: number, cz: number): string {
		return `${cx},${cy},${cz}`;
	}

	inBounds(x: number, y: number, z: number): boolean {
		return x >= 0 && y >= 0 && z >= 0 && x < this.size[0] && y < this.size[1] && z < this.size[2];
	}

	get(x: number, y: number, z: number): number {
		if (!this.inBounds(x, y, z)) return 0;
		const chunk = this.chunks.get(
			VoxelWorld.key(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT, z >> CHUNK_SHIFT),
		);
		return chunk ? chunk.data[chunkIndex(x & CHUNK_MASK, y & CHUNK_MASK, z & CHUNK_MASK)] : 0;
	}

	/** Возвращает false, если точка вне мира (запись проигнорирована). */
	set(x: number, y: number, z: number, value: number): boolean {
		if (!this.inBounds(x, y, z)) return false;
		const cx = x >> CHUNK_SHIFT;
		const cy = y >> CHUNK_SHIFT;
		const cz = z >> CHUNK_SHIFT;
		const key = VoxelWorld.key(cx, cy, cz);
		let chunk = this.chunks.get(key);
		if (!chunk) {
			if (value === 0) return true;
			chunk = { coord: [cx, cy, cz], data: new Uint8Array(CHUNK_VOLUME) };
			this.chunks.set(key, chunk);
		}
		chunk.data[chunkIndex(x & CHUNK_MASK, y & CHUNK_MASK, z & CHUNK_MASK)] = value;
		return true;
	}

	setChunk(coord: Vec3, data: Uint8Array): void {
		this.chunks.set(VoxelWorld.key(coord[0], coord[1], coord[2]), {
			coord: [coord[0], coord[1], coord[2]],
			data,
		});
	}

	/** Чанк 34³ с рамкой из соседей — вход для мешера. */
	extractPadded(cx: number, cy: number, cz: number): Uint8Array {
		const out = new Uint8Array(PAD_VOLUME);
		const center = this.chunks.get(VoxelWorld.key(cx, cy, cz))?.data;
		const ox = cx * CHUNK;
		const oy = cy * CHUNK;
		const oz = cz * CHUNK;
		for (let z = -1; z <= CHUNK; z++) {
			for (let y = -1; y <= CHUNK; y++) {
				for (let x = -1; x <= CHUNK; x++) {
					const interior = x >= 0 && y >= 0 && z >= 0 && x < CHUNK && y < CHUNK && z < CHUNK;
					out[padIndex(x, y, z)] = interior
						? (center?.[chunkIndex(x, y, z)] ?? 0)
						: this.get(ox + x, oy + y, oz + z);
				}
			}
		}
		return out;
	}

	countVoxels(): number {
		let count = 0;
		for (const { data } of this.chunks.values()) {
			for (let i = 0; i < data.length; i++) if (data[i] !== 0) count++;
		}
		return count;
	}

	usedMaterials(): Set<number> {
		const used = new Set<number>();
		for (const { data } of this.chunks.values()) {
			for (let i = 0; i < data.length; i++) if (data[i] !== 0) used.add(data[i]);
		}
		return used;
	}

	/** Удаляет чанки, в которых не осталось ни одного вокселя. */
	pruneEmpty(): void {
		for (const [key, { data }] of this.chunks) {
			if (!data.some((v) => v !== 0)) this.chunks.delete(key);
		}
	}
}
