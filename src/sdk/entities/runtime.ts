import type {
	EntityInstance,
	EntityPartSpec,
	Vec3,
	VoxelModelData,
	WorldContext,
} from '../../engine/types.ts';
import type { Model } from '../builder/model.ts';
import { createRng } from '../rng.ts';
import type { Diorama } from '../schema.ts';
import { poseRig } from './rig.ts';
import {
	type BehaviourContext,
	type Pose,
	type PoseFn,
	type ResolvedPoint,
	resolvePoint,
	toRadians,
} from './types.ts';

export const ENTITY_LIMITS = { instances: 256, parts: 600, modelSize: 64 } as const;

export type EntityDef = Diorama['entities'][number];

const message = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

function toModelData(m: Model): VoxelModelData {
	return {
		size: m.size,
		data: m.data,
		materials: m.materials.map((x) => x.material),
		scale: m.scale,
		pivot: m.pivot,
	};
}

/** Разворачивает описания сущностей в экземпляры для движка. Ошибки называют сущность. */
export function createEntityRuntime(
	entities: readonly EntityDef[],
	options: WorldContext & { seed: number },
): EntityInstance[] {
	const total = entities.reduce((n, e) => n + e.count, 0);
	if (total > ENTITY_LIMITS.instances) {
		throw new Error(
			`слишком много экземпляров сущностей: ${total} (максимум ${ENTITY_LIMITS.instances})`,
		);
	}
	const anchorNames = Object.keys(options.anchors);
	const anchor = (name: string): Vec3 => {
		const p = options.anchors[name];
		if (!p) {
			throw new Error(`неизвестный якорь "${name}". Есть: ${anchorNames.join(', ') || '(нет)'}`);
		}
		return [p[0], p[1], p[2]];
	};
	const root = createRng(options.seed ^ 0x2545f491);
	const out: EntityInstance[] = [];
	let parts = 0;

	entities.forEach((e, ei) => {
		const label = e.id ?? `#${ei + 1}`;
		const groupSeed = root.int(0, 2 ** 31 - 1);
		const group = createRng(groupSeed);
		let specs: EntityPartSpec[];
		if (e.model) {
			specs = [{ name: 'model', model: toModelData(e.model), parent: -1, attach: [0, 0, 0] }];
		} else if (e.rig) {
			specs = e.rig.parts.map((p) => ({
				name: p.name,
				model: toModelData(p.model),
				parent: p.parent,
				attach: p.attach,
			}));
		} else {
			throw new Error(`сущность ${label}: нужно ровно одно из model или rig`);
		}
		for (const spec of specs) {
			if (spec.model.size.some((s) => s > ENTITY_LIMITS.modelSize)) {
				throw new Error(`сущность ${label}: модель больше ${ENTITY_LIMITS.modelSize}³`);
			}
		}
		parts += specs.length * e.count;
		if (parts > ENTITY_LIMITS.parts) {
			throw new Error(`слишком много частей сущностей: больше ${ENTITY_LIMITS.parts}`);
		}
		const rigDef = e.rig;
		const yaw = toRadians(e.rotate);
		for (let i = 0; i < e.count; i++) {
			const ctx: BehaviourContext = {
				index: i,
				count: e.count,
				rng: group.fork(),
				groupSeed,
				groundAt: options.groundAt,
				anchor,
			};
			let base: ResolvedPoint | null;
			let fns: PoseFn[];
			try {
				base = e.at === undefined ? null : resolvePoint(e.at, ctx);
				fns = e.animate.map((b) => b.create(ctx));
			} catch (error) {
				throw new Error(`сущность ${label}: ${message(error)}`, { cause: error });
			}
			out.push({
				id: e.count > 1 ? `${label}[${i}]` : label,
				parts: specs,
				pose(t) {
					const position: Vec3 = base
						? [base.position[0], base.position[1], base.position[2]]
						: [0, 0, 0];
					if (base?.grounded) position[1] = options.groundAt(position[0], position[2]);
					const pose: Pose = { position, rotation: [0, yaw, 0], gait: 'idle', stride: 0 };
					for (const fn of fns) fn(pose, t);
					if (!rigDef) {
						return {
							position: pose.position,
							rotation: pose.rotation,
							lift: 0,
							parts: [[0, 0, 0]],
						};
					}
					const rp = poseRig(rigDef, pose.gait, pose.stride, t);
					return {
						position: pose.position,
						rotation: pose.rotation,
						lift: rigDef.rootLift + rp.lift,
						parts: rp.parts,
					};
				},
			});
		}
	});
	return out;
}
