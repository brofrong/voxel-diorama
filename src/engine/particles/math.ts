import type { EmitterSpec, Vec3 } from '../types.ts';

const TAU = Math.PI * 2;

const smoothstep = (a: number, b: number, x: number): number => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

export interface ParticleAge {
	age: number;
	/** Номер перерождения (для случайности новой жизни). */
	cycle: number;
	/** Доля жизни 0..1. */
	k: number;
}

/** Частица i из count появляется со сдвигом lifetime / count и перерождается каждые lifetime секунд. */
export function particleAge(
	t: number,
	index: number,
	count: number,
	lifetime: number,
): ParticleAge {
	const local = t - (index * lifetime) / count;
	const cycle = Math.floor(local / lifetime);
	const age = local - cycle * lifetime;
	return { age, cycle, k: age / lifetime };
}

/** Размер по кривой жизни: плавное появление и исчезновение (без прозрачности). */
export function particleScale(
	size: readonly [number, number],
	k: number,
	visibility: number,
): number {
	const s = size[0] + (size[1] - size[0]) * k;
	return s * smoothstep(0, 0.05, k) * (1 - smoothstep(0.85, 1, k)) * visibility;
}

export type EmitterMotion = Pick<
	EmitterSpec,
	'extent' | 'velocity' | 'jitter' | 'gravity' | 'wind'
>;

/** Положение без учёта земли; r1, r2 — случайные векторы частицы в [0, 1). */
export function particlePath(
	e: EmitterMotion,
	origin: Vec3,
	age: number,
	r1: Vec3,
	r2: Vec3,
): Vec3 {
	const p: Vec3 = [0, 0, 0];
	for (let i = 0; i < 3; i++) {
		p[i] =
			origin[i] +
			(r1[i] * 2 - 1) * e.extent[i] +
			(e.velocity[i] + (r2[i] * 2 - 1) * e.jitter[i]) * age;
	}
	p[1] += 0.5 * e.gravity * age * age;
	p[0] += Math.sin(age * e.wind.freq + r1[0] * TAU) * e.wind.amp;
	p[2] += Math.cos(age * e.wind.freq * 0.9 + r1[2] * TAU) * e.wind.amp;
	return p;
}

export function applyGround(
	e: Pick<EmitterSpec, 'groundRelative' | 'groundCull'>,
	p: Vec3,
	ground: number,
): { position: Vec3; visible: boolean } {
	const position: Vec3 = e.groundRelative ? [p[0], p[1] + ground, p[2]] : [p[0], p[1], p[2]];
	return { position, visible: !e.groundCull || position[1] >= ground };
}

/** Сколько частиц рисовать при плотности качества (минимум 1). */
export function instanceCount(count: number, density: number): number {
	return Math.max(1, Math.round(count * density));
}
