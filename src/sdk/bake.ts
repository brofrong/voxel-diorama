import type { Material, Vec3 } from '../engine/types.ts';
import { encodeVxb } from '../engine/voxel/vxb.ts';
import type { VoxelWorld } from '../engine/voxel/world.ts';
import { WorldBuilder } from './builder/world-builder.ts';
import type { Diorama } from './schema.ts';

export const SIZE_WARN_BYTES = 2 * 1024 * 1024;
export const SIZE_LIMIT_BYTES = 8 * 1024 * 1024;

export interface BakeStats {
	voxels: number;
	chunks: number;
	/** Сколько разных материалов реально стоит в мире. */
	materials: number;
	/** Материалы палитры диорамы, которые не использованы. */
	unusedPalette: string[];
	outOfBounds: number;
	anchors: number;
}

export interface BakeResult {
	world: VoxelWorld;
	materials: Material[];
	stats: BakeStats;
	anchors: Record<string, Vec3>;
}

export function bakeDiorama(d: Diorama): BakeResult {
	const w = new WorldBuilder(d.size, d.palette, d.seed);
	try {
		d.build(w);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`ошибка в build() диорамы «${d.meta.title}»: ${message}`, { cause: error });
	}
	w.world.pruneEmpty();
	const used = w.world.usedMaterials();
	return {
		world: w.world,
		materials: [...w.materialList],
		anchors: w.anchors,
		stats: {
			voxels: w.world.countVoxels(),
			chunks: w.world.chunks.size,
			materials: used.size,
			// Палитра диорамы регистрируется первой: её материал i имеет индекс i + 1.
			unusedPalette: Object.keys(d.palette).filter((_, i) => !used.has(i + 1)),
			outOfBounds: w.outOfBounds,
			anchors: Object.keys(w.anchors).length,
		},
	};
}

export async function bakeToVxb(
	d: Diorama,
): Promise<{ bytes: Uint8Array; stats: BakeStats & { bytes: number }; result: BakeResult }> {
	const result = bakeDiorama(d);
	const bytes = await encodeVxb(result);
	return { bytes, stats: { ...result.stats, bytes: bytes.length }, result };
}

export function bakeWarnings(stats: BakeStats & { bytes: number }): string[] {
	const warnings: string[] = [];
	if (stats.voxels === 0) warnings.push('мир пустой — build() не поставил ни одного вокселя');
	if (stats.outOfBounds > 0) {
		warnings.push(`${stats.outOfBounds} вокселей за границами size отброшено`);
	}
	if (stats.unusedPalette.length > 0) {
		warnings.push(`неиспользуемые материалы палитры: ${stats.unusedPalette.join(', ')}`);
	}
	if (stats.bytes > SIZE_WARN_BYTES) {
		const mb = (stats.bytes / 1024 / 1024).toFixed(1);
		warnings.push(`.vxb весит ${mb} МБ (> 2 МБ) — на мобилках будет грузиться долго`);
	}
	return warnings;
}
