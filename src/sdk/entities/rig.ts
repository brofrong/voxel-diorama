import type { Vec3 } from '../../engine/types.ts';
import type { Model } from '../builder/model.ts';
import { type Gait, TAU, toRadians } from './types.ts';

/**
 * `biped`/`quadruped`/`bird` — фиксированные части и встроенная походка.
 * `custom` — любые части и иерархия (змея, паук, дракон, робот); движение частей задаёт
 * поведение `limbs()`.
 */
export type Skeleton = 'biped' | 'quadruped' | 'bird' | 'custom';

export interface RigPartInput {
	model: Model;
	/** Имя родительской части; у корня `body` — нет. */
	parent?: string;
	/** Точка крепления в вокселях родителя (сюда встаёт pivot части). */
	at?: Vec3;
}

export interface RigOptions {
	skeleton: Skeleton;
	/** Размер вокселя частей в единицах мира; переопределяет scale моделей. */
	scale?: number;
	/** Корень и его части: у корня нет parent, у остальных — parent и at. */
	parts: Record<string, RigPartInput>;
	/**
	 * Длина шага в единицах мира (фаза `stride` для `limbs`). У встроенных скелетов — 2 длины
	 * ноги; у `custom` по умолчанию — 2 высоты корня над землёй.
	 */
	stride?: number;
}

/** Имя части свободного скелета: латиница с маленькой буквы. */
const PART_NAME_RE = /^[a-z][a-zA-Z0-9_-]*$/;
/** Частей в одном свободном скелете. */
export const CUSTOM_RIG_MAX_PARTS = 48;

export interface RigPart {
	name: string;
	model: Model;
	/** Индекс родителя в `parts`, у корня −1. */
	parent: number;
	/** Смещение pivot части от pivot родителя, единицы мира. */
	attach: Vec3;
}

export interface Rig {
	readonly kind: 'rig';
	readonly skeleton: Skeleton;
	readonly scale: number;
	/** Части от корня к листьям (родитель всегда раньше ребёнка). Корень — `parts[0]`. */
	readonly parts: readonly RigPart[];
	/** На сколько поднять pivot корня, чтобы нижний воксель в покое стоял на y позы. */
	readonly rootLift: number;
	/** Длина шага (2 × длина ноги), единицы мира. */
	readonly strideLength: number;
}

const REQUIRED: Record<Skeleton, readonly string[]> = {
	biped: ['body', 'head', 'armL', 'armR', 'legL', 'legR'],
	quadruped: ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR'],
	bird: ['body', 'wingL', 'wingR'],
	custom: [],
};

const OPTIONAL: Record<Skeleton, readonly string[]> = {
	biped: [],
	quadruped: ['tail'],
	bird: ['head', 'tail'],
	custom: [],
};

export function isRig(value: unknown): value is Rig {
	return (
		typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'rig'
	);
}

