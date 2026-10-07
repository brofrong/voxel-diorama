import type { Material } from '../types.ts';
import { CHUNK, chunkIndex } from './constants.ts';
import type { VoxelWorld } from './world.ts';

export interface Heightmap {
	/** y поверхности в точке (билинейно между центрами колонок); вне мира — 0. */
	groundAt(x: number, z: number): number;
	/** Высота земли по колонкам (x + z·width). */
	columns: Int16Array;
	/** Поверхность для частиц: над верхним непустым вокселем (вода и стекло — тоже). */
	surface: Int16Array;
	width: number;
	depth: number;
}

/** «Земля» колонки — y над верхним твёрдым (kind 'solid') вокселем; без твёрдых — 0. */
export function buildHeightmap(world: VoxelWorld, materials: readonly Material[]): Heightmap {
	const [sx, , sz] = world.size;
	const tops = new Int16Array(sx * sz);
	const surface = new Int16Array(sx * sz);
	const solid = new Uint8Array(256);
	materials.forEach((m, i) => {
		solid[i + 1] = m.kind === 'solid' ? 1 : 0;
	});
	for (const { coord, data } of world.chunks.values()) {
		const [cx, cy, cz] = coord;
		for (let lz = 0; lz < CHUNK; lz++) {
			for (let lx = 0; lx < CHUNK; lx++) {
				const x = cx * CHUNK + lx;
				const z = cz * CHUNK + lz;
				if (x >= sx || z >= sz) continue;
				const i = x + z * sx;
				let seenAny = false;
				for (let ly = CHUNK - 1; ly >= 0; ly--) {
					const v = data[chunkIndex(lx, ly, lz)];
					if (v === 0) continue;
					const top = cy * CHUNK + ly + 1;
					if (!seenAny) {
						seenAny = true;
						if (top > surface[i]) surface[i] = top;
					}
					if (solid[v]) {
						if (top > tops[i]) tops[i] = top;
						break;
					}
				}
			}
		}
	}
	const column = (x: number, z: number): number =>
		tops[Math.min(sx - 1, Math.max(0, x)) + Math.min(sz - 1, Math.max(0, z)) * sx];
	return {
		columns: tops,
		surface,
		width: sx,
		depth: sz,
		groundAt(x: number, z: number): number {
			if (x < 0 || z < 0 || x >= sx || z >= sz) return 0;
			const fx = x - 0.5;
			const fz = z - 0.5;
			const x0 = Math.floor(fx);
			const z0 = Math.floor(fz);
			const tx = fx - x0;
			const tz = fz - z0;
			const near = column(x0, z0) + (column(x0 + 1, z0) - column(x0, z0)) * tx;
			const far = column(x0, z0 + 1) + (column(x0 + 1, z0 + 1) - column(x0, z0 + 1)) * tx;
			return near + (far - near) * tz;
		},
	};
}
