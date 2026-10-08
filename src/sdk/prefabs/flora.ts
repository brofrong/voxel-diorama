import type { Vec3 } from '../../engine/types.ts';
import type { ModelBuilder } from '../builder/model.ts';
import type { Rng } from '../rng.ts';

/** Три оттенка листвы/цветов: тёмный, основной, светлый. */
export type Shades = [dark: string, mid: string, light: string];

export interface TrunkSpec {
	/** Центр основания ствола (низ модели). */
	base: Vec3;
	height: number;
	/** Толщина у земли (радиус трубки). */
	radius: number;
	/** Сколько ветвей у вершины. */
	branches: number;
	/** Как далеко ветви уходят в стороны. */
	spread: number;
	/** Насколько концы ветвей выше вершины ствола (может быть отрицательным — ива). */
	rise: number;
	material: string;
}

/**
 * Ствол — изогнутая сужающаяся трубка, у вершины расходятся ветви. Возвращает точки,
 * вокруг которых растёт крона: вершину ствола и концы ветвей.
 */
export function trunk(m: ModelBuilder, rng: Rng, spec: TrunkSpec): Vec3[] {
	const [bx, by, bz] = spec.base;
	const lean = rng.float(0, Math.PI * 2);
	const tilt = rng.float(0.4, 1.4);
	const top: Vec3 = [bx + Math.cos(lean) * tilt, by + spec.height, bz + Math.sin(lean) * tilt];
	const mid: Vec3 = [
		bx - Math.cos(lean) * tilt * 0.4,
		by + spec.height * 0.5,
		bz - Math.sin(lean) * tilt * 0.4,
	];
	m.curve([spec.base, mid, top], spec.material, {
		radius: spec.radius,
		endRadius: Math.max(0.5, spec.radius * 0.55),
	});
	// Корни-«лапы» у земли: дерево стоит, а не воткнуто.
	for (let i = 0; i < 3; i++) {
		const a = lean + (i / 3) * Math.PI * 2 + rng.float(-0.4, 0.4);
		const r = spec.radius + rng.float(1, 2);
		m.curve(
			[
				[bx, by + 1.5, bz],
				[bx + Math.cos(a) * r, by, bz + Math.sin(a) * r],
			],
			spec.material,
		);
	}
	const tips: Vec3[] = [top];
	const start = rng.float(0, Math.PI * 2);
	for (let i = 0; i < spec.branches; i++) {
		const a = start + (i / spec.branches) * Math.PI * 2 + rng.float(-0.35, 0.35);
		const reach = spec.spread * rng.float(0.7, 1);
		const from: Vec3 = [
			top[0] + (mid[0] - top[0]) * 0.25,
			top[1] - spec.height * 0.2,
			top[2] + (mid[2] - top[2]) * 0.25,
		];
		const tip: Vec3 = [
			top[0] + Math.cos(a) * reach,
			top[1] + spec.rise * rng.float(0.6, 1.2),
			top[2] + Math.sin(a) * reach,
		];
		const bend: Vec3 = [
			(from[0] + tip[0]) / 2,
			Math.max(from[1], tip[1]) + 0.5,
			(from[2] + tip[2]) / 2,
		];
		m.curve([from, bend, tip], spec.material, {
			radius: Math.max(0.5, spec.radius * 0.5),
			endRadius: 0,
		});
		tips.push(tip);
	}
	return tips;
}

export interface CanopySpec {
	/** Радиус одного «облака» кроны. */
	radius: number;
	/** Сплющенность по вертикали: 1 — шар, 0.6 — приплюснутая шапка. */
	flatten: number;
	shades: Shades;
	/** Крупность пятен оттенков. */
	scale?: number;
}

/** Крона: бугристые «облака» вокруг точек, затем пятна трёх оттенков (низ темнее). */
export function canopy(
	m: ModelBuilder,
	rng: Rng,
	centers: readonly Vec3[],
	spec: CanopySpec,
): void {
	const [dark, mid, light] = spec.shades;
	for (const c of centers) {
		const r = spec.radius * rng.float(0.8, 1.1);
		m.blob(c, [r, r * spec.flatten, r], mid, { roughness: 0.35, seed: rng.int(0, 2 ** 30) });
	}
	const [sx, sy, sz] = m.size;
	m.shade([0, 0, 0], [sx - 1, sy - 1, sz - 1], [dark, mid, mid, light], {
		only: mid,
		scale: spec.scale ?? 3,
		speckle: 0.25,
		seed: rng.int(0, 2 ** 30),
	});
	// Нижняя кромка кроны в тени — темнее: так объём читается даже без освещения.
	for (let z = 0; z < sz; z++) {
		for (let y = 1; y < sy; y++) {
			for (let x = 0; x < sx; x++) {
				const here = m.get([x, y, z]);
				if ((here === mid || here === light) && m.get([x, y - 1, z]) === null && rng.chance(0.6)) {
					m.set([x, y, z], dark);
				}
			}
		}
	}
}

/** Свисающие с нижней кромки воксели (лепестки, листья, пряди): «тяжёлая» живая крона. */
export function drip(
	m: ModelBuilder,
	rng: Rng,
	from: readonly string[],
	materials: readonly string[],
	chance: number,
	maxLength: number,
): void {
	const [sx, sy, sz] = m.size;
	const starts: Vec3[] = [];
	for (let z = 0; z < sz; z++) {
		for (let y = 1; y < sy; y++) {
			for (let x = 0; x < sx; x++) {
				const here = m.get([x, y, z]);
				if (here !== null && from.includes(here) && m.get([x, y - 1, z]) === null) {
					starts.push([x, y - 1, z]);
				}
			}
		}
	}
	for (const [x, y, z] of starts) {
		if (!rng.chance(chance)) continue;
		const length = rng.int(1, maxLength);
		const material = rng.pick(materials);
		for (let i = 0; i < length && y - i >= 1 && m.get([x, y - i, z]) === null; i++) {
			m.set([x, y - i, z], material);
		}
	}
}
