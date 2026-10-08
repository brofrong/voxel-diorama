import type { Vec3 } from '../../engine/types.ts';
import type { Rng } from '../rng.ts';

export type Gait = 'idle' | 'walk' | 'fly';

/** `[x, z]` — на земле; `[x, y, z]` — точно; строка — якорь (`well`, `mill.hub`). */
export type Point = readonly [number, number] | readonly [number, number, number] | string;

export interface Pose {
	position: Vec3;
	/** Радианы, Euler YXZ: [pitch (x), yaw (y), roll (z)]. При yaw 0 лицо смотрит в +z. */
	rotation: Vec3;
	gait: Gait;
	/** Пройденное расстояние — фаза шага rig'а. */
	stride: number;
	/** Длина шага rig'а (ед. мира); у моделей — 1. Только для чтения. */
	readonly strideLength: number;
	/**
	 * Повороты частей rig'а (радианы, Euler XYZ) по имени части — их задаёт `limbs()`.
	 * Прибавляются к встроенной походке; части из `replace` её заменяют.
	 */
	parts: Record<string, Vec3>;
	/** Части, у которых встроенная походка выключена (`limbs({ …, replace: true })`). */
	replace: Set<string>;
}

export interface BehaviourContext {
	/** Номер экземпляра 0..count-1. */
	index: number;
	count: number;
	/** Свой у каждого экземпляра, детерминирован по seed диорамы. */
	rng: Rng;
	/** Общий seed всех экземпляров одной сущности (групповые поведения, `flock`). */
	groupSeed: number;
	/** y поверхности (над верхним твёрдым вокселем). */
	groundAt(x: number, z: number): number;
	/** Мировые координаты якоря; неизвестное имя — исключение. */
	anchor(name: string): Vec3;
}

export type PoseFn = (pose: Pose, t: number) => void;

export interface Behaviour {
	readonly kind: string;
	/** Задаёт ли поведение позицию (иначе сущности нужен `at`). */
	readonly positional: boolean;
	create(ctx: BehaviourContext): PoseFn;
}

export function isBehaviour(value: unknown): value is Behaviour {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Partial<Behaviour>;
	return (
		typeof v.kind === 'string' &&
		typeof v.positional === 'boolean' &&
		typeof v.create === 'function'
	);
}

export interface ResolvedPoint {
	position: Vec3;
	/** true — высота берётся из земли (и пересчитывается при движении). */
	grounded: boolean;
}

export function resolvePoint(
	point: Point,
	ctx: Pick<BehaviourContext, 'groundAt' | 'anchor'>,
): ResolvedPoint {
	if (typeof point === 'string') {
		const p = ctx.anchor(point);
		return { position: [p[0], p[1], p[2]], grounded: false };
	}
	if (point.length === 2) {
		const [x, z] = point;
		return { position: [x, ctx.groundAt(x, z), z], grounded: true };
	}
	const [x, y, z] = point;
	return { position: [x, y, z], grounded: false };
}

export const TAU = Math.PI * 2;

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

/** yaw, при котором лицо (+z) смотрит вдоль (dx, dz). */
export const yawOf = (dx: number, dz: number): number => Math.atan2(dx, dz);
