import { buildHeightmap } from '../../engine/voxel/heightmap.ts';
import type { BakeResult } from '../bake.ts';
import type { Diorama } from '../schema.ts';
import { createEntityRuntime, ENTITY_LIMITS } from './runtime.ts';

export interface EntityStats {
	entities: number;
	instances: number;
	parts: number;
}

/** Прогоняет сущности на запечённом мире (t = 0..10 с шагом 0.5). Бросает понятную ошибку. */
export function checkEntities(
	d: Diorama,
	baked: Pick<BakeResult, 'world' | 'materials' | 'anchors'>,
): EntityStats {
	const { groundAt } = buildHeightmap(baked.world, baked.materials);
	const instances = createEntityRuntime(d.entities, {
		seed: d.seed,
		anchors: baked.anchors,
		groundAt,
	});
	for (const instance of instances) {
		for (let step = 0; step <= 20; step++) {
			const t = step / 2;
			try {
				const pose = instance.pose(t);
				const numbers = [...pose.position, ...pose.rotation, pose.lift, ...pose.parts.flat()];
				if (!numbers.every(Number.isFinite)) throw new Error('в позе NaN или Infinity');
			} catch (error) {
				const text = error instanceof Error ? error.message : String(error);
				throw new Error(`сущность ${instance.id}, t=${t}: ${text}`, { cause: error });
			}
		}
	}
	return {
		entities: d.entities.length,
		instances: instances.length,
		parts: instances.reduce((n, i) => n + i.parts.length, 0),
	};
}

export function entityWarnings(stats: EntityStats): string[] {
	const warnings: string[] = [];
	if (stats.instances > ENTITY_LIMITS.instances * 0.8) {
		warnings.push(`экземпляров сущностей ${stats.instances} из ${ENTITY_LIMITS.instances}`);
	}
	if (stats.parts > ENTITY_LIMITS.parts * 0.8) {
		warnings.push(`частей сущностей ${stats.parts} из ${ENTITY_LIMITS.parts}`);
	}
	return warnings;
}
