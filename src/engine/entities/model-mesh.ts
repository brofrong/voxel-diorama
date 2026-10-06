import type { VoxelModelData } from '../types.ts';
import { CHUNK } from '../voxel/constants.ts';
import { type ChunkMesh, meshChunk } from '../voxel/mesher.ts';
import { buildPaletteLUT } from '../voxel/palette.ts';
import { VoxelWorld } from '../voxel/world.ts';

/** Мешит модель сущности тем же greedy-мешером, что и мир. Координаты — в вокселях модели. */
export function meshModel(model: VoxelModelData): ChunkMesh[] {
	const [sx, sy, sz] = model.size;
	const world = new VoxelWorld([sx, sy, sz]);
	for (let z = 0; z < sz; z++) {
		for (let y = 0; y < sy; y++) {
			for (let x = 0; x < sx; x++) {
				const v = model.data[x + sx * (y + sy * z)];
				if (v !== 0) world.set(x, y, z, v);
			}
		}
	}
	const lut = buildPaletteLUT(model.materials);
	return [...world.chunks.values()].map(({ coord }) =>
		meshChunk(world.extractPadded(coord[0], coord[1], coord[2]), lut, [
			coord[0] * CHUNK,
			coord[1] * CHUNK,
			coord[2] * CHUNK,
		]),
	);
}