export function rig(options: RigOptions): Rig {
	const { skeleton, parts } = options;
	const scale = options.scale ?? 0.25;
	if (!(Number.isFinite(scale) && scale > 0 && scale <= 1)) {
		throw new Error(`rig: scale должен быть в (0, 1], получено ${scale}`);
	}
	const names = Object.keys(parts);
	let root = 'body';
	if (skeleton === 'custom') {
		if (names.length === 0) throw new Error('rig custom: нет ни одной части');
		if (names.length > CUSTOM_RIG_MAX_PARTS) {
			throw new Error(`rig custom: частей ${names.length} (максимум ${CUSTOM_RIG_MAX_PARTS})`);
		}
		for (const name of names) {
			if (!PART_NAME_RE.test(name)) {
				throw new Error(`rig custom: имя части "${name}" — латиница с маленькой буквы`);
			}
		}
		const roots = names.filter((n) => parts[n].parent === undefined);
		if (roots.length !== 1) {
			throw new Error(
				`rig custom: нужен ровно один корень (часть без parent), найдено: ${roots.join(', ') || 'ни одного'}`,
			);
		}
		root = roots[0];
	} else {
		const allowed = [...REQUIRED[skeleton], ...OPTIONAL[skeleton]];
		for (const name of names) {
			if (!allowed.includes(name)) {
				throw new Error(
					`rig ${skeleton}: неизвестная часть "${name}". Допустимы: ${allowed.join(', ')} (или skeleton: 'custom')`,
				);
			}
		}
		for (const name of REQUIRED[skeleton]) {
			if (!(name in parts)) throw new Error(`rig ${skeleton}: нет части "${name}"`);
		}
		if (parts.body.parent !== undefined)
			throw new Error('rig: body — корень, у него не должно быть parent');
	}
	for (const name of names) {
		if (name === root) continue;
		const part = parts[name];
		if (part.parent === undefined) {
			throw new Error(`rig: у части "${name}" нет parent`);
		}
		if (!(part.parent in parts)) {
			throw new Error(`rig: у части "${name}" неизвестный parent "${part.parent}"`);
		}
		if (!part.at) throw new Error(`rig: у части "${name}" нет at (точки крепления)`);
	}

	const order = [root];
	const placed = new Set(order);
	let progress = true;
	while (order.length < names.length && progress) {
		progress = false;
		for (const name of names) {
			const parent = parts[name].parent;
			if (!placed.has(name) && parent !== undefined && placed.has(parent)) {
				order.push(name);
				placed.add(name);
				progress = true;
			}
		}
	}
	if (order.length < names.length) {
		throw new Error(`rig: цикл в связях частей: ${names.filter((n) => !placed.has(n)).join(', ')}`);
	}

	const indexOf = new Map(order.map((name, i) => [name, i]));
	const rigParts: RigPart[] = order.map((name) => {
		const input = parts[name];
		const partModel: Model = { ...input.model, scale };
		if (input.parent === undefined || !input.at) {
			return { name, model: partModel, parent: -1, attach: [0, 0, 0] };
		}
		const parentPivot = parts[input.parent].model.pivot;
		return {
			name,
			model: partModel,
			parent: indexOf.get(input.parent) ?? -1,
			attach: [
				(input.at[0] - parentPivot[0]) * scale,
				(input.at[1] - parentPivot[1]) * scale,
				(input.at[2] - parentPivot[2]) * scale,
			],
		};
	});

	const offsets: Vec3[] = [];
	let minY = Number.POSITIVE_INFINITY;
	for (const part of rigParts) {
		const base: Vec3 = part.parent < 0 ? [0, 0, 0] : offsets[part.parent];
		const offset: Vec3 = [
			base[0] + part.attach[0],
			base[1] + part.attach[1],
			base[2] + part.attach[2],
		];
		offsets.push(offset);
		minY = Math.min(minY, offset[1] - part.model.pivot[1] * scale);
	}

	const legName = skeleton === 'biped' ? 'legL' : skeleton === 'quadruped' ? 'legFL' : 'body';
	const leg = rigParts.find((p) => p.name === legName) ?? rigParts[0];
	const stride =
		options.stride ??
		(skeleton === 'custom' ? Math.max(2 * -minY, scale * 2) : 2 * leg.model.size[1] * scale);
	if (!(Number.isFinite(stride) && stride > 0)) {
		throw new Error(`rig: stride должен быть > 0, получено ${stride}`);
	}
	return {
		kind: 'rig',
		skeleton,
		scale,
		parts: rigParts,
		rootLift: -minY,
		strideLength: stride,
	};
}

export interface RigPose {
	/** Повороты частей (радианы), индексы как в `rig.parts`. */
	parts: Vec3[];
	/** Подъём корня, единицы мира. */
	lift: number;
}

/** Процедурная поза rig'а: walk — по пройденному пути, idle/fly — по времени. */
export function poseRig(r: Rig, gait: Gait, stride: number, t: number): RigPose {
	const parts: Vec3[] = r.parts.map(() => [0, 0, 0]);
	const set = (name: string, axis: 0 | 1 | 2, value: number): void => {
		const i = r.parts.findIndex((p) => p.name === name);
		if (i >= 0) parts[i][axis] = value;
	};
	const breath = 0.25 * r.scale * (0.5 - 0.5 * Math.cos((TAU * t) / 3));
	let lift = 0;
	switch (r.skeleton) {
		case 'biped': {
			if (gait === 'walk') {
				const s = Math.sin((TAU * stride) / r.strideLength);
				set('legL', 0, toRadians(35) * s);
				set('legR', 0, -toRadians(35) * s);
				set('armL', 0, -toRadians(25) * s);
				set('armR', 0, toRadians(25) * s);
				lift = Math.abs(s) * 0.5 * r.scale;
			} else {
				lift = breath;
				set('head', 1, toRadians(10) * Math.sin((TAU * t) / 5));
			}
			break;
		}
		case 'quadruped': {
			if (gait === 'walk') {
				const s = Math.sin((TAU * stride) / r.strideLength);
				set('legFL', 0, toRadians(30) * s);
				set('legBR', 0, toRadians(30) * s);
				set('legFR', 0, -toRadians(30) * s);
				set('legBL', 0, -toRadians(30) * s);
				set('tail', 1, toRadians(10) * s);
			} else {
				lift = breath;
				set('tail', 1, toRadians(20) * Math.sin((TAU * t) / 1.5));
				set('head', 1, toRadians(10) * Math.sin((TAU * t) / 5));
			}
			break;
		}
		case 'bird': {
			if (gait === 'fly') {
				const f = Math.sin(TAU * 4 * t);
				set('wingL', 2, toRadians(60) * f);
				set('wingR', 2, -toRadians(60) * f);
			} else {
				set('head', 0, toRadians(20) * Math.max(0, Math.sin((TAU * t) / 2)) ** 4);
			}
			break;
		}
	}
	return { parts, lift };
}
