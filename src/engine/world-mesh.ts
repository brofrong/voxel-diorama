import {
	BufferAttribute,
	BufferGeometry,
	type Group,
	Mesh,
	type MeshStandardNodeMaterial,
} from 'three/webgpu';
import type { VoxelLayer } from './render/materials.ts';
import type { Vec3 } from './types.ts';
import { CHUNK } from './voxel/constants.ts';
import type { ChunkMesh, MeshData } from './voxel/mesher.ts';
import type { MesherPool } from './voxel/mesher-pool.ts';
import type { VoxelWorld } from './voxel/world.ts';

export function toGeometry(data: MeshData): BufferGeometry {
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
	geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
	geometry.setAttribute('color', new BufferAttribute(data.colors, 3));
	geometry.setAttribute('ao', new BufferAttribute(data.ao, 1));
	geometry.setAttribute('emissive', new BufferAttribute(data.emissive, 1));
	geometry.setIndex(new BufferAttribute(data.indices, 1));
	geometry.computeBoundingSphere();
	return geometry;
}

function addChunk(
	group: Group,
	mesh: ChunkMesh,
	materials: Record<VoxelLayer, MeshStandardNodeMaterial>,
): void {
	for (const layer of ['opaque', 'water', 'glass'] as const) {
		const data = mesh[layer];
		if (!data) continue;
		const object = new Mesh(toGeometry(data), materials[layer]);
		object.castShadow = layer === 'opaque';
		object.receiveShadow = layer !== 'glass';
		group.add(object);
	}
}

/** Мешит все чанки (от центра к краям) и добавляет их в group по мере готовности. */
export async function meshWorld(
	world: VoxelWorld,
	pool: MesherPool,
	group: Group,
	materials: Record<VoxelLayer, MeshStandardNodeMaterial>,
	onProgress?: (fraction: number) => void,
): Promise<void> {
	const cx = world.size[0] / 2 / CHUNK;
	const cz = world.size[2] / 2 / CHUNK;
	const chunks = [...world.chunks.values()].sort(
		(a, b) =>
			(a.coord[0] + 0.5 - cx) ** 2 +
			(a.coord[2] + 0.5 - cz) ** 2 -
			((b.coord[0] + 0.5 - cx) ** 2 + (b.coord[2] + 0.5 - cz) ** 2),
	);
	if (chunks.length === 0) {
		onProgress?.(1);
		return;
	}
	let done = 0;
	onProgress?.(0);
	await Promise.all(
		chunks.map(async ({ coord }) => {
			const origin: Vec3 = [coord[0] * CHUNK, coord[1] * CHUNK, coord[2] * CHUNK];
			const mesh = await pool.mesh(world.extractPadded(coord[0], coord[1], coord[2]), origin);
			addChunk(group, mesh, materials);
			done++;
			onProgress?.(done / chunks.length);
		}),
	);
}
