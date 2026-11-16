import { type Behaviour, custom, type Model, model, type Vec3 } from '#sdk';
import { hash } from './hut.ts';

const TAU = Math.PI * 2;
const fract = (v: number): number => v - Math.floor(v);

/** Язык пламени: светящийся воксельный факел, оживает вращением и дрожью. */
export function flame(height: number): Model {
	const w = 5;
	return model(
		{
			size: [w, height, w],
			palette: {
				core: { color: '#fff0a8', emissive: 1.7, vary: 0 },
				mid: { color: '#ffb02e', emissive: 1.4, vary: 0.04 },
				tip: { color: '#ff5a1a', emissive: 1.1, vary: 0.06 },
			},
		},
		(m) => {
			for (let y = 0; y < height; y++) {
				const k = y / (height - 1);
				const r = 2.3 * (1 - k) ** 0.8 + 0.25;
				// пламя изгибается вбок — при вращении силуэт меняется
				const bx = 2 + Math.round(1.1 * Math.sin(k * 3.2));
				const bz = 2 + Math.round(0.9 * Math.sin(k * 2.1 + 1.3));
				for (let z = 0; z < w; z++) {
					for (let x = 0; x < w; x++) {
						const d = Math.hypot(x - bx, z - bz);
						if (d > r) continue;
						if (hash(x, y, z) < 0.12 && d > r - 1) continue;
						m.set([x, y, z], k > 0.62 ? 'tip' : d < r * 0.45 && k < 0.5 ? 'core' : 'mid');
					}
				}
			}
		},
	);
}

/** Клуб дыма: бугристый шарик. */
export function puff(size: number, dark: string, light: string, emissive = 0): Model {
	const n = size * 2 + 1;
	return model(
		{
			size: [n, n, n],
			pivot: [n / 2, n / 2, n / 2],
			palette: {
				dark: { color: dark, emissive, vary: 0.08 },
				light: { color: light, emissive, vary: 0.08 },
			},
		},
		(m) => {
			m.blob([size, size, size], size, 'dark', { roughness: 0.45, scale: 2.5, seed: size * 7 });
			for (let z = 0; z < n; z++) {
				for (let y = 0; y < n; y++) {
					for (let x = 0; x < n; x++) {
						if (m.get([x, y, z]) === 'dark' && (y > size || hash(x, y, z) < 0.3)) {
							m.set([x, y, z], 'light');
						}
					}
				}
			}
		},
	);
}

/** Дрожание пламени: вращение, пульс по высоте, покачивание. */
export const flicker: Behaviour = custom((pose, t, ctx) => {
	const s = ctx.index * 2.3;
	pose.rotation[1] = t * (2.6 + 0.5 * ctx.index) + s;
	pose.rotation[0] = 0.16 * Math.sin(t * 5.3 + s);
	pose.rotation[2] = 0.16 * Math.sin(t * 4.1 + s * 1.7);
	pose.position[1] += 0.55 * Math.sin(t * 8.7 + s) + 0.3 * Math.sin(t * 13.1 + s * 3);
});

export interface RiseOptions {
	/** Откуда поднимается столб (может двигаться). */
	origin: (t: number) => Vec3;
	/** Полная высота столба и время подъёма. */
	height: number;
	period: number;
	/** Какую часть высоты занимает этот размер клуба: [от, до] в долях 0..1. */
	band: readonly [number, number];
	/** Снос ветром на вершине столба. */
	drift: readonly [number, number];
	phase?: number;
}

/**
 * Клубы поднимаются столбом и тают: три сущности с клубами разного размера
 * делят высоту на полосы, поэтому один и тот же клуб «уменьшается» по пути вверх.
 */
export function rise(o: RiseOptions): Behaviour {
	return custom((pose, t, ctx) => {
		const u = fract(t / o.period + ctx.index / ctx.count + (o.phase ?? 0));
		if (u < o.band[0] || u >= o.band[1]) {
			pose.position[1] = -500;
			return;
		}
		const base = o.origin(t - u * o.period * 0.15);
		const s = ctx.index * 1.9;
		const spread = 0.4 + 2.2 * u;
		pose.position[0] = base[0] + o.drift[0] * u * u + spread * Math.sin(u * 7 + s);
		pose.position[1] = base[1] + o.height * u;
		pose.position[2] = base[2] + o.drift[1] * u * u + spread * Math.cos(u * 5.5 + s * 1.3);
		pose.rotation[1] = t * 0.7 + s;
		pose.rotation[0] = 0.4 * Math.sin(u * TAU + s);
	});
}
