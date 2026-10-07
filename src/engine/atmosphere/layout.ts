import type { Vec3 } from '../types.ts';
import { mulberry32 } from './random.ts';

export interface StarPlacement {
	direction: Vec3;
	size: number;
}

/** Звёзды на верхней полусфере (y > 0.05). */
export function starLayout(seed: number, count = 400): StarPlacement[] {
	const rnd = mulberry32(seed ^ 0x51ed270b);
	const stars: StarPlacement[] = [];
	while (stars.length < count) {
		const y = 0.05 + 0.95 * rnd();
		const a = rnd() * Math.PI * 2;
		const r = Math.sqrt(1 - y * y);
		stars.push({ direction: [r * Math.cos(a), y, r * Math.sin(a)], size: 0.6 + 0.8 * rnd() });
	}
	return stars;
}

export interface CloudLayout {
	angle: number;
	/** Доля радиуса неба по горизонтали. */
	distance: number;
	/** Доля радиуса неба по высоте. */
	height: number;
	/** Кубы облака в единицах «размера облака» (0..1). */
	boxes: Array<{ offset: Vec3; size: Vec3 }>;
}

/** Воксельные облака: 3–6 плоских кубов на кольце вокруг диорамы. */
export function cloudLayout(seed: number, count = 10): CloudLayout[] {
	const rnd = mulberry32(seed ^ 0x2c1b3c6d);
	return Array.from({ length: count }, (_, i) => {
		const n = 3 + Math.floor(rnd() * 4);
		const boxes = Array.from({ length: n }, () => ({
			offset: [rnd() - 0.5, rnd() * 0.15, (rnd() - 0.5) * 0.6] as Vec3,
			size: [0.25 + 0.25 * rnd(), 0.08 + 0.06 * rnd(), 0.18 + 0.2 * rnd()] as Vec3,
		}));
		return {
			angle: (i / count) * Math.PI * 2 + rnd() * 0.4,
			distance: 0.45 + 0.35 * rnd(),
			height: 0.06 + 0.1 * rnd(),
			boxes,
		};
	});
}
