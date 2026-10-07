import type { Vec3 } from '../../engine/types.ts';
import { buildHeightmap } from '../../engine/voxel/heightmap.ts';
import type { BakeResult } from '../bake.ts';
import type { Diorama } from '../schema.ts';
import { createEntityRuntime, ENTITY_LIMITS } from './runtime.ts';

export interface EntityStats {
	entities: number;
	instances: number;
	parts: number;
	/** Скачки высоты ходоков (вероятный проход по крыше/кроне/оси). */
	warnings: string[];
}

/** Порог «скачка» по высоте между соседними шагами сетки, единиц мира. */
const HEIGHT_JUMP = 2;
/** Насколько должна совпасть y с землёй на предыдущем шаге, чтобы считать экземпляр «ходоком». */
const GROUNDED_TOLERANCE = 0.05;

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
	const warnings: string[] = [];
	for (const instance of instances) {
		let prev: Vec3 | null = null;
		for (let step = 0; step <= 20; step++) {
			const t = step / 2;
			let pose: ReturnType<typeof instance.pose>;
			try {
				pose = instance.pose(t);
				const numbers = [...pose.position, ...pose.rotation, pose.lift, ...pose.parts.flat()];
				if (!numbers.every(Number.isFinite)) throw new Error('в позе NaN или Infinity');
			} catch (error) {
				const text = error instanceof Error ? error.message : String(error);
				throw new Error(`сущность ${instance.id}, t=${t}: ${text}`, { cause: error });
			}
			// Только для «ходоков»: экземпляр, чья y на предыдущем шаге стояла на земле. Иначе
			// птицы (fly) и лодка (плавает над якорем) дают ложные срабатывания.
			if (prev) {
				const grounded = Math.abs(prev[1] - groundAt(prev[0], prev[2])) <= GROUNDED_TOLERANCE;
				const dy = pose.position[1] - prev[1];
				const horizontal = Math.hypot(pose.position[0] - prev[0], pose.position[2] - prev[2]);
				if (grounded && horizontal < HEIGHT_JUMP && Math.abs(dy) > HEIGHT_JUMP) {
					warnings.push(
						`сущность ${instance.id}, t=${t}: скачок высоты ${dy.toFixed(1)} — маршрут идёт по крыше/кроне/оси?`,
					);
				}
			}
			prev = pose.position;
		}
	}
	return {
		entities: d.entities.length,
		instances: instances.length,
		parts: instances.reduce((n, i) => n + i.parts.length, 0),
		warnings,
	};
}

export function entityWarnings(stats: EntityStats): string[] {
	const warnings = [...stats.warnings];
	if (stats.instances > ENTITY_LIMITS.instances * 0.8) {
		warnings.push(`экземпляров сущностей ${stats.instances} из ${ENTITY_LIMITS.instances}`);
	}
	if (stats.parts > ENTITY_LIMITS.parts * 0.8) {
		warnings.push(`частей сущностей ${stats.parts} из ${ENTITY_LIMITS.parts}`);
	}
	return warnings;
}
