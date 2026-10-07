import { buildHeightmap } from '../../engine/voxel/heightmap.ts';
import type { BakeResult } from '../bake.ts';
import { createEntityRuntime } from '../entities/runtime.ts';
import type { Diorama } from '../schema.ts';
import { ATMOSPHERE_LIMITS, createAtmosphereRuntime } from './runtime.ts';

export interface AtmosphereStats {
	emitters: number;
	/** Частиц на качестве high. */
	particles: number;
	lights: number;
}

/** Разворачивает частицы и свет на запечённом мире, как это сделает вьюер. Бросает понятную ошибку. */
export function checkAtmosphere(
	d: Diorama,
	baked: Pick<BakeResult, 'world' | 'materials' | 'anchors'>,
): AtmosphereStats {
	const { groundAt } = buildHeightmap(baked.world, baked.materials);
	const context = { anchors: baked.anchors, groundAt };
	const entityIds = createEntityRuntime(d.entities, { seed: d.seed, ...context }).map((i) => i.id);
	const spec = createAtmosphereRuntime(d, { ...context, size: d.size, entityIds });
	return {
		emitters: spec.emitters.length,
		particles: spec.emitters.reduce((n, e) => n + e.count, 0),
		lights: spec.lights.length,
	};
}

export function atmosphereWarnings(stats: AtmosphereStats): string[] {
	const warnings: string[] = [];
	if (stats.emitters > ATMOSPHERE_LIMITS.emitters * 0.8) {
		warnings.push(`эмиттеров частиц ${stats.emitters} из ${ATMOSPHERE_LIMITS.emitters}`);
	}
	if (stats.particles > ATMOSPHERE_LIMITS.particles * 0.8) {
		warnings.push(
			`частиц ${stats.particles} из ${ATMOSPHERE_LIMITS.particles} — на телефонах будет тяжело`,
		);
	}
	if (stats.lights > ATMOSPHERE_LIMITS.lights * 0.8) {
		warnings.push(`источников света ${stats.lights} из ${ATMOSPHERE_LIMITS.lights}`);
	}
	return warnings;
}
